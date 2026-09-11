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
// CARD BUILDER 1:  HELP CARD
// ─────────────────────────────────────────────────────────────────────────────
function buildHelpCard(botName, channelEnv, allEnvs) {
  const name = botName || 'Jarvis';
  const body = [];

  let headerTitle = `${name} - APM-02 Command Centre`;
  let headerSubtitle = 'APM-02 Deployment & Snapshot Bot';
  let commands = [];

  if (channelEnv && channelEnv.isApm02) {
    headerTitle = `${name} - APM-02 Command Centre`;
    headerSubtitle = 'APM-02 Cherry-Pick Snapshot Window & CI/CD Bot';
    commands = [
      {
        syntax: `@${name} share snapshot`,
        desc: `Starts a new snapshot deployment with a default 60m cherry-pick window. Specify custom wait time (e.g. @${name} share snapshot 85m).`,
        color: 'Accent'
      },
      {
        syntax: `@${name} deploy now`,
        desc: 'Bypasses the remaining wait countdown and immediately merges the snapshot into APM-02 to trigger SAP CI/CD build.',
        color: 'Good'
      },
      {
        syntax: `@${name} extend`,
        desc: `Adds +10 minutes to the active cherry-pick window. Specify custom extension (e.g. @${name} extend 15m).`,
        color: 'Warning'
      },
      {
        syntax: `@${name} reduce`,
        desc: `Subtracts -10 minutes from the active cherry-pick window. Specify custom reduction (e.g. @${name} reduce 5m).`,
        color: 'Warning'
      },
      {
        syntax: `@${name} re-trigger`,
        desc: 'Restarts SAP CI/CD build without code changes. (Strictly works only when PR has "APM-02 Failed" label).',
        color: 'Attention'
      },
      {
        syntax: `@${name} deployment fix pushed, re-deploy`,
        desc: 'Re-merges snapshot into APM-02 after pushing a code fix. (Strictly works only when PR has "APM-02 Failed" label).',
        color: 'Attention'
      },
      {
        syntax: `@${name} status`,
        desc: 'Queries real-time APM-02 deployment state and tracking PR status.',
        color: 'Default'
      }
    ];
  } else if (channelEnv) {
    headerTitle = `${name} - ${channelEnv.name} Command Centre`;
    headerSubtitle = `Dedicated deployment channel for ${channelEnv.name}`;
    commands = [
      {
        syntax: `@${name} deploy`,
        desc: `Immediately triggers deployment for ${channelEnv.name} (merges latest code and starts SAP CI/CD pipeline).`,
        color: 'Good'
      },
      {
        syntax: `@${name} deploy ${channelEnv.name.toLowerCase()}`,
        desc: `Explicit syntax to trigger deployment for ${channelEnv.name}.`,
        color: 'Accent'
      },
      {
        syntax: `@${name} help`,
        desc: `Displays available deployment commands for this channel.`,
        color: 'Default'
      }
    ];
  } else {
    headerTitle = `${name} - Multi-Environment Deployment Bot`;
    headerSubtitle = 'Automated SAP CI/CD Deployment Bot';
    commands = (allEnvs || [])
      .filter((e) => !e.isApm02)
      .map((e) => ({
        syntax: `@${name} deploy ${e.name.toLowerCase()}`,
        desc: `Execute in ${e.channelName} to deploy ${e.name}.`,
        color: 'Accent'
      }));
  }

  // ── Header Banner ──────────────────────────────────────────────────────────
  body.push({
    type: 'Container',
    style: 'emphasis',
    bleed: true,
    spacing: 'None',
    items: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            verticalContentAlignment: 'Center',
            items: [
              {
                type: 'Image',
                url: 'https://img.icons8.com/color/96/bot.png',
                size: 'Small',
                style: 'Person'
              }
            ]
          },
          {
            type: 'Column',
            width: 'stretch',
            verticalContentAlignment: 'Center',
            items: [
              {
                type: 'TextBlock',
                text: headerTitle,
                size: 'Large',
                weight: 'Bolder',
                color: 'Accent',
                spacing: 'None',
                wrap: true
              },
              {
                type: 'TextBlock',
                text: headerSubtitle,
                size: 'Small',
                isSubtle: true,
                spacing: 'None',
                wrap: true
              }
            ]
          }
        ]
      }
    ]
  });

  // ── One Container per command ───────────────────────────────────────────────
  commands.forEach((cmd, idx) => {
    body.push({
      type: 'Container',
      separator: true,
      spacing: 'Medium',
      items: [
        {
          type: 'TextBlock',
          text: `${idx + 1}.  ${cmd.syntax}`,
          size: 'Medium',
          weight: 'Bolder',
          color: cmd.color,
          spacing: 'None',
          wrap: true
        },
        {
          type: 'TextBlock',
          text: cmd.desc,
          size: 'Small',
          isSubtle: true,
          wrap: true,
          spacing: 'Small'
        }
      ]
    });
  });

  // ── Clean Footer ───────────────────────────────────────────────────────────
  body.push({
    type: 'TextBlock',
    text: channelEnv
      ? `🔒 Commands are isolated: Only ${channelEnv.name} actions can run in this channel.`
      : 'Type any command above and press Enter to execute.',
    size: 'Small',
    isSubtle: true,
    wrap: true,
    spacing: 'Medium',
    separator: true
  });

  return body;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD BUILDER 2:  GENERIC CARD
// ─────────────────────────────────────────────────────────────────────────────
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

  const paragraphs = (messageText || '').split(/\n\n+/);
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
// PUBLIC: postToTeamsWebhook
// ─────────────────────────────────────────────────────────────────────────────
function postToTeamsWebhook(urls, messageText, cardTitle, callback) {
  const cardBody = buildGenericCard(messageText, cardTitle);
  _broadcastCard(urls, cardBody, '1.4', callback);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: sendBotResponse
// ─────────────────────────────────────────────────────────────────────────────
function sendBotResponse(res, messageText, cardTitle, targetWebhookUrl) {
  const webhookUrl = targetWebhookUrl || config.TEAMS_WEBHOOK_URL;
  const cardBody = buildGenericCard(messageText, cardTitle);

  if (webhookUrl) {
    postToTeamsWebhook(webhookUrl, messageText, cardTitle, (err) => {
      if (err) {
        console.error('Failed to post to Teams webhook, falling back to response:', err);
        return res.status(200).json({
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                body: cardBody
              }
            }
          ]
        });
      }
      return res.status(204).end();
    });
  } else {
    return res.status(200).json({
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: cardBody
          }
        }
      ]
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC: sendHelpCard
// ─────────────────────────────────────────────────────────────────────────────
function sendHelpCard(res, botName, channelEnv, allEnvs, targetWebhookUrl) {
  const webhookUrl = targetWebhookUrl || config.TEAMS_WEBHOOK_URL;
  const cardBody = buildHelpCard(botName, channelEnv, allEnvs);

  if (webhookUrl) {
    _broadcastCard(webhookUrl, cardBody, '1.4', (err) => {
      if (err) {
        console.error('Failed to post help card to Teams webhook, falling back:', err);
        return res.status(200).json({
          type: 'message',
          attachments: [
            {
              contentType: 'application/vnd.microsoft.card.adaptive',
              content: {
                $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                type: 'AdaptiveCard',
                version: '1.4',
                body: cardBody
              }
            }
          ]
        });
      }
      return res.status(204).end();
    });
  } else {
    return res.status(200).json({
      type: 'message',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            type: 'AdaptiveCard',
            version: '1.4',
            body: cardBody
          }
        }
      ]
    });
  }
}

module.exports = {
  buildHelpCard,
  buildGenericCard,
  postToTeamsWebhook,
  sendBotResponse,
  sendHelpCard
};
