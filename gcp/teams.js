const https = require('https');
const config = require('./config');

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

  const cardBody = [];
  if (cardTitle) {
    cardBody.push({
      type: 'TextBlock',
      size: 'Medium',
      weight: 'Bolder',
      text: cardTitle,
      wrap: true
    });
  }

  cardBody.push({
    type: 'TextBlock',
    text: messageText,
    wrap: true
  });

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
