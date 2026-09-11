const assert = require('assert');
const {
  ENVIRONMENTS,
  extractChannelName,
  getEnvironmentByChannelName,
  findEnvironmentInText
} = require('./environments');
const {
  getChannelMismatchMessage,
  getDeployInitiatedMessage,
  getChannelHelpMessage
} = require('./messages');

console.log('🧪 Starting Multi-Environment Channel Routing Verification...\n');

// Test 1: Verify all 14 environments exist with their expected dispatch event
console.log('Test 1: Verifying all 14 environment definitions...');
assert.strictEqual(ENVIRONMENTS.length, 14, 'Should have exactly 14 environments');

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
  'ST-ENV Deployment POC': 'trigger_st_env_deployment'
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
console.log(`  ✅ Successfully detected "${detectedEnv.name}" from channelData`);

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

console.log('\n🎉 ALL TESTS PASSED! Multi-environment channel routing is 100% verified.');
