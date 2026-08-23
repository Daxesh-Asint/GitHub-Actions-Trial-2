const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PAYLOAD = process.env.WIKI_PAYLOAD;
if (!PAYLOAD) {
  console.error("Missing WIKI_PAYLOAD environment variable.");
  process.exit(1);
}
const payload = JSON.parse(PAYLOAD);
const action = payload.action; 
const snapshot = payload.snapshot;

const wikiDir = path.join(process.cwd(), 'wiki');
const historyFile = path.join(wikiDir, 'apm02_history.json');
const mdFile = path.join(wikiDir, 'APM-02-Deployment-History.md');

if (!fs.existsSync(wikiDir)) {
  console.error("Wiki directory not found.");
  process.exit(1);
}

let history = [];
if (fs.existsSync(historyFile)) {
  try {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch(e) {}
}

const GREEN_YES = '<span style="color:green;font-weight:bold">Yes</span>';
const RED_NO = '<span style="color:red;font-weight:bold">No</span>';

let row = history.find(r => r.snapshot === snapshot);

if (!row) {
  row = {
    id: history.length > 0 ? Math.max(...history.map(r => r.id)) + 1 : 1,
    date: payload.date || new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', dateStyle: 'medium' }),
    snapshot: snapshot,
    apm02_pr: 'N/A',
    main_pr: 'N/A',
    initiated_by: payload.actor || 'N/A',
    merge_time: 'N/A',
    status: '⏳ Waiting',
    merged_apm02: '-',
    merged_main: '-',
    cycle_completed: '-'
  };
  history.unshift(row);
}

if (action === 'create') {
  row.status = '⏳ Waiting';
} else if (action === 'merged-apm02') {
  if (payload.pr_number) row.apm02_pr = payload.pr_number;
  if (payload.merge_time) row.merge_time = payload.merge_time;
  row.merged_apm02 = payload.success ? GREEN_YES : RED_NO;
  row.status = payload.success ? '🚀 Deploying' : '⚠️ Blocked (APM-02)';
} else if (action === 'finalize-success') {
  if (payload.pr_number) row.main_pr = payload.pr_number;
  row.merged_main = GREEN_YES;
  row.cycle_completed = GREEN_YES;
  row.status = '✅ Success';
} else if (action === 'finalize-fail') {
  if (payload.pr_number) row.main_pr = payload.pr_number;
  row.merged_main = RED_NO;
  row.cycle_completed = RED_NO;
  row.status = '❌ Blocked (Main)';
} else if (action === 'post-conflict') {
  row.merged_main = GREEN_YES;
  row.cycle_completed = GREEN_YES;
  row.status = '✅ Success';
}

fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

let md = `# APM-02 Deployment History\n\n`;
md += `> Auto-updated by GitHub Actions after every deployment cycle.\n\n`;
md += `| # | 📅 Date (IST) | 🌿 Snapshot Branch | APM-02 PR | Main PR | snapshot merged into APM-02? | snapshot merged into main? | Completed? | Status |\n`;
md += `|---|---|---|---|---|---|---|---|---|\n`;

const REPO = process.env.GITHUB_REPOSITORY || 'Daxesh-Asint/GitHub-Actions-Trial-2';

for (const r of history) {
  const apm02Link = r.apm02_pr !== 'N/A' && r.apm02_pr !== 'NO_COMMITS' ? `[#${r.apm02_pr}](https://github.com/${REPO}/pull/${r.apm02_pr})` : r.apm02_pr;
  const mainLink = r.main_pr !== 'N/A' && r.main_pr !== 'NO_COMMITS' ? `[#${r.main_pr}](https://github.com/${REPO}/pull/${r.main_pr})` : r.main_pr;
  
  // Format date to take exactly 2 lines by splitting after the comma and preventing wraps elsewhere
  const dateStr = r.date.replace(', ', ',<br>').replace(/ /g, '&nbsp;');
  
  // Format status to keep emoji and first word on the same line, and the rest on a new line
  const statusParts = r.status.split(' ');
  let statusStr = statusParts[0];
  if (statusParts.length > 1) {
    statusStr += '&nbsp;' + statusParts[1];
  }
  if (statusParts.length > 2) {
    statusStr += '<br>' + statusParts.slice(2).join(' ');
  }
  
  md += `| ${r.id} | ${dateStr} | \`${r.snapshot}\` | ${apm02Link} | ${mainLink} | ${r.merged_apm02} | ${r.merged_main} | ${r.cycle_completed} | ${statusStr} |\n`;
}

fs.writeFileSync(mdFile, md);

try {
  execSync(`git config user.name "github-actions[bot]"`, { cwd: wikiDir });
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { cwd: wikiDir });
  execSync(`git add apm02_history.json APM-02-Deployment-History.md`, { cwd: wikiDir });
  
  const status = execSync(`git status --porcelain`, { cwd: wikiDir }).toString();
  if (status.trim() !== '') {
    execSync(`git commit -m "docs: Update APM-02 Deployment History for ${snapshot}"`, { cwd: wikiDir });
    execSync(`git push`, { cwd: wikiDir });
    console.log("Wiki updated successfully.");
  } else {
    console.log("No changes to commit.");
  }
} catch (error) {
  console.error("Error updating wiki repository:", error.message);
  process.exit(1);
}
