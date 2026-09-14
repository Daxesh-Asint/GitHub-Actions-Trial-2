# GCP Cloud Function / Cloud Run - MS Teams Deployment Bot (Jarvis)

This directory contains the source code for the Microsoft Teams bot webhook hosted on Google Cloud Platform (Cloud Functions / Cloud Run). It supports deployment commands for all 14 environments with strict channel isolation.

---

## 📁 Modular File Architecture

* **`index.js`**: Clean entry point (`deployBot`) and request router. Extracts channel context, enforces channel boundaries, dispatches commands, and manages anti-spam debounce locks.
* **`environments.js`**: Comprehensive registry of all 14 environments, their dedicated MS Teams channel names, aliases, and GitHub Action `repository_dispatch` event triggers.
* **`config.js`**: Centralized configuration reading environment variables (`GITHUB_REPO`, `GITHUB_PAT`, `TEAMS_WEBHOOK_URL`, `BOT_NAME`), plus per-channel webhook resolution.
* **`teams.js`**: Microsoft Teams communication handler. Builds and broadcasts rich Adaptive Cards to channel incoming webhooks or returns direct HTTP 200 card responses.
* **`github.js`**: GitHub REST & Search API client. Contains `callGitHubAPI()`, `getActiveDeploymentPR()`, `extractSnapshotBranch()`, and `triggerWorkflowDispatch()`.
* **`messages.js`**: User-facing message templates, channel mismatch warnings, deploy confirmation cards, real-time status cards, and channel-aware help guides.
* **`test_routing.js`**: Automated verification test suite for multi-environment routing and channel boundary enforcement.
* **`package.json`**: Node.js package specification for GCP Cloud Functions / Cloud Run runtime.
* **`.env.example`**: Reference template for required environment variables.

---

## 🔒 Channel Boundary Isolation Rules

Every environment has its own dedicated MS Teams channel:
1. When a user runs `@Jarvis deploy` in `AIS-02 Deployment POC`, it deploys **AIS-02**.
2. If a user attempts to run `@Jarvis deploy apm-01` inside the `AIS-02 Deployment POC` channel, Jarvis blocks the command and instructs them to go to the `APM-01 Deployment POC` channel.
3. Snapshot and cherry-picking commands (`@Jarvis share snapshot`, `@Jarvis extend`, etc.) are strictly isolated to the **APM-02 Deployment POC** channel.

---

## 🗺️ Channel & Environment Mapping

| Channel Name (MS Teams) | Target Environment | Dispatch Event Triggered |
| :--- | :--- | :--- |
| **AIS-02 Deployment POC** | AIS-02 | `trigger_ais02_deployment` |
| **APM-01 Deployment POC** | APM-01 | `trigger_apm01_deployment` |
| **APM-02 Deployment POC** | APM-02 | *(Dedicated snapshot & cherry-pick cycle)* |
| **APM-EIOT Deployment POC** | APM-EIOT | `trigger_apm_eiot_deployment` |
| **AsInt Demo Deployment POC** | AsInt Demo | `trigger_asint_demo_deployment` |
| **BAYSTAR Deployment POC** | BAYSTAR | `trigger_baystar_deployment` |
| **HSC Non-Prod Deployment POC** | HSC Non-Prod | `trigger_hsc_non_prod_deployment` |
| **HSC Prod Deployment POC** | HSC Prod | `trigger_hsc_prod_deployment` |
| **Indorama Prod 900 Deployment POC** | Indorama Prod 900 | `trigger_indorama_prod_900_deployment` |
| **Indorama Prod 933 Deployment POC** | Indorama Prod 933 | `trigger_indorama_prod_933_deployment` |
| **Indorama QA 233 Deployment POC** | Indorama QA 233 | `trigger_indorama_qa_233_deployment` |
| **Indorama QA 234 Deployment POC** | Indorama QA 234 | `trigger_indorama_qa_234_deployment` |
| **IRC Deployment POC** | IRC | `trigger_irc_deployment` |
| **ST-ENV Deployment POC** | ST-ENV | `trigger_st_env_deployment` |

---

## ⚙️ Cloud Function Configuration

* **Function Name:** `deploybot-poc` (or your chosen function name)
* **Trigger:** HTTPS (Allow unauthenticated invocations so MS Teams can post webhooks)
* **Runtime:** Node.js 20 or Node.js 22
* **Entry Point:** `deployBot`

### Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `GITHUB_PAT` | **(Required)** GitHub Personal Access Token with `repo` and `workflow` scopes | `github_pat_...` |
| `GITHUB_REPO` | Target GitHub repository (`owner/repo`) | `Daxesh-Asint/GitHub-Actions-Trial-2` |
| `BOT_NAME` | *(Optional)* Fallback bot name if not extracted from Teams mention | `Jarvis` |
| `TEAMS_WEBHOOK_URL` | *(Optional)* Fallback Incoming Webhook URL | `https://asint.webhook.office.com/...` |
| `TEAMS_WEBHOOK_<ENV>_1` | *(Optional)* Per-channel Incoming Webhook URLs for direct feed delivery | `https://asint.webhook.office.com/...` |

---

## 📋 Copying Files into GCP Cloud Run / Functions Console

In the GCP Cloud Run / Cloud Functions inline source editor:
1. Create and copy over each file:
   - `environments.js`
   - `config.js`
   - `teams.js`
   - `github.js`
   - `messages.js`
   - `index.js`
   - `package.json`
2. Ensure **Function entry point** is set to `deployBot`.
3. Click **Save and redeploy**.
