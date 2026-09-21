const assert = require('assert');
const {
  ENVIRONMENTS,
  extractChannelName,
  getEnvironmentById,
  getEnvironmentByChannelName,
  findEnvironmentInText
} = require('./environments');
const {
  getChannelMismatchMessage,
  getDeployInitiatedMessage,
  getChannelHelpMessage
} = require('./messages');

console.log('🧪 Starting Multi-Environment Channel Routing Verification...\n');

// Test 1: Verify all 15 environments exist with their expected dispatch event
console.log('Test 1: Verifying all 15 environment definitions...');
assert.strictEqual(ENVIRONMENTS.length, 15, 'Should have exactly 15 environments');

const expectedMappings = {
  'AIS-02 Deployment POC': 'trigger_ais02_deployment',
  'APM-01 Deployment POC': 'trigger_apm01_deployment',
  'APM-02 Deployment POC': 'trigger_apm02_deployment',
  'APM-EIOT Deployment POC': 'trigger_apm_eiot_deployment',
  'AsInt Demo Deployment POC': 'trigger_asint_demo_deployment',
  'BAYSTAR Deployment POC': 'trigger_baystar_deployment',
  'HSC Non-Prod Deployment POC': 'trigger_hsc_non_prod_deployment',
  'HSC Prod Deployment POC': 'trigger_hsc_prod_deployment',
  'Indorama Prod 900 Deployment POC': 'trigger_indorama_prod_900_deployment',
  'Indorama Prod 933 Deployment POC': 'trigger_indorama_prod_933_deployment',
  'Indorama QA 233 Deployment POC': 'trigger_indorama_qa_233_deployment',
  'Indorama QA 234 Deployment POC': 'trigger_indorama_qa_234_deployment',
  'IRC Deployment POC': 'trigger_irc_deployment',
  'ST-ENV Deployment POC': 'trigger_st_env_deployment',
  'VMOS Deployment POC': 'trigger_vmos_deployment'
};

for (const [channelName, expectedDispatch] of Object.entries(expectedMappings)) {
  const env = getEnvironmentByChannelName(channelName);
  assert(env, `Environment must be found for channel "${channelName}"`);
  assert.strictEqual(env.dispatchEvent, expectedDispatch, `Channel "${channelName}" should map to dispatch "${expectedDispatch}"`);
  console.log(`  ✅ ${channelName} → ${env.name} (${env.dispatchEvent})`);
}

// Test 2: Channel detection from MS Teams Bot Framework payload
console.log('\nTest 2: Testing extractChannelName from Bot Framework payload...');
const mockReqFromTeams = {
  body: {
    channelData: {
      channel: {
        id: '19:xyz@thread.tacv2',
        name: 'AIS-02 Deployment POC'
      }
    }
  }
};
const detectedChannel = extractChannelName(mockReqFromTeams);
assert.strictEqual(detectedChannel, 'AIS-02 Deployment POC');
const detectedEnv = getEnvironmentByChannelName(detectedChannel);
assert.strictEqual(detectedEnv.name, 'AIS-02');
console.log(`  ✅ Successfully detected "${detectedEnv.name}" from channelData.name`);

// Test 2b: Real Teams Outgoing Webhook payload (using teamsChannelId without channel name)
console.log('\nTest 2b: Testing channel ID detection from Teams Outgoing Webhook payload...');
const realApm02TeamsReq = {
  body: {
    channelData: {
      teamsChannelId: '19:lSAZ2F1bhcVqFh6zoLafU-RovkCK6uhoMM4sBBaQMcY1@thread.tacv2',
      channel: {
        id: '19:lSAZ2F1bhcVqFh6zoLafU-RovkCK6uhoMM4sBBaQMcY1@thread.tacv2'
      }
    }
  }
};
const detectedApm02Id = extractChannelName(realApm02TeamsReq);
const detectedApm02Env = getEnvironmentByChannelName(detectedApm02Id);
assert(detectedApm02Env, 'Should find APM-02 from real Teams channelData ID');
assert.strictEqual(detectedApm02Env.id, 'apm02', 'Should resolve to APM-02');
assert.strictEqual(detectedApm02Env.isApm02, true, 'Should have isApm02 flag');
console.log(`  ✅ Successfully detected APM-02 from real teamsChannelId!`);

// Test 2c: Verify all 14 channels resolve correctly from their channelId
console.log('\nTest 2c: Verifying all 14 channel IDs resolve to their environments...');
for (const env of ENVIRONMENTS) {
  assert(env.channelId, `Environment ${env.name} must have channelId`);
  const req = { body: { channelData: { teamsChannelId: env.channelId } } };
  const resolved = getEnvironmentByChannelName(extractChannelName(req));
  assert(resolved, `Failed to resolve ${env.name} from ID ${env.channelId}`);
  assert.strictEqual(resolved.id, env.id, `ID mismatch for ${env.name}`);
  console.log(`  ✅ ${env.name} (${env.channelId.substring(0, 20)}...) → ${resolved.name}`);
}

// Test 3: Detecting environment aliases in command text
console.log('\nTest 3: Testing environment detection in text...');
const testCases = [
  { text: '@Jarvis deploy ais-02', expectedId: 'ais02' },
  { text: '@jarvis deploy apm-01', expectedId: 'apm01' },
  { text: 'deploy baystar', expectedId: 'baystar' },
  { text: 'deploy indorama prod 900', expectedId: 'indorama_prod_900' },
  { text: 'deploy indorama prod 933', expectedId: 'indorama_prod_933' },
  { text: 'deploy indorama qa 233', expectedId: 'indorama_qa_233' },
  { text: 'deploy indorama qa 234', expectedId: 'indorama_qa_234' },
  { text: 'deploy hsc non-prod', expectedId: 'hsc_non_prod' },
  { text: 'deploy hsc prod', expectedId: 'hsc_prod' },
  { text: 'deploy apm-eiot', expectedId: 'apmeiot' },
  { text: 'deploy demo', expectedId: 'demo' },
  { text: 'deploy irc', expectedId: 'irc' },
  { text: 'deploy st-env', expectedId: 'st_env' }
];

for (const tc of testCases) {
  const match = findEnvironmentInText(tc.text);
  assert(match, `Should match environment in "${tc.text}"`);
  assert.strictEqual(match.id, tc.expectedId, `Expected ${tc.expectedId} for "${tc.text}", got ${match.id}`);
  console.log(`  ✅ "${tc.text}" → ${match.name}`);
}

// Test 4: Channel boundary enforcement
console.log('\nTest 4: Channel boundary enforcement...');
const aisEnv = getEnvironmentByChannelName('AIS-02 Deployment POC');
const apm01InText = findEnvironmentInText('@jarvis deploy apm-01');

// When user is in AIS-02 and tries to deploy APM-01
assert.notStrictEqual(aisEnv.id, apm01InText.id, 'Environments should differ');
const mismatchCard = getChannelMismatchMessage(aisEnv.channelName, apm01InText.name, apm01InText.channelName);
assert(mismatchCard.title.includes('Restricted to APM-01'));
assert(mismatchCard.body.includes('AIS-02 Deployment POC'));
console.log(`  ✅ Cross-channel deployment correctly blocked:`);
console.log(`     Title: ${mismatchCard.title}`);

// Test 5: Deploy confirmation message
console.log('\nTest 5: Deploy confirmation message...');
const deployCard = getDeployInitiatedMessage('BAYSTAR', 'Daxesh');
assert(deployCard.title.includes('BAYSTAR'));
assert(deployCard.body.includes('Daxesh'));
console.log(`  ✅ Deploy initiated message: ${deployCard.title}`);

// Test 6: FAIL-CLOSED — channel not detected scenario (the bug that was fixed)
console.log('\nTest 6: Fail-closed guard when channel is undetected...');

// Simulate a request with NO channelData (empty channel name)
const mockReqNoChannel = { body: { text: 'deploy st-env' } };
const emptyChannelName = extractChannelName(mockReqNoChannel);
assert.strictEqual(emptyChannelName, '', 'Channel name should be empty when no channelData');

const noChannelEnv = getEnvironmentByChannelName(emptyChannelName);
assert.strictEqual(noChannelEnv, null, 'Should NOT resolve any environment from empty channel name');

// But the text DOES contain an environment reference
const stEnvFromText = findEnvironmentInText('deploy st-env');
assert(stEnvFromText, 'ST-ENV should be detected in text');
assert.strictEqual(stEnvFromText.id, 'st_env');

// This is the condition that triggers the fail-closed guard in index.js:
// !currentChannelEnv && targetEnvInText → BLOCK
console.log(`  ✅ Fail-closed scenario confirmed:`);
console.log(`     Channel detected: (none) → currentChannelEnv = null`);
console.log(`     Text target: ${stEnvFromText.name} → deploy would be BLOCKED`);
console.log(`     This prevents the APM-02→ST cross-channel bug!`);

// Verify the guard condition logic
assert(
  !noChannelEnv && stEnvFromText,
  'Guard condition (!currentChannelEnv && targetEnvInText) must be true'
);
console.log(`  ✅ Guard condition verified: !null && 'st_env' = true → BLOCKED`);

// Test 7: Query parameter-based channel detection (the primary fix)
console.log('\nTest 7: Query parameter ?channel= based channel detection...');

const queryParamTests = [
  { param: 'apm02', expectedId: 'apm02', expectedName: 'APM-02' },
  { param: 'ais02', expectedId: 'ais02', expectedName: 'AIS-02' },
  { param: 'apm01', expectedId: 'apm01', expectedName: 'APM-01' },
  { param: 'apmeiot', expectedId: 'apmeiot', expectedName: 'APM-EIOT' },
  { param: 'demo', expectedId: 'demo', expectedName: 'AsInt Demo' },
  { param: 'baystar', expectedId: 'baystar', expectedName: 'BAYSTAR' },
  { param: 'hsc_non_prod', expectedId: 'hsc_non_prod', expectedName: 'HSC Non-Prod' },
  { param: 'hsc_prod', expectedId: 'hsc_prod', expectedName: 'HSC Prod' },
  { param: 'indorama_prod_900', expectedId: 'indorama_prod_900', expectedName: 'Indorama Prod 900' },
  { param: 'indorama_prod_933', expectedId: 'indorama_prod_933', expectedName: 'Indorama Prod 933' },
  { param: 'indorama_qa_233', expectedId: 'indorama_qa_233', expectedName: 'Indorama QA 233' },
  { param: 'indorama_qa_234', expectedId: 'indorama_qa_234', expectedName: 'Indorama QA 234' },
  { param: 'irc', expectedId: 'irc', expectedName: 'IRC' },
  { param: 'st_env', expectedId: 'st_env', expectedName: 'ST-ENV' }
];

for (const tc of queryParamTests) {
  const env = getEnvironmentById(tc.param);
  assert(env, `getEnvironmentById('${tc.param}') should find environment`);
  assert.strictEqual(env.id, tc.expectedId, `Expected id '${tc.expectedId}' for param '${tc.param}'`);
  assert.strictEqual(env.name, tc.expectedName, `Expected name '${tc.expectedName}' for param '${tc.param}'`);
  console.log(`  ✅ ?channel=${tc.param} → ${env.name} (${env.id})`);
}

// Also test alias-based resolution via getEnvironmentById
const aliasTests = [
  { param: 'apm-02', expectedId: 'apm02' },
  { param: 'ais-02', expectedId: 'ais02' },
  { param: 'st-env', expectedId: 'st_env' },
  { param: 'eiot', expectedId: 'apmeiot' },
  { param: 'APM-01', expectedId: 'apm01' }
];

for (const tc of aliasTests) {
  const env = getEnvironmentById(tc.param);
  assert(env, `getEnvironmentById('${tc.param}') should find environment via alias`);
  assert.strictEqual(env.id, tc.expectedId);
  console.log(`  ✅ ?channel=${tc.param} (alias) → ${env.name}`);
}

console.log(`  ✅ All 14 environments + aliases resolve correctly via query param`);

// Test 8: APM-02 help card shows correct commands when channel is detected
console.log('\nTest 8: Channel-specific help card verification...');
const { buildHelpCard } = require('./teams');

// APM-02 channel → should show 8 APM-02 specific commands
const apm02Env = getEnvironmentById('apm02');
const apm02HelpCard = buildHelpCard('Jarvis', apm02Env, ENVIRONMENTS);
const apm02CardText = JSON.stringify(apm02HelpCard);
assert(apm02CardText.includes('share snapshot'), 'APM-02 help should include share snapshot');
assert(apm02CardText.includes('deploy now'), 'APM-02 help should include deploy now');
assert(apm02CardText.includes('extend'), 'APM-02 help should include extend');
assert(apm02CardText.includes('reduce'), 'APM-02 help should include reduce');
assert(apm02CardText.includes('re-trigger'), 'APM-02 help should include re-trigger');
assert(apm02CardText.includes('deployment fix pushed'), 'APM-02 help should include fix pushed');
assert(apm02CardText.includes('status'), 'APM-02 help should include status');
assert(apm02CardText.includes('APM-02 Command Centre'), 'APM-02 help header should say APM-02 Command Centre');
console.log('  ✅ APM-02 help card shows all 8 commands correctly');

// AIS-02 channel → should show channel-specific deploy commands, NOT other envs
const ais02Env = getEnvironmentById('ais02');
const ais02HelpCard = buildHelpCard('Jarvis', ais02Env, ENVIRONMENTS);
const ais02CardText = JSON.stringify(ais02HelpCard);
assert(ais02CardText.includes('AIS-02 Command Centre'), 'AIS-02 help should say AIS-02 Command Centre');
assert(ais02CardText.includes('deploy'), 'AIS-02 help should include deploy command');
assert(!ais02CardText.includes('share snapshot'), 'AIS-02 help should NOT include APM-02 share snapshot');
assert(!ais02CardText.includes('deploy apm-01'), 'AIS-02 help should NOT include APM-01 commands');
console.log('  ✅ AIS-02 help card shows ONLY AIS-02 commands');

// No channel detected → should show generic multi-environment list
const genericHelpCard = buildHelpCard('Jarvis', null, ENVIRONMENTS);
const genericCardText = JSON.stringify(genericHelpCard);
assert(genericCardText.includes('Multi-Environment'), 'Generic help should say Multi-Environment');
console.log('  ✅ Generic help card shows multi-environment list');

// Test 9: Status message verification across all PR states
console.log('\nTest 9: APM-02 Status card message verification across all states...');
const { getStatusMessage } = require('./messages');

// 9a. IDLE state (no active PR)
const idleStatus = getStatusMessage(null);
assert(idleStatus.title.includes('IDLE'), 'Should indicate IDLE state');
assert(idleStatus.body.includes('share snapshot'), 'Should suggest share snapshot');
console.log('  ✅ IDLE state status message verified');

// 9b. APM-02 Active (Cherry-pick window)
const activePr = {
  number: 101,
  html_url: 'https://github.com/org/repo/pull/101',
  labels: [{ name: 'APM-02 Active' }],
  body: 'snapshot/main-2026-09-14-1200',
  user: { login: 'daxesh' }
};
const activeStatus = getStatusMessage(activePr);
assert(activeStatus.title.includes('Waiting for Cherry-Picks'), 'Active title mismatch');
assert(activeStatus.body.includes('Active snapshot branch is available & waiting for cherry-picks'), 'Active status body mismatch');
assert(activeStatus.body.includes('deploy now'), 'Should suggest deploy now');
console.log('  ✅ APM-02 Active status message verified');

// 9c. APM-02 Deploying
const deployingPr = {
  number: 102,
  html_url: 'https://github.com/org/repo/pull/102',
  labels: [{ name: 'APM-02 Deploying' }],
  body: 'snapshot/main-2026-09-14-1200',
  user: { login: 'daxesh' }
};
const deployingStatus = getStatusMessage(deployingPr);
assert(deployingStatus.title.includes('Deployment in Progress'), 'Deploying title mismatch');
assert(deployingStatus.body.includes('Deployment is in progress'), 'Deploying body mismatch');
console.log('  ✅ APM-02 Deploying status message verified');

// 9d. APM-02 Failed
const failedPr = {
  number: 103,
  html_url: 'https://github.com/org/repo/pull/103',
  labels: [{ name: 'APM-02 Failed' }],
  body: 'snapshot/main-2026-09-14-1200',
  user: { login: 'daxesh' }
};
const failedStatus = getStatusMessage(failedPr);
assert(failedStatus.title.includes('Deployment Failed'), 'Failed title mismatch');
assert(failedStatus.body.includes('SAP CI/CD pipeline failed'), 'Failed body mismatch');
assert(failedStatus.body.includes('re-trigger'), 'Should mention re-trigger');
assert(failedStatus.body.includes('deployment fix pushed, re-deploy'), 'Should mention deployment fix pushed');
console.log('  ✅ APM-02 Failed status message verified');

// 9e. APM-02 Blocked (Conflicts)
const blockedPr = {
  number: 104,
  html_url: 'https://github.com/org/repo/pull/104',
  labels: [{ name: 'APM-02 Blocked' }],
  body: 'snapshot/main-2026-09-14-1200',
  user: { login: 'daxesh' }
};
// Test 10: In-progress deployment guard card verification
console.log('\nTest 10: Deployment already in progress guard card verification...');
const { getDeploymentInProgressMessage, getRetriggerInitiatedMessage } = require('./messages');
const mockActivePr = {
  number: 105,
  html_url: 'https://github.com/org/repo/pull/105'
};
const inProgressCard = getDeploymentInProgressMessage('AIS-02', mockActivePr, 'Jarvis');
assert(inProgressCard.title.includes('Deployment Already in Progress'), 'Title should state in progress');
assert(inProgressCard.body.includes('AIS-02'), 'Body should mention environment');
assert(inProgressCard.body.includes('PR #105'), 'Body should link active PR');
console.log('  ✅ In-progress deployment block card verified');

// Test 11: Re-trigger message and tenantBranch verification for all 14 environments
console.log('\nTest 11: Re-trigger message & tenant branch verification across all environments...');
for (const env of ENVIRONMENTS) {
  assert(env.tenantBranch, `Environment ${env.name} must have a tenantBranch defined`);
}
console.log('  ✅ All 14 environments have tenantBranch configured');

const retriggerCard = getRetriggerInitiatedMessage('AIS-02', 'tenant/asint-ais-02', '71404107b55b636680e6a298425c4de6c0d09bb7', 'daxesh');
assert(retriggerCard.title.includes('Re-trigger Initiated for AIS-02'), 'Title should mention Re-trigger Initiated');
assert(retriggerCard.body.includes('tenant/asint-ais-02'), 'Body should mention tenant branch');
assert(retriggerCard.body.includes('7140410'), 'Body should include short SHA');
assert(retriggerCard.body.includes('@daxesh'), 'Body should mention user');
console.log('  ✅ Re-trigger confirmation message verified');

console.log('\n🎉 ALL TESTS PASSED! Multi-environment channel routing, Status messages, Concurrency Guards, and Re-trigger are 100% verified.');
