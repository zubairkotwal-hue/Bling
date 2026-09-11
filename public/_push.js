const crypto = require('crypto');

// Web push, sent straight from the function that caused the event.
//
// Written against the raw protocol rather than the `web-push` package so that
// adding notifications does not add a dependency to a project that currently
// has exactly one. It does the two things that library does: signs a VAPID JWT
// so the push service will accept us, and encrypts the payload (RFC 8291) so
// the push service cannot read it.
//
// Needs two environment variables in Netlify:
//   VAPID_PUBLIC_KEY   VAPID_PRIVATE_KEY
// If either is missing this quietly does nothing — the site keeps working and
// notifications simply do not arrive, which is the right way round.

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (str) => Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function vapidKeys(){
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  return (pub && priv) ? { pub, priv } : null;
}

// A signed token proving to the push service who is sending.
function vapidHeader(endpoint, keys){
  const audience = new URL(endpoint).origin;
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const body = b64url(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:support@blinghappiness.co.za',
  }));
  const unsigned = `${header}.${body}`;

  const privateKey = crypto.createPrivateKey({
    key: { kty: 'EC', crv: 'P-256', d: keys.priv,
           x: b64url(unb64url(keys.pub).slice(1, 33)),
           y: b64url(unb64url(keys.pub).slice(33, 65)) },
    format: 'jwk',
  });

  // Node signs as DER; JWT wants the raw 64-byte r||s pair.
  const der = crypto.sign('sha256', Buffer.from(unsigned), privateKey);
  const sig = derToRaw(der);
  return { authorization: `vapid t=${unsigned}.${b64url(sig)}, k=${keys.pub}` };
}

function derToRaw(der){
  let offset = 2;
  if (der[1] & 0x80) offset += der[1] & 0x7f;
  const out = Buffer.alloc(64);
  for (const half of [0, 1]){
    offset += 1;                       // 0x02 tag
    let len = der[offset]; offset += 1;
    let start = offset;
    while (len > 32){ start += 1; len -= 1; }   // strip leading zero padding
    der.copy(out, half * 32 + (32 - len), start, start + len);
    offset = start + len;
  }
  return out;
}

// RFC 8291 payload encryption (aes128gcm).
function encrypt(payload, p256dh, auth){
  const clientPub = unb64url(p256dh);
  const authSecret = unb64url(auth);
  const salt = crypto.randomBytes(16);

  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const serverPub = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(clientPub);

  const hkdf = (ikm, salt2, info, len) => {
    const prk = crypto.createHmac('sha256', salt2).update(ikm).digest();
    return crypto.createHmac('sha256', prk)
      .update(Buffer.concat([info, Buffer.from([1])])).digest().slice(0, len);
  };

  const prkInfo = Buffer.concat([
    Buffer.from('WebPush: info\0'), clientPub, serverPub,
  ]);
  const ikm = hkdf(shared, authSecret, prkInfo, 32);
  const cek = hkdf(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);

  const body = Buffer.concat([Buffer.from(payload, 'utf8'), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const encrypted = Buffer.concat([cipher.update(body), cipher.final(), cipher.getAuthTag()]);

  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(serverPub.length, 20);

  return Buffer.concat([header, serverPub, encrypted]);
}

// Send to one subscription. Returns 'gone' if the browser has thrown the
// subscription away, so the caller can delete it.
async function sendOne(sub, payload, keys){
  try {
    const body = encrypt(payload, sub.p256dh, sub.auth);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        TTL: '86400',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        Authorization: vapidHeader(sub.endpoint, keys).authorization,
      },
      body,
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    return res.ok ? 'sent' : 'failed';
  } catch (e) {
    console.error('push send failed', e.message);
    return 'failed';
  }
}

// Is this kind of event set to notify right now?
// prefs looks like { orders:'instant', stories:'batched', help:'off', ... }
// plus quietFrom / quietTo as hours in the local timezone.
function shouldNotify(prefs, kind, mode){
  const setting = (prefs && prefs[kind]) || 'off';
  if (setting !== mode) return false;
  if (mode === 'instant' && inQuietHours(prefs)) return false;
  return true;
}

function inQuietHours(prefs){
  if (!prefs || prefs.quietFrom === undefined || prefs.quietTo === undefined) return false;
  const from = Number(prefs.quietFrom), to = Number(prefs.quietTo);
  if (isNaN(from) || isNaN(to) || from === to) return false;
  // South Africa is UTC+2 all year.
  const hour = (new Date().getUTCHours() + 2) % 24;
  return from < to ? (hour >= from && hour < to) : (hour >= from || hour < to);
}

async function loadPrefs(pool){
  try {
    const r = await pool.query(`SELECT value FROM settings WHERE key = 'notifyPrefs' LIMIT 1`);
    return r.rows.length ? JSON.parse(r.rows[0].value) : {};
  } catch (e) { return {}; }
}

// The one function the event handlers call. Never throws — a notification
// failing must not fail the thing that triggered it.
async function notify(pool, kind, title, body, url){
  try {
    const keys = vapidKeys();
    if (!keys) return;

    const prefs = await loadPrefs(pool);
    if (!shouldNotify(prefs, kind, 'instant')) return;

    const subs = await pool.query('SELECT * FROM push_subscriptions');
    if (!subs.rows.length) return;

    const payload = JSON.stringify({ title, body, url: url || '/', kind });
    for (const row of subs.rows){
      const result = await sendOne(
        { endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth }, payload, keys);
      if (result === 'gone'){
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
      }
    }
  } catch (e) {
    console.error('notify failed', e.message);
  }
}

module.exports = { notify, sendOne, vapidKeys, loadPrefs, shouldNotify, inQuietHours };
