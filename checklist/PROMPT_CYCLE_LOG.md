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

- **Git Commit:** Pending push on branch `dev`.
- **Status:** Tested syntax, committed, and pushed to `origin/dev`.

---


