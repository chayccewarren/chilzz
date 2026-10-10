// Chilzz Proxy as a Netlify Function: same safety rules as server/server.js.
import dns from 'node:dns'; import net from 'node:net'; import http from 'node:http'; import https from 'node:https';
const ALLOW = (process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const MAX = +process.env.MAX_BYTES || 2e6, TO = +process.env.TIMEOUT_MS || 8000;
const isPrivate = ip => {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || /^f[cd]/.test(l) || l.startsWith('fe80') || (l.startsWith('::ffff:') && isPrivate(l.slice(7))); }
  const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
};
const allowed = h => ALLOW.some(a => h === a || h.endsWith('.' + a));
const safeLookup = (host, opts, cb) => dns.lookup(host, { family: opts.family }, (e, addr, fam) => {
  if (e) return cb(e); if (isPrivate(addr)) return cb(new Error('blocked address'));
  opts.all ? cb(null, [{ address: addr, family: fam }]) : cb(null, addr, fam); });
function check(raw) { const u = new URL(raw); if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) allowed'); if (u.username || u.password) throw new Error('Credentials in URL not allowed');
  const h = u.hostname.toLowerCase(); if (net.isIP(h) && isPrivate(h)) throw new Error('Blocked address'); if (!allowed(h)) throw new Error('Host is not on the allowlist'); return u; }
const once = u => new Promise((res, rej) => { const m = u.protocol === 'https:' ? https : http;
  const r = m.get(u, { lookup: safeLookup, timeout: TO, headers: { 'user-agent': 'ChilzzProxy/1.0', accept: 'text/html,text/plain' } }, x => {
    if (x.statusCode >= 300 && x.statusCode < 400 && x.headers.location) { x.resume(); return res({ redirect: new URL(x.headers.location, u).href }); }
    if (!/^text\/(html|plain)/.test(x.headers['content-type'] || '')) { x.resume(); return rej(new Error('Only HTML or text pages are supported')); }
    let n = 0; const c = []; x.on('data', d => { n += d.length; if (n > MAX) { x.destroy(); rej(new Error('Response too large')); } else c.push(d); }); x.on('end', () => res({ body: Buffer.concat(c).toString('utf8') })); x.on('error', rej); });
  r.on('timeout', () => r.destroy(new Error('Timed out'))); r.on('error', rej); });
const hits = new Map(); // best-effort per-instance limiter
const limited = ip => { const n = Date.now(), a = (hits.get(ip) || []).filter(t => n - t < 60000); a.push(n); hits.set(ip, a); return a.length > 30; };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' } });
export default async (req, ctx) => {
  const url = new URL(req.url); if (url.pathname === '/health') return json({ ok: true, allowed: ALLOW });
  if (limited(ctx?.ip || '?')) return json({ error: 'Too many requests' }, 429);
  try { let u = check(url.searchParams.get('url') || '');
    for (let i = 0; i < 4; i++) { const o = await once(u); if (o.redirect) { u = check(o.redirect); continue; } return json({ body: o.body }); }
    throw new Error('Too many redirects'); }
  catch (e) { return json({ error: /Invalid URL/.test(e.message) ? 'Invalid URL' : e.message }, 400); }
};
export const config = { path: ['/api/fetch', '/health'] };
