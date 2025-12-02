
const axios = require('axios');
let cachedToken = null;
let tokenExpiry = null;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiry && now < tokenExpiry) {
    return cachedToken;
  }

  const response = await axios.post(`${process.env.SERVICENOW_INSTANCE}/oauth_token.do`, null, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    params: {
      grant_type: 'client_credentials',
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET
    }
  });

  cachedToken = response.data.access_token;
  tokenExpiry = now + (response.data.expires_in * 1000);
  return cachedToken;
}

module.exports = { getAccessToken };
