const https = require('https');
const config = require('./config');

/**
 * Helper to make HTTPS requests to GitHub API
 */
function callGitHubAPI(path, method, data, callback) {
  if (!config.GITHUB_PAT) {
    return callback(
      new Error('GITHUB_PAT is not configured. Please set GITHUB_PAT in GCP Cloud Run environment variables.')
    );
  }

  const payload = data ? JSON.stringify(data) : null;
  const options = {
    hostname: 'api.github.com',
    path: path,
    method: method,
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${config.GITHUB_PAT}`,
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
    `repo:${config.GITHUB_REPO} is:pr is:open label:"APM-02 Active","APM-02 Deploying","APM-02 Failed","APM-02 Blocked","APM-02 Pre-Deploy Blocked","auto merge for APM02"`
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
 * Helper to trigger repository_dispatch event on GitHub
 */
function triggerWorkflowDispatch(eventType, clientPayload, callback) {
  const data = { event_type: eventType };
  if (clientPayload) {
    data.client_payload = clientPayload;
  }
  callGitHubAPI(`/repos/${config.GITHUB_REPO}/dispatches`, 'POST', data, callback);
}

module.exports = {
  callGitHubAPI,
  getActiveDeploymentPR,
  extractSnapshotBranch,
  triggerWorkflowDispatch
};
