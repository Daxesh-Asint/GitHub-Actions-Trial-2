const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PAYLOAD_STR = process.env.WIKI_PAYLOAD;
if (!PAYLOAD_STR) {
  console.log("No WIKI_PAYLOAD provided. Skipping wiki update.");
  process.exit(0);
}

let payload;
try {
  payload = JSON.parse(PAYLOAD_STR);
} catch (e) {
  console.error("Failed to parse WIKI_PAYLOAD JSON:", e.message);
  process.exit(1);
}

const wikiDir = path.join(process.cwd(), 'wiki');
if (!fs.existsSync(wikiDir)) {
  console.error("Wiki directory does not exist at:", wikiDir);
  process.exit(1);
}

// Extract parameters
const rawEnv = payload.environment || payload.deployment_name || payload.resource_name || 'General';
const cleanEnv = rawEnv.replace(/^AsInt-/i, '').replace(/[-_]/g, ' ').trim()
  .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words
const envSlug = cleanEnv.replace(/\s+/g, '-');
const envKey = cleanEnv.toLowerCase().replace(/[^a-z0-9]/g, '');

const REPO = process.env.GITHUB_REPOSITORY || 'Daxesh-Asint/GitHub-Actions-Trial-2';
const action = payload.action || 'deploy'; // 'deploy', 'approval_merge', 'conflict_merge', 'sap_start', 'sap_finish'
const prNumber = payload.pr_number ? String(payload.pr_number).replace(/[^0-9]/g, '') : '';
const commitId = payload.commit_id || payload.commit || payload.sha || 'N/A';
const shortCommit = commitId && commitId !== 'N/A' ? commitId.substring(0, 7) : 'N/A';
const sourceBranch = payload.source_branch || payload.head_branch || 'dev';
const targetBranch = payload.target_branch || payload.base_branch || 'tenant';
const actor = payload.actor || payload.initiator || 'github-actions[bot]';
const status = payload.status || 'Success'; // Success, Failed, Awaiting Approval, Running, etc.

const now = new Date();
const dateIST = payload.date || now.toLocaleDateString('en-US', {
  timeZone: 'Asia/Kolkata',
  weekday: 'short',
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});
const timeIST = payload.time || now.toLocaleTimeString('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
}) + ' IST';

const historyJsonFile = path.join(wikiDir, `${envKey}_history.json`);
const historyMdFile = path.join(wikiDir, `${envSlug}-Deployment-History.md`);
const homeMdFile = path.join(wikiDir, 'Home.md');

let history = [];
if (fs.existsSync(historyJsonFile)) {
  try {
    history = JSON.parse(fs.readFileSync(historyJsonFile, 'utf8'));
  } catch (err) {
    console.warn(`Could not parse existing ${historyJsonFile}, starting new.`);
    history = [];
  }
}

// Match existing entry if this is a follow-up action (e.g. sap_start, sap_finish, approval_merge)
let entry = null;
if (prNumber) {
  entry = history.find(item => item.pr_number === prNumber);
}
if (!entry && shortCommit !== 'N/A') {
  entry = history.find(item => item.commit_id && item.commit_id.startsWith(shortCommit));
}

// Styling helpers
function formatBadge(text, type) {
  if (type === 'good') return `<span style="color:#2ea44f;font-weight:bold;">${text}</span>`;
  if (type === 'warn') return `<span style="color:#d99b00;font-weight:bold;">${text}</span>`;
  if (type === 'danger') return `<span style="color:#cb2431;font-weight:bold;">${text}</span>`;
  return `<span>${text}</span>`;
}

if (!entry) {
  // Create new history entry
  const nextId = history.length > 0 ? Math.max(...history.map(h => h.id || 0)) + 1 : 1;
  entry = {
    id: nextId,
    date: dateIST,
    time: timeIST,
    environment: cleanEnv,
    pr_number: prNumber || 'N/A',
    commit_id: shortCommit,
    source_branch: sourceBranch,
    target_branch: targetBranch,
    actor: actor,
    merge_status: 'Merged',
    sap_status: '⏳ Pending',
    status: status
  };
  history.unshift(entry);
}

// Update entry based on action
if (action === 'deploy' || action === 'merge_attempt') {
  if (status === 'Success' || status === 'Merged') {
    entry.merge_status = formatBadge('✅ Yes', 'good');
    entry.status = '🚀 Deploying';
  } else if (status === 'Awaiting Approval') {
    entry.merge_status = formatBadge('⏳ Awaiting Approval', 'warn');
    entry.status = '🟡 Awaiting Review';
  } else {
    entry.merge_status = formatBadge('❌ Failed', 'danger');
    entry.status = '❌ Merge Failed';
  }
  if (shortCommit !== 'N/A') entry.commit_id = shortCommit;
  if (prNumber) entry.pr_number = prNumber;
} else if (action === 'approval_merge') {
  entry.merge_status = formatBadge('✅ Yes (Approved)', 'good');
  entry.status = '🚀 Deploying';
  if (shortCommit !== 'N/A') entry.commit_id = shortCommit;
} else if (action === 'conflict_merge') {
  entry.merge_status = formatBadge('✅ Yes (Resolved)', 'good');
  entry.status = '🚀 Deploying';
  if (shortCommit !== 'N/A') entry.commit_id = shortCommit;
} else if (action === 'sap_start') {
  entry.sap_status = formatBadge('⏳ Running', 'warn');
  entry.status = '🚀 In Progress';
  if (shortCommit !== 'N/A' && entry.commit_id === 'N/A') entry.commit_id = shortCommit;
} else if (action === 'sap_finish') {
  if (status === 'SUCCESS' || status === 'INFO') {
    entry.sap_status = formatBadge('✅ Success', 'good');
    entry.status = '✅ Succeeded';
  } else {
    entry.sap_status = formatBadge('❌ Failed', 'danger');
    entry.status = '❌ SAP Build Failed';
  }
  if (shortCommit !== 'N/A' && entry.commit_id === 'N/A') entry.commit_id = shortCommit;
}

// Save JSON log
fs.writeFileSync(historyJsonFile, JSON.stringify(history, null, 2), 'utf8');

// Generate Environment Markdown Table
let md = `# ${cleanEnv} Deployment History\n\n`;
md += `> Auto-updated by GitHub Actions upon every deployment event and SAP CI/CD completion.\n\n`;
md += `| # | 📅 Date (IST) | 🔀 Pull Request | 🏷️ Commit | 🌿 Source &rarr; Target | 👤 Initiator | 🔀 Merge Status | ⚙️ SAP CI/CD | 📊 Overall Status |\n`;
md += `|---|---|---|---|---|---|---|---|---|\n`;

for (const row of history) {
  const prLink = row.pr_number && row.pr_number !== 'N/A'
    ? `[#${row.pr_number}](https://github.com/${REPO}/pull/${row.pr_number})`
    : 'N/A';

  const commitLink = row.commit_id && row.commit_id !== 'N/A'
    ? `[\`${row.commit_id}\`](https://github.com/${REPO}/commit/${row.commit_id})`
    : 'N/A';

  const branches = `\`${row.source_branch || '-'}\` &rarr;<br>\`${row.target_branch || '-'}\``;
  const dateFormatted = `${(row.date || '').replace(', ', ',<br>')}<br><small>${row.time || ''}</small>`;

  md += `| ${row.id} | ${dateFormatted} | ${prLink} | ${commitLink} | ${branches} | ${row.actor || 'N/A'} | ${row.merge_status || '-'} | ${row.sap_status || '-'} | ${row.status || '-'} |\n`;
}

fs.writeFileSync(historyMdFile, md, 'utf8');

// Update Home.md index
let homeContent = `# Welcome to the Repository Deployment Wiki\n\n`;
homeContent += `Auto-generated deployment logs and tracking across all configured tenant environments.\n\n`;
homeContent += `### 🌐 Environment Deployment Histories\n\n`;
homeContent += `| Environment | Wiki History Page | Last Activity (IST) |\n`;
homeContent += `|:---|:---|:---|\n`;

// Discover all deployment history markdown files in wiki directory
const files = fs.readdirSync(wikiDir);
const historyPages = files.filter(f => f.endsWith('-Deployment-History.md')).sort();

for (const page of historyPages) {
  const envTitle = page.replace(/-Deployment-History\.md$/, '').replace(/-/g, ' ');
  const pageNameNoExt = page.replace(/\.md$/, '');
  const pagePath = path.join(wikiDir, page);
  const mtime = fs.statSync(pagePath).mtime.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST';
  homeContent += `| **${envTitle}** | [${envTitle} Deployment History](${pageNameNoExt}) | ${mtime} |\n`;
}

homeContent += `\n*Page dynamically maintained by GitHub Actions automation workflows.*\n`;
fs.writeFileSync(homeMdFile, homeContent, 'utf8');

// Commit & push to wiki repo
try {
  execSync(`git config user.name "github-actions[bot]"`, { cwd: wikiDir });
  execSync(`git config user.email "github-actions[bot]@users.noreply.github.com"`, { cwd: wikiDir });
  execSync(`git add .`, { cwd: wikiDir });

  const statusOut = execSync(`git status --porcelain`, { cwd: wikiDir }).toString();
  if (statusOut.trim() !== '') {
    execSync(`git commit -m "docs(wiki): update deployment history for ${cleanEnv}"`, { cwd: wikiDir });
    execSync(`git push`, { cwd: wikiDir });
    console.log(`✅ Wiki successfully updated and pushed for ${cleanEnv}!`);
  } else {
    console.log("No wiki changes to commit.");
  }
} catch (error) {
  console.error("Error committing to wiki repository:", error.message);
  process.exit(1);
}
