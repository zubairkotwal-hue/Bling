const { getPool, json, isAdmin } = require('./_utils');

// The numbers behind the admin Analytics tab. Admin only.
// Everything is worked out by the database and returned as small totals —
// individual visit rows never leave it.
const TODAY = `(NOW() AT TIME ZONE 'Africa/Johannesburg')::date`;
const RANGES = [7, 30, 90];
const yes = (col) => `SUM(CASE WHEN ${col} THEN 1 ELSE 0 END)::int`;
const any = (col) => `MAX(CASE WHEN ${col} THEN 1 ELSE 0 END)`;

async function tablesReady(pool){
  try {
    const r = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('visits','view_counts')`
    );
    return r.rows.length === 2;
  } catch (e) { return false; }
}

exports.handler = async (event) => {
  const pool = getPool();
  if (!isAdmin(event)) return json(401, { error: 'Admin login required' });
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });

  try {
    if (!(await tablesReady(pool))) return json(200, { ready: false });

    const asked = parseInt((event.queryStringParameters || {}).days, 10);
    const days = RANGES.includes(asked) ? asked : 30;
    // "The last 7 days" means today and the six before it.
    const inRange = `day > ${TODAY} - $1::int`;

    const [meta, daily, people, sources, devices, top] = await Promise.all([
      pool.query(`SELECT ${TODAY}::text AS today, MIN(day)::text AS since FROM visits`),

      // One row per day that had any visits.
      pool.query(
        `SELECT day::text AS day, COUNT(*)::int AS visits, COALESCE(SUM(views),0)::int AS views,
                ${yes('is_new')} AS new_people, ${yes('saw_shop')} AS shop, ${yes('saw_stories')} AS stories,
                ${yes('ordered')} AS orders
           FROM visits WHERE ${inRange} GROUP BY day ORDER BY day`, [days]),

      // Each person counted once across the whole range, however many days
      // they came back on: someone who read stories on Monday and browsed the
      // shop on Friday is "both", not one of each.
      pool.query(
        `SELECT COUNT(*)::int AS people,
                COALESCE(SUM(CASE WHEN st = 1 AND sh = 0 THEN 1 ELSE 0 END),0)::int AS stories_only,
                COALESCE(SUM(CASE WHEN st = 0 AND sh = 1 THEN 1 ELSE 0 END),0)::int AS shop_only,
                COALESCE(SUM(CASE WHEN st = 1 AND sh = 1 THEN 1 ELSE 0 END),0)::int AS both,
                COALESCE(SUM(CASE WHEN st = 0 AND sh = 0 THEN 1 ELSE 0 END),0)::int AS neither,
                COALESCE(SUM(sh),0)::int AS browsed, COALESCE(SUM(pr),0)::int AS product,
                COALESCE(SUM(ca),0)::int AS cart, COALESCE(SUM(co),0)::int AS checkout,
                COALESCE(SUM(od),0)::int AS ordered, COALESCE(SUM(re),0)::int AS replied,
                COALESCE(SUM(su),0)::int AS submitted, COALESCE(SUM(ins),0)::int AS installed,
                COALESCE(SUM(nw),0)::int AS new_people
           FROM (SELECT visitor,
                        ${any('saw_stories')} AS st, ${any('saw_shop')} AS sh, ${any('saw_product')} AS pr,
                        ${any('added_cart')} AS ca, ${any('started_checkout')} AS co, ${any('ordered')} AS od,
                        ${any('replied')} AS re, ${any('submitted')} AS su, ${any('installed')} AS ins,
                        ${any('is_new')} AS nw
                   FROM visits WHERE ${inRange} GROUP BY visitor) t`, [days]),

      pool.query(
        `SELECT source AS name, COUNT(*)::int AS n FROM visits WHERE ${inRange}
          GROUP BY source ORDER BY n DESC`, [days]),
      pool.query(
        `SELECT device AS name, COUNT(*)::int AS n FROM visits WHERE ${inRange}
          GROUP BY device ORDER BY n DESC`, [days]),
      pool.query(
        `SELECT kind, ref, SUM(n)::int AS n FROM view_counts WHERE ${inRange}
          GROUP BY kind, ref ORDER BY n DESC, ref LIMIT 200`, [days]),
    ]);

    const topOf = (kind) => top.rows.filter(r => r.kind === kind).slice(0, 8).map(r => ({ ref: r.ref, n: r.n }));
    const visits = daily.rows.reduce((a, r) => a + r.visits, 0);
    const views = daily.rows.reduce((a, r) => a + r.views, 0);

    return json(200, {
      ready: true,
      days,
      today: meta.rows[0].today,
      since: meta.rows[0].since,       // the first day anything was counted
      totals: { visits, views },
      daily: daily.rows,
      people: people.rows[0],
      sources: sources.rows,
      devices: devices.rows,
      topProducts: topOf('product'),
      topStories: topOf('story'),
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: err.message });
  }
};
