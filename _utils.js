const { Pool } = require('pg');

let pool;
function getPool(){
  if (!pool){
    const connectionString = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString){
      throw new Error('No database connection string found. Check that Netlify DB is enabled for this site.');
    }
    pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

function json(statusCode, body){
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// The admin check happens HERE, on the server — not in the browser.
// The password lives in the ADMIN_PASSWORD environment variable in the
// Netlify dashboard, never in the code, so it can be changed any time
// without editing any files.
function isAdmin(event){
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // no password configured = nobody gets in
  const headers = event.headers || {};
  const supplied = headers['x-admin-password'] || headers['X-Admin-Password'] || '';
  if (supplied.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++){
    diff |= supplied.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function newId(){
  return Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

module.exports = { getPool, json, isAdmin, newId };
