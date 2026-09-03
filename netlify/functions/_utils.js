const { Pool } = require('pg');

let pool;
function getPool(){
  if (!pool){
    // Netlify DB sets this automatically once enabled for the site.
    // If your dashboard shows a different variable name, update this line to match.
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

// Netlify automatically verifies the Identity token sent by the browser and,
// if it's valid, hands us the logged-in user here — nothing to hand-roll.
function getAdminUser(context){
  return (context.clientContext && context.clientContext.user) || null;
}

function newId(){
  return Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

module.exports = { getPool, json, getAdminUser, newId };
