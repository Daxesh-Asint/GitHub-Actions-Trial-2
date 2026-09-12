// =========================================================================
// 🌍 ENVIRONMENTS & CHANNEL MAPPINGS
// =========================================================================

const ENVIRONMENTS = [
  {
    id: 'ais02',
    name: 'AIS-02',
    channelName: 'AIS-02 Deployment POC',
    dispatchEvent: 'trigger_ais02_deployment',
    aliases: ['ais-02', 'ais02', 'ais', 'asint-ais-02'],
    webhookEnvVar: 'TEAMS_WEBHOOK_AIS02_1'
  },
  {
    id: 'apm01',
    name: 'APM-01',
    channelName: 'APM-01 Deployment POC',
    dispatchEvent: 'trigger_apm01_deployment',
    aliases: ['apm-01', 'apm01', 'asint-apm-01'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APM01_1'
  },
  {
    id: 'apm02',
    name: 'APM-02',
    channelName: 'APM-02 Deployment POC',
    isApm02: true,
    dispatchEvent: 'trigger_apm02_deployment',
    aliases: ['apm-02', 'apm02', 'asint-apm-02'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APM02_1'
  },
  {
    id: 'apmeiot',
    name: 'APM-EIOT',
    channelName: 'APM-EIOT Deployment POC',
    dispatchEvent: 'trigger_apm_eiot_deployment',
    aliases: ['apm-eiot', 'apmeiot', 'eiot', 'asint-apm-eiot'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APMEIOT_1'
  },
  {
    id: 'demo',
    name: 'AsInt Demo',
    channelName: 'AsInt Demo Deployment POC',
    dispatchEvent: 'trigger_asint_demo_deployment',
    aliases: ['asint demo', 'demo', 'asintdemo'],
    webhookEnvVar: 'TEAMS_WEBHOOK_DEMO_1'
  },
  {
    id: 'baystar',
    name: 'BAYSTAR',
    channelName: 'BAYSTAR Deployment POC',
    dispatchEvent: 'trigger_baystar_deployment',
    aliases: ['baystar', 'asint-baystar'],
    webhookEnvVar: 'TEAMS_WEBHOOK_BAYSTAR_1'
  },
  {
    id: 'hsc_non_prod',
    name: 'HSC Non-Prod',
    channelName: 'HSC Non-Prod Deployment POC',
    dispatchEvent: 'trigger_hsc_non_prod_deployment',
    aliases: ['hsc non-prod', 'hsc non prod', 'hscnonprod', 'hemlock non-prod', 'hemlock non prod', 'hsc-non-prod'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_NON_PROD_1'
  },
  {
    id: 'hsc_prod',
    name: 'HSC Prod',
    channelName: 'HSC Prod Deployment POC',
    dispatchEvent: 'trigger_hsc_prod_deployment',
    aliases: ['hsc prod', 'hscprod', 'hemlock prod', 'hemlockprod', 'hsc-prod'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_PROD_1'
  },
  {
    id: 'indorama_prod_900',
    name: 'Indorama Prod 900',
    channelName: 'Indorama Prod 900 Deployment POC',
    dispatchEvent: 'trigger_indorama_prod_900_deployment',
    aliases: ['indorama prod 900', 'indorama 900', 'indoramaprod900', 'prod 900', 'prod900', '900'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_900_1'
  },
  {
    id: 'indorama_prod_933',
    name: 'Indorama Prod 933',
    channelName: 'Indorama Prod 933 Deployment POC',
    dispatchEvent: 'trigger_indorama_prod_933_deployment',
    aliases: ['indorama prod 933', 'indorama 933', 'indoramaprod933', 'prod 933', 'prod933', '933'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_933_1'
  },
  {
    id: 'indorama_qa_233',
    name: 'Indorama QA 233',
    channelName: 'Indorama QA 233 Deployment POC',
    dispatchEvent: 'trigger_indorama_qa_233_deployment',
    aliases: ['indorama qa 233', 'indorama 233', 'indoramaqa233', 'qa 233', 'qa233', '233'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_233_1'
  },
  {
    id: 'indorama_qa_234',
    name: 'Indorama QA 234',
    channelName: 'Indorama QA 234 Deployment POC',
    dispatchEvent: 'trigger_indorama_qa_234_deployment',
    aliases: ['indorama qa 234', 'indorama 234', 'indoramaqa234', 'qa 234', 'qa234', '234'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_234_1'
  },
  {
    id: 'irc',
    name: 'IRC',
    channelName: 'IRC Deployment POC',
    dispatchEvent: 'trigger_irc_deployment',
    aliases: ['irc', 'asint-irc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_IRC_1'
  },
  {
    id: 'st_env',
    name: 'ST-ENV',
    channelName: 'ST-ENV Deployment POC',
    dispatchEvent: 'trigger_st_env_deployment',
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
 * Detects current MS Teams channel from incoming payload
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
  }
  // 3. Check conversation name
  if (req.body && req.body.conversation && req.body.conversation.name) {
    return req.body.conversation.name;
  }
  return '';
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
 * Finds environment by its Teams Channel Name
 */
function getEnvironmentByChannelName(channelName) {
  if (!channelName) return null;
  const normInput = normalizeString(channelName);
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
  getEnvironmentByChannelName,
  findEnvironmentInText
};
