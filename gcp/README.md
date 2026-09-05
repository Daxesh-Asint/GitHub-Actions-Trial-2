# GCP Cloud Function / Cloud Run - MS Teams Deployment Bot (Jarvis)

This directory contains the source code for the Microsoft Teams bot webhook hosted on Google Cloud Platform (Cloud Functions / Cloud Run).

---

## 📁 Files

* **`index.js`**: Core webhook handler with multi-environment routing, channel isolation (`AIS-02 Deployment` vs `APM-02 Deployment`), debounce anti-spam locks, and GitHub API dispatching.
* **`package.json`**: Node.js package specification for the GCP Cloud Function runtime.
* **`.env.example`**: Reference template for required environment variables.

---

## ⚙️ Cloud Function Configuration

When configuring or deploying the Cloud Function in the GCP Console:

* **Function Name:** `jarvis-teams-bot` (or your chosen function name)
* **Trigger:** HTTPS (Allow unauthenticated invocations so MS Teams can send webhooks)
* **Runtime:** Node.js 18 or Node.js 20
* **Entry Point:** `deployBot`

### Environment Variables

Set the following in the **Runtime, build, connections and security settings** -> **Environment variables**:

| Variable | Description | Example |
| :--- | :--- | :--- |
| `GITHUB_PAT` | **(Required)** GitHub Personal Access Token with `repo` and `workflow` scopes | `github_pat_...` |
| `GITHUB_REPO` | Target GitHub repository (`owner/repo`) | `Daxesh-Asint/GitHub-Actions-Trial-2` *(or `StillSomehowSane/asint_ais`)* |
| `BOT_NAME` | *(Optional)* Fallback bot name if not extracted from Teams mention | `Jarvis` |
| `TEAMS_WEBHOOK_URL` | *(Recommended)* Channel Incoming Webhook URL to post responses directly into the main channel feed (prevents collapsed "1 reply" thread) | `https://asint.webhook.office.com/webhookb2/...` |

---

## 🚀 Channel-Specific Commands

### 1. `AIS-02 Deployment` Channel
* `@Jarvis deploy` *(or `@Jarvis sync`)* — Trigger on-demand auto-merge and deployment to AIS-02.
* `@Jarvis status` — Query active AIS-02 auto-merge PR.
* `@Jarvis help` — Display AIS-02 commands.

### 2. `APM-02 Deployment` Channel
* `@Jarvis share snapshot [minutes]` — Initiate snapshot deployment (default: 60m).
* `@Jarvis deploy now` — Bypass remaining waiting countdown and deploy immediately.
* `@Jarvis extend [minutes]` — Add minutes to the countdown window.
* `@Jarvis reduce [minutes]` — Decrease minutes from countdown window.
* `@Jarvis status` — Query active APM-02 deployment PR.
* `@Jarvis help` — Display APM-02 commands.

---

## 🛡️ Cross-Channel Guard

The bot automatically identifies the channel by name:
* If APM-02 commands are sent inside the `AIS-02 Deployment` channel, the bot politely blocks them and instructs the user to switch to the `APM-02 Deployment` channel.
* If AIS-02 commands are sent inside the `APM-02 Deployment` channel, the bot politely blocks them and instructs the user to switch to the `AIS-02 Deployment` channel.
