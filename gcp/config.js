// =========================================================================
// 🔧 REPOSITORY, AUTHENTICATION & BOT CONFIGURATION
// =========================================================================

module.exports = {
  // 🧪 1. Target Repository:
  GITHUB_REPO: process.env.GITHUB_REPO || 'Daxesh-Asint/GitHub-Actions-Trial-2',

  // 🔑 2. GitHub Personal Access Token (Requires 'repo' and 'workflow' scopes):
  GITHUB_PAT: process.env.GITHUB_PAT || '',

  // 📢 3. Global Fallback MS Teams Incoming Webhook URL:
  TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_GLOBAL_1 || process.env.TEAMS_WEBHOOK_URL || '',

  // 🤖 4. Fallback Bot Name:
  DEFAULT_BOT_NAME: process.env.BOT_NAME || 'Jarvis',

  // 🔒 5. Anti-Spam Debounce Lock Duration (180 seconds):
  SNAPSHOT_LOCK_DURATION_MS: 180 * 1000,

  /**
   * Helper to resolve the best available webhook URL for an environment
   */
  getChannelWebhookUrl: function (env) {
    if (!env) return this.TEAMS_WEBHOOK_URL;
    
    // Check primary slot, slot 2, slot 3
    if (env.webhookEnvVar && process.env[env.webhookEnvVar]) {
      return process.env[env.webhookEnvVar];
    }
    const legacyKey = env.webhookEnvVar ? env.webhookEnvVar.replace('_1', '') : '';
    if (legacyKey && process.env[legacyKey]) {
      return process.env[legacyKey];
    }
    return this.TEAMS_WEBHOOK_URL;
  }
};

// Test trigger for workflow testing: 2026-09-19T19:49:25IST
