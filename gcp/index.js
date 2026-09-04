const https = require('https');

// =========================================================================
// 🔧 REPOSITORY & AUTHENTICATION CONFIGURATION
// =========================================================================
// You can toggle between POC and Production by commenting/uncommenting below,
// or by setting the GITHUB_REPO and GITHUB_PAT environment variables in GCP Cloud Run.

// 🧪 1. POC REPOSITORY (Currently Active for testing):
const GITHUB_REPO = process.env.GITHUB_REPO || 'Daxesh-Asint/GitHub-Actions-Trial-2';
const GITHUB_PAT  = process.env.GITHUB_PAT  || '';

// 🏢 2. FINAL COMPANY REPOSITORY (Commented out for now - uncomment when switching to production):
// const GITHUB_REPO = process.env.GITHUB_REPO || 'StillSomehowSane/asint_ais';
// const GITHUB_PAT  = process.env.GITHUB_PAT  || 'YOUR_COMPANY_GITHUB_PAT_HERE';

// =========================================================================
// 🔒 ANTI-SPAM DEBOUNCE LOCK (180 SECONDS)
// =========================================================================
let lastSnapshotTriggerTime = 0;
const SNAPSHOT_LOCK_DURATION_MS = 180 * 1000; // 180 seconds

/**
 * Helper to make HTTPS requests to GitHub API
 */
function callGitHubAPI(path, method, data, callback) {
  if (!GITHUB_PAT) {
    return callback(new Error('GITHUB_PAT is not configured. Please set GITHUB_PAT in GCP Cloud Run environment variables.'));
  }

  const payload = data ? JSON.stringify(data) : null;
  const options = {
    hostname: 'api.github.com',
    path: path,
    method: method,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${GITHUB_PAT}`,
      'User-Agent': 'GCP-Teams-DeployBot'
    }
  };

  if (payload) {
    options.headers['Content-Type'] = 'application/json';
    options.headers['Content-Length'] = Buffer.byteLength(payload);
  }

  const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        callback(null, res.statusCode, json);
      } catch (e) {
        callback(e, res.statusCode, body);
      }
    });
  });

  req.on('error', (err) => callback(err));
  if (payload) req.write(payload);
  req.end();
}

/**
 * Checks GitHub using Search API: Searches across ALL open APM-02 PRs
 */
function getActiveDeploymentPR(callback) {
  const query = encodeURIComponent(
    `repo:${GITHUB_REPO} is:pr is:open label:"APM-02 Active","APM-02 Deploying","APM-02 Failed","APM-02 Blocked","APM-02 Pre-Deploy Blocked","auto merge for APM02"`
  );

  callGitHubAPI(`/search/issues?q=${query}`, 'GET', null, (err, statusCode, res) => {
    if (err) return callback(err);
    if (!res || !Array.isArray(res.items)) {
      return callback(new Error('Invalid response from GitHub Search API'));
    }

    const activePr = res.items.length > 0 ? res.items[0] : null;
    callback(null, activePr);
  });
}

/**
 * Extracts the snapshot branch name from PR labels or body
 */
function extractSnapshotBranch(activePr) {
  if (activePr.head && activePr.head.ref) {
    return activePr.head.ref;
  }
  const match = (activePr.body || '').match(/`?(snapshot\/main-[^`\s]+)`?/);
  return match ? match[1] : (activePr.title.match(/snapshot\/main-[^\s]+/)?.[0] || 'snapshot branch');
}

/**
 * Generates tailored explanation with clean spacing and line breaks for MS Teams
 */
function getBlockedExplanation(activePr, botName) {
  const labelNames = (activePr.labels || []).map((l) => l.name);
  const snapshotBranch = extractSnapshotBranch(activePr);

  // 1️⃣ When SAP CI/CD is currently running
  if (labelNames.some((l) => /APM-02 Deploying/i.test(l))) {
    return (
      `### 🚫 APM-02 Deployment Blocked!\n\n` +
      `**🔵 Deployment Currently in Progress!**\n\n` +
      `SAP CI/CD is currently building and deploying the snapshot to APM-02.\n\n` +
      `* **Active PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
      `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
      `⏱️ *Deployment typically takes ~55–60 minutes. Please wait for the current cycle to finish before triggering a new one.*`
    );
  }

  // 2️⃣ When Previous Deployment Failed
  if (labelNames.some((l) => /APM-02 Failed/i.test(l))) {
    return (
      `### 🚫 APM-02 Deployment Blocked!\n\n` +
      `**🔴 Previous Deployment Failed!**\n\n` +
      `The previous SAP CI/CD deployment failed or auto-merge could not finish. The snapshot was **not merged into \`main\`**.\n\n` +
      `* **Blocking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
      `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
      `* **Action Required:** Please review the failed PR, investigate CI/CD logs, and resolve or close the PR before starting a new cycle.`
    );
  }

  // 3️⃣ When Blocked by Merge Conflicts
  if (labelNames.some((l) => /APM-02 Blocked|Pre-Deploy Blocked|Conflicts/i.test(l))) {
    return (
      `### 🚫 APM-02 Deployment Blocked!\n\n` +
      `**🟠 Deployment Blocked by Merge Conflicts!**\n\n` +
      `Merge conflicts were detected between the snapshot and the target branch.\n\n` +
      `* **Conflicting PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
      `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
      `* **Action Required:** Please resolve the merge conflicts directly in the PR before creating a new snapshot.`
    );
  }

  // 4️⃣ When an Active Snapshot is Waiting for Cherry-Picks
  return (
    `### 🚫 APM-02 Deployment Blocked!\n\n` +
    `**⏳ Active Cherry-Pick Window in Progress!**\n\n` +
    `A snapshot deployment is currently active and accepting cherry-picks.\n\n` +
    `* **Active PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
    `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
    `💡 *To deploy immediately, type* \`@${botName} deploy now\` *, or wait for the countdown to finish.*`
  );
}

/**
 * Main Cloud Function Entry Point
 */
exports.deployBot = (req, res) => {
  // 1. Verify POST request from MS Teams
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  // 2. Extract Bot Name dynamically from MS Teams payload
  //    Priority: Teams mention payload → BOT_NAME env var → 'Jarvis' fallback
  const botName =
    (req.body &&
      req.body.entities &&
      req.body.entities[0] &&
      req.body.entities[0].mentioned &&
      req.body.entities[0].mentioned.name) ||
    process.env.BOT_NAME || 'Jarvis';

  // 3. Clean user input (strip HTML tags like <at>Jarvis</at>)
  const rawText = req.body && req.body.text ? req.body.text : '';
  const cleanText = rawText.replace(/<[^>]*>/g, '').trim().toLowerCase();

  // -----------------------------------------------------------------------
  // COMMAND 1: share snapshot __m (PRIMARY) / share snapshot [minutes]
  // -----------------------------------------------------------------------
  if (
    cleanText.includes('share snapshot') ||
    cleanText.includes('deploy apm-02') ||
    cleanText.includes('deploy apm02')
  ) {
    const now = Date.now();
    const timeSinceLastTrigger = now - lastSnapshotTriggerTime;

    // 🔒 ANTI-SPAM LOCK: If triggered in the last 180 seconds, block duplicate run!
    if (timeSinceLastTrigger < SNAPSHOT_LOCK_DURATION_MS) {
      const secondsLeft = Math.ceil((SNAPSHOT_LOCK_DURATION_MS - timeSinceLastTrigger) / 1000);
      return res.status(200).json({
        type: 'message',
        text:
          `### ⏳ Snapshot Creation in Progress!\n\n` +
          `A snapshot request was initiated just a moment ago.\n\n` +
          `Please wait **${secondsLeft} seconds** for the GitHub Actions workflow to finish creating the snapshot branch and tracking PR.\n\n` +
          `📢 *The notification card will appear in this channel shortly.*`
      });
    }

    const match = cleanText.match(/(?:share\s+snapshot|deploy\s+apm-?02).*?(\d+)\s*(?:m|min|mins|minutes)?/);
    const waitingMinutes = match ? match[1] : '60';

    // 🛡️ Pre-Check across ALL open PRs using Search API
    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return res.status(200).json({
          type: 'message',
          text: `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`
        });
      }

      // 🚫 IF PREVIOUS CYCLE IS NOT COMPLETE: BLOCK AND GIVE TAILORED EXPLANATION!
      if (activePr) {
        return res.status(200).json({
          type: 'message',
          text: getBlockedExplanation(activePr, botName)
        });
      }

      // 🔒 ENGAGE THE 180s LOCK!
      lastSnapshotTriggerTime = Date.now();

      // ✅ IF SYSTEM IS IDLE: TRIGGER GITHUB ACTIONS!
      callGitHubAPI(
        `/repos/${GITHUB_REPO}/dispatches`,
        'POST',
        { event_type: 'trigger_apm02_deployment', client_payload: { waiting_minutes: waitingMinutes } },
        (dispatchErr, statusCode) => {
          if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
            // If dispatch failed, release lock
            lastSnapshotTriggerTime = 0;
            return res.status(200).json({
              type: 'message',
              text: `❌ **Failed to trigger workflow.** GitHub API returned status: ${statusCode || dispatchErr.message}`
            });
          }
          res.status(200).json({
            type: 'message',
            text:
              `🚀 **On it! Initiating APM-02 Snapshot Deployment...**\n\n` +
              `* **Waiting Window:** ${waitingMinutes} minutes\n\n` +
              `* **Source Branch:** \`main\`\n\n` +
              `📢 *An active deployment card will be posted to this channel shortly.*`
          });
        }
      );
    });

  // -----------------------------------------------------------------------
  // COMMAND 2: deploy now (PRIMARY) / force start
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('deploy now') || cleanText.includes('force start')) {
    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'adjust_apm02_wait', client_payload: { deploy_now: 'true' } },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return res.status(200).json({
            type: 'message',
            text: `❌ **Failed to trigger immediate deployment.** GitHub status: ${statusCode || err.message}`
          });
        }
        res.status(200).json({
          type: 'message',
          text: `⚡ **Immediate Deployment Triggered!**\n\nBypassing the remaining waiting window. Merging snapshot into APM-02 and initiating SAP CI/CD immediately.`
        });
      }
    );

  // -----------------------------------------------------------------------
  // COMMAND 3: extend __m (PRIMARY) / extend [minutes]
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('extend')) {
    const match = cleanText.match(/extend\s+(\d+)/);
    const extendMinutes = match ? match[1] : '10';

    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'adjust_apm02_wait', client_payload: { deploy_now: 'false', adjust_minutes: extendMinutes } },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return res.status(200).json({
            type: 'message',
            text: `❌ **Failed to extend window.** GitHub status: ${statusCode || err.message}`
          });
        }
        res.status(200).json({
          type: 'message',
          text: `⏳ **Understood!** Added **+${extendMinutes} minutes** to the cherry-picking window.`
        });
      }
    );

  // -----------------------------------------------------------------------
  // COMMAND 4: reduce __m (PRIMARY) / reduce [minutes]
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('reduce') || cleanText.includes('decrease')) {
    const match = cleanText.match(/(?:reduce|decrease)\s+(\d+)/);
    const reduceMinutes = match ? `-${match[1]}` : '-10';

    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'adjust_apm02_wait', client_payload: { deploy_now: 'false', adjust_minutes: reduceMinutes } },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return res.status(200).json({
            type: 'message',
            text: `❌ **Failed to reduce window.** GitHub status: ${statusCode || err.message}`
          });
        }
        res.status(200).json({
          type: 'message',
          text: `⏩ **Done!** Reduced the waiting window by **${Math.abs(parseInt(reduceMinutes, 10))} minutes**.`
        });
      }
    );

  // -----------------------------------------------------------------------
  // COMMAND 5: status (PRIMARY)
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('status')) {
    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return res.status(200).json({
          type: 'message',
          text: `❌ **Error querying status:** ${err.message}`
        });
      }
      if (!activePr) {
        return res.status(200).json({
          type: 'message',
          text: `🟢 **System Status: IDLE**\n\nNo APM-02 deployment is currently active. You can start a new snapshot anytime.`
        });
      }
      const labels = (activePr.labels || []).map((l) => l.name).join(', ');
      const snapshotBranch = extractSnapshotBranch(activePr);
      res.status(200).json({
        type: 'message',
        text:
          `### 🔵 Active Deployment in Progress\n\n` +
          `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
          `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
          `* **Current State:** \`${labels}\`\n\n` +
          `* **Initiated by:** @${activePr.user ? activePr.user.login : 'github-actions'}`
      });
    });

  // -----------------------------------------------------------------------
  // COMMAND 6: help (PRIMARY)
  // -----------------------------------------------------------------------
  } else {
    res.status(200).json({
      type: 'message',
      text:
        `### ⚡ ${botName} - APM-02 Deployment Commands\n\n` +
        `* **\`@${botName} share snapshot 60m\`**\n\n` +
        `  Start snapshot deployment with custom (e.g. 30m, 45m) or default (60m) window\n\n` +
        `* **\`@${botName} deploy now\`**\n\n` +
        `  Skip remaining wait time and deploy immediately to APM-02\n\n` +
        `* **\`@${botName} extend 10m\`**\n\n` +
        `  Add extra minutes to the current countdown\n\n` +
        `* **\`@${botName} reduce 5m\`**\n\n` +
        `  Subtract minutes from the current countdown\n\n` +
        `* **\`@${botName} status\`**\n\n` +
        `  Check real-time APM-02 deployment status\n\n` +
        `* **\`@${botName} help\`**\n\n` +
        `  Display this command guide`
    });
  }
};
