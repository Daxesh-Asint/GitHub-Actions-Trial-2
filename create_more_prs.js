const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

console.log('🚀 Starting creation of 450 additional test PRs (101 to 550) against test-target-base...');

for (let i = 101; i <= 550; i++) {
  const branchName = `test-pr-source-${i}`;
  try {
    run(`git checkout -b ${branchName} origin/test-target-base`);
    fs.writeFileSync(`test_dummy_${i}.txt`, `Test dummy content for PR #${i}`);
    run(`git add test_dummy_${i}.txt`);
    run(`git commit -m "chore: test PR ${i}"`);
    run(`git push -u origin ${branchName}`);
    run(`gh pr create --repo Daxesh-Asint/GitHub-Actions-Trial-2 --base test-target-base --head ${branchName} --title "Test PR #${i}" --body "Dummy test PR ${i}"`);
    console.log(`✅ [${i}/550] Created PR for ${branchName}`);
  } catch (err) {
    console.error(`❌ Error on PR ${i}:`, err.message);
  } finally {
    try {
      if (fs.existsSync(`test_dummy_${i}.txt`)) {
        fs.unlinkSync(`test_dummy_${i}.txt`);
      }
    } catch (e) {}
  }
}

run('git checkout dev');
console.log('🎉 Done! 450 additional test PRs created. Switched back to dev branch.');
