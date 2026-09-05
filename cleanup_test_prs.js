const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    return '';
  }
}

console.log('🧹 Cleaning up 100 test PRs and branches...');

// Fetch all open PRs against test-target-base
const prsJson = run('gh pr list --repo Daxesh-Asint/GitHub-Actions-Trial-2 --base test-target-base --state open --limit 500 --json number,headRefName');

if (prsJson) {
  const prs = JSON.parse(prsJson);
  console.log(`Found ${prs.length} test PRs to close.`);
  for (const pr of prs) {
    run(`gh pr close ${pr.number} --repo Daxesh-Asint/GitHub-Actions-Trial-2 --delete-branch`);
    console.log(`🗑️ Closed PR #${pr.number} and deleted branch ${pr.headRefName}`);
  }
}

// Delete base branch
run('git push origin --delete test-target-base');
run('git branch -D test-target-base');
console.log('✅ All test PRs and branches cleaned up!');
