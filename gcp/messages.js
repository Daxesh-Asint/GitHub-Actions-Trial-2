const { extractSnapshotBranch } = require('./github');

/**
 * Generates tailored explanation with clean spacing and line breaks for MS Teams
 * when an APM-02 deployment is blocked or in progress.
 */
function getBlockedExplanation(activePr, botName) {
  const labelNames = (activePr.labels || []).map((l) => l.name);
  const snapshotBranch = extractSnapshotBranch(activePr);

  // 1️⃣ When SAP CI/CD is currently running
  if (labelNames.some((l) => /APM-02 Deploying/i.test(l))) {
    return {
      title: '🚫 APM-02 Deployment Blocked!',
      body:
        `**🔵 Deployment Currently in Progress!**\n\n` +
        `SAP CI/CD is currently building and deploying the snapshot to APM-02.\n\n` +
        `* **Active PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
        `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
        `⏱️ *Deployment typically takes ~55–60 minutes. Please wait for the current cycle to finish before triggering a new one.*`
    };
  }

  // 2️⃣ When Previous Deployment Failed
  if (labelNames.some((l) => /APM-02 Failed/i.test(l))) {
    return {
      title: '🚫 APM-02 Deployment Blocked!',
      body:
        `**🔴 Previous SAP CI/CD Deployment Failed!**\n\n` +
        `The previous deployment did not complete successfully. Snapshot was **not merged into \`main\`**.\n\n` +
        `* **Failed Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
        `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
        `💡 **How to Recover (Choose an option):**\n\n` +
        `1. **If timeout / flaky CI/CD (No code changes):**\n` +
        `   Type \`@${botName} re-trigger\` to restart the pipeline. *(Only works when label is APM-02 Failed)*\n\n` +
        `2. **If code fix is needed:**\n` +
        `   Push fix commit to \`${snapshotBranch}\` *(auto-deploys)*, or type \`@${botName} deployment fix pushed, re-deploy\`\n\n` +
        `📢 *You can retry as many times as needed until deployment succeeds!*`
    };
  }

  // 3️⃣ When Blocked by Merge Conflicts
  if (labelNames.some((l) => /APM-02 Blocked|Pre-Deploy Blocked|Conflicts/i.test(l))) {
    return {
      title: '🚫 APM-02 Deployment Blocked!',
      body:
        `**🟠 Deployment Blocked by Merge Conflicts!**\n\n` +
        `Merge conflicts were detected between the snapshot and the target branch.\n\n` +
        `* **Conflicting PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
        `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
        `* **Action Required:** Please resolve the merge conflicts directly in the PR before creating a new snapshot.`
    };
  }

  // 4️⃣ When an Active Snapshot is Waiting for Cherry-Picks
  return {
    title: '🚫 APM-02 Deployment Blocked!',
    body:
      `**⏳ Active Cherry-Pick Window in Progress!**\n\n` +
      `A snapshot deployment is currently active and accepting cherry-picks.\n\n` +
      `* **Active PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
      `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
      `💡 *To deploy immediately, type* \`@${botName} deploy now\` *, or wait for the countdown to finish.*`
  };
}

/**
 * Message when a command is executed in the wrong channel
 */
function getChannelMismatchMessage(currentChannelName, requestedEnvName, targetChannelName) {
  return {
    title: `⚠️ Command Restricted to ${targetChannelName || requestedEnvName}`,
    body:
      `You are currently in the **${currentChannelName || 'different'}** channel.\n\n` +
      `* Commands for **${requestedEnvName}** can only be executed in **${targetChannelName || requestedEnvName + ' Deployment POC'}**.\n\n` +
      `👉 *Please navigate to the **${targetChannelName || requestedEnvName}** channel to trigger this deployment.*`
  };
}

/**
 * Message when a deployment is successfully triggered
 */
function getDeployInitiatedMessage(envName, user) {
  const userName = user ? `@${user}` : 'User';
  return {
    title: `🚀 Deployment Initiated for ${envName}!`,
    body:
      `* **Environment:** \`${envName}\`\n\n` +
      `* **Triggered By:** ${userName}\n\n` +
      `* **Status:** GitHub Actions workflow has been dispatched. Auto-merge and SAP CI/CD deployment are starting.\n\n` +
      `📢 *Live deployment progress cards will be delivered to this channel shortly.*`
  };
}

/**
 * Message when a deployment is blocked because another is already in progress
 */
function getDeploymentInProgressMessage(envName, activePr, botName) {
  const name = botName || 'Jarvis';
  const prInfo = activePr
    ? `\n\n* **Active PR:** [PR #${activePr.number}](${activePr.html_url})`
    : '';

  return {
    title: `⏳ ${envName} Deployment Already in Progress!`,
    body:
      `**🚫 A deployment for ${envName} is currently running.**\n\n` +
      `Auto-merge or SAP CI/CD is currently compiling and deploying for this environment.${prInfo}\n\n` +
      `* Please wait until the current deployment completes before triggering a new one.\n\n` +
      `💡 *Type* \`@${name} status\` *to check the real-time status of this deployment.*`
  };
}

/**
 * Generates formatted Help guide for APM-02 (cherry-pick snapshot window)
 */
function getHelpMessage(botName) {
  return {
    title: `⚡ ${botName} - APM-02 Deployment Commands`,
    body:
      `* **\`@${botName} share snapshot\`** *(or custom e.g. \`@${botName} share snapshot 85m\`)*\n\n` +
      `  Starts snapshot deployment with default **60m** window, or specify any custom wait time as per your choice (e.g. \`85m\`, \`45m\`, \`30m\`).\n\n` +
      `* **\`@${botName} deploy now\`**\n\n` +
      `  Bypasses the remaining wait countdown and immediately deploys snapshot to APM-02.\n\n` +
      `* **\`@${botName} extend\`** *(or custom e.g. \`@${botName} extend 15m\`)*\n\n` +
      `  Adds extra minutes to the countdown (default: **+10m**, or specify your choice like \`15m\`, \`20m\`).\n\n` +
      `* **\`@${botName} reduce\`** *(or custom e.g. \`@${botName} reduce 5m\`)*\n\n` +
      `  Subtracts minutes from the countdown (default: **-10m**, or specify your choice like \`5m\`, \`20m\`).\n\n` +
      `* **\`@${botName} re-trigger\`**\n\n` +
      `  Restarts SAP CI/CD pipeline without code changes.\n` +
      `  ⚠️ **Note:** Only works when tracking PR has the **\`APM-02 Failed\`** label (for timeout/flaky CI issues). In the **IDLE** stage, this will NOT work.\n\n` +
      `* **\`@${botName} deployment fix pushed, re-deploy\`**\n\n` +
      `  Re-merges snapshot into APM-02 and triggers build after pushing a code fix to the snapshot branch.\n` +
      `  ⚠️ **Note:** Only works when tracking PR has the **\`APM-02 Failed\`** label. In the **IDLE** stage, this will NOT work.\n\n` +
      `* **\`@${botName} status\`**\n\n` +
      `  Check real-time APM-02 deployment status & active tracking PR.\n\n` +
      `* **\`@${botName} help\`**\n\n` +
      `  Display this command reference guide.`
  };
}

/**
 * Context-aware Help guide based on the channel
 */
function getChannelHelpMessage(channelEnv, botName, allEnvs) {
  const name = botName || 'Jarvis';

  if (channelEnv && channelEnv.isApm02) {
    return getHelpMessage(name);
  }

  if (channelEnv) {
    return {
      title: `⚡ ${name} - ${channelEnv.name} Deployment Commands`,
      body:
        `* **\`@${name} deploy\`** *(or \`@${name} deploy ${channelEnv.name.toLowerCase()}\`)*\n\n` +
        `  Immediately triggers deployment for **${channelEnv.name}** (merges latest code into tenant branch and initiates SAP CI/CD pipeline).\n\n` +
        `* **\`@${name} help\`**\n\n` +
        `  Displays available deployment commands for this channel.\n\n` +
        `🔒 *Note: Only ${channelEnv.name} deployment commands can be executed in this channel.*`
    };
  }

  // Fallback if no specific channel detected
  const envList = (allEnvs || [])
    .filter((e) => !e.isApm02)
    .map((e) => `* **\`@${name} deploy ${e.name.toLowerCase()}\`** → Deploy to ${e.name}`)
    .join('\n');

  return {
    title: `⚡ ${name} - Deployment Command Centre`,
    body:
      `Each environment has its own dedicated MS Teams channel where deployment commands run.\n\n` +
      `**Available Direct Deploy Commands:**\n\n` +
      `${envList}\n\n` +
      `* **\`@${name} share snapshot\`** *(APM-02 Deployment POC channel only)*`
  };
}

/**
 * Generates Status message for active PR
 */
function getStatusMessage(activePr) {
  if (!activePr) {
    return {
      title: '🟢 System Status: IDLE',
      body:
        `* **Status:** 🟢 All previous deployments are completed. No active deployment in progress.\n\n` +
        `💡 *You can start a new snapshot deployment anytime by typing* \`@Jarvis share snapshot\` *(or custom time e.g.* \`@Jarvis share snapshot 85m\`*).*`
    };
  }

  const labelNames = (activePr.labels || []).map((l) => l.name);
  const snapshotBranch = extractSnapshotBranch(activePr);
  const initiatedBy = activePr.user ? activePr.user.login : 'github-actions';

  // 1️⃣ State: APM-02 Deploying (SAP CI/CD Running)
  if (labelNames.some((l) => /APM-02 Deploying/i.test(l))) {
    return {
      title: '🚀 APM-02 Deployment in Progress',
      body:
        `* **Status:** 🔵 Deployment is in progress. Merged snapshot into tenant branch and building in SAP CI/CD.\n\n` +
        `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
        `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
        `* **Initiated By:** @${initiatedBy}\n\n` +
        `⏱️ *Build typically takes ~50–60 minutes. Please wait for the current cycle to complete.*`
    };
  }

  // 2️⃣ State: APM-02 Failed (Build/Deploy Failed)
  if (labelNames.some((l) => /APM-02 Failed/i.test(l))) {
    return {
      title: '❌ APM-02 Deployment Failed',
      body:
        `* **Status:** 🔴 SAP CI/CD pipeline failed. Snapshot was **not** merged into \`main\`.\n\n` +
        `* **Failed PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
        `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
        `* **Initiated By:** @${initiatedBy}\n\n` +
        `🛠️ **Recovery Options:**\n\n` +
        `1. **If timeout / transient failure (no code changes):** Type \`@Jarvis re-trigger\`\n\n` +
        `2. **If code fix is needed:** Push fix commit to \`${snapshotBranch}\`, then type \`@Jarvis deployment fix pushed, re-deploy\``
    };
  }

  // 3️⃣ State: APM-02 Blocked (Merge Conflicts)
  if (labelNames.some((l) => /APM-02 Blocked|Pre-Deploy Blocked|Conflicts/i.test(l))) {
    return {
      title: '⚠️ APM-02 Deployment Blocked by Conflicts',
      body:
        `* **Status:** 🟠 Merge conflicts detected between snapshot branch and target branch.\n\n` +
        `* **Conflicting PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
        `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
        `* **Initiated By:** @${initiatedBy}\n\n` +
        `👉 *Action Required: Developers must resolve conflicts in the PR before deployment can continue.*`
    };
  }

  // 4️⃣ State: APM-02 Active (Cherry-Pick Window Open)
  return {
    title: '⏳ Active Snapshot Waiting for Cherry-Picks',
    body:
      `* **Status:** 🌿 Active snapshot branch is available & waiting for cherry-picks\n\n` +
      `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
      `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
      `* **Initiated By:** @${initiatedBy}\n\n` +
      `💡 *Developers can cherry-pick their PRs into this snapshot branch. To deploy immediately, type* \`@Jarvis deploy now\`*, or wait for the countdown to finish.*`
  };
}

module.exports = {
  getBlockedExplanation,
  getChannelMismatchMessage,
  getDeployInitiatedMessage,
  getDeploymentInProgressMessage,
  getHelpMessage,
  getChannelHelpMessage,
  getStatusMessage
};
