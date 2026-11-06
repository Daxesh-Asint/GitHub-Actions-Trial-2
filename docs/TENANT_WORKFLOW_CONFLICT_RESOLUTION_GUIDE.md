# Tenant Branch Workflow Merge Conflict Resolution Guide
## Safe Synchronization Runbook for `.github/` Deployment Workflows

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The Problem
When automated deployment cycles (or manual merges) run from **`dev`**, **`main`**, **`main-dc`**, or **`main-dc-addin`** into specific tenant branches (e.g., `tenant/indorama-qa-234`, `tenant/asint-ais-02`, etc.), pull requests encounter **merge conflicts** on `.github/` workflow and script files.

### 1.2 Root Cause
* **Legacy Workflow Remnants:** Historically, tenant branches received commits containing older versions of deployment files (such as legacy `_auto_merge.yml`, hardcoded tenant webhook secrets, or old APM02 wait cycle workflows).
* **Modernized CI/CD Engine:** The active development and release branches (`dev`, `main`, `main-dc`, `main-dc-addin`) were recently updated with the centralized, multi-tenant deployment engine (introducing unified scripts like `notify_auto_merge.sh`, `notify_sap_event.sh`, and standardized deployment wrappers).
* **Git Content Divergence:** Because both the source branch and the tenant branch made non-fast-forward modifications to the same `.github/` files over time, Git cannot automatically merge them, halting deployment PRs.

### 1.3 Why the "Targeted Tenant Fix Branch" Strategy is 100% Safe
1. **Zero Impact on Application Code:** Synchronizes strictly the `.github/` directory. Zero Java, CDS, SAPUI5, `mta.yaml`, or tenant configuration files are touched.
2. **No Unwanted Pipeline Triggers:** Cutting and pushing to a temporary `fix/` branch does **not** trigger SAP CI/CD builds (SAP CI/CD only listens for pushes directly to the target tenant branch).
3. **Full Auditability:** Team leads and reviewers can inspect the Pull Request diff on GitHub to visually confirm that only CI/CD files are updated before merging.

---

## 2. Standardized Naming & Pull Request Conventions

To maintain uniformity across the entire repository and audit history, follow these conventions:

| Item | Standard Convention | Example (`tenant/indorama-qa-234`) |
| :--- | :--- | :--- |
| **Fix Branch Name** | `fix/resolve-github-conflicts-<tenant-short-name>` | `fix/resolve-github-conflicts-indo-qa-234` |
| **Commit Message** | `fix: resolve .github merge conflicts for <tenant-name>` | `fix: resolve .github merge conflicts for indorama qa 234` |
| **PR Title** | `fix: resolve .github merge conflicts for <tenant-name>` | `fix: resolve .github merge conflicts for indorama qa 234` |

### Pull Request Description Template
Copy and paste this template when opening the PR on GitHub:

```markdown
### Summary
Aligns the `.github/` workflows and automation scripts in `<TENANT_BRANCH>` with `<SOURCE_BRANCH>` to eliminate recurring merge conflicts during automated deployments.

### Scope of Changes
- Synchronized `.github/` workflows and scripts directly from `<SOURCE_BRANCH>`.
- **Zero application code modified** (no changes to Java, CDS, UI, or tenant configurations).

### Verification
- Verified via `git status` that only `.github/` files were staged and committed.
```

---

## 3. Step-by-Step Resolution Runbooks

### 🟢 Track 1: Tenants Deploying from `dev`
*(For tenant branches that receive continuous deployments from `dev`)*

```bash
# 1. Explicitly fetch the source branch and the target tenant branch
git fetch origin dev
git fetch origin <TENANT_BRANCH>

# 2. Cut a new fix branch directly from the targeted tenant branch
git checkout -b fix/resolve-github-conflicts-<SHORT_NAME> origin/<TENANT_BRANCH>

# 3. Pull ONLY the .github/ directory from dev
git checkout origin/dev -- .github/

# 4. Verify that strictly .github/ files are staged (zero application files)
git status

# 5. Commit and push the fix branch to the remote repository
git commit -m "fix: resolve .github merge conflicts for <TENANT_NAME>"
git push origin fix/resolve-github-conflicts-<SHORT_NAME>
```

* **PR Base (Target):** `<TENANT_BRANCH>`
* **PR Compare (Source):** `fix/resolve-github-conflicts-<SHORT_NAME>`

---

### 🔵 Track 2: Tenants Deploying from `main`
*(For core production and release QA tenants, e.g., `tenant/indorama-qa-234`, `tenant/asint-apm-02-v2`, `tenant/indorama-prod-900`)*

```bash
# 1. Explicitly fetch the source branch and the target tenant branch
git fetch origin main
git fetch origin <TENANT_BRANCH>

# 2. Cut a new fix branch directly from the targeted tenant branch
git checkout -b fix/resolve-github-conflicts-<SHORT_NAME> origin/<TENANT_BRANCH>

# 3. Pull ONLY the .github/ directory from main
git checkout origin/main -- .github/

# 4. Verify that strictly .github/ files are staged (zero application files)
git status

# 5. Commit and push the fix branch to the remote repository
git commit -m "fix: resolve .github merge conflicts for <TENANT_NAME>"
git push origin fix/resolve-github-conflicts-<SHORT_NAME>
```

* **PR Base (Target):** `<TENANT_BRANCH>`
* **PR Compare (Source):** `fix/resolve-github-conflicts-<SHORT_NAME>`

---

### 🟣 Track 3: Tenants Deploying from `main-dc`
*(For Data Center core tenants, e.g., `tenant/indorama-qa-234-dc`, `tenant/asint-ais-02-dc`)*

```bash
# 1. Explicitly fetch the source branch and the target tenant branch
git fetch origin main-dc
git fetch origin <TENANT_BRANCH_DC>

# 2. Cut a new fix branch directly from the targeted tenant branch
git checkout -b fix/resolve-github-conflicts-<SHORT_NAME>-dc origin/<TENANT_BRANCH_DC>

# 3. Pull ONLY the .github/ directory from main-dc
git checkout origin/main-dc -- .github/

# 4. Verify that strictly .github/ files are staged (zero application files)
git status

# 5. Commit and push the fix branch to the remote repository
git commit -m "fix: resolve .github merge conflicts for <TENANT_NAME> dc"
git push origin fix/resolve-github-conflicts-<SHORT_NAME>-dc
```

* **PR Base (Target):** `<TENANT_BRANCH_DC>`
* **PR Compare (Source):** `fix/resolve-github-conflicts-<SHORT_NAME>-dc`

---

### 🟡 Track 4: Tenants Deploying from `main-dc-addin`
*(For Data Center Add-in tenants, e.g., `tenant/indorama-qa-234-dc-addin`, `tenant/asint-ais-02-dc-addin`)*

```bash
# 1. Explicitly fetch the source branch and the target tenant branch
git fetch origin main-dc-addin
git fetch origin <TENANT_BRANCH_DC_ADDIN>

# 2. Cut a new fix branch directly from the targeted tenant branch
git checkout -b fix/resolve-github-conflicts-<SHORT_NAME>-dc-addin origin/<TENANT_BRANCH_DC_ADDIN>

# 3. Pull ONLY the .github/ directory from main-dc-addin
git checkout origin/main-dc-addin -- .github/

# 4. Verify that strictly .github/ files are staged (zero application files)
git status

# 5. Commit and push the fix branch to the remote repository
git commit -m "fix: resolve .github merge conflicts for <TENANT_NAME> dc addin"
git push origin fix/resolve-github-conflicts-<SHORT_NAME>-dc-addin
```

* **PR Base (Target):** `<TENANT_BRANCH_DC_ADDIN>`
* **PR Compare (Source):** `fix/resolve-github-conflicts-<SHORT_NAME>-dc-addin`

---

## 4. Operational Best Practices & Safeguards

### 4.1 Windows Remote Branch Collisions
On Windows workstations, Git encounters ref-lock errors during blanket `git fetch origin` commands if remote branches have case variations (e.g., `Defect/...` vs `defect/...`).
* **Rule:** **Never run a global `git fetch`**. Always fetch the explicit branches required for the operation:
  ```bash
  git fetch origin <branch-name>
  ```

### 4.2 Staging Verification Check
Before executing `git commit`, run:
```bash
git status
```
* **Expected:** All staged files are located in `.github/workflows/`, `.github/scripts/`, or `.github/linters/`.
* **Action if an application file appears:** If any non-`.github` file is accidentally staged, unstage it immediately:
  ```bash
  git restore --staged <file-path>
  git checkout HEAD -- <file-path>
  ```

### 4.3 Clean-Up After Merge
Once the PR has been reviewed and merged into `<TENANT_BRANCH>`:
```bash
# Delete local fix branch
git checkout main
git branch -D fix/resolve-github-conflicts-<SHORT_NAME>

# Delete remote fix branch (optional)
git push origin --delete fix/resolve-github-conflicts-<SHORT_NAME>
```

---

## 5. Result
The target tenant branch is now permanently aligned with the latest CI/CD workflow architecture. All future automated deployments or snapshot merges will execute cleanly with **zero `.github/` merge conflicts**.
