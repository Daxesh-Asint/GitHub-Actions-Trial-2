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

---

### Prompt #21: Multi-Branch Propagation of Zero-PR Configurable Dynamic Runner Switching
- **Date / Timestamp:** 2026-10-26T11:38:00+05:30
- **User Request:**
  - Propagate the zero-PR configurable runner switching (`runs-on: ${{ vars.RUNNER_TYPE || 'self-hosted' }}`) across all remaining 6 branches in the POC repository (`main`, `main-dc`, `main-dc-addin`, `tenant/asint-apm-02-v2`, `tenant/asint-apm-02-dc`, `tenant/asint-apm-02-dc-addin`).

- **Activities:**
  - Synchronized and updated all 13 workflow files across each target branch on `origin`.
  - Pushed commits cleanly across all 6 target branches:
    - `main`: `3c1f79f0b1`
    - `main-dc`: `cb254433fc`
    - `main-dc-addin`: `9b0d835497`
    - `tenant/asint-apm-02-v2`: `0900cfa5f3`
    - `tenant/asint-apm-02-dc`: `d732e08a7d`
    - `tenant/asint-apm-02-dc-addin`: `669da96534`
  - Re-verified working tree cleanliness on `dev`.

- **Files Modified:**
  - All 13 workflow files in `.github/workflows/` across all 7 POC branches
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Status:** Completed, verified, and pushed to all 7 branches on `origin`.

---

### Prompt #22: Company Repository Dynamic Runner Update on Staging Deployment Branches
- **Date / Timestamp:** 2026-10-26T11:51:00+05:30
- **User Request:**
  - Apply the zero-PR configurable runner switching (`runs-on: ${{ vars.RUNNER_TYPE || 'self-hosted' }}`) strictly to the automation workflows that belong to the user in the company repository (`StillSomehowSane/asint_ais`).
  - Do NOT touch unrelated workflows (e.g. `assign_reviewers_to_pr.yml`, `build.yml`, `cds_schema_diff.yml`, `checktests.yml`, `hana-tests.yml`, `ui-test-check.yml`, etc.).
  - Push changes across the 4 staging branches:
    1. `ci/deployment-workflows-dev`
    2. `ci/deployment-workflows-main`
    3. `ci/deployment-workflows-main-dc`
    4. `ci/deployment-workflows-main-dc-addin`
  - Identify any remaining branches that may need these changes.

- **Activities:**
  - Audited workflows across `upstream`: isolated exactly the 12 automation workflow files owned by this pipeline, keeping all 6 third-party / team CI files and 45 `deploy_*.yml` caller workflows completely untouched.
  - Replaced `runs-on: ubuntu-latest` with `runs-on: ${{ vars.RUNNER_TYPE || 'self-hosted' }}` with zero other code modifications.
  - Successfully committed and pushed to `upstream` (`StillSomehowSane/asint_ais`):
    - `ci/deployment-workflows-dev`: `ae59c204c1`
    - `ci/deployment-workflows-main`: `228f23d75b`
    - `ci/deployment-workflows-main-dc`: `2615ddb939`
    - `ci/deployment-workflows-main-dc-addin`: `271e0cce1d`

- **Files Modified (12 files on each of the 4 staging branches):**
  - `.github/workflows/_auto_merge.yml`
  - `.github/workflows/_cf_app_control.yml`
  - `.github/workflows/_apm02_notify.yml`
  - `.github/workflows/apm02_1_create_and_wait.yml`
  - `.github/workflows/apm02_2_extend_wait.yml`
  - `.github/workflows/apm02_3_finalize_cycle.yml`
  - `.github/workflows/apm02_4_conflict_monitor.yml`
  - `.github/workflows/apm02_5_apm02_conflict_monitor.yml`
  - `.github/workflows/apm02_6_recovery.yml`
  - `.github/workflows/auto_merge_conflict_resolver.yml`
  - `.github/workflows/auto_merge_approval_handler.yml`
  - `.github/workflows/sap_cicd_notifier.yml`

- **Status:** Completed, verified, and pushed to `upstream`.

---

### Prompt #23: Scope Clarification on Tenant Branches & Base Branch Pull Request Specifications
- **Date / Timestamp:** 2026-10-26T12:02:00+05:30
- **User Request:**
  - Confirm that APM-02 deployments originate from `main`, `main-dc`, and `main-dc-addin`, eliminating the need for standalone workflow modifications on `tenant/asint-apm-02-*` branches.
  - Formulate structured, professional Pull Request titles and descriptions for merging the 4 staging branches (`ci/deployment-workflows-*`) into the 4 base branches (`dev`, `main`, `main-dc`, `main-dc-addin`).

- **Activities:**
  - Confirmed architectural isolation: tenant branches inherit runner configurations directly from base branches during merge cycles.
  - Prepared professional, reviewer-ready PR templates documenting the zero-cost self-hosted runner transition, dynamic variable switching mechanism (`RUNNER_TYPE`), zero business-logic impact, and operational rollback instructions.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Status:** Documented and verified.

---

### Prompt #24: Simplified PR Formatting & Team Communication for Self-Hosted Migration
- **Date / Timestamp:** 2026-10-26T12:08:00+05:30
- **User Request:**
  - Create concise, "short and sweet" PR titles and descriptions stating simply that deployment runners have been transitioned from GitHub-hosted to self-hosted to resolve GitHub Actions runtime limit exhaustion.
  - Do NOT disclose internal dynamic runner variable toggles (`vars.RUNNER_TYPE`) or zero-PR automation in reviewer-facing documents.
  - Provide an executive, polished MS Teams message informing the team/seniors about the runner switch due to exhausted GitHub runtime minutes.

- **Activities:**
  - Formulated clean, conventional-commit PR titles and lightweight 1-paragraph PR descriptions emphasizing quota resolution and zero-logic impact.
  - Drafted professional MS Teams notification message ready for senior leadership review.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md)

- **Status:** Completed and verified.

---

### Prompt #25: Merge Conflict Resolution on Company PR #19442 (`ci/deployment-workflows-dev`)
- **Date / Timestamp:** 2026-10-26T12:30:00+05:30
- **User Request:**
  - Identify conflict in PR #19442 (`ci/deployment-workflows-dev` -> `dev`) in `StillSomehowSane/asint_ais`.
  - Present root cause and exact resolution snippet for approval before executing.
  - Upon receiving explicit user green light, execute the resolution and push to upstream.

- **Activities:**
  - Identified conflict root cause: duplicated commit history for PR restriction fix (`3c8347a092` on `dev` vs `b1253a8d5f` on staging branch) colliding on adjacent lines with runner target change in `.github/workflows/auto_merge_approval_handler.yml`.
  - Merged `upstream/dev` into local `ci/deployment-workflows-dev`.
  - Resolved conflict in `.github/workflows/auto_merge_approval_handler.yml` by keeping dynamic runner configuration `runs-on: ${{ vars.RUNNER_TYPE || 'self-hosted' }}` alongside the `if:` filter.
  - Committed merge resolution (`36310b6072`) and pushed to `upstream ci/deployment-workflows-dev`.
  - Confirmed PR #19442 conflicts resolved on GitHub.

- **Files Modified:**
  - `.github/workflows/auto_merge_approval_handler.yml` on `upstream/ci/deployment-workflows-dev`
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed, verified, and pushed to `upstream`.

---

### Prompt #26: Company Repository 8-Runner Setup Architecture & EC2 Connection Guidance
- **Date / Timestamp:** 2026-10-26T12:38:00+05:30
- **User Request:**
  - Provide guidance on acquiring registration credentials for the company repository (`StillSomehowSane/asint_ais`).
  - Configure 8 parallel self-hosted runners on AWS EC2 to process company jobs simultaneously.
  - Provide connection specifications (EC2 Instance Connect vs SSH key file) and complete automated multi-runner deployment script.

- **Activities:**
  - Clarified company repository runner registration prerequisites and URL (`https://github.com/StillSomehowSane/asint_ais/settings/actions/runners/new`).
  - Designed automated multi-runner provisioning script for 8 concurrent services (`asint-runner-01` through `asint-runner-08`) with 8 GB swap allocation.
  - Provided connection options: browser-based EC2 Instance Connect (no key file required) and local SSH configuration script.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Documented and verified.

---

### Prompt #27: Clean-Slate EC2 Company Runner Migration Script & Instance Connect Procedure
- **Date / Timestamp:** 2026-10-26T12:42:00+05:30
- **User Request:**
  - Create a clean-slate automated deployment script to transition the AWS EC2 instance entirely from the POC repository to the company repository (`StillSomehowSane/asint_ais`).
  - Provide a single script to be executed in EC2 Instance Connect (browser terminal) that uninstalls legacy POC runner services, configures 8 GB swap, pre-installs dependencies, and registers 8 dedicated company runner workers (`asint-runner-01` through `asint-runner-08`).

- **Activities:**
  - Designed idempotent clean-slate bash script automating:
    1. Graceful stop and removal of old POC runner services (`aws-runner-*`, `actions-runner`).
    2. Swap configuration expansion to 8 GB.
    3. Essential tool validation (`gh`, `git`, `jq`, `curl`, `libicu`, etc.).
    4. Parallel runner loop registering 8 independent worker daemons for `StillSomehowSane/asint_ais`.
    5. Automatic systemd daemon-reload and service activation.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #28: Simple & Polite PR Approval Request Template for Senior Reviewers
- **Date / Timestamp:** 2026-10-26T12:59:00+05:30
- **User Request:**
  - Draft a simple, polite message for seniors asking for their approval on PR #19442.
  - Reassure reviewers that the PR only updates the workflow runner target from GitHub-hosted to self-hosted with zero code modifications or business logic changes.

- **Activities:**
  - Prepared concise, professional approval request templates for MS Teams / Slack / Email with direct PR references.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #29: Workflow Optimization Commitment in Senior Review Communication
- **Date / Timestamp:** 2026-10-26T13:01:00+05:30
- **User Request:**
  - Incorporate a proactive commitment into the senior approval message stating: *"I will review all the workflows to see where we can club them or move tasks out of Actions to reduce our GitHub runtime."*

- **Activities:**
  - Integrated the workflow consolidation and runtime reduction commitment into professional message templates for leadership.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #30: Official GitHub Documentation on Self-Hosted Runner Billing & Zero Runtime Cost
- **Date / Timestamp:** 2026-10-26T13:57:00+05:30
- **User Request:**
  - Retrieve official, authoritative GitHub documentation proving that self-hosted runners consume $0 in GitHub Actions runtime minutes/credits to satisfy managerial review.

- **Activities:**
  - Fetched and verified official documentation from GitHub Docs (`docs.github.com`):
    1. *About billing for GitHub Actions*: Explicitly states that GitHub Actions usage is **free** for self-hosted runners.
    2. *About self-hosted runners*: Confirms self-hosted runners are **free to use with GitHub Actions**, with costs limited solely to the underlying host infrastructure (AWS EC2).
  - Compiled executive evidence packet with direct official URLs, word-for-word citations, and side-by-side billing comparisons.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #31: Private Repository Self-Hosted Runner Billing Verification & Documentation Breakdown
- **Date / Timestamp:** 2026-10-26T14:01:00+05:30
- **User Request:**
  - Provide specific official documentation proving that self-hosted runners on **private repositories** have unlimited runtime and consume $0 in GitHub Actions minutes to satisfy the repository owner's inquiry.

- **Activities:**
  - Analyzed the official GitHub billing architecture and documentation structure:
    1. Highlighted the distinction in GitHub Docs where the monthly minute quota on private repositories applies strictly **"for use with GitHub-hosted runners"**, whereas self-hosted runners are classified as universally **free**.
    2. Cited the official table "Included minutes for GitHub-hosted runners" confirming self-hosted runners bypass the minute metering engine entirely.
    3. Provided verification instructions for inspecting the live GitHub organization billing dashboard.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #32: Executive & Technical Explanation of Self-Hosted Runners for Senior Leadership
- **Date / Timestamp:** 2026-10-26T14:14:00+05:30
- **User Request:**
  - Formulate an executive, senior-friendly explanation for lead reviewer Alisha Verma answering: *"can you let know more about self-hosted runner ?"*
  - Clarify the architecture, zero-cost GitHub billing decoupling, AWS infrastructure hosting, security posture (outbound polling only), and parallel job performance.

- **Activities:**
  - Structured a comprehensive yet digestible response covering:
    1. Core Definition: Dedicated company-controlled AWS EC2 VM vs GitHub's metered Azure VMs.
    2. Zero GitHub Quota Impact: 100% free unlimited runtime minutes on private repos without hitting spending limits.
    3. Concurrency & Throughput: 8 parallel worker daemons eliminating deployment queueing.
    4. Enterprise Security: Outbound HTTPS/WebSocket communication without inbound firewall exposure.
    5. Reversibility: Seamless dynamic switching back to GitHub runners if desired.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #33: Alternative Conversational & Senior-Aligned Communication Formats
- **Date / Timestamp:** 2026-10-26T14:34:00+05:30
- **User Request:**
  - Provide alternative message formats and tones (conversational, scannable, and problem-solution focused) to respond to Alisha's query regarding self-hosted runners.

- **Activities:**
  - Formulated 3 distinct communication alternatives:
    1. Conversational 1-on-1 Teams chat format (friendly, relatable, clear).
    2. Problem $\rightarrow$ Solution $\rightarrow$ Benefit format (fast to skim).
    3. Technical assurance format (reassuring about safety, official support, and zero code impact).

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #34: AWS EC2 Infrastructure Specifications Breakdown for Senior Reviewer
- **Date / Timestamp:** 2026-10-26T14:44:00+05:30
- **User Request:**
  - Provide an executive and technical infrastructure summary of the live AWS EC2 runner instance (`asint-github-actions-runner`, `i-0bf51cdca82e0113d`) to share with Alisha Verma.
  - Detail compute specifications, OS, networking, security controls (IMDSv2, outbound-only traffic), and cost predictability.

- **Activities:**
  - Extracted and compiled all core attributes from AWS EC2 console summary:
    1. Host & ID: `asint-github-actions-runner` (`i-0bf51cdca82e0113d`)
    2. Sizing: `t3.medium` (2 vCPUs, 4 GiB RAM + 8 GiB Swap pool, 30 GiB gp3 disk)
    3. OS Platform: Ubuntu Server 24.04 LTS (Canonical AMI `ami-02a9cdd4e98bc3c78`)
    4. Network Placement: `Test_VPC` (`vpc-0ea4439dbddab7278`), Region `us-east-1`
    5. Security & Isolation: IMDSv2 enforced, outbound HTTPS WebSocket polling to GitHub API with zero open inbound ports required.
    6. Economics: Flat, predictable hosting cost (~$30/mo) eliminating variable GitHub per-minute charges.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #35: Tailored Peer-Review Response to Sharan
- **Date / Timestamp:** 2026-10-26T14:50:00+05:30
- **User Request:**
  - Craft a tailored, clear, and friendly response to senior reviewer Sharan N answering: *"Hi Daxesh bhai bro, sorry need more info on this @"*
  - Integrate context from prior discussions with Ashweyth Sunil (official GitHub $0 billing proof) and Alisha Verma (AWS EC2 `t3.medium` runner architecture).

- **Activities:**
  - Formulated two friendly and technically complete responses matching the team's collegial tone ("Sharan Anna / bhai"):
    1. Comprehensive friendly breakdown: Explaining the GitHub minute exhaustion, the dedicated AWS EC2 runner host (`asint-github-actions-runner`), the 100% zero-logic-change scope of PR #19442, and official GitHub documentation proving $0 minute consumption on private repos.
    2. Short & conversational quick-read option.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #36: Clarification on Runner Connection Protocols (HTTPS vs SSH) & Script Provisioning
- **Date / Timestamp:** 2026-10-26T15:15:00+05:30
- **User Request:**
  - Inquire about an "SSH file to connect AWS instance to GitHub".

- **Activities:**
  - Clarified connection protocol architecture:
    1. GitHub Actions runners do **not** connect to GitHub over SSH. They communicate over **HTTPS (Port 443) via WebSocket/Long-Polling** using a registration token.
    2. SSH is solely used if a user wants to connect from their local computer to the AWS EC2 instance.
  - Created standalone automation script `scripts/setup_company_runners.sh` containing the clean-slate deployment script for 8 runners.
  - Provided local SSH helper script `scripts/connect_ec2.bat` for optional direct terminal access.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #37: Technical Walkthrough & Section-by-Section Explanation of setup_company_runners.sh
- **Date / Timestamp:** 2026-10-26T15:18:00+05:30
- **User Request:**
  - Provide a section-by-section explanation of `scripts/setup_company_runners.sh` to present and explain to colleagues.

- **Activities:**
  - Prepared structured educational walkthrough covering:
    1. Architectural intent (Zero-downtime, automated 8-worker registration).
    2. Deep-dive into each section: Configuration, legacy service cleanup, 8 GB swap safeguard, dependency verification/caching, unattended multi-worker deployment loop, and systemd persistence.
    3. Operational reliability safeguards (reboot auto-recovery, OOM protection, clean directory isolation).

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #38: Company Repository Registration Token Injection & Execution Package
- **Date / Timestamp:** 2026-10-26T16:00:00+05:30
- **User Request:**
  - Receive company repository registration token (`AXNICAWET234XXTVNAIMDJDK34LJA`) for `StillSomehowSane/asint_ais`.
  - Provide ready-to-execute script for AWS EC2 instance to register and activate 8 parallel self-hosted company runner daemons.

- **Activities:**
  - Injected token into `scripts/setup_company_runners.sh`.
  - Prepared execution instructions for EC2 Instance Connect browser terminal.

- **Files Modified:**
  - [`scripts/setup_company_runners.sh`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/scripts/setup_company_runners.sh)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #39: Runner Registration 404 Troubleshooting & URL/Scope Reconciliation
- **Date / Timestamp:** 2026-10-26T16:06:00+05:30
- **User Request:**
  - Diagnose error received during runner registration:
    `Http response code: NotFound from 'POST https://api.github.com/actions/runner-registration'` `Response status code does not indicate success: 404 (Not Found)`.

- **Activities:**
  - Diagnosed GitHub API 404 rejection root causes:
    1. Scope / URL Mismatch: Token generated at Organization level vs Repository level.
    2. Token Expiration: Registration token expired (1-hour window) or has character discrepancy.
    3. Disabled Actions / Self-Hosted Runner Permissions in target repository settings.
  - Formulated direct diagnostic steps and instructed user to verify the exact `./config.sh --url ... --token ...` command displayed on the admin's GitHub runner creation page.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #40: Account-Level vs Repository-Level Runner Registration Verification
- **Date / Timestamp:** 2026-10-26T16:10:00+05:30
- **User Request:**
  - Execute diagnostic registration commands testing both account/org scope (`https://github.com/StillSomehowSane`) and repository scope (`https://github.com/StillSomehowSane/asint_ais`) with token `AXNICAWET234XXTVNAIMDJDK34LJA`.

- **Activities:**
  - Verified repository attributes via GitHub API: `StillSomehowSane` is a personal account, `asint_ais` is private.
  - Formulated direct diagnostic commands for both scopes to isolate whether the token was issued at the account level or repository level.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #41: Confirmation of Runner Token Expiration & Fresh Token Acquisition
- **Date / Timestamp:** 2026-10-26T16:13:00+05:30
- **User Request:**
  - Review terminal results of both account-level and repository-level registration attempts.

- **Activities:**
  - Evaluated dual-scope failure: both `https://github.com/StillSomehowSane` and `https://github.com/StillSomehowSane/asint_ais` returned `404 Not Found`.
  - Confirmed root cause: registration token `AXNICAWET234XXTVNAIMDJDK34LJA` has expired due to elapsed time (>45 mins) or page closure/refresh on the repository admin's side.
  - Provided instructions to obtain a fresh token and execute the registration immediately upon receipt.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #42: Admin Communication Template for Active Runner Registration Token
- **Date / Timestamp:** 2026-10-26T16:16:00+05:30
- **User Request:**
  - Draft a polite, clear request to Ashweyth Sunil asking for a newly generated runner token, advising him to keep the runner creation tab open without refreshing so GitHub maintains token validity while the EC2 daemon registers.

- **Activities:**
  - Formulated two direct message options for Microsoft Teams explaining the 404 expiration behavior and requesting a live, active token.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #43: OS (Linux) & Architecture (x64) Specification in Token Request
- **Date / Timestamp:** 2026-10-26T16:18:00+05:30
- **User Request:**
  - Update the admin request to explicitly ask Ashweyth to select **Runner image: Linux** and **Architecture: x64** when generating the new runner registration token.

- **Activities:**
  - Integrated the OS and architecture parameters into the communication templates for Ashweyth.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #44: Live Fresh Company Registration Token Deployment & Execution
- **Date / Timestamp:** 2026-10-26T16:27:00+05:30
- **User Request:**
  - Receive active, freshly generated Linux x64 company registration token (`AXNICATPQ2ZAA3KCQIO2B73K347ZY`) for `StillSomehowSane/asint_ais`.
  - Provide ready-to-run automation block to execute immediately in EC2 Instance Connect browser terminal.

- **Activities:**
  - Injected token into `scripts/setup_company_runners.sh`.
  - Formulated full-execution script block for EC2 Instance Connect.

- **Files Modified:**
  - [`scripts/setup_company_runners.sh`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/scripts/setup_company_runners.sh)
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #45: 8 Company Runners Live Verification & Idempotency Red Line Clarification
- **Date / Timestamp:** 2026-10-26T16:32:00+05:30
- **User Request:**
  - Verify state after executing deployment script: 8 runners visible on `StillSomehowSane/asint_ais`.
  - Inquire regarding trailing red message: *"Cannot configure the runner because it is already configured. To reconfigure the runner, run 'config.cmd remove' or './config.sh remove' first."*

- **Activities:**
  - Verified live status in GitHub repository settings: all 8 runners (`asint-runner-01` through `asint-runner-08`) are **Online / Available** with labels `self-hosted, Linux, X64, asint-runner`.
  - Clarified that the red message is a standard GitHub Actions idempotency safeguard confirming `asint-runner-01` was already successfully configured and protected against duplicate overwrites. Confirmed **zero blockers**.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.

---

### Prompt #46: Admin Confirmation of 8 Live Runners & PR Approval Request
- **Date / Timestamp:** 2026-10-26T16:34:00+05:30
- **User Request:**
  - Formulate confirmation message to Ashweyth Sunil confirming successful connection of all 8 runner daemons on `StillSomehowSane/asint_ais`.
  - Request formal review and approval on PR #19442 to transition deployment workflows to target the AWS EC2 instance.

- **Activities:**
  - Prepared concise, professional communication for MS Teams with direct links to the active runners page and PR #19442.

- **Files Modified:**
  - [`checklist/PROMPT_CYCLE_LOG.md`](file:///e:/4%29%20Copy/GitHub%20Actions%20Copy%202/just-for-poc-GitHub-/checklist/PROMPT_CYCLE_LOG.md) on POC `origin/dev`

- **Status:** Completed and verified.




























