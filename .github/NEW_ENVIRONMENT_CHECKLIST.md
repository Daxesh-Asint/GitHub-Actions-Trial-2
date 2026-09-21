# 📋 SOP: Adding a New Deployment Environment to the CI/CD Pipeline

When onboarding a new environment (e.g., `VMOS`, `AIS-02`, `BAYSTAR`), all steps across **GCP**, **GitHub Actions Workflows**, and **Scripts** must be updated simultaneously. **Do not omit any of these locations.**

---

## 1. Environment Secrets & Config Checklist

| Location | Key / Variable | Description |
| :--- | :--- | :--- |
| **GitHub Secrets** | `TEAMS_WEBHOOK_<ENV>_1` (and `_2`, `_3`) | MS Teams Incoming Webhook for the dedicated channel |
| **GCP Cloud Run / Functions** | `TEAMS_WEBHOOK_<ENV>_1` | Environment variable for Jarvis Outgoing Webhook |

---

## 2. Code Files Checklist (MANDATORY TO UPDATE TOGETHER)

### A. GCP Bot Configuration
- [ ] `gcp/environments.js`:
  - Add to `ENVIRONMENTS` array with `id`, `name`, `channelId`, `channelName`, `dispatchEvent`, `tenantBranch`, `aliases`, `webhookEnvVar`.
- [ ] Deploy new revision of Cloud Run / Cloud Function.

### B. GitHub Actions Workflows (Webhook Target Routing)
*CRITICAL: Every workflow that sends Teams notifications MUST have the `<env>` case added to its target webhook resolution block, otherwise cards fall back to `GLOBAL`.*
- [ ] `.github/workflows/_auto_merge.yml`:
  - Add `"<env>"|"<alias>")` to `TARGET_WEBHOOKS` switch block.
- [ ] `.github/workflows/auto_merge_conflict_resolver.yml`:
  - Add `"<env>"|"<alias>")` to both conflict notification switch blocks.
  - Add branch mapping to `tenant/<env>-branch` detection block.
- [ ] `.github/workflows/auto_merge_approval_handler.yml`:
  - Add `"<env>"|"<alias>")` to target webhooks switch block.
  - Add branch mapping to `tenant/<env>-branch` detection block.
- [ ] `.github/workflows/deploy_<env>.yml`:
  - Create reusable dispatch workflow calling `_auto_merge.yml`.

### C. SAP CI/CD Scripts & Workflows
- [ ] `.github/scripts/notify_sap_event.sh`:
  - Add environment to `VALID_ENVIRONMENTS` list.
  - Add to `TARGET_BRANCH` case block.
  - Add to `TARGET_WEBHOOKS` case block (`TEAMS_WEBHOOK_<ENV>_1`, `_2`, `_3`).
- [ ] `.github/workflows/sap_cicd_notifier.yml`:
  - Add environment to workflow dispatch enum list.
  - Pass `TEAMS_WEBHOOK_<ENV>_1` under `env:`.
- [ ] `.github/workflows/simulate_sap_webhook.yml`:
  - Add environment to simulation trigger list.

### D. Global Wiki Deployment History
- [ ] `.github/scripts/update_wiki_global.js`:
  - Add uppercase identifier to the exclusion/matching list if needed.

---

## 3. Deployment & Push Rule
* **Always commit and push all modified `.github/workflows/` files to `main` before testing the deployment command (`Jarvis deploy`) in Teams.** 
* GitHub Actions executes exclusively from the code already committed to the remote repository.
