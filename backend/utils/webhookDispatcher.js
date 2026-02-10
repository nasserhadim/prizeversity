const crypto = require('crypto');
const IntegrationApp = require('../models/IntegrationApp');

async function dispatchWebhook(event, classroomId, payload) {
  try {
    const apps = await IntegrationApp.find({
      active: true,
      'webhooks.event': event,
      'webhooks.active': true,
      $or: [
        { classrooms: { $size: 0 } },
        { classrooms: classroomId }
      ]
    });

    if (apps.length > 0) {
      console.debug(`[webhook][beta] Dispatching "${event}" to ${apps.length} app(s)`);
    }

    for (const app of apps) {
      const hooks = app.webhooks.filter(w => w.event === event && w.active);

      for (const hook of hooks) {
        const body = JSON.stringify({
          event,
          classroomId,
          timestamp: new Date().toISOString(),
          appId: app.clientId,
          data: payload
        });

        const signature = crypto
          .createHmac('sha256', hook.secret)
          .update(body)
          .digest('hex');

        fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Prizeversity-Signature': `sha256=${signature}`,
            'X-Prizeversity-Event': event
          },
          body,
          signal: AbortSignal.timeout(10000)
        })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            hook.lastTriggeredAt = new Date();
            hook.failCount = 0;
            await app.save();
          })
          .catch(async (err) => {
            console.warn(`[webhook] ${event} → ${hook.url} failed:`, err.message);
            hook.failCount = (hook.failCount || 0) + 1;
            hook.lastFailedAt = new Date();
            if (hook.failCount >= 10) {
              hook.active = false;
              console.warn(`[webhook] Auto-disabled ${hook.url} after 10 failures`);
            }
            await app.save();
          });
      }
    }
  } catch (err) {
    console.error('[webhookDispatcher] error:', err);
  }
}

module.exports = { dispatchWebhook };