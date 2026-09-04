const https = require('https');

// =========================================================================
// 🔧 REPOSITORY & AUTHENTICATION CONFIGURATION
// =========================================================================
// You can toggle between POC and Production by commenting/uncommenting below,
// or by setting the GITHUB_REPO and GITHUB_PAT environment variables in GCP.

// 🧪 1. POC REPOSITORY (Currently Active for testing):
const GITHUB_REPO = process.env.GITHUB_REPO || 'Daxesh-Asint/GitHub-Actions-Trial-2';
const GITHUB_PAT  = process.env.GITHUB_PAT  || '';

// 🏢 2. FINAL COMPANY REPOSITORY (Commented out for now - uncomment when switching to production):
// const GITHUB_REPO = process.env.GITHUB_REPO || 'StillSomehowSane/asint_ais';
// const GITHUB_PAT  = process.env.GITHUB_PAT  || 'YOUR_COMPANY_GITHUB_PAT_HERE';

// =========================================================================
// 🔒 ANTI-SPAM DEBOUNCE LOCKS
// =========================================================================
let lastSnapshotTriggerTime = 0;
const SNAPSHOT_LOCK_DURATION_MS = 180 * 1000; // 180 seconds for APM-02

let lastAis02TriggerTime = 0;
const AIS02_LOCK_DURATION_MS = 60 * 1000; // 60 seconds for AIS-02

/**
 * Helper to make HTTPS requests to GitHub API
 */
function callGitHubAPI(path, method, data, callback) {
  if (!GITHUB_PAT) {
    return callback(new Error('GITHUB_PAT environment variable is not configured in GCP Cloud Function'));
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
 * Detects target environment based on MS Teams Channel Name
 */
function detectEnvironment(reqBody) {
  let channelName = '';
  if (reqBody && reqBody.channelData && reqBody.channelData.channel && reqBody.channelData.channel.name) {
    channelName = reqBody.channelData.channel.name;
  } else if (reqBody && reqBody.conversation && reqBody.conversation.name) {
    channelName = reqBody.conversation.name;
  }

  const lower = channelName.toLowerCase();
  if (lower.includes('ais-02') || lower.includes('ais02')) {
    return { env: 'AIS-02', channelName: channelName || 'AIS-02 Deployment' };
  }
  if (lower.includes('apm-02') || lower.includes('apm02')) {
    return { env: 'APM-02', channelName: channelName || 'APM-02 Deployment' };
  }

  // Future extensible environments (e.g. APM-01, AIS-01, QA-01)
  const match = lower.match(/(apm|ais|qa)-?(\d+)/i);
  if (match) {
    return { env: `${match[1].toUpperCase()}-${match[2].padStart(2, '0')}`, channelName };
  }

  return { env: 'UNKNOWN', channelName };
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
 * Checks GitHub for any open AIS-02 auto-merge PRs
 */
function getActiveAis02PR(callback) {
  const query = encodeURIComponent(
    `repo:${GITHUB_REPO} is:pr is:open base:tenant/asint-ais-02 head:dev`
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

  // 3. Detect originating channel & target environment
  const { env: channelEnv, channelName } = detectEnvironment(req.body);

  // 4. Clean user input (strip HTML tags like <at>Jarvis</at>)
  const rawText = req.body && req.body.text ? req.body.text : '';
  const cleanText = rawText.replace(/<[^>]*>/g, '').trim().toLowerCase();

  // Helper to send standard MS Teams markdown response
  const sendReply = (text) => res.status(200).json({ type: 'message', text });

  // =========================================================================
  // 🛡️ CHANNEL CROSS-COMMAND GUARD
  // =========================================================================
  const isApmCommand =
    cleanText.includes('share snapshot') ||
    cleanText.includes('deploy apm') ||
    cleanText.includes('deploy now') ||
    cleanText.includes('force start') ||
    cleanText.includes('extend') ||
    cleanText.includes('reduce') ||
    cleanText.includes('decrease');

  const isAisCommand =
    cleanText.includes('deploy ais') ||
    cleanText.includes('sync ais') ||
    cleanText.includes('trigger ais');

  // Rule 1: APM commands issued inside AIS-02 channel
  if (channelEnv === 'AIS-02' && isApmCommand) {
    return sendReply(
      `⚠️ **Command Not Allowed in this Channel**\n\n` +
      `This channel (**${channelName}**) is dedicated to **AIS-02**.\n\n` +
      `APM-02 commands like \`share snapshot\`, \`deploy now\`, \`extend\`, etc. can only be used in the **APM-02 Deployment** channel.\n\n` +
      `💡 *Type* \`@${botName} help\` *to see commands available for AIS-02.*`
    );
  }

  // Rule 2: AIS commands issued inside APM-02 channel
  if (channelEnv === 'APM-02' && isAisCommand) {
    return sendReply(
      `⚠️ **Command Not Allowed in this Channel**\n\n` +
      `This channel (**${channelName}**) is dedicated to **APM-02**.\n\n` +
      `AIS-02 commands can only be used in the **AIS-02 Deployment** channel.\n\n` +
      `💡 *Type* \`@${botName} help\` *to see commands available for APM-02.*`
    );
  }

  // =========================================================================
  // 🚀 SECTION A: AIS-02 COMMANDS
  // (Active in 'AIS-02 Deployment' channel or when 'ais' is explicitly typed)
  // =========================================================================
  if (
    channelEnv === 'AIS-02' && (cleanText === 'deploy' || cleanText === 'sync' || cleanText.includes('deploy') || cleanText.includes('sync')) ||
    isAisCommand
  ) {
    const now = Date.now();
    const timeSinceLastTrigger = now - lastAis02TriggerTime;

    // 🔒 ANTI-SPAM LOCK: 60 seconds debounce for AIS-02
    if (timeSinceLastTrigger < AIS02_LOCK_DURATION_MS) {
      const secondsLeft = Math.ceil((AIS02_LOCK_DURATION_MS - timeSinceLastTrigger) / 1000);
      return sendReply(
        `### ⏳ AIS-02 Deployment in Progress!\n\n` +
        `An AIS-02 deployment trigger was dispatched just a moment ago.\n\n` +
        `Please wait **${secondsLeft} seconds** before triggering again.\n\n` +
        `📢 *Status card will appear in this channel once the merge check completes.*`
      );
    }

    lastAis02TriggerTime = Date.now();

    // Trigger GitHub Action for AIS-02
    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'trigger_ais02_deployment' },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          lastAis02TriggerTime = 0; // Release lock on failure
          return sendReply(`❌ **Failed to trigger AIS-02 deployment.** GitHub API returned status: ${statusCode || err.message}`);
        }
        sendReply(
          `🚀 **On it! Initiating AIS-02 Auto-Merge & Deployment...**\n\n` +
          `* **Source Branch:** \`dev\`\n\n` +
          `* **Target Branch:** \`tenant/asint-ais-02\`\n\n` +
          `📢 *An active deployment / sync card will be posted to this channel shortly.*`
        );
      }
    );
    return;
  }

  // =========================================================================
  // 📦 SECTION B: APM-02 COMMANDS
  // =========================================================================

  // COMMAND B1: share snapshot __m / deploy apm-02
  if (
    cleanText.includes('share snapshot') ||
    cleanText.includes('deploy apm-02') ||
    cleanText.includes('deploy apm02') ||
    (channelEnv === 'APM-02' && (cleanText === 'deploy' || cleanText.startsWith('deploy ')))
  ) {
    const now = Date.now();
    const timeSinceLastTrigger = now - lastSnapshotTriggerTime;

    // 🔒 ANTI-SPAM LOCK: 180 seconds for APM-02
    if (timeSinceLastTrigger < SNAPSHOT_LOCK_DURATION_MS) {
      const secondsLeft = Math.ceil((SNAPSHOT_LOCK_DURATION_MS - timeSinceLastTrigger) / 1000);
      return sendReply(
        `### ⏳ Snapshot Creation in Progress!\n\n` +
        `A snapshot request was initiated just a moment ago.\n\n` +
        `Please wait **${secondsLeft} seconds** for the GitHub Actions workflow to finish creating the snapshot branch and tracking PR.\n\n` +
        `📢 *The notification card will appear in this channel shortly.*`
      );
    }

    const match = cleanText.match(/(?:share\s+snapshot|deploy\s+apm-?02|deploy).*?(\d+)\s*(?:m|min|mins|minutes)?/);
    const waitingMinutes = match ? match[1] : '60';

    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return sendReply(`⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`);
      }

      if (activePr) {
        return sendReply(getBlockedExplanation(activePr, botName));
      }

      lastSnapshotTriggerTime = Date.now();

      callGitHubAPI(
        `/repos/${GITHUB_REPO}/dispatches`,
        'POST',
        { event_type: 'trigger_apm02_deployment', client_payload: { waiting_minutes: waitingMinutes } },
        (dispatchErr, statusCode) => {
          if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
            lastSnapshotTriggerTime = 0;
            return sendReply(`❌ **Failed to trigger workflow.** GitHub API returned status: ${statusCode || dispatchErr.message}`);
          }
          sendReply(
            `🚀 **On it! Initiating APM-02 Snapshot Deployment...**\n\n` +
            `* **Waiting Window:** ${waitingMinutes} minutes\n\n` +
            `* **Source Branch:** \`main\`\n\n` +
            `📢 *An active deployment card will be posted to this channel shortly.*`
          );
        }
      );
    });

  // COMMAND B2: deploy now / force start
  } else if (cleanText.includes('deploy now') || cleanText.includes('force start')) {
    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'adjust_apm02_wait', client_payload: { deploy_now: 'true' } },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return sendReply(`❌ **Failed to trigger immediate deployment.** GitHub status: ${statusCode || err.message}`);
        }
        sendReply(
          `⚡ **Immediate Deployment Triggered!**\n\n` +
          `Bypassing the remaining waiting window. Merging snapshot into APM-02 and initiating SAP CI/CD immediately.`
        );
      }
    );

  // COMMAND B3: extend __m
  } else if (cleanText.includes('extend')) {
    const match = cleanText.match(/extend\s+(\d+)/);
    const extendMinutes = match ? match[1] : '10';

    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'adjust_apm02_wait', client_payload: { deploy_now: 'false', adjust_minutes: extendMinutes } },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return sendReply(`❌ **Failed to extend window.** GitHub status: ${statusCode || err.message}`);
        }
        sendReply(`⏳ **Understood!** Added **+${extendMinutes} minutes** to the cherry-picking window.`);
      }
    );

  // COMMAND B4: reduce __m
  } else if (cleanText.includes('reduce') || cleanText.includes('decrease')) {
    const match = cleanText.match(/(?:reduce|decrease)\s+(\d+)/);
    const reduceMinutes = match ? `-${match[1]}` : '-10';

    callGitHubAPI(
      `/repos/${GITHUB_REPO}/dispatches`,
      'POST',
      { event_type: 'adjust_apm02_wait', client_payload: { deploy_now: 'false', adjust_minutes: reduceMinutes } },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return sendReply(`❌ **Failed to reduce window.** GitHub status: ${statusCode || err.message}`);
        }
        sendReply(`⏩ **Done!** Reduced the waiting window by **${Math.abs(parseInt(reduceMinutes, 10))} minutes**.`);
      }
    );

  // =========================================================================
  // 📊 SECTION C: STATUS COMMAND (CHANNEL-AWARE)
  // =========================================================================
  } else if (cleanText.includes('status')) {
    // If in AIS-02 channel
    if (channelEnv === 'AIS-02') {
      getActiveAis02PR((err, activePr) => {
        if (err) {
          return sendReply(`❌ **Error querying AIS-02 status:** ${err.message}`);
        }
        if (!activePr) {
          return sendReply(
            `🟢 **AIS-02 Status: IDLE / UP TO DATE**\n\n` +
            `* **Source:** \`dev\`\n\n` +
            `* **Target:** \`tenant/asint-ais-02\`\n\n` +
            `No pending or blocked auto-merge PR. You can trigger deployment anytime using \`@${botName} deploy\`.`
          );
        }
        sendReply(
          `### 🔵 Open AIS-02 Auto-Merge PR Detected\n\n` +
          `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
          `* **Title:** ${activePr.title}\n\n` +
          `* **Created:** ${new Date(activePr.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST`
        );
      });
    } else {
      // Default to APM-02 status
      getActiveDeploymentPR((err, activePr) => {
        if (err) {
          return sendReply(`❌ **Error querying APM-02 status:** ${err.message}`);
        }
        if (!activePr) {
          return sendReply(
            `🟢 **APM-02 Status: IDLE**\n\n` +
            `No APM-02 deployment is currently active. You can start a new snapshot anytime.`
          );
        }
        const labels = (activePr.labels || []).map((l) => l.name).join(', ');
        const snapshotBranch = extractSnapshotBranch(activePr);
        sendReply(
          `### 🔵 Active APM-02 Deployment in Progress\n\n` +
          `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
          `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
          `* **Current State:** \`${labels}\`\n\n` +
          `* **Initiated by:** @${activePr.user ? activePr.user.login : 'github-actions'}`
        );
      });
    }

  // =========================================================================
  // ❓ SECTION D: HELP COMMAND (CHANNEL-AWARE)
  // =========================================================================
  } else {
    // If in AIS-02 channel, show AIS-02 specific commands
    if (channelEnv === 'AIS-02') {
      sendReply(
        `### ⚡ ${botName} - AIS-02 Deployment Commands\n\n` +
        `* **\`@${botName} deploy\`** (or **\`@${botName} sync\`**)\n\n` +
        `  Trigger on-demand auto-merge from \`dev\` to \`tenant/asint-ais-02\` and initiate SAP CI/CD deployment\n\n` +
        `* **\`@${botName} status\`**\n\n` +
        `  Check current AIS-02 deployment / auto-merge status\n\n` +
        `* **\`@${botName} help\`**\n\n` +
        `  Display this command guide for AIS-02`
      );
    // If in APM-02 channel, show APM-02 specific commands
    } else if (channelEnv === 'APM-02') {
      sendReply(
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
        `  Display this command guide for APM-02`
      );
    // If unknown channel or direct message, show all environments
    } else {
      sendReply(
        `### ⚡ ${botName} - Deployment Command Guide\n\n` +
        `#### 🔹 APM-02 Commands (Use in **APM-02 Deployment** channel)\n\n` +
        `* \`@${botName} share snapshot [minutes]\` — Start snapshot deployment (default: 60m)\n` +
        `* \`@${botName} deploy now\` — Trigger immediate deployment\n` +
        `* \`@${botName} extend [minutes]\` — Add minutes to wait window\n` +
        `* \`@${botName} reduce [minutes]\` — Reduce wait window\n` +
        `* \`@${botName} status\` — Check APM-02 status\n\n` +
        `#### 🔹 AIS-02 Commands (Use in **AIS-02 Deployment** channel)\n\n` +
        `* \`@${botName} deploy\` (or \`sync\`) — Trigger on-demand auto-merge and deployment to AIS-02\n` +
        `* \`@${botName} status\` — Check AIS-02 status`
      );
    }
  }
};
