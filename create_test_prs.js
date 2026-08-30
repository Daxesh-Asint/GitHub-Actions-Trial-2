const { execSync } = require('child_process');
const fs = require('fs');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
}

console.log('🚀 Setting up test-target-base branch...');
run('git checkout -b test-target-base origin/main');
run('git push -u origin test-target-base');

console.log('🚀 Creating 100 test PRs...');
for (let i = 1; i <= 100; i++) {
  const branchName = `test-pr-source-${i}`;
  try {
    run(`git checkout -b ${branchName} test-target-base`);
    fs.writeFileSync(`test_file_${i}.txt`, `Test content ${i}`);
    run(`git add test_file_${i}.txt`);
    run(`git commit -m "chore: test PR ${i}"`);
    run(`git push -u origin ${branchName}`);
    run(`gh pr create --repo Daxesh-Asint/GitHub-Actions-Trial-2 --base test-target-base --head ${branchName} --title "Test PR #${i}" --body "Dummy test PR ${i}"`);
    console.log(`✅ [${i}/100] Created PR for ${branchName}`);
  } catch (err) {
    console.error(`❌ Error on PR ${i}:`, err.message);
  } finally {
    try {
      if (fs.existsSync(`test_file_${i}.txt`)) {
        fs.unlinkSync(`test_file_${i}.txt`);
      }
    } catch (e) {}
    try {
      run('git checkout test-target-base');
    } catch (e) {}
  }
}

run('git checkout dev');
console.log('🎉 Done! 100 test PRs created. Returned to dev.');
