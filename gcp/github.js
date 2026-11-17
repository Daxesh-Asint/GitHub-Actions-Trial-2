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
 * Checks GitHub for an active deployment PR for a specific APM-02 environment (Core, DC, DC AddIn)
 */
function getActiveDeploymentPR(env, callback) {
  // Support legacy call: getActiveDeploymentPR(callback)
  if (typeof env === 'function') {
    callback = env;
    env = null;
  }

  const labelPrefix = (env && env.labelPrefix) ? env.labelPrefix : 'APM-02';
  const autoMergeLabel = (env && env.id === 'apm02_dc')
    ? 'auto merge for APM-02-DC'
    : (env && env.id === 'apm02_dc_addin')
      ? 'auto merge for APM-02-DC-AddIn'
      : 'auto merge for APM02';

  const labels = [
    `${labelPrefix} Active`,
    `${labelPrefix} Deploying`,
    `${labelPrefix} Failed`,
    `${labelPrefix} Blocked`,
    `${labelPrefix} Pre-Deploy Blocked`,
    autoMergeLabel
  ];

  // Fetch open pull requests (up to 50 most recent)
  callGitHubAPI(`/repos/${config.GITHUB_REPO}/pulls?state=open&per_page=50&sort=created&direction=desc`, 'GET', null, (err, statusCode, pulls) => {
    if (err) return callback(err);
    if (!Array.isArray(pulls)) {
      return callback(new Error(`Failed to fetch pulls from GitHub: ${statusCode}`));
    }

    const activePr = pulls.find((pr) => {
      const prLabels = (pr.labels || []).map((l) => l.name);
      return labels.some((targetLabel) => prLabels.includes(targetLabel));
    }) || null;

    callback(null, activePr);
  });
}

/**
 * Checks GitHub for an active deployment PR for any environment (e.g. AIS-02, APM-01)
 */
function checkActiveEnvironmentDeployment(env, callback) {
  if (!env) return callback(null, null);

  if (env.isApm02) {
    return getActiveDeploymentPR(env, callback);
  }

  // Check for active deploying label or auto-merge PR for this environment
  const labels = [
    `auto merge for ${env.name}`,
    `${env.name} Deploying`
  ];

  callGitHubAPI(`/repos/${config.GITHUB_REPO}/pulls?state=open&per_page=50&sort=created&direction=desc`, 'GET', null, (err, statusCode, pulls) => {
    if (err) return callback(err);
    if (!Array.isArray(pulls)) {
      return callback(new Error(`Failed to fetch pulls from GitHub: ${statusCode}`));
    }

    const activePr = pulls.find((pr) => {
      const prLabels = (pr.labels || []).map((l) => l.name);
      return labels.some((targetLabel) => prLabels.includes(targetLabel));
    }) || null;

    callback(null, activePr);
  });
}

/**
 * Extracts the snapshot branch name from PR labels or body
 */
function extractSnapshotBranch(activePr) {
  if (!activePr) return 'snapshot branch';
  if (activePr.head && activePr.head.ref) {
    return activePr.head.ref;
  }
  const match = (activePr.body || '').match(/`?(snapshot\/main(?:-[a-z0-9]+)?-[^`\s]+)`?/i);
  return match ? match[1] : (activePr.title ? (activePr.title.match(/snapshot\/main(?:-[a-z0-9]+)?-[^\s]+/i)?.[0] || 'snapshot branch') : 'snapshot branch');
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

/**
 * Creates an empty commit on a target branch directly via GitHub Git Data API to re-trigger deployments
 */
function createEmptyCommitOnBranch(branch, commitMessage, callback) {
  const refPath = `/repos/${config.GITHUB_REPO}/git/refs/heads/${branch}`;

  // 1. Get current branch commit SHA
  callGitHubAPI(refPath, 'GET', null, (err, statusCode, refData) => {
    if (err || statusCode !== 200 || !refData.object) {
      return callback(new Error(`Failed to get ref for branch '${branch}': ${err ? err.message : statusCode}`));
    }
    const parentSha = refData.object.sha;

    // 2. Get tree SHA of the current commit
    callGitHubAPI(`/repos/${config.GITHUB_REPO}/git/commits/${parentSha}`, 'GET', null, (commitErr, commitStatus, commitData) => {
      if (commitErr || commitStatus !== 200 || !commitData.tree) {
        return callback(new Error(`Failed to get tree for commit '${parentSha}': ${commitErr ? commitErr.message : commitStatus}`));
      }
      const treeSha = commitData.tree.sha;

      // 3. Create a new commit with the same tree (an empty commit)
      const newCommitPayload = {
        message: commitMessage || `chore(re-trigger): re-trigger deployment on ${branch}`,
        tree: treeSha,
        parents: [parentSha]
      };

      callGitHubAPI(`/repos/${config.GITHUB_REPO}/git/commits`, 'POST', newCommitPayload, (createErr, createStatus, createdCommit) => {
        if (createErr || (createStatus !== 201 && createStatus !== 200) || !createdCommit.sha) {
          return callback(new Error(`Failed to create empty commit: ${createErr ? createErr.message : createStatus}`));
        }
        const newCommitSha = createdCommit.sha;

        // 4. Update the branch ref to point to the new commit
        callGitHubAPI(refPath, 'PATCH', { sha: newCommitSha, force: false }, (updateErr, updateStatus, updatedRef) => {
          if (updateErr || updateStatus !== 200) {
            return callback(new Error(`Failed to update ref for branch '${branch}': ${updateErr ? updateErr.message : updateStatus}`));
          }
          callback(null, newCommitSha);
        });
      });
    });
  });
}

module.exports = {
  callGitHubAPI,
  getActiveDeploymentPR,
  checkActiveEnvironmentDeployment,
  extractSnapshotBranch,
  triggerWorkflowDispatch,
  createEmptyCommitOnBranch
};

