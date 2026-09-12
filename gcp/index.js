const config = require('./config');
const {
  callGitHubAPI,
  getActiveDeploymentPR,
  triggerWorkflowDispatch
} = require('./github');
let envModule;
try {
  envModule = require('./environments');
} catch (e) {
  try {
    envModule = require('./environment');
  } catch (err) {
    throw e;
  }
}
const {
  ENVIRONMENTS,
  extractChannelName,
  getEnvironmentByChannelName,
  findEnvironmentInText
} = envModule;
const { sendBotResponse, sendHelpCard } = require('./teams');
const {
  getBlockedExplanation,
  getChannelMismatchMessage,
  getDeployInitiatedMessage,
  getHelpMessage,
  getChannelHelpMessage,
  getStatusMessage
} = require('./messages');

// =========================================================================
// 🔒 ANTI-SPAM DEBOUNCE LOCKS
// =========================================================================
let lastSnapshotTriggerTime = 0;
const lastDirectDeployTimes = {};
const DEPLOY_LOCK_DURATION_MS = 20 * 1000; // 20 seconds anti-double-click lock

/**
 * Main Cloud Function / Cloud Run Entry Point
 */
exports.deployBot = (req, res) => {
  try {
    // 1. Verify POST request from MS Teams
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // 2. Extract Bot Name dynamically from MS Teams payload
    let botName = config.DEFAULT_BOT_NAME;
    if (req.body && Array.isArray(req.body.entities)) {
      const mentionEntity = req.body.entities.find((e) => e && e.type === 'mention' && e.mentioned);
      if (mentionEntity && mentionEntity.mentioned && mentionEntity.mentioned.name) {
        botName = mentionEntity.mentioned.name;
      }
    }

    // 3. Extract sender information
    const senderName =
      (req.body && req.body.from && req.body.from.name)
        ? req.body.from.name
        : 'Team Member';

    // 4. Detect MS Teams Channel & Environment context
    const channelName = extractChannelName(req);
    const currentChannelEnv = getEnvironmentByChannelName(channelName);
    const targetWebhookUrl = config.getChannelWebhookUrl(currentChannelEnv);

    // 🔍 DEBUG: Log channel detection for troubleshooting boundary issues
    console.log('[Channel Detection]', JSON.stringify({
      detectedChannelName: channelName || '(empty)',
      resolvedEnv: currentChannelEnv ? currentChannelEnv.id : '(none)',
      channelData: req.body && req.body.channelData ? req.body.channelData : '(missing)',
      conversationName: req.body && req.body.conversation && req.body.conversation.name ? req.body.conversation.name : '(missing)',
      queryParams: req.query || '(none)'
    }));

    // 5. Clean user input (strip HTML tags like <at>Jarvis</at>)
    const rawText = (req.body && typeof req.body.text === 'string') ? req.body.text : '';
    const cleanText = rawText.replace(/<[^>]*>/g, '').trim().toLowerCase();

    // 6. Detect if an environment name/alias was mentioned in the user's text
    const targetEnvInText = findEnvironmentInText(cleanText);

    // =======================================================================
    // 🛡️ ENFORCE CHANNEL ISOLATION (When in a specific channel)
    // =======================================================================
    if (currentChannelEnv) {
      // If user typed an environment name that DOES NOT match this channel:
      if (targetEnvInText && targetEnvInText.id !== currentChannelEnv.id) {
        const mismatchInfo = getChannelMismatchMessage(
          currentChannelEnv.channelName,
          targetEnvInText.name,
          targetEnvInText.channelName
        );
        return sendBotResponse(res, mismatchInfo.body, mismatchInfo.title, targetWebhookUrl);
      }

      // If user is NOT in APM-02 channel, but attempted APM-02 snapshot commands:
      if (
        !currentChannelEnv.isApm02 &&
        (cleanText.includes('share snapshot') ||
         cleanText.includes('extend') ||
         cleanText.includes('reduce') ||
         cleanText.includes('re-trigger') ||
         cleanText.includes('retrigger') ||
         cleanText.includes('deployment fix pushed') ||
         cleanText.includes('fix pushed'))
      ) {
        const apm02Env = ENVIRONMENTS.find((e) => e.isApm02);
        const mismatchInfo = getChannelMismatchMessage(
          currentChannelEnv.channelName,
          'APM-02 Snapshot',
          apm02Env ? apm02Env.channelName : 'APM-02 Deployment POC'
        );
        return sendBotResponse(res, mismatchInfo.body, mismatchInfo.title, targetWebhookUrl);
      }
    }

    // =======================================================================
    // 🔒 FAIL-CLOSED: Block deploy commands when channel is UNDETECTED
    // =======================================================================
    // If channel name could not be determined, block deploy commands targeting
    // non-APM-02 environments. APM-02-exclusive commands (share snapshot, etc.)
    // are exempt — they're handled by the APM-02 section below.
    if (!currentChannelEnv && targetEnvInText) {
      if (cleanText.includes('deploy')) {
        console.warn('[SECURITY] Deploy command blocked — channel not detected.', {
          rawText: rawText.substring(0, 200),
          targetEnv: targetEnvInText.name,
          channelName: channelName || '(empty)'
        });
        return sendBotResponse(
          res,
          `🔒 **Channel Not Detected**\n\n` +
          `Your deploy command for **${targetEnvInText.name}** was blocked because the bot could not verify which Teams channel you're in.\n\n` +
          `**How to fix:**\n` +
          `* Use this command from the dedicated **${targetEnvInText.channelName}** channel\n` +
          `* Make sure the bot is properly installed in the channel\n\n` +
          `💡 *This is a security measure to prevent cross-environment deployments.*`,
          `🛡️ Channel Verification Failed`,
          targetWebhookUrl
        );
      }
    }

    // =======================================================================
    // 🤖 APM-02 SPECIFIC LOGIC (For APM-02 Deployment POC)
    // =======================================================================
    // APM-02-exclusive commands that no other environment uses.
    // When these are detected, we know the user intends APM-02 regardless of
    // channel detection (restores pre-refactor behavior).
    const isApm02ExclusiveCommand =
      cleanText.includes('share snapshot') ||
      cleanText.includes('deploy now') ||
      cleanText.includes('force start') ||
      cleanText.includes('re-trigger') ||
      cleanText.includes('retrigger') ||
      cleanText.includes('deployment fix pushed') ||
      cleanText.includes('fix pushed') ||
      cleanText.includes('re-deploy fix') ||
      cleanText.includes('redeploy fix') ||
      /(?:extend|reduce|decrease)\s+\d+/.test(cleanText);

    const isApm02Context =
      (currentChannelEnv && currentChannelEnv.isApm02) ||
      (!currentChannelEnv && targetEnvInText && targetEnvInText.isApm02) ||
      isApm02ExclusiveCommand;

    if (isApm02Context) {
      // ---------------------------------------------------------------------
      // APM-02 COMMAND 1: share snapshot __m
      // ---------------------------------------------------------------------
      if (
        cleanText.includes('share snapshot') ||
        cleanText.includes('deploy apm-02') ||
        cleanText.includes('deploy apm02')
      ) {
        const now = Date.now();
        const timeSinceLastTrigger = now - lastSnapshotTriggerTime;

        if (timeSinceLastTrigger < config.SNAPSHOT_LOCK_DURATION_MS) {
          const secondsLeft = Math.ceil(
            (config.SNAPSHOT_LOCK_DURATION_MS - timeSinceLastTrigger) / 1000
          );
          return sendBotResponse(
            res,
            `A snapshot request was initiated just a moment ago.\n\n` +
            `Please wait **${secondsLeft} seconds** for the GitHub Actions workflow to finish creating the snapshot branch and tracking PR.\n\n` +
            `📢 *The notification card will appear in this channel shortly.*`,
            `⏳ Snapshot Creation in Progress!`,
            targetWebhookUrl
          );
        }

        const match = cleanText.match(/(?:share\s+snapshot|deploy\s+apm-?02).*?(\d+)\s*(?:m|min|mins|minutes)?/);
        const waitingMinutes = match ? match[1] : '60';

        getActiveDeploymentPR((err, activePr) => {
          if (err) {
            return sendBotResponse(
              res,
              `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`,
              'Error',
              targetWebhookUrl
            );
          }

          if (activePr) {
            const blockedInfo = getBlockedExplanation(activePr, botName);
            return sendBotResponse(res, blockedInfo.body, blockedInfo.title, targetWebhookUrl);
          }

          lastSnapshotTriggerTime = Date.now();

          triggerWorkflowDispatch(
            'trigger_apm02_deployment',
            { waiting_minutes: waitingMinutes },
            (dispatchErr, statusCode) => {
              if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
                lastSnapshotTriggerTime = 0;
                return sendBotResponse(
                  res,
                  `❌ **Failed to trigger workflow.** GitHub API returned status: ${statusCode || dispatchErr.message}`,
                  'Error',
                  targetWebhookUrl
                );
              }
              sendBotResponse(
                res,
                `* **Waiting Window:** ${waitingMinutes} minutes\n\n` +
                `* **Source Branch:** \`main\`\n\n` +
                `📢 *An active deployment card will be posted to this channel shortly.*`,
                `🚀 On it! Initiating APM-02 Snapshot Deployment...`,
                targetWebhookUrl
              );
            }
          );
        });
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 2: deploy now / force start
      // ---------------------------------------------------------------------
      } else if (cleanText.includes('deploy now') || cleanText.includes('force start')) {
        triggerWorkflowDispatch('adjust_apm02_wait', { deploy_now: 'true' }, (err, statusCode) => {
          if (err || (statusCode !== 204 && statusCode !== 200)) {
            return sendBotResponse(
              res,
              `❌ **Failed to trigger immediate deployment.** GitHub status: ${statusCode || err.message}`,
              'Error',
              targetWebhookUrl
            );
          }
          sendBotResponse(
            res,
            `Bypassing the remaining waiting window. Merging snapshot into APM-02 and initiating SAP CI/CD immediately.`,
            `⚡ Immediate Deployment Triggered!`,
            targetWebhookUrl
          );
        });
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 3: extend __m
      // ---------------------------------------------------------------------
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
                `❌ **Failed to extend window.** GitHub status: ${statusCode || err.message}`,
                'Error',
                targetWebhookUrl
              );
            }
            sendBotResponse(
              res,
              `Added **+${extendMinutes} minutes** to the cherry-picking window.`,
              `⏳ Waiting Window Extended`,
              targetWebhookUrl
            );
          }
        );
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 4: reduce __m
      // ---------------------------------------------------------------------
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
                `❌ **Failed to reduce window.** GitHub status: ${statusCode || err.message}`,
                'Error',
                targetWebhookUrl
              );
            }
            sendBotResponse(
              res,
              `Reduced the waiting window by **${Math.abs(parseInt(reduceMinutes, 10))} minutes**.`,
              `⏩ Waiting Window Reduced`,
              targetWebhookUrl
            );
          }
        );
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 5: re-trigger
      // ---------------------------------------------------------------------
      } else if (cleanText.includes('re-trigger') || cleanText.includes('retrigger')) {
        getActiveDeploymentPR((err, activePr) => {
          if (err) {
            return sendBotResponse(
              res,
              `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`,
              'Error',
              targetWebhookUrl
            );
          }

          if (!activePr) {
            return sendBotResponse(
              res,
              `Cannot re-trigger: No failed deployment detected.\n\n` +
              `* \`@${botName} re-trigger\` **only works when the tracking PR has the \`APM-02 Failed\` label** (for transient/timeout CI/CD failures).\n` +
              `* Since the system is currently **IDLE**, please start a new snapshot deployment using \`@${botName} share snapshot\` instead.`,
              `🟢 System is currently IDLE`,
              targetWebhookUrl
            );
          }

          const labels = (activePr.labels || []).map((l) => l.name);
          if (labels.includes('APM-02 Deploying')) {
            return sendBotResponse(
              res,
              `SAP CI/CD is currently building and deploying APM-02. Please wait for the pipeline to finish before attempting a retry.`,
              `🔵 Deployment is already in progress!`,
              targetWebhookUrl
            );
          }

          if (!labels.includes('APM-02 Failed')) {
            return sendBotResponse(
              res,
              `Cannot re-trigger: Tracking PR is in state \`${labels.join(', ')}\`.\n\n` +
              `* \`@${botName} re-trigger\` **only works when the tracking PR has the \`APM-02 Failed\` label**.\n` +
              `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})`,
              `⚠️ Re-trigger Not Allowed`,
              targetWebhookUrl
            );
          }

          triggerWorkflowDispatch('retrigger_apm02_deployment', null, (dispatchErr, statusCode) => {
            if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
              return sendBotResponse(
                res,
                `❌ **Failed to re-trigger deployment.** GitHub status: ${statusCode || dispatchErr.message}`,
                'Error',
                targetWebhookUrl
              );
            }
            sendBotResponse(
              res,
              `Restarting SAP CI/CD pipeline without code changes (transient/timeout retry).\n\n` +
              `📢 *Status card will appear in this channel once the build begins.*`,
              `🔁 On it! Re-triggering APM-02 deployment...`,
              targetWebhookUrl
            );
          });
        });
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 6: deployment fix pushed, re-deploy
      // ---------------------------------------------------------------------
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
              `⚠️ **Error checking deployment status:** ${err.message}. Please check GitHub directly.`,
              'Error',
              targetWebhookUrl
            );
          }

          if (!activePr) {
            return sendBotResponse(
              res,
              `Cannot re-deploy fix: No failed deployment detected.\n\n` +
              `* \`@${botName} deployment fix pushed, re-deploy\` **only works when the tracking PR has the \`APM-02 Failed\` label** and a build fix was pushed to the snapshot branch.\n` +
              `* Since the system is currently **IDLE**, please start a new snapshot deployment using \`@${botName} share snapshot\` instead.`,
              `🟢 System is currently IDLE`,
              targetWebhookUrl
            );
          }

          const labels = (activePr.labels || []).map((l) => l.name);
          if (labels.includes('APM-02 Deploying')) {
            return sendBotResponse(
              res,
              `SAP CI/CD is currently building and deploying APM-02. Please wait for the current build to finish.`,
              `🔵 Deployment is already in progress!`,
              targetWebhookUrl
            );
          }

          if (!labels.includes('APM-02 Failed')) {
            return sendBotResponse(
              res,
              `Cannot re-deploy fix: Tracking PR is in state \`${labels.join(', ')}\`.\n\n` +
              `* \`@${botName} deployment fix pushed, re-deploy\` **only works when the tracking PR has the \`APM-02 Failed\` label**.\n` +
              `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})`,
              `⚠️ Re-deploy Fix Not Allowed`,
              targetWebhookUrl
            );
          }

          triggerWorkflowDispatch('redeploy_apm02_fix', null, (dispatchErr, statusCode) => {
            if (dispatchErr || (statusCode !== 204 && statusCode !== 200)) {
              return sendBotResponse(
                res,
                `❌ **Failed to re-deploy fix.** GitHub status: ${statusCode || dispatchErr.message}`,
                'Error',
                targetWebhookUrl
              );
            }
            sendBotResponse(
              res,
              `Merging latest snapshot commits into APM-02 tenant branch and initiating SAP CI/CD build.\n\n` +
              `📢 *Status card will appear in this channel shortly.*`,
              `🛠️ Deployment fix detected! Re-deploying to APM-02...`,
              targetWebhookUrl
            );
          });
        });
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 7: status
      // ---------------------------------------------------------------------
      } else if (cleanText.includes('status')) {
        getActiveDeploymentPR((err, activePr) => {
          if (err) {
            return sendBotResponse(res, `❌ **Error querying status:** ${err.message}`, 'Error', targetWebhookUrl);
          }
          const statusInfo = getStatusMessage(activePr);
          sendBotResponse(res, statusInfo.body, statusInfo.title, targetWebhookUrl);
        });
        return;

      // ---------------------------------------------------------------------
      // APM-02 COMMAND 8: help
      // ---------------------------------------------------------------------
      } else if (cleanText.includes('help')) {
        return sendHelpCard(res, botName, currentChannelEnv, ENVIRONMENTS, targetWebhookUrl);
      }
    }

    // =======================================================================
    // 🚀 DIRECT DEPLOYMENT LOGIC (For the other 13 Environments)
    // =======================================================================
    // Determine which environment to deploy:
    // 1. Channel context (e.g. user is in AIS-02 Deployment POC)
    // 2. Or explicit environment specified in text
    const targetDeployEnv = currentChannelEnv || targetEnvInText;

    if (cleanText.startsWith('deploy') || cleanText.includes('deploy')) {
      if (!targetDeployEnv) {
        return sendBotResponse(
          res,
          `Please specify which environment to deploy, or run this command from that environment's dedicated channel.\n\n` +
          `**Example:** \`@${botName} deploy ais-02\` or \`@${botName} deploy apm-01\`\n\n` +
          `Type \`@${botName} help\` to view all environment commands.`,
          `❓ Unknown Environment`,
          targetWebhookUrl
        );
      }

      // Check anti-spam lock for direct deployments (20 seconds per env)
      const now = Date.now();
      const lastTrigger = lastDirectDeployTimes[targetDeployEnv.id] || 0;
      if (now - lastTrigger < DEPLOY_LOCK_DURATION_MS) {
        const secondsLeft = Math.ceil((DEPLOY_LOCK_DURATION_MS - (now - lastTrigger)) / 1000);
        return sendBotResponse(
          res,
          `A deployment request for **${targetDeployEnv.name}** was triggered just a moment ago.\n\n` +
          `Please wait **${secondsLeft} seconds** before triggering another run.\n\n` +
          `📢 *Progress notification cards will appear in this channel as the build starts.*`,
          `⏳ Deployment in Progress!`,
          targetWebhookUrl
        );
      }

      // Engage anti-spam lock
      lastDirectDeployTimes[targetDeployEnv.id] = now;

      // Trigger GitHub Actions repository_dispatch event
      triggerWorkflowDispatch(targetDeployEnv.dispatchEvent, null, (err, statusCode) => {
        if (err || (statusCode !== 204 && statusCode !== 200)) {
          delete lastDirectDeployTimes[targetDeployEnv.id];
          return sendBotResponse(
            res,
            `❌ **Failed to trigger ${targetDeployEnv.name} deployment.** GitHub status: ${statusCode || err.message}`,
            `❌ Deployment Trigger Failed`,
            targetWebhookUrl
          );
        }

        const confirmation = getDeployInitiatedMessage(targetDeployEnv.name, senderName);
        sendBotResponse(res, confirmation.body, confirmation.title, targetWebhookUrl);
      });
      return;
    }

    // -----------------------------------------------------------------------
    // COMMAND: status (General for non-APM-02 channels)
    // -----------------------------------------------------------------------
    if (cleanText.includes('status')) {
      if (targetDeployEnv) {
        return sendBotResponse(
          res,
          `* **Environment:** \`${targetDeployEnv.name}\`\n\n` +
          `* **Channel:** \`${targetDeployEnv.channelName}\`\n\n` +
          `* **Dispatch Trigger:** \`${targetDeployEnv.dispatchEvent}\`\n\n` +
          `💡 *Type* \`@${botName} deploy\` *in this channel to initiate a new deployment.*`,
          `🟢 Environment: ${targetDeployEnv.name}`,
          targetWebhookUrl
        );
      }
      return sendBotResponse(
        res,
        `Type \`@${botName} deploy <env>\` (e.g. \`@${botName} deploy ais-02\`) or switch to the dedicated environment channel.`,
        `🟢 Bot Status: Ready`,
        targetWebhookUrl
      );
    }

    // -----------------------------------------------------------------------
    // COMMAND: help
    // -----------------------------------------------------------------------
    sendHelpCard(res, botName, currentChannelEnv, ENVIRONMENTS, targetWebhookUrl);

  } catch (err) {
    console.error('Unhandled exception in deployBot:', err);
    return res.status(200).json({
      type: 'message',
      text: `⚠️ **Bot Encountered an Error:** ${err.message || 'Unknown error'}. Please try again.`
    });
  }
};
