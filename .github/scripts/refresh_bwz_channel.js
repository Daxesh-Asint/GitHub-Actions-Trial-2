/**
 * refresh_bwz_channel.js
 * 
 * Automates refreshing SAP Build Work Zone (BWZ / Launchpad Service)
 * Content Channels (e.g., HTML5 Apps / saas_approuter) after deployment.
 * 
 * Environment Variables:
 *   TARGET_ENV: Environment identifier or alias (e.g. "APM-02", "AsInt-APM-02")
 *   BWZ_USERNAME: Technical user username/email
 *   BWZ_PASSWORD: Technical user password
 *   BWZ_CONFIG_PATH: (Optional) Path to config file (default: .github/bwz-channels.json)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

function log(msg) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${msg}`);
}

async function run() {
  const targetEnvInput = process.env.TARGET_ENV || process.env.ENV_NAME || 'APM-02';
  const username = process.env.BWZ_USERNAME;
  const password = process.env.BWZ_PASSWORD;
  const configPath = process.env.BWZ_CONFIG_PATH || path.join(__dirname, '..', 'bwz-channels.json');

  log(`🚀 Starting SAP Build Work Zone Channel Refresh for target: "${targetEnvInput}"`);

  if (!username || !password) {
    if (process.env.STRICT_AUTH === 'true') {
      throw new Error('❌ Missing credentials! BWZ_USERNAME and BWZ_PASSWORD environment variables are required.');
    }
    log('⚠️ BWZ_USERNAME or BWZ_PASSWORD not found in repository secrets. Skipping BWZ channel refresh.');
    process.exit(0);
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(`❌ Configuration file not found at: ${configPath}`);
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const environments = rawConfig.environments || {};

  // Find matching environment by key or aliases
  let matchedEnvKey = null;
  let envConfig = null;

  for (const [key, conf] of Object.entries(environments)) {
    if (key.toLowerCase() === targetEnvInput.toLowerCase()) {
      matchedEnvKey = key;
      envConfig = conf;
      break;
    }
    if (conf.aliases && conf.aliases.some(a => a.toLowerCase() === targetEnvInput.toLowerCase())) {
      matchedEnvKey = key;
      envConfig = conf;
      break;
    }
  }

  if (!envConfig) {
    log(`⚠️ Environment "${targetEnvInput}" is not configured in ${path.basename(configPath)}. Skipping BWZ channel refresh.`);
    process.exit(0);
  }

  log(`✅ Matched environment: ${matchedEnvKey}`);
  log(`   Launchpad URL : ${envConfig.launchpad_url}`);
  log(`   Channel ID    : ${envConfig.channel_id}`);
  log(`   Channel Name  : ${envConfig.channel_name || 'N/A'}`);
  log(`   Subdomain     : ${envConfig.subdomain}`);
  log(`   Subaccount ID : ${envConfig.subaccountId}`);

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Create artifacts folder for screenshots
  const artifactsDir = path.join(process.cwd(), 'bwz_artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  try {
    const targetUrl = `${envConfig.launchpad_url}/channel/providerManager`;
    log(`🌐 Navigating to Channel Manager: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Step 1: Check for IAS / SAML login options
    log('🔍 Checking login state...');
    await page.waitForTimeout(3000);

    const asintLogonLink = page.locator('a.saml-login-link:has-text("AsInt Log-On"), a:has-text("AsInt Log-On")');
    if (await asintLogonLink.isVisible().catch(() => false)) {
      log('👉 Clicking "AsInt Log-On" link...');
      await asintLogonLink.first().click();
      await page.waitForLoadState('domcontentloaded');
    }

    // Step 2: Handle SAP IAS credentials login form
    const usernameInput = page.locator('input#j_username');
    if (await usernameInput.isVisible({ timeout: 15000 }).catch(() => false)) {
      log('🔑 Filling username into SAP IAS form...');
      await usernameInput.fill(username);

      const passwordInput = page.locator('input#j_password, input[type="password"]');
      const isPasswordVisible = await passwordInput.first().isVisible().catch(() => false);

      if (!isPasswordVisible) {
        log('👉 Two-step login detected: clicking Continue button to reveal password field...');
        const continueBtn = page.locator('button:has-text("Continue"), button#logOnFormSubmit, button[type="submit"]');
        if (await continueBtn.first().isVisible().catch(() => false)) {
          await continueBtn.first().click();
        } else {
          log('⌨️ Pressing Enter on username input...');
          await usernameInput.press('Enter');
        }

        log('⏳ Waiting for password field to appear...');
        await passwordInput.first().waitFor({ state: 'visible', timeout: 20000 });
      }

      log('🔑 Filling password into SAP IAS form...');
      await passwordInput.first().fill(password);

      const submitBtn = page.locator('button#logOnFormSubmit, button:has-text("Log On"), button:has-text("Sign In"), button:has-text("Continue"), button[type="submit"]');
      log('🔓 Submitting login form...');
      await submitBtn.first().click();

      // Wait for navigation back to launchpad
      log('⏳ Waiting for authentication callback to complete...');
      try {
        await page.waitForURL(url => url.toString().includes(envConfig.launchpad_url.replace('https://', '')), {
          timeout: 60000
        });
      } catch (navErr) {
        log(`ℹ️ waitForURL note: ${navErr.message}. Current URL: ${page.url()}`);
        if (!page.url().includes(envConfig.launchpad_url.replace('https://', ''))) {
          throw navErr;
        }
      }
      log(`📍 Post-login landing URL: ${page.url()}`);
    }

    // Step 3: Explicitly navigate to Channel Manager design-time URL
    const channelManagerUrl = `${envConfig.launchpad_url}/channel/providerManager?&sap-locale=en&sap-theme=sap_horizon`;
    log(`🧭 Navigating directly to Channel Manager UI: ${channelManagerUrl}`);
    await page.goto(channelManagerUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    log(`📍 Active Channel Manager Page URL: ${page.url()}`);

    // Wait for Channel Manager table / content to load
    log('📋 Channel Manager loaded. Waiting for network idle...');
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {
      log('⚠️ Network idle timed out, proceeding to check table...');
    });
    // Wait for table or channel content to render
    await page.locator('table, [role="grid"], [role="table"]').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {
      log('ℹ️ Table locator wait ended, continuing...');
    });
    await page.waitForTimeout(3000);

    // Save state screenshot of Channel Manager table
    const managerScreenshot = path.join(artifactsDir, 'bwz_channel_manager.png');
    await page.screenshot({ path: managerScreenshot, fullPage: true });
    log(`📸 Captured Channel Manager screenshot: ${managerScreenshot}`);

    // Step 4: Refresh Channel
    // We will attempt native UI refresh button first, with in-page API fallback
    log(`🔄 Locating channel refresh action for ID "${envConfig.channel_id}"...`);
    let refreshSuccess = false;

    // Approach A: UI Button Click
    try {
      // Find row containing channel ID or Name
      const row = page.locator(`tr:has-text("${envConfig.channel_id}"), tr:has-text("${envConfig.channel_name}")`).first();
      if (await row.isVisible({ timeout: 5000 })) {
        log(`🎯 Found table row for channel "${envConfig.channel_id}". Looking for refresh button...`);
        // Refresh button is usually an action button with title/aria-label containing Refresh or Update, or the 3rd icon
        const refreshBtn = row.locator('button[title*="Update" i], button[title*="Refresh" i], button[aria-label*="Update" i], button[aria-label*="Refresh" i], [data-sap-ui-icon-content*="refresh" i]').first();

        if (await refreshBtn.isVisible()) {
          log('👉 Clicking UI refresh button...');
          const [response] = await Promise.all([
            page.waitForResponse(res => res.url().includes('/provider/html5') && res.request().method() === 'POST', { timeout: 25000 }),
            refreshBtn.click()
          ]);
          log(`✅ UI Refresh Response received: HTTP ${response.status()} ${response.statusText()}`);
          if (response.status() === 200 || response.status() === 201) {
            refreshSuccess = true;
          }
        }
      }
    } catch (uiErr) {
      log(`ℹ️ UI click method had an issue (${uiErr.message}). Falling back to in-page API invocation...`);
    }

    // Approach B: In-page API invocation with authenticated session & CSRF fetch
    if (!refreshSuccess) {
      log('🌐 Executing in-page authenticated API call to /provider/html5...');
      const apiResult = await page.evaluate(async ({ launchpadUrl, payload }) => {
        try {
          // Fetch fresh CSRF token
          const tokenRes = await fetch(`${launchpadUrl}/provider/html5`, {
            method: 'GET',
            headers: {
              'x-csrf-token': 'fetch',
              'accept': 'application/json, text/plain, */*'
            }
          });
          const csrfToken = tokenRes.headers.get('x-csrf-token');

          // Trigger POST /provider/html5
          const postRes = await fetch(`${launchpadUrl}/provider/html5`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-csrf-token': csrfToken || '',
              'accept': 'application/json, text/plain, */*'
            },
            body: JSON.stringify(payload)
          });

          const bodyText = await postRes.text();
          return {
            status: postRes.status,
            statusText: postRes.statusText,
            body: bodyText
          };
        } catch (e) {
          return { error: e.message };
        }
      }, {
        launchpadUrl: envConfig.launchpad_url,
        payload: {
          contentAdditionMode: "manual",
          providerId: envConfig.channel_id,
          subaccountId: envConfig.subaccountId,
          subdomain: envConfig.subdomain
        }
      });

      log(`📡 API Result: ${JSON.stringify(apiResult)}`);
      if (apiResult.status === 200 || apiResult.status === 201) {
        refreshSuccess = true;
      } else {
        throw new Error(`API refresh failed with status ${apiResult.status}: ${apiResult.body || apiResult.error}`);
      }
    }

    // Success confirmation
    log(`🎉 SUCCESS: Channel "${envConfig.channel_name}" (${envConfig.channel_id}) on ${matchedEnvKey} refreshed successfully!`);
    await page.waitForTimeout(3000);
    const finalScreenshot = path.join(artifactsDir, 'bwz_refresh_success.png');
    await page.screenshot({ path: finalScreenshot, fullPage: true });
    log(`📸 Final success screenshot captured: ${finalScreenshot}`);

  } catch (error) {
    log(`❌ ERROR: Channel refresh failed: ${error.message}`);
    const failureScreenshot = path.join(artifactsDir, 'bwz_refresh_failure.png');
    await page.screenshot({ path: failureScreenshot, fullPage: true }).catch(() => {});
    log(`📸 Failure screenshot captured: ${failureScreenshot}`);
    throw error;
  } finally {
    await browser.close();
    log('🏁 Browser session closed.');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
