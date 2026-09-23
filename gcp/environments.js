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
    baseBranch: 'main',
    snapshotPrefix: 'snapshot/main-',
    dispatchEvent: 'trigger_apm02_deployment',
    adjustDispatchEvent: 'adjust_apm02_wait',
    retriggerDispatchEvent: 'retrigger_apm02_deployment',
    redeployFixDispatchEvent: 'redeploy_apm02_fix',
    tenantBranch: 'tenant/asint-apm-02-v2',
    labelPrefix: 'APM-02',
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
  },
  {
    id: 'vmos',
    name: 'VMOS',
    channelId: '19:ebc512933cec453f8f26e68e72f3c217@thread.tacv2',
    channelName: 'VMOS Deployment POC',
    dispatchEvent: 'trigger_vmos_deployment',
    tenantBranch: 'tenant/vmos-dev',
    aliases: ['vmos', 'asint-vmos', 'vmos-dev', 'vmos deployment', 'vmos deployment poc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_VMOS_1'
  },
  {
    id: 'ais02_dc',
    name: 'AIS-02 DC',
    channelId: '19:5f02426408b84504a93199460c822515@thread.tacv2',
    channelName: 'AIS-02-DC Deployment POC',
    dispatchEvent: 'trigger_ais02_dc_deployment',
    tenantBranch: 'tenant/asint-ais-02-dc',
    aliases: ['ais-02 dc', 'ais02 dc', 'ais-02-dc', 'ais02-dc', 'ais02dc', 'ais dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_AIS02_DC_1'
  },
  {
    id: 'apm02_dc',
    name: 'APM-02 DC',
    channelId: '19:465eada7a0ee418581a59f9c8d7cfffd@thread.tacv2',
    channelName: 'APM-02 DC Deployment POC',
    isApm02: true,
    baseBranch: 'main-dc',
    snapshotPrefix: 'snapshot/main-dc-',
    dispatchEvent: 'trigger_apm02_dc_deployment',
    adjustDispatchEvent: 'adjust_apm02_dc_wait',
    retriggerDispatchEvent: 'retrigger_apm02_dc_deployment',
    redeployFixDispatchEvent: 'redeploy_apm02_dc_fix',
    tenantBranch: 'tenant/asint-apm-02-dc',
    labelPrefix: 'APM-02 DC',
    aliases: ['apm-02 dc', 'apm02 dc', 'apm-02-dc', 'apm02-dc', 'apm02dc', 'asint-apm-02-dc', 'apm 02 dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APM02_DC_1'
  },
  {
    id: 'apm02_dc_addin',
    name: 'APM-02 DC AddIn',
    channelId: '19:781b4e172d3b494092b3b5a08037a5f0@thread.tacv2',
    channelName: 'APM-02 DC AddIn Deployment POC',
    isApm02: true,
    baseBranch: 'main-dc-addin',
    snapshotPrefix: 'snapshot/main-dc-addin-',
    dispatchEvent: 'trigger_apm02_dc_addin_deployment',
    adjustDispatchEvent: 'adjust_apm02_dc_addin_wait',
    retriggerDispatchEvent: 'retrigger_apm02_dc_addin_deployment',
    redeployFixDispatchEvent: 'redeploy_apm02_dc_addin_fix',
    tenantBranch: 'tenant/asint-apm-02-dc-addin',
    labelPrefix: 'APM-02 DC AddIn',
    aliases: ['apm-02 dc addin', 'apm02 dc addin', 'apm-02-dc-addin', 'apm02-dc-addin', 'apm02dcaddin', 'asint-apm-02-dc-addin', 'apm 02 dc addin', 'apm02 addin', 'apm-02 addin', 'apm02-addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APM02_DC_ADDIN_1'
  },
  {
    id: 'ais02_dc_addin',
    name: 'AIS-02 DC AddIn',
    channelId: '19:6e153f094cbe42979468dc67cbe4c500@thread.tacv2',
    channelName: 'AIS-02 DC AddIn Deployment POC',
    dispatchEvent: 'trigger_ais02_dc_addin_deployment',
    tenantBranch: 'tenant/asint-ais-02-dc-addin',
    aliases: ['ais-02 dc addin', 'ais02 dc addin', 'ais-02-dc-addin', 'ais02-dc-addin', 'ais02dcaddin', 'ais dc addin', 'ais-02 addin', 'ais02 addin', 'ais-02 dc addin deployment poc', 'ais-02 dc addin deployment'],
    webhookEnvVar: 'TEAMS_WEBHOOK_AIS02_DC_ADDIN_1'
  },
  {
    id: 'apmeiot_dc',
    name: 'APM-EIOT DC',
    channelId: '',
    channelName: 'APM-EIOT DC Deployment',
    dispatchEvent: 'trigger_apm_eiot_dc_deployment',
    tenantBranch: 'tenant/asint-apm-eiot-dc',
    aliases: ['apm-eiot dc', 'apmeiot dc', 'eiot dc', 'asint-apm-eiot-dc', 'apm-eiot-dc', 'apmeiotdc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APMEIOT_DC_1'
  },
  {
    id: 'apmeiot_dc_addin',
    name: 'APM-EIOT DC AddIn',
    channelId: '',
    channelName: 'APM-EIOT DC AddIn Deployment',
    dispatchEvent: 'trigger_apm_eiot_dc_addin_deployment',
    tenantBranch: 'tenant/asint-apm-eiot-dc-addin',
    aliases: ['apm-eiot dc addin', 'apmeiot dc addin', 'eiot dc addin', 'asint-apm-eiot-dc-addin', 'apm-eiot-dc-addin', 'apmeiotdcaddin', 'apm-eiot addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_APMEIOT_DC_ADDIN_1'
  },
  {
    id: 'demo_dc',
    name: 'AsInt Demo DC',
    channelId: '',
    channelName: 'AsInt Demo DC Deployment',
    dispatchEvent: 'trigger_asint_demo_dc_deployment',
    tenantBranch: 'tenant/asint-demo-dc',
    aliases: ['asint demo dc', 'demo dc', 'asintdemodc', 'asint-demo-dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_DEMO_DC_1'
  },
  {
    id: 'demo_dc_addin',
    name: 'AsInt Demo DC AddIn',
    channelId: '',
    channelName: 'AsInt Demo DC AddIn Deployment',
    dispatchEvent: 'trigger_asint_demo_dc_addin_deployment',
    tenantBranch: 'tenant/asint-demo-dc-addin',
    aliases: ['asint demo dc addin', 'demo dc addin', 'asintdemodcaddin', 'asint-demo-dc-addin', 'demo addin', 'asint demo addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_DEMO_DC_ADDIN_1'
  },
  {
    id: 'baystar_dc',
    name: 'BAYSTAR DC',
    channelId: '',
    channelName: 'BAYSTAR DC Deployment',
    dispatchEvent: 'trigger_baystar_dc_deployment',
    tenantBranch: 'tenant/baystar-dc',
    aliases: ['baystar dc', 'asint-baystar-dc', 'baystar-dc', 'baystardc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_BAYSTAR_DC_1'
  },
  {
    id: 'baystar_dc_addin',
    name: 'BAYSTAR DC AddIn',
    channelId: '',
    channelName: 'BAYSTAR DC AddIn Deployment',
    dispatchEvent: 'trigger_baystar_dc_addin_deployment',
    tenantBranch: 'tenant/baystar-dc-addin',
    aliases: ['baystar dc addin', 'asint-baystar-dc-addin', 'baystar-dc-addin', 'baystardcaddin', 'baystar addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_BAYSTAR_DC_ADDIN_1'
  },
  {
    id: 'hsc_non_prod_dc',
    name: 'HSC Non-Prod DC',
    channelId: '',
    channelName: 'HSC Non-Prod DC Deployment',
    dispatchEvent: 'trigger_hsc_non_prod_dc_deployment',
    tenantBranch: 'tenant/hemlock-non-prod-dc',
    aliases: ['hsc non-prod dc', 'hsc non prod dc', 'hscnonproddc', 'hemlock non-prod dc', 'hemlock non prod dc', 'hsc-non-prod-dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_NON_PROD_DC_1'
  },
  {
    id: 'hsc_non_prod_dc_addin',
    name: 'HSC Non-Prod DC AddIn',
    channelId: '',
    channelName: 'HSC Non-Prod DC AddIn Deployment',
    dispatchEvent: 'trigger_hsc_non_prod_dc_addin_deployment',
    tenantBranch: 'tenant/hemlock-non-prod-dc-addin',
    aliases: ['hsc non-prod dc addin', 'hsc non prod dc addin', 'hscnonproddcaddin', 'hemlock non-prod dc addin', 'hemlock non prod dc addin', 'hsc-non-prod-dc-addin', 'hsc non-prod addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_NON_PROD_DC_ADDIN_1'
  },
  {
    id: 'hsc_prod_dc',
    name: 'HSC Prod DC',
    channelId: '',
    channelName: 'HSC Prod DC Deployment',
    dispatchEvent: 'trigger_hsc_prod_dc_deployment',
    tenantBranch: 'tenant/hemlock-prod-dc',
    aliases: ['hsc prod dc', 'hscproddc', 'hemlock prod dc', 'hemlockproddc', 'hsc-prod-dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_PROD_DC_1'
  },
  {
    id: 'hsc_prod_dc_addin',
    name: 'HSC Prod DC AddIn',
    channelId: '',
    channelName: 'HSC Prod DC AddIn Deployment',
    dispatchEvent: 'trigger_hsc_prod_dc_addin_deployment',
    tenantBranch: 'tenant/hemlock-prod-dc-addin',
    aliases: ['hsc prod dc addin', 'hscproddcaddin', 'hemlock prod dc addin', 'hemlockproddcaddin', 'hsc-prod-dc-addin', 'hsc prod addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_HSC_PROD_DC_ADDIN_1'
  },
  {
    id: 'indorama_prod_900_dc',
    name: 'Indorama Prod 900 DC',
    channelId: '',
    channelName: 'Indorama Prod 900 DC Deployment',
    dispatchEvent: 'trigger_indorama_prod_900_dc_deployment',
    tenantBranch: 'tenant/indorama-prod-900-dc',
    aliases: ['indorama prod 900 dc', 'indorama 900 dc', 'indoramaprod900dc', 'prod 900 dc', 'prod900dc', '900 dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_900_DC_1'
  },
  {
    id: 'indorama_prod_900_dc_addin',
    name: 'Indorama Prod 900 DC AddIn',
    channelId: '',
    channelName: 'Indorama Prod 900 DC AddIn Deployment',
    dispatchEvent: 'trigger_indorama_prod_900_dc_addin_deployment',
    tenantBranch: 'tenant/indorama-prod-900-dc-addin',
    aliases: ['indorama prod 900 dc addin', 'indorama 900 dc addin', 'indoramaprod900dcaddin', 'prod 900 dc addin', 'prod900dcaddin', '900 dc addin', '900 addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_900_DC_ADDIN_1'
  },
  {
    id: 'indorama_prod_933_dc',
    name: 'Indorama Prod 933 DC',
    channelId: '',
    channelName: 'Indorama Prod 933 DC Deployment',
    dispatchEvent: 'trigger_indorama_prod_933_dc_deployment',
    tenantBranch: 'tenant/indorama-prod-933-dc',
    aliases: ['indorama prod 933 dc', 'indorama 933 dc', 'indoramaprod933dc', 'prod 933 dc', 'prod933dc', '933 dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_933_DC_1'
  },
  {
    id: 'indorama_prod_933_dc_addin',
    name: 'Indorama Prod 933 DC AddIn',
    channelId: '',
    channelName: 'Indorama Prod 933 DC AddIn Deployment',
    dispatchEvent: 'trigger_indorama_prod_933_dc_addin_deployment',
    tenantBranch: 'tenant/indorama-prod-933-dc-addin',
    aliases: ['indorama prod 933 dc addin', 'indorama 933 dc addin', 'indoramaprod933dcaddin', 'prod 933 dc addin', 'prod933dcaddin', '933 dc addin', '933 addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_PROD_933_DC_ADDIN_1'
  },
  {
    id: 'indorama_qa_233_dc',
    name: 'Indorama QA 233 DC',
    channelId: '19:f94a9976c02246a6b388b3e0706019df@thread.tacv2',
    channelName: 'Indorama QA 233 DC Deployment POC',
    dispatchEvent: 'trigger_indorama_qa_233_dc_deployment',
    tenantBranch: 'tenant/indorama-qa-233-dc',
    aliases: ['indorama qa 233 dc', 'indorama 233 dc', 'indoramaqa233dc', 'qa 233 dc', 'qa233dc', '233 dc', 'indorama qa 233 dc deployment poc', 'indorama qa 233 dc deployment'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_233_DC_1'
  },
  {
    id: 'indorama_qa_233_dc_addin',
    name: 'Indorama QA 233 DC AddIn',
    channelId: '',
    channelName: 'Indorama QA 233 DC AddIn Deployment',
    dispatchEvent: 'trigger_indorama_qa_233_dc_addin_deployment',
    tenantBranch: 'tenant/indorama-qa-233-dc-addin',
    aliases: ['indorama qa 233 dc addin', 'indorama 233 dc addin', 'indoramaqa233dcaddin', 'qa 233 dc addin', 'qa233dcaddin', '233 dc addin', '233 addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_233_DC_ADDIN_1'
  },
  {
    id: 'indorama_qa_234_dc',
    name: 'Indorama QA 234 DC',
    channelId: '',
    channelName: 'Indorama QA 234 DC Deployment',
    dispatchEvent: 'trigger_indorama_qa_234_dc_deployment',
    tenantBranch: 'tenant/indorama-qa-234-dc',
    aliases: ['indorama qa 234 dc', 'indorama 234 dc', 'indoramaqa234dc', 'qa 234 dc', 'qa234dc', '234 dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_234_DC_1'
  },
  {
    id: 'indorama_qa_234_dc_addin',
    name: 'Indorama QA 234 DC AddIn',
    channelId: '',
    channelName: 'Indorama QA 234 DC AddIn Deployment',
    dispatchEvent: 'trigger_indorama_qa_234_dc_addin_deployment',
    tenantBranch: 'tenant/indorama-qa-234-dc-addin',
    aliases: ['indorama qa 234 dc addin', 'indorama 234 dc addin', 'indoramaqa234dcaddin', 'qa 234 dc addin', 'qa234dcaddin', '234 dc addin', '234 addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_INDORAMA_QA_234_DC_ADDIN_1'
  },
  {
    id: 'irc_dc',
    name: 'IRC DC',
    channelId: '',
    channelName: 'IRC DC Deployment',
    dispatchEvent: 'trigger_irc_dc_deployment',
    tenantBranch: 'tenant/irc-dc',
    aliases: ['irc dc', 'asint-irc-dc', 'irc-dc', 'ircdc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_IRC_DC_1'
  },
  {
    id: 'irc_dc_addin',
    name: 'IRC DC AddIn',
    channelId: '',
    channelName: 'IRC DC AddIn Deployment',
    dispatchEvent: 'trigger_irc_dc_addin_deployment',
    tenantBranch: 'tenant/irc-dc-addin',
    aliases: ['irc dc addin', 'asint-irc-dc-addin', 'irc-dc-addin', 'ircdcaddin', 'irc addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_IRC_DC_ADDIN_1'
  },
  {
    id: 'st_env_dc',
    name: 'ST-ENV DC',
    channelId: '',
    channelName: 'ST-ENV DC Deployment',
    dispatchEvent: 'trigger_st_env_dc_deployment',
    tenantBranch: 'tenant/asint-st-env-dc',
    aliases: ['st-env dc', 'st env dc', 'stenv dc', 'stenvdc', 'st dc', 'asint-st-dc', 'asint-st-env-dc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_ST_ENV_DC_1'
  },
  {
    id: 'st_env_dc_addin',
    name: 'ST-ENV DC AddIn',
    channelId: '',
    channelName: 'ST-ENV DC AddIn Deployment',
    dispatchEvent: 'trigger_st_env_dc_addin_deployment',
    tenantBranch: 'tenant/asint-st-env-dc-addin',
    aliases: ['st-env dc addin', 'st env dc addin', 'stenv dc addin', 'stenvdcaddin', 'st dc addin', 'asint-st-dc-addin', 'asint-st-env-dc-addin', 'st addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_ST_ENV_DC_ADDIN_1'
  },
  {
    id: 'vmos_dc',
    name: 'VMOS DC',
    channelId: '',
    channelName: 'VMOS DC Deployment',
    dispatchEvent: 'trigger_vmos_dc_deployment',
    tenantBranch: 'tenant/vmos-dc',
    aliases: ['vmos dc', 'asint-vmos-dc', 'vmos-dc', 'vmosdc'],
    webhookEnvVar: 'TEAMS_WEBHOOK_VMOS_DC_1'
  },
  {
    id: 'vmos_dc_addin',
    name: 'VMOS DC AddIn',
    channelId: '',
    channelName: 'VMOS DC AddIn Deployment',
    dispatchEvent: 'trigger_vmos_dc_addin_deployment',
    tenantBranch: 'tenant/vmos-dc-addin',
    aliases: ['vmos dc addin', 'asint-vmos-dc-addin', 'vmos-dc-addin', 'vmosdcaddin', 'vmos addin'],
    webhookEnvVar: 'TEAMS_WEBHOOK_VMOS_DC_ADDIN_1'
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
  return (
    ENVIRONMENTS.find((env) => normInput === normalizeString(env.channelName)) ||
    ENVIRONMENTS.find((env) => env.aliases.some((alias) => normalizeString(alias) === normInput)) ||
    // If substring matching, check longer/more specific names first (e.g. APM-02 DC before APM-02)
    [...ENVIRONMENTS]
      .sort((a, b) => b.name.length - a.name.length)
      .find((env) => normInput.includes(normalizeString(env.name))) ||
    null
  );
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
