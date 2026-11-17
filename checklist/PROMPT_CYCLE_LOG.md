# Prompt Execution & Checklist Protocol

> [!IMPORTANT]
> **Mandatory Cycle Rule:**
> Before proceeding with any new prompt, the agent **must** record the last prompt's task, decisions, actions, and file modifications into this document under the `checklist/` folder.
> When a new prompt is received, the agent **must first read and take reference of the entire history and documentation under the `checklist/` folder** before executing any new actions, and strictly follow this cycle for every subsequent prompt.

---

## Cycle Execution History

### Prompt #1: SAP Build Work Zone (BWZ) Content Channel Refresh Automation
- **Date / Timestamp:** 2026-10-14T22:15:00+05:30
- **User Request:**
  - Automate the refresh of the SAP Build Work Zone (Launchpad Service) Content Channel for `HTML5 Apps` (`saas_approuter`) upon receiving the SAP CI/CD ANS deployment completion signal for the APM-02 environment.
  - Make the design 100% dynamic via centralized configuration so future environments can be added with zero workflow script changes.
  - Handle authentication using technical user credentials (`BWZ_USERNAME`, `BWZ_PASSWORD`) stored in GitHub Secrets via headless Playwright automation (SAP IAS / AsInt Log-On).

- **Technical Analysis & Endpoints:**
  - **Endpoint:** `POST https://apm-02-asint.dt.launchpad.cfapps.us10.hana.ondemand.com/provider/html5`
  - **Payload:**
    ```json
    {
      "contentAdditionMode": "manual",
      "providerId": "saas_approuter",
      "subaccountId": "9a06e582-c39e-457d-81d4-67fbb82ce18b",
      "subdomain": "apm-02-asint"
    }
    ```
  - **Response:** `201 Created`
  - **Authentication Flow:**
    - Redirects to SAP IAS login (`https://apm-02-asint.authentication.us10.hana.ondemand.com/saml2/authenticate/...`)
    - Selects "AsInt Log-On" SAML SSO option
    - Fills `#j_username` and `#j_password`
    - Submits `#logOnFormSubmit`
    - Navigates to `/channel/providerManager`
    - Triggers channel refresh and validates HTTP `201 Created`

- **Files Created / Modified:**
  1. [`.github/bwz-channels.json`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/bwz-channels.json) (Created): Centralized configuration mapping environments to Launchpad URL, subdomain, subaccountId, channel ID, and channel name.
  2. [`.github/scripts/refresh_bwz_channel.js`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/scripts/refresh_bwz_channel.js) (Created): Playwright automation script handling IAS login, navigating Channel Manager, triggering refresh, and capturing screenshot artifacts.
  3. [`.github/workflows/test_bwz_refresh.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/test_bwz_refresh.yml) (Created): Standalone `workflow_dispatch` test workflow for manual testing of the refresh logic and credentials.
  4. [`.github/workflows/apm02_3_finalize_cycle.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/apm02_3_finalize_cycle.yml) (Modified): Added `refresh-bwz-channel` job triggered automatically when the SAP CI/CD ANS completion signal arrives.

- **Git Commit:** `732f2bb` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #2: Two-Step Login Diagnosis & Fix for SAP APM Live Sign-In
- **Date / Timestamp:** 2026-10-14T22:37:00+05:30
- **User Request:**
  - Investigate why `[Test] Refresh BWZ Content Channel` workflow failed on run `38602991346`.
  - Identify root cause without touching company repository.
  - Implement the fix and update the checklist log.

- **Root Cause Analysis:**
  - Inspected downloaded failure screenshot artifact `bwz_refresh_failure.png`.
  - Discovered that the SAP APM Live Sign-In page (`aewxagoqs.accounts.ondemand.com`) enforces a **Two-Step Authentication Flow**:
    - Step 1: E-Mail input only, accompanied by a "Continue" button. The password input field is not rendered in the DOM yet.
    - Step 2: The password input field (`input#j_password`) only appears after clicking "Continue" (or pressing Enter).
  - The script initially attempted to fill `input#j_password` immediately after username, causing a 30-second timeout.

- **Fix Applied:**
  - Updated [`.github/scripts/refresh_bwz_channel.js`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/scripts/refresh_bwz_channel.js):
    - Fills `input#j_username`.
    - Checks if `input#j_password` is visible. If not, clicks the "Continue" button (or sends Enter key) and waits for `input#j_password` to become visible.
    - Fills `input#j_password` and clicks "Log On" / "Sign In".
    - Resiliently handles redirection back to the Launchpad Channel Manager.

- **Files Modified:**
  - [`.github/scripts/refresh_bwz_channel.js`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/scripts/refresh_bwz_channel.js)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `2e7a0e8` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #3: Channel Manager URL Navigation & Screenshot Artifact Fix
- **Date / Timestamp:** 2026-10-14T22:54:00+05:30
- **User Request:**
  - Investigate why workflow run `38604122576` completed with success (HTTP `201 Created` for `/provider/html5`), but the captured screenshots showed:
    *"Sorry, we couldn't find the site. Perhaps you don't have the required authorization to access it, or the site doesn't exist."*

- **Root Cause Analysis:**
  - The API call to `/provider/html5` succeeded with HTTP `201 Created`, confirming the channel refresh actually took place on the backend.
  - However, after authentication on SAP IAS, the OAuth callback redirected to the launchpad runtime root (`/sites`).
  - Because the technical user account has administrator / design-time roles rather than an end-user runtime site assignment, visiting `/sites` displays the "couldn't find the site" error page.
  - The automation script had not explicitly re-navigated to the design-time Channel Manager UI URL (`/channel/providerManager?&sap-locale=en&sap-theme=sap_horizon`), leaving the browser on the runtime error page when capturing screenshots.

- **Fix Applied:**
  - Updated [`.github/scripts/refresh_bwz_channel.js`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/scripts/refresh_bwz_channel.js):
    - Added explicit navigation to `${envConfig.launchpad_url}/channel/providerManager?&sap-locale=en&sap-theme=sap_horizon` immediately after the login callback completes.
    - Added logging for `page.url()` so the exact page is tracked in the run log.
    - Added waiting for table content to render before taking the screenshot so the Channel Manager table is visually documented in artifacts.

- **Files Modified:**
  - [`.github/scripts/refresh_bwz_channel.js`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/scripts/refresh_bwz_channel.js)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `8eb4117` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #4: Verified Visual Dashboard Card Screenshot Implementation
- **Date / Timestamp:** 2026-10-14T23:37:00+05:30
- **User Request:**
  - Investigate why `accessDenied.html` ("couldn't find the site") was still captured in screenshots even though the channel refresh API returned HTTP `201 Created`.
  - Provide an approach to capture the verified refresh data in the screenshot artifact.
  - Implement the chosen approach: Fetch live channel details via GraphQL after refresh and render a verified SAP status card dashboard screenshot.

- **Root Cause & Solution:**
  - In headless automated runs on Cloud Foundry, the portal UI route `/channel/providerManager` redirects to `/accessDenied.html` due to runtime portal site restrictions on technical user roles.
  - However, the authenticated session has full authorization for `/provider/html5` (which returns HTTP `201 Created`) and `/provider/graphql`.
  - Implemented **Option A**: After `POST /provider/html5` returns `201 Created`, the script queries `POST /provider/graphql` to retrieve the live status (`Updated`) and timestamp, and renders a SAP Fiori Horizon-themed visual verification dashboard directly into the page to capture `bwz_refresh_success.png`.
  - Conditioned `bwz_channel_manager.png` to avoid capturing `accessDenied.html` when UI routing redirects to access denied.

- **Files Modified:**
  - [`.github/scripts/refresh_bwz_channel.js`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/scripts/refresh_bwz_channel.js)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `4bbda40` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #5: Team Communication & Rollout Estimation
- **Date / Timestamp:** 2026-10-15T11:29:00+05:30
- **User Request:**
  - Format a professional team update message detailing the successful APM-02 BWZ refresh POC.
  - Highlight the working demo run, artifact screenshot verification, integration roadmap with SAP CI/CD and MS Teams notifications, and future tenant rollout estimates (~1 hr per tenant).

- **Activities:**
  - Prepared structured and executive-ready communication formats for MS Teams / Email.
  - Outlined effort breakdown (4 hrs R&D completed; ~1 hr per additional tenant for discovery, testing, CI/CD trigger, and Teams card alerting).

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `20c2e51` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #6: Team Communication Update with 2FA Scope Clarification
- **Date / Timestamp:** 2026-10-15T11:41:00+05:30
- **User Request:**
  - Incorporate a dedicated scope clarification regarding Two-Factor Authentication (2FA) into the team message.
  - Specifically highlight that the current automation covers non-2FA tenants, and that tenants enforcing 2FA will require additional research to determine feasibility and approach.

- **Activities:**
  - Refined the message to explicitly call out 2FA prerequisites, testing links, live run references, and future rollout estimates.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `f9c8536` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #7: Jira Ticket Draft for Management Showcase
- **Date / Timestamp:** 2026-10-20T15:18:00+05:30
- **User Request:**
  - Create a structured, professional Jira ticket text (Subject and Description) for management review.
  - Showcase business value, technical solution, POC results (APM-02), artifacts, future rollout estimates (~1 hr/tenant), and scope notes (2FA).

- **Activities:**
  - Prepared Jira ticket text with executive summary, problem statement, solution architecture, POC verification links, and rollout roadmap.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `8836e12` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #8: Short & Sweet Jira Description Creation
- **Date / Timestamp:** 2026-10-20T15:26:00+05:30
- **User Request:**
  - Provide a short and sweet version of the Jira ticket description that is quick to read for management.

- **Activities:**
  - Distilled the POC details into a concise, 4-bullet executive summary covering objective, result, evidence link, 2FA note, and the 1 hr/tenant estimate.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `5de8a74` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #9: Restrict Conflict and Approval Workflows from Running on Developer PRs
- **Date / Timestamp:** 2026-10-21T14:52:00+05:30
- **User Request:**
  - 4 automated checks (`APM-02 Base PR Conflicts`, `APM-02 Pre-Deploy Conflicts`, `Auto-Merge Conflict Resolver`, and `Auto-Merge PR Approval Handler`) were triggering and failing on regular developer PRs targeting `dev`.
  - Disabling them completely would break automated deployments, so the user agreed to branch-filtering: restrict triggers so they only run on their relevant deployment target branches (`tenant/**`, `main*`, etc.) and NEVER on developer PRs targeting `dev`.
  - Apply the changes to the POC repo and verify.

- **Activities:**
  - Configured `pull_request.branches` filter on:
    - `.github/workflows/apm02_4_conflict_monitor.yml` (`[main, main-dc, main-dc-addin]`)
    - `.github/workflows/apm02_5_apm02_conflict_monitor.yml` (`["tenant/asint-apm-02-v2", "tenant/asint-apm-02-dc", "tenant/asint-apm-02-dc-addin"]`)
    - `.github/workflows/auto_merge_conflict_resolver.yml` (`["tenant/**", "apm-eiot-temp-copy", "st-env-for-contentfederation"]`)
    - `.github/workflows/auto_merge_approval_handler.yml` (`["tenant/**", "apm-eiot-temp-copy", "st-env-for-contentfederation"]` + base ref guard in `jobs.handle-approval.if`)
  - Verified that PRs targeting `dev` will be skipped pre-flight by GitHub Actions trigger evaluation, leaving developer PRs clean and running only the required checks (`CDS Schema Diff` & `require-tests-in-pr`).

- **Files Modified:**
  - [`.github/workflows/apm02_4_conflict_monitor.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/apm02_4_conflict_monitor.yml)
  - [`.github/workflows/apm02_5_apm02_conflict_monitor.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/apm02_5_apm02_conflict_monitor.yml)
  - [`.github/workflows/auto_merge_conflict_resolver.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/auto_merge_conflict_resolver.yml)
  - [`.github/workflows/auto_merge_approval_handler.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/auto_merge_approval_handler.yml)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `82b13ba` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #10: Test and Verify Workflow Branch Filtering via Live PR in POC Repo
- **Date / Timestamp:** 2026-10-21T14:58:00+05:30
- **User Request:**
  - Raise a PR in the POC repo to test and verify all the checks and confirm the branch-filtering behavior.

- **Activities:**
  - Created test branch `test/verify-dev-pr-filtering` from `dev`.
  - Raised PR #1104 targeting base `dev`: [`#1104`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/pull/1104).
  - Pushed subsequent commit (`synchronize` event) to test update lifecycle.
  - Closed PR #1104 (`closed` event).
  - Verified across all lifecycle events that none of the 4 conflict or approval workflows were triggered or queued, and zero failing checks appeared on the PR.
  - Returned local workspace to `dev` branch.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `76a0181` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #11: Propagate Workflow Branch-Filtering to Company Deployment Branches
- **Date / Timestamp:** 2026-10-21T15:15:00+05:30
- **User Request:**
  - Push the branch-filtering changes to the 4 company deployment workflow branches in `StillSomehowSane/asint_ais` (Option A):
    1. `ci/deployment-workflows-dev`
    2. `ci/deployment-workflows-main`
    3. `ci/deployment-workflows-main-dc`
    4. `ci/deployment-workflows-main-dc-addin`

- **Activities:**
  - Added upstream remote `https://github.com/StillSomehowSane/asint_ais.git`.
  - Fetched all 4 deployment workflow branches.
  - Checked out each branch and applied the clean 4 workflow file edits:
    - `.github/workflows/apm02_4_conflict_monitor.yml`
    - `.github/workflows/apm02_5_apm02_conflict_monitor.yml`
    - `.github/workflows/auto_merge_conflict_resolver.yml`
    - `.github/workflows/auto_merge_approval_handler.yml`
  - Committed and pushed each branch cleanly to `upstream`:
    - `ci/deployment-workflows-dev`: commit `b1253a8d5f`
    - `ci/deployment-workflows-main`: commit `f97f4e28a2`
    - `ci/deployment-workflows-main-dc`: commit `08574c1406`
    - `ci/deployment-workflows-main-dc-addin`: commit `c225ac7c9f`
  - Returned workspace to `dev` in POC repository.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `2142a2c` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #12: Generate PR Title and Description for Company Repository Pull Requests
- **Date / Timestamp:** 2026-10-21T15:20:00+05:30
- **User Request:**
  - Provide a clear, professional PR title and description for raising PRs from `ci/deployment-workflows-*` branches into the base streams in `StillSomehowSane/asint_ais`.

- **Activities:**
  - Formulated a standard, high-quality PR template covering problem statement, root cause, architectural fix (branch-filtering), live verification in POC repo, and impacted workflows.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `d8ea960` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #13: Architecture Plan for GitHub Actions Quota Limit using GCP
- **Date / Timestamp:** 2026-10-22T21:30:00+05:30
- **User Request:**
  - GitHub Actions runtime quota exhausted (spending limit error preventing jobs from starting).
  - User requested alternative ways to run automations without purchasing GitHub Actions runtime, leveraging existing GCP services.
  - Specified: entire suite for all environments, medium VM size, and pilot on POC repo first. Requested full plan before implementation.

- **Activities:**
  - Evaluated architectural alternatives: Self-Hosted Runner on Compute Engine ($0 GitHub runtime cost, unlimited minutes), Cloud Build, and Cloud Run.
  - Recommended Self-Hosted Runner on GCP VM as it preserves 100% of workflow triggers, artifacts, and PR checks without rewriting YAML.
  - Formulated comprehensive 5-phase plan: VM provisioning, environment & runner setup, POC workflow label updates (`runs-on: [self-hosted, linux]`), testing/verification, and company rollout path.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** Pending commit on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed and approved by user.

---

### Prompt #14: GCP VM Provisioning & GitHub Runner Registration
- **Date / Timestamp:** 2026-10-22T21:50:00+05:30
- **User Request:**
  - Guided step-by-step creation of GCP Compute Engine VM (`e2-medium`, Ubuntu 22.04 LTS x86/64, 30 GB disk) in `AsInt-GCP-FTS`.
  - Provide runner installation and registration script for POC repository.
  - Clarified that the registration token is securely pre-generated from GitHub API and does not require a personal PAT.

- **Activities:**
  - Assisted user with GCP Console setup for `github-actions-runner` in `us-central1-b`.
  - Generated live runner registration token (`BT3Z2Q24JXJWKLAEZLWVNFTK3JDEI`) via GitHub API for `Daxesh-Asint/GitHub-Actions-Trial-2`.
  - Provided copy-paste installation script configuring dependencies, runner service (`actions-runner-linux-x64-2.338.1`), and persistent systemd service.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `6648416` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #15: Update BWZ Refresh Workflow to use Self-Hosted GCP Runner
- **Date / Timestamp:** 2026-10-22T22:00:00+05:30
- **User Request:**
  - Proceed with Option 1: update `test_bwz_refresh.yml` to target the self-hosted GCP runner (`runs-on: [self-hosted, linux]`) and execute a live test run before updating remaining workflows.

- **Activities:**
  - Verified `gcp-runner-01` is online and idle via GitHub API.
  - Updated `test_bwz_refresh.yml` `refresh-channel` job to `runs-on: [self-hosted, linux]`.
  - Staged, committed, and pushed changes to `origin dev`.

- **Files Modified:**
  - [`.github/workflows/test_bwz_refresh.yml`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/.github/workflows/test_bwz_refresh.yml)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `8a65977` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #16: Successful Live Execution on GCP Runner & BWZ Artifact Verification
- **Date / Timestamp:** 2026-10-22T22:12:00+05:30
- **User Request:**
  - Verify live execution on GCP runner (`gcp-runner-01`) for BWZ Refresh workflow.

- **Activities:**
  - Verified journalctl service logs on GCP VM confirming runner received and processed jobs.
  - Live Run #39815009830 completed in 58s with result: `Succeeded`.
  - Confirmed `bwz-refresh-screenshots-APM-02` artifact was uploaded successfully.
  - Zero GitHub Actions quota / billing minutes were consumed ($0 cost on GitHub).

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `bddd9e3` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #17: Mass Migration of All Workflows to Self-Hosted GCP Runner Across All Environments
- **Date / Timestamp:** 2026-10-23T00:12:00+05:30
- **User Request:**
  - Update all workflows in POC repo for all environments to use the self-hosted GCP runner.
  - Confirmed via interactive prompt to apply changes to 7 branches: 4 base branches (`dev`, `main`, `main-dc`, `main-dc-addin`) and 3 tenant branches (`tenant/asint-apm-02-v2`, `tenant/asint-apm-02-dc`, `tenant/asint-apm-02-dc-addin`).

- **Activities:**
  - Converted all 28 occurrences of `runs-on: ubuntu-latest` across all 13 workflow files in `.github/workflows/` to `runs-on: self-hosted`.
  - Propagated and pushed the updated workflow configurations to all 7 target branches on `origin` in the POC repository.
  - Verified clean status and zero remaining references to `ubuntu-latest`.

- **Files Modified:**
  - All 13 workflow files in `.github/workflows/`
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commits (POC Repository):**
  - `dev`: [`f50e5cd`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/f50e5cd26a)
  - `main`: [`5a0e40f`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/5a0e40f4ba)
  - `main-dc`: [`087942d`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/087942d6e6)
  - `main-dc-addin`: [`38d7c9f`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/38d7c9f4a4)
  - `tenant/asint-apm-02-v2`: [`60afa68`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/60afa687e2)
  - `tenant/asint-apm-02-dc`: [`2666ad3`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/2666ad38bd)
  - `tenant/asint-apm-02-dc-addin`: [`a09b6dd`](https://github.com/Daxesh-Asint/GitHub-Actions-Trial-2/commit/a09b6dd682)
- **Status:** Completed, verified, and pushed to all 7 branches on `origin`.

---

### Prompt #18: AWS EC2 Self-Hosted Runner Provisioning & Activation
- **Date / Timestamp:** 2026-10-23T17:15:00+05:30
- **User Request:**
  - Transition self-hosted runner infrastructure from GCP to AWS per management alignment with Ashweyth Sunil (GCP credits depleted, AWS available).
  - Launch AWS EC2 instance (`t3.small`, Ubuntu 24.04 LTS x86/64, 30 GB gp3 disk, named `asint-github-actions-runner`).
  - Configure runner for POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).

- **Activities:**
  - Guided user through AWS EC2 Console setup, correcting AMI selection (avoiding paid SQL Server image) and storage configuration.
  - Resolved EC2 Instance Connect browser terminal connection.
  - Executed all-in-one setup script on AWS instance pre-installing `gh` (GitHub CLI), Git, dependencies, and runner service (`aws-runner-01`).
  - Verified `aws-runner-01` registered, online, and actively processing jobs on GitHub Actions.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Git Commit:** `380f50c` on branch `dev` in POC repository (`Daxesh-Asint/GitHub-Actions-Trial-2`).
- **Status:** Completed, verified, and pushed to `origin/dev`.

---

### Prompt #19: AWS EC2 Instance Upgrade to t3.medium & Multi-Worker Parallel Concurrency
- **Date / Timestamp:** 2026-10-24T20:15:00+05:30
- **User Request:**
  - Upgrade AWS EC2 runner instance from `t3.small` to `t3.medium` to eliminate job queueing.
  - Scale up self-hosted runner capacity to 5+ concurrent parallel workers.
  - Assess scaling boundaries (6, 7, 8 parallel workers) on `t3.medium`.

- **Activities:**
  - Configured 4 GB swapfile on the 30 GB gp3 root disk to guarantee headroom against memory exhaustion.
  - Registered and deployed systemd service workers `aws-runner-02`, `aws-runner-03`, `aws-runner-04`, and `aws-runner-05` alongside `aws-runner-01`.
  - Verified live runner status via `gh api`: 5 active runners online, with concurrent jobs picked up immediately (0 queued jobs).
  - Benchmarked instance capacity: 5–6 workers identified as optimal sweet spot for `t3.medium` (2 vCPUs / 4 GB RAM); documented path to `t3.large` for 8+ workers.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Status:** Completed and verified.

---

### Prompt #20: Zero-PR Configurable Dynamic Runner Switching via Repository Variables (`vars.RUNNER_TYPE`)
- **Date / Timestamp:** 2026-10-26T11:12:00+05:30
- **User Request:**
  - Make runner assignment dynamic and configurable so that when GitHub billing quota resets, runners can be switched to GitHub-hosted (`ubuntu-latest`) and back to self-hosted (`self-hosted`) without opening Pull Requests or waiting for PR approvals.
  - Confirmed: Default fallback to `self-hosted`, variable name `RUNNER_TYPE`, apply to POC repo first.

- **Activities:**
  - Designed zero-PR architecture using GitHub Actions native variable evaluation: `runs-on: ${{ vars.RUNNER_TYPE || 'self-hosted' }}`.
  - Tested and verified execution on `test_bwz_refresh.yml` (Run #40275504627 passed in 55s on `aws-runner-04`).
  - Created repository variable `RUNNER_TYPE=self-hosted` in `Daxesh-Asint/GitHub-Actions-Trial-2`.
  - Upgraded all 29 jobs across all 13 workflow files in `.github/workflows/` to use dynamic `${{ vars.RUNNER_TYPE || 'self-hosted' }}`.

- **Files Modified:**
  - `.github/workflows/_auto_merge.yml`
  - `.github/workflows/_cf_app_control.yml`
  - `.github/workflows/_apm02_notify.yml`
  - `.github/workflows/test_bwz_refresh.yml`
  - `.github/workflows/simulate_sap_webhook.yml`
  - `.github/workflows/sap_cicd_notifier.yml`
  - `.github/workflows/auto_merge_conflict_resolver.yml`
  - `.github/workflows/auto_merge_approval_handler.yml`
  - `.github/workflows/apm02_6_recovery.yml`
  - `.github/workflows/apm02_5_apm02_conflict_monitor.yml`
  - `.github/workflows/apm02_4_conflict_monitor.yml`
  - `.github/workflows/apm02_3_finalize_cycle.yml`
  - `.github/workflows/apm02_2_extend_wait.yml`
  - `.github/workflows/apm02_1_create_and_wait.yml`
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Status:** Completed, verified, and pushed to `origin/dev`.


