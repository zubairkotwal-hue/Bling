const { json, isAdmin } = require('./_utils');

// Checks an admin password submitted from the login box.
// Returns simply whether it was correct — the real protection is that every
// other function independently re-checks the password on every request, so
// a "yes" here alone grants nothing.
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  if (!process.env.ADMIN_PASSWORD){
    return json(500, { ok: false, error: 'No admin password is configured on the server yet.' });
  }
  if (isAdmin(event)) return json(200, { ok: true });
  return json(401, { ok: false, error: 'That password is not correct.' });
};
