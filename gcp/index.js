const config = require('./config');
const {
  callGitHubAPI,
  getActiveDeploymentPR,
  triggerWorkflowDispatch
} = require('./github');
const { sendBotResponse } = require('./teams');
const {
  getBlockedExplanation,
  getHelpMessage,
  getStatusMessage
} = require('./messages');

// =========================================================================
// 🔒 ANTI-SPAM DEBOUNCE LOCK (180 SECONDS)
// =========================================================================
let lastSnapshotTriggerTime = 0;

/**
 * Main Cloud Function / Cloud Run Entry Point
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
    config.DEFAULT_BOT_NAME;

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
    if (timeSinceLastTrigger < config.SNAPSHOT_LOCK_DURATION_MS) {
      const secondsLeft = Math.ceil(
        (config.SNAPSHOT_LOCK_DURATION_MS - timeSinceLastTrigger) / 1000
      );
      return sendBotResponse(
        res,
        `A snapshot request was initiated just a moment ago.\n\n` +
        `Please wait **${secondsLeft} seconds** for the GitHub Actions workflow to finish creating the snapshot branch and tracking PR.\n\n` +
        `📢 *The notification card will appear in this channel shortly.*`,
        `⏳ Snapshot Creation in Progress!`
      );
    }

    const match = cleanText.match(/(?:share\s+snapshot|deploy\s+apm-?02).*?(\d+)\s*(?:m|min|mins|minutes)?/);
    const waitingMinutes = match ? match[1] : '60';

    // 🛡️ Pre-Check across ALL open PRs using Search API
    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return sendBotResponse(
          res,
          `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`
        );
      }

      // 🚫 IF PREVIOUS CYCLE IS NOT COMPLETE: BLOCK AND GIVE TAILORED EXPLANATION!
      if (activePr) {
        const blockedInfo = getBlockedExplanation(activePr, botName);
        return sendBotResponse(res, blockedInfo.body, blockedInfo.title);
      }

      // 🔒 ENGAGE THE 180s LOCK!
      lastSnapshotTriggerTime = Date.now();

      // ✅ IF SYSTEM IS IDLE: TRIGGER GITHUB ACTIONS!
      triggerWorkflowDispatch(
        'trigger_apm02_deployment',
        { waiting_minutes: waitingMinutes },
        (dispatchErr, statusCode) => {
          if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
            // If dispatch failed, release lock
            lastSnapshotTriggerTime = 0;
            return sendBotResponse(
              res,
              `❌ **Failed to trigger workflow.** GitHub API returned status: ${statusCode || dispatchErr.message}`
            );
          }
          sendBotResponse(
            res,
            `* **Waiting Window:** ${waitingMinutes} minutes\n\n` +
            `* **Source Branch:** \`main\`\n\n` +
            `📢 *An active deployment card will be posted to this channel shortly.*`,
            `🚀 On it! Initiating APM-02 Snapshot Deployment...`
          );
        }
      );
    });

  // -----------------------------------------------------------------------
  // COMMAND 2: deploy now (PRIMARY) / force start
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('deploy now') || cleanText.includes('force start')) {
    triggerWorkflowDispatch('adjust_apm02_wait', { deploy_now: 'true' }, (err, statusCode) => {
      if (err || (statusCode !== 204 && statusCode !== 200)) {
        return sendBotResponse(
          res,
          `❌ **Failed to trigger immediate deployment.** GitHub status: ${statusCode || err.message}`
        );
      }
      sendBotResponse(
        res,
        `Bypassing the remaining waiting window. Merging snapshot into APM-02 and initiating SAP CI/CD immediately.`,
        `⚡ Immediate Deployment Triggered!`
      );
    });

  // -----------------------------------------------------------------------
  // COMMAND 3: extend __m (PRIMARY) / extend [minutes]
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('extend')) {
    const match = cleanText.match(/extend\s+(\d+)/);
    const extendMinutes = match ? match[1] : '10';

    triggerWorkflowDispatch(
      'adjust_apm02_wait',
      { deploy_now: 'false', adjust_minutes: extendMinutes },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return sendBotResponse(
            res,
            `❌ **Failed to extend window.** GitHub status: ${statusCode || err.message}`
          );
        }
        sendBotResponse(
          res,
          `Added **+${extendMinutes} minutes** to the cherry-picking window.`,
          `⏳ Waiting Window Extended`
        );
      }
    );

  // -----------------------------------------------------------------------
  // COMMAND 4: reduce __m (PRIMARY) / reduce [minutes]
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('reduce') || cleanText.includes('decrease')) {
    const match = cleanText.match(/(?:reduce|decrease)\s+(\d+)/);
    const reduceMinutes = match ? `-${match[1]}` : '-10';

    triggerWorkflowDispatch(
      'adjust_apm02_wait',
      { deploy_now: 'false', adjust_minutes: reduceMinutes },
      (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          return sendBotResponse(
            res,
            `❌ **Failed to reduce window.** GitHub status: ${statusCode || err.message}`
          );
        }
        sendBotResponse(
          res,
          `Reduced the waiting window by **${Math.abs(parseInt(reduceMinutes, 10))} minutes**.`,
          `⏩ Waiting Window Reduced`
        );
      }
    );

  // -----------------------------------------------------------------------
  // COMMAND 5: re-trigger (PRIMARY) / retrigger (Scenario 1: No code changes)
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('re-trigger') || cleanText.includes('retrigger')) {
    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return sendBotResponse(
          res,
          `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`
        );
      }

      // Re-trigger is strictly blocked in IDLE stage
      if (!activePr) {
        return sendBotResponse(
          res,
          `Cannot re-trigger: No failed deployment detected.\n\n` +
          `* \`@${botName} re-trigger\` **only works when the tracking PR has the \`APM-02 Failed\` label** (for transient/timeout CI/CD failures).\n` +
          `* Since the system is currently **IDLE**, please start a new snapshot deployment using \`@${botName} share snapshot\` instead.`,
          `🟢 System is currently IDLE`
        );
      }

      const labels = (activePr.labels || []).map((l) => l.name);
      if (labels.includes('APM-02 Deploying')) {
        return sendBotResponse(
          res,
          `SAP CI/CD is currently building and deploying APM-02. Please wait for the pipeline to finish before attempting a retry.`,
          `🔵 Deployment is already in progress!`
        );
      }

      // Re-trigger only works when label is APM-02 Failed
      if (!labels.includes('APM-02 Failed')) {
        return sendBotResponse(
          res,
          `Cannot re-trigger: Tracking PR is in state \`${labels.join(', ')}\`.\n\n` +
          `* \`@${botName} re-trigger\` **only works when the tracking PR has the \`APM-02 Failed\` label**.\n` +
          `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})`,
          `⚠️ Re-trigger Not Allowed`
        );
      }

      triggerWorkflowDispatch('retrigger_apm02_deployment', null, (dispatchErr, statusCode) => {
        if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
          return sendBotResponse(
            res,
            `❌ **Failed to re-trigger deployment.** GitHub status: ${statusCode || dispatchErr.message}`
          );
        }
        sendBotResponse(
          res,
          `Restarting SAP CI/CD pipeline without code changes (transient/timeout retry).\n\n` +
          `📢 *Status card will appear in this channel once the build begins.*`,
          `🔁 On it! Re-triggering APM-02 deployment...`
        );
      });
    });

  // -----------------------------------------------------------------------
  // COMMAND 6: deployment fix pushed, re-deploy (PRIMARY) (Scenarios 2 & 3)
  // -----------------------------------------------------------------------
  } else if (
    cleanText.includes('deployment fix pushed') ||
    cleanText.includes('fix pushed') ||
    cleanText.includes('re-deploy fix') ||
    cleanText.includes('redeploy fix')
  ) {
    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return sendBotResponse(
          res,
          `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`
        );
      }

      // Re-deploy fix is strictly blocked in IDLE stage
      if (!activePr) {
        return sendBotResponse(
          res,
          `Cannot re-deploy fix: No failed deployment detected.\n\n` +
          `* \`@${botName} deployment fix pushed, re-deploy\` **only works when the tracking PR has the \`APM-02 Failed\` label** and a build fix was pushed to the snapshot branch.\n` +
          `* Since the system is currently **IDLE**, please start a new snapshot deployment using \`@${botName} share snapshot\` instead.`,
          `🟢 System is currently IDLE`
        );
      }

      const labels = (activePr.labels || []).map((l) => l.name);
      if (labels.includes('APM-02 Deploying')) {
        return sendBotResponse(
          res,
          `SAP CI/CD is currently building and deploying APM-02. Please wait for the current build to finish.`,
          `🔵 Deployment is already in progress!`
        );
      }

      // Only works when label is APM-02 Failed
      if (!labels.includes('APM-02 Failed')) {
        return sendBotResponse(
          res,
          `Cannot re-deploy fix: Tracking PR is in state \`${labels.join(', ')}\`.\n\n` +
          `* \`@${botName} deployment fix pushed, re-deploy\` **only works when the tracking PR has the \`APM-02 Failed\` label**.\n` +
          `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})`,
          `⚠️ Re-deploy Fix Not Allowed`
        );
      }

      triggerWorkflowDispatch('redeploy_apm02_fix', null, (dispatchErr, statusCode) => {
        if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
          return sendBotResponse(
            res,
            `❌ **Failed to re-deploy fix.** GitHub status: ${statusCode || dispatchErr.message}`
          );
        }
        sendBotResponse(
          res,
          `Merging latest snapshot commits into APM-02 tenant branch and initiating SAP CI/CD build.\n\n` +
          `📢 *Status card will appear in this channel shortly.*`,
          `🛠️ Deployment fix detected! Re-deploying to APM-02...`
        );
      });
    });

  // -----------------------------------------------------------------------
  // COMMAND 7: status (PRIMARY)
  // -----------------------------------------------------------------------
  } else if (cleanText.includes('status')) {
    getActiveDeploymentPR((err, activePr) => {
      if (err) {
        return sendBotResponse(res, `❌ **Error querying status:** ${err.message}`);
      }
      const statusInfo = getStatusMessage(activePr);
      sendBotResponse(res, statusInfo.body, statusInfo.title);
    });

  // -----------------------------------------------------------------------
  // COMMAND 8: help (PRIMARY)
  // -----------------------------------------------------------------------
  } else {
    const helpInfo = getHelpMessage(botName);
    sendBotResponse(res, helpInfo.body, helpInfo.title);
  }
};
