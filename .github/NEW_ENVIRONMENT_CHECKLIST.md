# 📋 SOP & Master Checklist: Onboarding a New Deployment Environment

When onboarding a new environment (e.g., `AIS-02`, `VMOS`, `APM-02 DC`, `APM-02 DC AddIn`), updates must be applied across **GCP Bot**, **GitHub Secrets**, **GitHub Actions Workflows**, and **Scripts** simultaneously. 

> [!CAUTION]
> **Never proceed partially.** Skipping even a single file or secret causes silent failures (e.g. notifications only landing in the Global channel, `jq` crashes, or skipped jobs).
> Always review **Section 4: Common Pitfalls & Prevention Checklist** before testing.

---

## 1. Secrets & Infrastructure Prerequisites

| Location | Key / Variable | Description |
| :--- | :--- | :--- |
| **GitHub Secrets** | `TEAMS_WEBHOOK_<ENV>_1` (and `_2`, `_3`) | Incoming webhook for the dedicated MS Teams channel. |
| **GCP Cloud Run / Functions** | `TEAMS_WEBHOOK_<ENV>_1` | Environment variable in Cloud Run/Function for bot responses. |
| **Git Branches** | Base branch (`main`, `main-dc`, etc.) | Must exist and **must be updated with the latest `.github/workflows` from `main`**. |
| **Git Branches** | Tenant branch (`tenant/...`) | Must exist on `origin`. |

---

## 2. Complete Code Modification Checklist

### A. GCP Bot Configuration (`gcp/environments.js`)
- [ ] Add the environment object to the `ENVIRONMENTS` array in `gcp/environments.js`:
  - `id`: Unique identifier (e.g., `'apm02_dc'`)
  - `name`: Human-readable name (e.g., `'APM-02 DC'`)
  - `channelId`: MS Teams channel ID (e.g., `'19:...@thread.tacv2'`)
  - `channelName`: Exact channel name in MS Teams
  - `tenantBranch`: Target tenant branch (e.g., `'tenant/asint-apm-02-dc'`)
  - `aliases`: Array of lowercase user inputs to match this environment
  - `webhookEnvVar`: Name of the webhook secret (e.g., `'TEAMS_WEBHOOK_APM02_DC_1'`)
  - **For Snapshot-based Deployments (APM-02 Family)**:
    - `isApm02: true`
    - `baseBranch`: e.g. `'main-dc'`
    - `snapshotPrefix`: e.g. `'snapshot/main-dc-'`
    - `dispatchEvent`: `'trigger_apm02_dc_deployment'`
    - `adjustDispatchEvent`: `'adjust_apm02_dc_wait'`
    - `retriggerDispatchEvent`: `'retrigger_apm02_dc_deployment'`
    - `redeployFixDispatchEvent`: `'redeploy_apm02_dc_fix'`
    - `labelPrefix`: `'APM-02 DC'`
  - **For Direct Deployments (Legacy Family)**:
    - `dispatchEvent`: `'trigger_<env>_deployment'`
- [ ] Deploy new revision of GCP Cloud Run / Cloud Function and verify with `node gcp/test_routing.js`.

---

### B. SAP CI/CD Webhook & Notification Service (*CRITICAL*)
*Failure here causes SAP CI/CD Started/Finished cards to fall back to the Global channel only.*

- [ ] **`.github/workflows/sap_cicd_notifier.yml`**:
  - [ ] Add the SAP CI/CD job name to the `resource_name` dropdown options in `workflow_dispatch`.
  - [ ] Under `jobs.notify.steps.process.env`, pass the webhook secrets:
    ```yaml
    TEAMS_WEBHOOK_<ENV>_1: ${{ secrets.TEAMS_WEBHOOK_<ENV>_1 }}
    TEAMS_WEBHOOK_<ENV>_2: ${{ secrets.TEAMS_WEBHOOK_<ENV>_2 }}
    TEAMS_WEBHOOK_<ENV>_3: ${{ secrets.TEAMS_WEBHOOK_<ENV>_3 }}
    ```
- [ ] **`.github/scripts/notify_sap_event.sh`**:
  - [ ] Add the SAP CI/CD job name to `ALLOWED_JOBS` array (e.g., `"AsInt-APM-02-DC"`).
  - [ ] Add the tenant branch mapping to `TARGET_BRANCH` case block:
    ```bash
    "AsInt-<ENV>")
      TARGET_BRANCH="tenant/asint-<env>"
      ;;
    ```
  - [ ] Add routing to `TARGET_WEBHOOKS` in the `case "$NORM_ENV" in` block. **Must handle both `asint<env>` and `<env>`**:
    ```bash
    "asint<norm_env>"|"<norm_env>")
      [ -n "$TEAMS_WEBHOOK_<ENV>_1" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_<ENV>_1")
      [ -n "$TEAMS_WEBHOOK_<ENV>_2" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_<ENV>_2")
      [ -n "$TEAMS_WEBHOOK_<ENV>_3" ] && TARGET_WEBHOOKS+=("$TEAMS_WEBHOOK_<ENV>_3")
      ;;
    ```
- [ ] **`.github/workflows/simulate_sap_webhook.yml`**:
  - [ ] Add the job name to `resource_name` options for testing.

---

### C. Snapshot Pipeline (For APM-02 Family Environments)
*Applies to Core, DC, DC AddIn, and any new snapshot-based environments.*

- [ ] **`.github/workflows/_apm02_notify.yml`**:
  - [ ] Add target webhook routing under `# Send to configured environment webhook URLs`:
    ```bash
    elif echo "$ENV_NAME" | grep -qi "<env_keyword>"; then
      [ -n "${{ secrets.TEAMS_WEBHOOK_<ENV>_1 }}" ] && TARGET_WEBHOOKS+=("${{ secrets.TEAMS_WEBHOOK_<ENV>_1 }}")
      [ -n "${{ secrets.TEAMS_WEBHOOK_<ENV>_2 }}" ] && TARGET_WEBHOOKS+=("${{ secrets.TEAMS_WEBHOOK_<ENV>_2 }}")
      [ -n "${{ secrets.TEAMS_WEBHOOK_<ENV>_3 }}" ] && TARGET_WEBHOOKS+=("${{ secrets.TEAMS_WEBHOOK_<ENV>_3 }}")
    ```
  - [ ] **JQ Variable Binding Rule**: Whenever using `\($env_name)` or any other variable inside a `jq` template, **every** `jq -n` call in the script must receive `--arg env_name "$ENV_NAME"`. Never pass it to only one `jq` call!
- [ ] **`.github/workflows/apm02_1_create_and_wait.yml`**:
  - [ ] In `guard` job, ensure the `repository_dispatch` event type is routed and sets:
    - `env_name`, `base_branch`, `tenant_branch`, `label_prefix`, `snapshot_prefix`.
  - [ ] Downstream notify jobs (`notify-conflict`, `notify-tenant-merged`, `notify-already-synced`) must use:
    ```yaml
    if: always() && needs.merge-to-tenant.result == '...'
    ```
    *(Never use bare `success()` or `failure()` — sibling skips will prevent them from executing!)*
- [ ] **`.github/workflows/apm02_3_finalize_cycle.yml`**:
  - [ ] `notify-success` must use: `if: always() && needs.finalize.result == 'success'`.
- [ ] **`.github/workflows/apm02_6_recovery.yml`**:
  - [ ] Search query must use dynamic `${LABEL_PREFIX} Failed` (never hardcode `APM-02 Failed`).
  - [ ] `notify-success` condition: `if: always() && needs.execute-recovery.result == 'success'`.
  - [ ] `notify-conflict` condition: `if: always() && needs.execute-recovery.result == 'failure' && needs.execute-recovery.outputs.has_conflicts == 'true'`.

---

### D. Direct Auto-Merge Pipeline (For Legacy / Direct Auto-Merge Environments)
*Applies to environments using `_auto_merge.yml`.*

- [ ] **`.github/workflows/_auto_merge.yml`**:
  - [ ] Add `"<env>"|"<alias>")` to `TARGET_WEBHOOKS` switch block.
- [ ] **`.github/workflows/auto_merge_conflict_resolver.yml`**:
  - [ ] Add `"<env>"|"<alias>")` to conflict notification switch blocks.
  - [ ] Add branch mapping in `tenant/<env>-branch` detection block.
- [ ] **`.github/workflows/auto_merge_approval_handler.yml`**:
  - [ ] Add `"<env>"|"<alias>")` to target webhooks switch block.
  - [ ] Add branch mapping in `tenant/<env>-branch` detection block.
- [ ] **`.github/workflows/deploy_<env>.yml`**:
  - [ ] Create workflow file with `repository_dispatch` matching the environment's `dispatchEvent`.

---

### E. Global Wiki Deployment History
- [ ] **`.github/scripts/update_wiki_global.js`**:
  - [ ] In `normalizeEnv(name)`, ensure any new uppercase abbreviations (e.g. `DC`, `ADDIN`, `PROD`, `QA`) are included in the uppercase preservation list.

---

## 3. Deployment & Push Rule (*MANDATORY*)

1. **Always commit and push to BOTH `origin/dev` AND `origin/main`:**
   ```bash
   git checkout dev
   git commit -am "feat(env): onboard <ENV_NAME>"
   git push origin dev

   git checkout main
   git pull origin main
   git merge dev -m "Merge branch 'dev': onboard <ENV_NAME>"
   git push origin main
   git checkout dev
   ```
2. **Sync the Base Branch**:
   If onboarding an environment with a custom base branch (e.g. `main-dc`), ensure that base branch has all latest `.github/workflows` files merged from `main`. Otherwise, snapshot branches branched from it will run outdated workflow definitions during push/recovery events.

---

## 4. Common Pitfalls & Prevention Checklist ("Hall of Mistakes")

| # | Mistake Observed | Root Cause | Prevention / Rule |
| :--- | :--- | :--- | :--- |
| **1** | **Notification only sent to Global channel** | Secret was omitted from `sap_cicd_notifier.yml`'s `env:` block OR case was omitted in `notify_sap_event.sh`. | **Both** must be updated: pass secret in `sap_cicd_notifier.yml` AND add case in `notify_sap_event.sh`. |
| **2** | **Missing `jq` variable binding crashes notification** | Used `\($env_name)` inside an actions `jq` call, but only added `--arg env_name` to the facts `jq` call. | Pass `--arg env_name "$ENV_NAME"` to **every** `jq -n` call that references `\($env_name)`. |
| **3** | **Notification jobs silently skipped** | Used `if: success()` in jobs that depend on `needs: [guard, create-snapshot, merge-to-tenant]`. When sibling jobs skip, `success()` evaluates to false! | Always use explicit status check: `if: always() && needs.<job>.result == 'success'`. |
| **4** | **Snapshot immediately closes with "Already Synced"** | Base branch and tenant branch were identical (`git diff` was empty). | To test deployment, ensure the snapshot branch has at least one real code commit modifying a non-protected file (e.g., `test.txt`). |
| **5** | **Testing before pushing to `main`** | `repository_dispatch` triggers GitHub Actions from the default branch (`main` / `dev`). | Always push workflow changes to remote `dev` and `main` before issuing Jarvis commands in Teams. |
| **6** | **Hardcoded environment names in UI cards** | Hardcoded `"APM-02 PR"` or `"Track APM-02 Deployment"` in buttons/facts. | Always use dynamic interpolation: `\($env_name) PR` and `Track \($env_name) Deployment Status...`. |
| **7** | **Recovery workflow looking for wrong failed PR** | Hardcoded query for `label: "APM-02 Failed"`. | Must use dynamic label query: `label: "${LABEL_PREFIX} Failed"`. |

---

## 5. Verification & Pre-flight Testing

Before declaring any new environment onboarding complete:
1. **Simulate SAP CI/CD Start**: Run `[Test] Simulate SAP Webhook` with `sap_cicd_started` and verify the card appears in the dedicated Teams channel (NOT just Global).
2. **Simulate SAP CI/CD Finish**: Run `[Test] Simulate SAP Webhook` with `sap_cicd_finished` (Status: `SUCCESS`) and verify the Succeeded card appears in the dedicated channel.
3. **Trigger Deployment**: Type `Jarvis deploy` in the dedicated channel. Verify that:
   - Command Centre card renders with correct environment name.
   - Snapshot branch & tracking PR are created with correct labels.
   - Pushing a commit to snapshot branch correctly triggers the pipeline and posts cards to the dedicated channel.
