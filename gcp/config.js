// =========================================================================
// 🔧 REPOSITORY, AUTHENTICATION & BOT CONFIGURATION
// =========================================================================

module.exports = {
  // 🧪 1. Target Repository:
  GITHUB_REPO: process.env.GITHUB_REPO || 'Daxesh-Asint/GitHub-Actions-Trial-2',

  // 🔑 2. GitHub Personal Access Token (Requires 'repo' and 'workflow' scopes):
  GITHUB_PAT: process.env.GITHUB_PAT || '',

  // 📢 3. MS Teams Incoming Webhook URL (For Direct Main Feed Posts):
  TEAMS_WEBHOOK_URL: process.env.TEAMS_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL_APM02 || '',

  // 🤖 4. Fallback Bot Name:
  DEFAULT_BOT_NAME: process.env.BOT_NAME || 'Jarvis',

  // 🔒 5. Anti-Spam Debounce Lock Duration (180 seconds):
  SNAPSHOT_LOCK_DURATION_MS: 180 * 1000
};
