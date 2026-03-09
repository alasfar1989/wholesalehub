const db = require('../config/database');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const result = await db.query('SELECT push_token FROM users WHERE id = $1 AND push_token IS NOT NULL', [userId]);
    if (result.rows.length === 0 || !result.rows[0].push_token) return;

    const token = result.rows[0].push_token;
    if (!token.startsWith('ExponentPushToken')) return;

    const message = {
      to: token,
      sound: 'default',
      title,
      body,
      data,
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });

    const responseData = await response.json();
    if (responseData.data?.status === 'error') {
      console.error('Push notification error:', responseData.data.message);
    }
  } catch (err) {
    console.error('Push notification failed:', err.message);
  }
}

async function sendPushToMultiple(userIds, title, body, data = {}) {
  for (const userId of userIds) {
    await sendPushNotification(userId, title, body, data);
  }
}

module.exports = { sendPushNotification, sendPushToMultiple };
