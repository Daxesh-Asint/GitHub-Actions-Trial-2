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
