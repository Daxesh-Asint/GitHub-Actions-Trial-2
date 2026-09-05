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
        `   Type \`@${botName} re-trigger\` to restart the pipeline.\n\n` +
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
 * Generates formatted Help guide
 */
function getHelpMessage(botName) {
  return {
    title: `⚡ ${botName} - APM-02 Deployment Commands`,
    body:
      `* **\`@${botName} share snapshot 60m\`**\n\n` +
      `  Start snapshot deployment with custom (e.g. 30m, 45m) or default (60m) window\n\n` +
      `* **\`@${botName} deploy now\`**\n\n` +
      `  Skip remaining wait time and deploy immediately to APM-02\n\n` +
      `* **\`@${botName} extend 10m\`**\n\n` +
      `  Add extra minutes to the current countdown\n\n` +
      `* **\`@${botName} reduce 5m\`**\n\n` +
      `  Subtract minutes from the current countdown\n\n` +
      `* **\`@${botName} re-trigger\`**\n\n` +
      `  Restart SAP CI/CD deployment without code changes (transient timeout/glitch retry)\n\n` +
      `* **\`@${botName} deployment fix pushed, re-deploy\`**\n\n` +
      `  Re-merge snapshot to APM-02 and trigger SAP CI/CD after pushing a build fix\n\n` +
      `* **\`@${botName} status\`**\n\n` +
      `  Check real-time APM-02 deployment status\n\n` +
      `* **\`@${botName} help\`**\n\n` +
      `  Display this command guide`
  };
}

/**
 * Generates Status message for active PR
 */
function getStatusMessage(activePr) {
  if (!activePr) {
    return {
      title: '🟢 System Status: IDLE',
      body: 'No APM-02 deployment is currently active. You can start a new snapshot anytime.'
    };
  }

  const labels = (activePr.labels || []).map((l) => l.name).join(', ');
  const snapshotBranch = extractSnapshotBranch(activePr);

  return {
    title: '🔵 Active Deployment in Progress',
    body:
      `* **Tracking PR:** [PR #${activePr.number}](${activePr.html_url})\n\n` +
      `* **Snapshot Branch:** \`${snapshotBranch}\`\n\n` +
      `* **Current State:** \`${labels}\`\n\n` +
      `* **Initiated by:** @${activePr.user ? activePr.user.login : 'github-actions'}`
  };
}

module.exports = {
  getBlockedExplanation,
  getHelpMessage,
  getStatusMessage
};
