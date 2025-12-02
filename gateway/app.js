
const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const { createIncident } = require('./incident');
require('dotenv').config();

const app = express();
app.use(bodyParser.json({ verify: rawBodySaver }));

function rawBodySaver(req, res, buf) {
  if (buf && buf.length) {
    req.rawBody = buf.toString('utf8');
  }
}

function verifySignature(req) {
  const signatureHeader = req.get('X-Sonar-Webhook-HMAC-SHA256');
  if (!signatureHeader) return false;

  const computedHmac = crypto
    .createHmac('sha256', process.env.SONARQUBE_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(computedHmac));
}

// ✅ Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// ✅ Optional root route
app.get('/', (req, res) => {
  res.send('SonarQube → ServiceNow Gateway is running. Use /healthz or POST /sonarqube-webhook.');
});

app.post('/sonarqube-webhook', async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body;
  if (payload.qualityGate.status === 'FAILED') {
    try {
      const result = await createIncident(payload);
      res.status(200).json({ message: 'Incident created', result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to create incident' });
    }
  } else {
    res.status(200).json({ message: 'Quality gate passed, no incident created' });
  }
});

app.listen(3000, () => console.log('Gateway running on port 3000'));
