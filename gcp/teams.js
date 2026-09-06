const https = require('https');
const config = require('./config');

// ─────────────────────────────────────────────────────────────────────────────
// PRIVATE HELPER: Send one Adaptive Card payload to a list of webhook URLs
// ─────────────────────────────────────────────────────────────────────────────
function _broadcastCard(urls, cardBodyElements, version, callback) {
  const urlList = Array.isArray(urls)
    ? urls
    : urls.split(',').map((u) => u.trim()).filter(Boolean);

  if (urlList.length === 0) {
    return callback(new Error('No valid webhook URL configured'));
  }

  const payload = JSON.stringify({
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: version || '1.4',
          body: cardBodyElements
        }
      }
    ]
  });

  let completed = 0;
  let firstErr = null;

  urlList.forEach((webhookUrl) => {
    try {
      const parsedUrl = new URL(webhookUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (httpRes) => {
        let body = '';
        httpRes.on('data', (chunk) => (body += chunk));
        httpRes.on('end', () => {
          completed++;
          if (httpRes.statusCode < 200 || httpRes.statusCode >= 300) {
            if (!firstErr) firstErr = new Error(`Status ${httpRes.statusCode}: ${body}`);
          }
          if (completed === urlList.length) callback(firstErr);
        });
      });

      req.on('error', (err) => {
        completed++;
        if (!firstErr) firstErr = err;
        if (completed === urlList.length) callback(firstErr);
      });

      req.write(payload);
      req.end();
    } catch (e) {
      completed++;
      if (!firstErr) firstErr = e;
      if (completed === urlList.length) callback(firstErr);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD BUILDER 1:  HELP CARD  ──  Stunning "marriage-invitation" layout
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Builds a fully structured, beautiful Adaptive Card for the help command.
 * Each command gets its own Container block with:
 *   emoji icon  +  large accent command name
 *   monospace syntax line(s)
 *   subtle description text
 *   a visual separator between every command
 */
function buildHelpCard(botName) {
  const commands = [
    {
      syntax: `@${botName} share snapshot`,
      desc: 'Starts a new snapshot deployment with a default 60m cherry-pick window. You can specify a custom wait time (e.g. `@${botName} share snapshot 85m`).',
      color: 'Accent'
    },
    {
      syntax: `@${botName} deploy now`,
      desc: 'Bypasses the remaining wait countdown and immediately merges the snapshot into APM-02 to trigger SAP CI/CD build.',
      color: 'Good'
    },
    {
      syntax: `@${botName} extend`,
      desc: 'Adds 10 minutes to the active cherry-pick countdown. You can specify custom minutes (e.g. `@${botName} extend 15m`).',
      color: 'Accent'
    },
    {
      syntax: `@${botName} reduce`,
      desc: 'Subtracts 10 minutes from the active cherry-pick countdown. You can specify custom minutes (e.g. `@${botName} reduce 5m`).',
      color: 'Warning'
    },
    {
      syntax: `@${botName} re-trigger`,
      desc: 'Restarts the SAP CI/CD pipeline without code changes. Only works when the tracking PR has the APM-02 Failed label (not allowed in IDLE state).',
      color: 'Attention'
    },
    {
      syntax: `@${botName} deployment fix pushed, re-deploy`,
      desc: 'Re-merges the latest snapshot commits into APM-02 and triggers a new build after pushing a fix. Only works when the tracking PR has the APM-02 Failed label.',
      color: 'Attention'
    },
    {
      syntax: `@${botName} status`,
      desc: 'Displays the current real-time APM-02 deployment state, active tracking PR link, snapshot branch name, and initiator.',
      color: 'Good'
    },
    {
      syntax: `@${botName} help`,
      desc: 'Displays this command reference guide.',
      color: 'Default'
    }
  ];

  const body = [];

  // ── Clean Header block ──────────────────────────────────────────────────────
  body.push({
    type: 'Container',
    style: 'emphasis',
    bleed: true,
    items: [
      {
        type: 'TextBlock',
        text: (botName || 'JARVIS').toUpperCase(),
        size: 'Large',
        weight: 'Bolder',
        color: 'Accent',
        spacing: 'None'
      },
      {
        type: 'TextBlock',
        text: 'APM-02 Deployment Command Reference',
        size: 'Small',
        isSubtle: true,
        spacing: 'None',
        wrap: true
      }
    ]
  });

  // ── One Container per command ───────────────────────────────────────────────
  commands.forEach((cmd, idx) => {
    const items = [];

    // Prominent, readable command syntax
    items.push({
      type: 'TextBlock',
      text: `${idx + 1}.  ${cmd.syntax}`,
      size: 'Medium',
      weight: 'Bolder',
      color: cmd.color,
      spacing: 'None',
      wrap: true
    });

    // Complete, clear description
    items.push({
      type: 'TextBlock',
      text: cmd.desc,
      size: 'Small',
      isSubtle: true,
      wrap: true,
      spacing: 'Small'
    });

    body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: items
    });
  });

  // ── Clean Footer ───────────────────────────────────────────────────────────
  body.push({
    type: 'TextBlock',
    text: 'Type any command above and press Enter to execute.',
    size: 'Small',
    isSubtle: true,
    wrap: true,
    spacing: 'Medium',
    separator: true
  });

  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD BUILDER 2:  GENERIC CARD  ──  For status / blocked / confirmation cards
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Converts a plain-text message string into a structured, properly-spaced
 * Adaptive Card body.
 *
 * Layout rules:
 *  • cardTitle      → Large bold accent header + separator line below
 *  • paragraphs (\n\n) → Medium spacing between blocks
 *  • lines (\n)     → Small spacing between lines
 *  • "* " prefix    → rendered as "• " bullet
 */
function buildGenericCard(messageText, cardTitle) {
  const body = [];

  if (cardTitle) {
    body.push({
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      color: 'Accent',
      text: cardTitle,
      wrap: true,
      spacing: 'None'
    });
    body.push({ type: 'TextBlock', text: ' ', spacing: 'Small', separator: true });
  }

  const paragraphs = messageText.split(/\n\n+/);
  let firstParagraph = true;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');

    lines.forEach((line, lineIdx) => {
      const trimLine = line.trim();
      if (!trimLine) return;

      const isBullet = trimLine.startsWith('* ');
      const text = isBullet ? '• ' + trimLine.slice(2) : trimLine;

      let spacing;
      if (firstParagraph && lineIdx === 0) {
        spacing = 'Small';
      } else if (lineIdx === 0) {
        spacing = 'Medium';
      } else {
        spacing = 'Small';
      }

      body.push({ type: 'TextBlock', text, wrap: true, spacing });
    });

    firstParagraph = false;
  }

  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: postToTeamsWebhook  ──  generic webhook broadcast
// ─────────────────────────────────────────────────────────────────────────────
function postToTeamsWebhook(urls, messageText, cardTitle, callback) {
  const cardBody = buildGenericCard(messageText, cardTitle);
  _broadcastCard(urls, cardBody, '1.4', callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: sendBotResponse  ──  generic response (status / blocked / confirm)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Posts a generic card to the Teams main feed via Incoming Webhook.
 * Falls back to a thread reply if no webhook URL is configured.
 */
function sendBotResponse(res, messageText, cardTitle) {
  if (config.TEAMS_WEBHOOK_URL) {
    postToTeamsWebhook(config.TEAMS_WEBHOOK_URL, messageText, cardTitle, (err) => {
      if (err) {
        console.error('Failed to post to Teams webhook, falling back to thread reply:', err);
        return res.status(200).json({
          type: 'message',
          text: (cardTitle ? '### ' + cardTitle + '\n\n' : '') + messageText
        });
      }
      // HTTP 204 → Teams creates ZERO collapsed reply threads
      return res.status(204).end();
    });
  } else {
    return res.status(200).json({
      type: 'message',
      text: (cardTitle ? '### ' + cardTitle + '\n\n' : '') + messageText
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: sendHelpCard  ──  the stunning structured help card
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Posts the rich, eye-catching help card to the Teams main feed.
 * Falls back to a minimal thread reply if no webhook URL is configured.
 */
function sendHelpCard(res, botName) {
  if (config.TEAMS_WEBHOOK_URL) {
    const cardBody = buildHelpCard(botName);
    _broadcastCard(config.TEAMS_WEBHOOK_URL, cardBody, '1.4', (err) => {
      if (err) {
        console.error('Failed to post help card to Teams webhook, falling back:', err);
        return res.status(200).json({
          type: 'message',
          text: '### ⚡ ' + botName + ' – APM-02 Command Centre\n\nType `@' + botName + ' help` to see available commands.'
        });
      }
      return res.status(204).end();
    });
  } else {
    return res.status(200).json({
      type: 'message',
      text: '### ⚡ ' + botName + ' – APM-02 Command Centre\n\nType `@' + botName + ' help` to see available commands.'
    });
  }
}

module.exports = {
  postToTeamsWebhook,
  sendBotResponse,
  sendHelpCard
};
