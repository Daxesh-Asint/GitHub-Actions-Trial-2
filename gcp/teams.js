const https = require('https');
const config = require('./config');

/**
 * Converts a raw message string into a structured array of Adaptive Card body elements.
 *
 * Rules:
 *  - The cardTitle is rendered as a large, bold, accented header with a separator below.
 *  - The messageText is split on \n\n into paragraphs; each paragraph becomes its own
 *    TextBlock with Medium spacing above it (except the first).
 *  - Lines beginning with "* " inside a paragraph are treated as bullet items and get
 *    a "• " prefix so they look like proper bullets in Teams.
 *  - No sentence content is modified — only visual structure is added.
 */
function buildCardBody(messageText, cardTitle) {
  const cardBody = [];

  // ── Header ──────────────────────────────────────────────────────────────────
  if (cardTitle) {
    cardBody.push({
      type: 'TextBlock',
      size: 'Large',
      weight: 'Bolder',
      color: 'Accent',
      text: cardTitle,
      wrap: true,
      spacing: 'None'
    });
    // Thin separator line under the title
    cardBody.push({
      type: 'TextBlock',
      text: ' ',
      spacing: 'Small',
      separator: true
    });
  }

  // ── Body: split into paragraphs ─────────────────────────────────────────────
  const paragraphs = messageText.split(/\n\n+/);
  let isFirstParagraph = true;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (!trimmedPara) continue;

    const lines = trimmedPara.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine) continue;

      // Detect bullet lines: lines that start with "* "
      const isBullet = trimmedLine.startsWith('* ');
      const lineText = isBullet ? '• ' + trimmedLine.slice(2) : trimmedLine;

      // Determine spacing:
      //  - First element after title: Small (tight under separator)
      //  - First line of a new paragraph (not a bullet starting after a bullet): Medium
      //  - Continuation lines inside a paragraph / sub-lines of a bullet: Small
      let spacing;
      if (isFirstParagraph && i === 0) {
        spacing = 'Small';
      } else if (i === 0) {
        spacing = 'Medium';
      } else {
        spacing = 'Small';
      }

      cardBody.push({
        type: 'TextBlock',
        text: lineText,
        wrap: true,
        spacing: spacing
      });
    }

    isFirstParagraph = false;
  }

  return cardBody;
}

/**
 * Sends a message directly to MS Teams Channel Main Feed via Incoming Webhook.
 * Uses AdaptiveCard format (compatible with Workflows and Connectors).
 */
function postToTeamsWebhook(urls, messageText, cardTitle, callback) {
  const urlList = Array.isArray(urls)
    ? urls
    : urls.split(',').map((u) => u.trim()).filter(Boolean);

  if (urlList.length === 0) {
    return callback(new Error('No valid webhook URL configured'));
  }

  const cardBody = buildCardBody(messageText, cardTitle);

  const payload = JSON.stringify({
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

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          completed++;
          if (res.statusCode < 200 || res.statusCode >= 300) {
            if (!firstErr) firstErr = new Error(`Status ${res.statusCode}: ${body}`);
          }
          if (completed === urlList.length) {
            callback(firstErr);
          }
        });
      });

      req.on('error', (err) => {
        completed++;
        if (!firstErr) firstErr = err;
        if (completed === urlList.length) {
          callback(firstErr);
        }
      });

      req.write(payload);
      req.end();
    } catch (e) {
      completed++;
      if (!firstErr) firstErr = e;
      if (completed === urlList.length) {
        callback(firstErr);
      }
    }
  });
}

/**
 * Helper to send response to the user.
 * If TEAMS_WEBHOOK_URL is configured, posts directly into the main channel feed
 * and responds to the Outgoing Webhook trigger with an empty 200 OK so Teams does not
 * create a collapsed thread reply under the user's message.
 * If TEAMS_WEBHOOK_URL is not set, gracefully falls back to direct thread reply.
 */
function sendBotResponse(res, messageText, cardTitle) {
  if (config.TEAMS_WEBHOOK_URL) {
    postToTeamsWebhook(config.TEAMS_WEBHOOK_URL, messageText, cardTitle, (err) => {
      if (err) {
        console.error('Failed to post to Teams main feed webhook, falling back to thread reply:', err);
        return res.status(200).json({
          type: 'message',
          text: (cardTitle ? `### ${cardTitle}\n\n` : '') + messageText
        });
      }
      // Successfully broadcasted to main feed!
      // Return HTTP 204 No Content so MS Teams creates ZERO replies in the thread!
      return res.status(204).end();
    });
  } else {
    // Fallback if TEAMS_WEBHOOK_URL is not set yet in GCP environment variables
    return res.status(200).json({
      type: 'message',
      text: (cardTitle ? `### ${cardTitle}\n\n` : '') + messageText
    });
  }
}

module.exports = {
  postToTeamsWebhook,
  sendBotResponse
};
