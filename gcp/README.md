# GCP Cloud Function / Cloud Run - MS Teams Deployment Bot (Jarvis)

This directory contains the source code for the Microsoft Teams bot webhook hosted on Google Cloud Platform (Cloud Functions / Cloud Run).

---

## 📁 Modular File Architecture

Instead of having everything bundled into a single monolithic `index.js`, the code is organized into modular files:

* **`index.js`**: Clean entry point (`deployBot`) and request router. Dispatches user commands to respective modules and manages the anti-spam debounce lock.
* **`config.js`**: Centralized configuration reading environment variables (`GITHUB_REPO`, `GITHUB_PAT`, `TEAMS_WEBHOOK_URL`, `BOT_NAME`, and debounce lock duration).
* **`teams.js`**: Microsoft Teams communication handler. Contains `sendBotResponse()` and `postToTeamsWebhook()` using Adaptive Cards to deliver responses directly into the main channel feed (preventing collapsed thread replies).
* **`github.js`**: GitHub REST & Search API client. Contains `callGitHubAPI()`, `getActiveDeploymentPR()`, `extractSnapshotBranch()`, and `triggerWorkflowDispatch()`.
* **`messages.js`**: User-facing message templates, blocked reason formatters, real-time status card bodies, and command help text.
* **`package.json`**: Node.js package specification for GCP Cloud Functions / Cloud Run runtime.
* **`.env.example`**: Reference template for required environment variables.

---

## ⚙️ Cloud Function Configuration

When configuring or deploying the Cloud Function in the GCP Console:

* **Function Name:** `deploybot-apm02-poc` (or your chosen function name)
* **Trigger:** HTTPS (Allow unauthenticated invocations so MS Teams can send webhooks)
* **Runtime:** Node.js 20 or Node.js 22
* **Entry Point:** `deployBot`

### Environment Variables

Set the following in **Runtime, build, connections and security settings** -> **Environment variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `GITHUB_PAT` | **(Required)** GitHub Personal Access Token with `repo` and `workflow` scopes | `github_pat_...` |
| `GITHUB_REPO` | Target GitHub repository (`owner/repo`) | `Daxesh-Asint/GitHub-Actions-Trial-2` *(or `StillSomehowSane/asint_ais`)* |
| `BOT_NAME` | *(Optional)* Fallback bot name if not extracted from Teams mention | `Jarvis` |
| `TEAMS_WEBHOOK_URL` | *(Recommended)* Channel Incoming Webhook URL to post responses directly into the main channel feed (prevents collapsed "1 reply" thread) | `https://asint.webhook.office.com/webhookb2/...` |

---

## 📋 Copying Files into GCP Cloud Run Console

In the GCP Cloud Run / Cloud Functions inline source editor:
1. Click the `+` icon or use the file explorer to add each file next to `index.js` and `package.json`:
   - `config.js`
   - `teams.js`
   - `github.js`
   - `messages.js`
   - `index.js`
   - `package.json`
2. Paste the corresponding code into each file.
3. Ensure **Function entry point** is set to `deployBot`.
4. Click **Save and redeploy**.

---

## 🚀 Supported Commands

* **`@Jarvis share snapshot [minutes]`** — Initiate snapshot deployment (default: 60m).
* **`@Jarvis deploy now`** — Bypass remaining waiting countdown and deploy immediately.
* **`@Jarvis extend [minutes]`** — Add minutes to the countdown window.
* **`@Jarvis reduce [minutes]`** — Decrease minutes from countdown window.
* **`@Jarvis re-trigger`** — Restart SAP CI/CD deployment without code changes (transient timeout/glitch retry).
* **`@Jarvis deployment fix pushed, re-deploy`** — Re-merge snapshot to APM-02 and trigger SAP CI/CD after pushing a build fix.
* **`@Jarvis status`** — Query real-time deployment status and active tracking PR.
* **`@Jarvis help`** — Display command reference guide.
