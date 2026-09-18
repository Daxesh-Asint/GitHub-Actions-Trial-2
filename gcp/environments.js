// =========================================================================
// 🌍 ENVIRONMENTS & CHANNEL MAPPINGS
// =========================================================================

const ENVIRONMENTS = [
  {
    id: 'ais02',
    name: 'AIS-02',
    channelId: '19:6940084ed04d48b79fd11e47d7801dd7@thread.tacv2',
    channelName: 'AIS-02 Deployment POC',
    dispatchEvent: 'trigger_ais02_deployment',
    tenantBranch: 'tenant/asint-ais-02',
    aliases: ['ais-02', 'ais02', 'ais', 'asint-ais-02'],
    webhookEnvVar: 'TEAMS_WEBHOOK_AIS02_1'
  },
  {
    id: 'apm01',
    name: 'APM-01',
    channelId: '19:d9b3cf62547548908f82dbff737d5add@thread.tacv2',
    channelName: 'APM-01 Deployment POC',
    dispatchEvent: 'trigger_apm01_deployment',
    tenantBranch: 'tenant/asint-apm-01-new',
    aliases: ['apm-01', 'apm01', 'asint-apm-01'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APM01_1'
  },
  {
    id: 'apm02',
    name: 'APM-02',
    channelId: '19:lSAZ2F1bhcVqFh6zoLafU-RovkCK6uhoMM4sBBaQMcY1@thread.tacv2',
    channelName: 'APM-02 Deployment POC',
    isApm02: true,
    dispatchEvent: 'trigger_apm02_deployment',
    tenantBranch: 'tenant/asint-apm-02-v2',
    aliases: ['apm-02', 'apm02', 'asint-apm-02'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APM02_1'
  },
  {
    id: 'apmeiot',
    name: 'APM-EIOT',
    channelId: '19:79f3f9070bc9427ea854206ae633b721@thread.tacv2',
    channelName: 'APM-EIOT Deployment POC',
    dispatchEvent: 'trigger_apm_eiot_deployment',
    tenantBranch: 'apm-eiot-temp-copy',
    aliases: ['apm-eiot', 'apmeiot', 'eiot', 'asint-apm-eiot'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APMEIOT_1'
  },
  {
    id: 'demo',
    name: 'AsInt Demo',
    channelId: '19:cca98dbf2ab94b3f99e143110e998c6d@thread.tacv2',
    channelName: 'AsInt Demo Deployment POC',
    dispatchEvent: 'trigger_asint_demo_deployment',
    tenantBranch: 'tenant/asint-demo',
    aliases: ['asint demo', 'demo', 'asintdemo'],
    webhookEnvVar: 'TEAMS_WEBHOOK_DEMO_1'
  },
  {
    id: 'baystar',
    name: 'BAYSTAR',
    channelId: '19:1389d10242a3438681fde9ae77861661@thread.tacv2',
    channelName: 'BAYSTAR Deployment POC',
    dispatchEvent: 'trigger_baystar_deployment',
    tenantBranch: 'tenant/baystar',
    aliases: ['baystar', 'asint-baystar'],
    webhookEnvVar: 'TEAMS_WEBHOOK_BAYSTAR_1'
  },
  {
    id: 'hsc_non_prod',
    name: 'HSC Non-Prod',
    channelId: '19:b40e6b67fd6e476299c862f5fe834f72@thread.tacv2',
    channelName: 'HSC Non-Prod Deployment POC',
    dispatchEvent: 'trigger_hsc_non_prod_deployment',
    tenantBranch: 'tenant/hemlock-non-prod',
    aliases: ['hsc non-prod', 'hsc non prod', 'hscnonprod', 'hemlock non-prod', 'hemlock non prod', 'hsc-non-prod'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_NON_PROD_1'
  },
  {
    id: 'hsc_prod',
    name: 'HSC Prod',
    channelId: '19:6af52681e4fa4610bb8bf75d622bbbbf@thread.tacv2',
    channelName: 'HSC Prod Deployment POC',
    dispatchEvent: 'trigger_hsc_prod_deployment',
    tenantBranch: 'tenant/hemlock-prod',
    aliases: ['hsc prod', 'hscprod', 'hemlock prod', 'hemlockprod', 'hsc-prod'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_PROD_1'
  },
  {
    id: 'indorama_prod_900',
    name: 'Indorama Prod 900',
    channelId: '19:3a5753030bd64fcda34f6958adeadb95@thread.tacv2',
    channelName: 'Indorama Prod 900 Deployment POC',
    dispatchEvent: 'trigger_indorama_prod_900_deployment',
    tenantBranch: 'tenant/indorama-prod-900',
    aliases: ['indorama prod 900', 'indorama 900', 'indoramaprod900', 'prod 900', 'prod900', '900'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_900_1'
  },
  {
    id: 'indorama_prod_933',
    name: 'Indorama Prod 933',
    channelId: '19:a18bcd98d0364070b1dcf79a9068a718@thread.tacv2',
    channelName: 'Indorama Prod 933 Deployment POC',
    dispatchEvent: 'trigger_indorama_prod_933_deployment',
    tenantBranch: 'tenant/indorama-prod-933',
    aliases: ['indorama prod 933', 'indorama 933', 'indoramaprod933', 'prod 933', 'prod933', '933'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_933_1'
  },
  {
    id: 'indorama_qa_233',
    name: 'Indorama QA 233',
    channelId: '19:6f5a4f7ad9c2421287523647750d67f2@thread.tacv2',
    channelName: 'Indorama QA 233 Deployment POC',
    dispatchEvent: 'trigger_indorama_qa_233_deployment',
    tenantBranch: 'tenant/indorama-qa-233',
    aliases: ['indorama qa 233', 'indorama 233', 'indoramaqa233', 'qa 233', 'qa233', '233'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_233_1'
  },
  {
    id: 'indorama_qa_234',
    name: 'Indorama QA 234',
    channelId: '19:827ca67584574137b1732016390486bb@thread.tacv2',
    channelName: 'Indorama QA 234 Deployment POC',
    dispatchEvent: 'trigger_indorama_qa_234_deployment',
    tenantBranch: 'tenant/indorama-qa-234',
    aliases: ['indorama qa 234', 'indorama 234', 'indoramaqa234', 'qa 234', 'qa234', '234'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_234_1'
  },
  {
    id: 'irc',
    name: 'IRC',
    channelId: '19:e2f2bc56c8c94077a769ee1f7c44a29e@thread.tacv2',
    channelName: 'IRC Deployment POC',
    dispatchEvent: 'trigger_irc_deployment',
    tenantBranch: 'tenant/asint-irc-temp',
    aliases: ['irc', 'asint-irc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_IRC_1'
  },
  {
    id: 'st_env',
    name: 'ST-ENV',
    channelId: '19:d3a97522e5f44dcea3e45bf4d48dc97b@thread.tacv2',
    channelName: 'ST-ENV Deployment POC',
    dispatchEvent: 'trigger_st_env_deployment',
    tenantBranch: 'st-env-for-contentfederation',
    aliases: ['st-env', 'st env', 'stenv', 'st', 'asint-st'],
    webhookEnvVar: 'TEAMS_WEBHOOK_ST_ENV_1'
  }
];

/**
 * Normalizes text for lenient matching (lowercased, alphanumeric only)
 */
function normalizeString(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Detects current MS Teams channel name or ID from incoming payload
 */
function extractChannelName(req) {
  if (!req) return '';
  // 1. Check direct query parameters if configured in webhook URL
  if (req.query && (req.query.channel || req.query.env)) {
    return req.query.channel || req.query.env;
  }
  // 2. Check Bot Framework channelData
  if (req.body && req.body.channelData) {
    if (req.body.channelData.channel && req.body.channelData.channel.name) {
      return req.body.channelData.channel.name;
    }
    // Check teamsChannelId or channel.id (Teams Outgoing Webhooks send this)
    if (req.body.channelData.teamsChannelId) {
      return req.body.channelData.teamsChannelId;
    }
    if (req.body.channelData.channel && req.body.channelData.channel.id) {
      return req.body.channelData.channel.id;
    }
  }
  // 3. Check conversation name or id
  if (req.body && req.body.conversation) {
    if (req.body.conversation.name) {
      return req.body.conversation.name;
    }
    if (req.body.conversation.id) {
      return req.body.conversation.id;
    }
  }
  return '';
}

/**
 * Finds environment by its Teams Channel ID (e.g. 19:xxx@thread.tacv2)
 */
function getEnvironmentByTeamsChannelId(channelId) {
  if (!channelId) return null;
  const cleanId = channelId.trim().toLowerCase();
  return ENVIRONMENTS.find((env) => env.channelId && env.channelId.toLowerCase() === cleanId) || null;
}

/**
 * Finds environment by its ID or alias (used for ?channel= query param resolution)
 * Accepts: env id (e.g. 'apm02'), env name (e.g. 'APM-02'), or any alias
 */
function getEnvironmentById(idOrAlias) {
  if (!idOrAlias) return null;
  const norm = normalizeString(idOrAlias);
  return ENVIRONMENTS.find((env) => {
    if (normalizeString(env.id) === norm) return true;
    if (normalizeString(env.name) === norm) return true;
    return env.aliases.some((alias) => normalizeString(alias) === norm);
  }) || null;
}

/**
 * Finds environment by its Teams Channel Name or Channel ID
 */
function getEnvironmentByChannelName(channelNameOrId) {
  if (!channelNameOrId) return null;

  // 1. Try exact match by Teams Channel ID first (e.g. 19:...@thread.tacv2)
  const byId = getEnvironmentByTeamsChannelId(channelNameOrId);
  if (byId) return byId;

  // 2. Try match by channel name or alias
  const normInput = normalizeString(channelNameOrId);
  return ENVIRONMENTS.find((env) => {
    const normChannel = normalizeString(env.channelName);
    const normEnvName = normalizeString(env.name);
    return (
      normInput === normChannel ||
      normInput.includes(normEnvName) ||
      env.aliases.some((alias) => normalizeString(alias) === normInput)
    );
  }) || null;
}

/**
 * Scans command text to see if an environment name/alias was mentioned
 */
function findEnvironmentInText(text) {
  if (!text) return null;
  const clean = text.toLowerCase();

  // Sort aliases by length descending so longer/more specific names match first (e.g. "indorama prod 900" before "900")
  const candidates = [];
  for (const env of ENVIRONMENTS) {
    for (const alias of env.aliases) {
      candidates.push({ env, alias, len: alias.length });
    }
  }
  candidates.sort((a, b) => b.len - a.len);

  for (const c of candidates) {
    const regex = new RegExp(`(^|\\s|\\b)${c.alias.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')}(\\b|\\s|$)`, 'i');
    if (regex.test(clean)) {
      return c.env;
    }
  }
  return null;
}

module.exports = {
  ENVIRONMENTS,
  normalizeString,
  extractChannelName,
  getEnvironmentById,
  getEnvironmentByTeamsChannelId,
  getEnvironmentByChannelName,
  findEnvironmentInText
};
