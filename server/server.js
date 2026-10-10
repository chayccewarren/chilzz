import express from 'express'; import rateLimit from 'express-rate-limit';
import path from 'node:path'; import { fileURLToPath } from 'node:url'; import dns from 'node:dns'; import net from 'node:net'; import http from 'node:http'; import https from 'node:https';
const ALLOW = (process.env.ALLOWED_HOSTS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const MAX = +process.env.MAX_BYTES || 2e6, TO = +process.env.TIMEOUT_MS || 8000, ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
const isPrivate = ip => {
  if (net.isIPv6(ip)) { const l = ip.toLowerCase(); return l === '::1' || l === '::' || /^f[cd]/.test(l) || l.startsWith('fe80') || (l.startsWith('::ffff:') && isPrivate(l.slice(7))); }
  const [a, b] = ip.split('.').map(Number); return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
};
const allowed = h => ALLOW.some(a => h === a || h.endsWith('.' + a));
// Validated at connect time (not only before), which defeats DNS rebinding.
const safeLookup = (host, opts, cb) => dns.lookup(host, { family: opts.family }, (e, addr, fam) => {
  if (e) return cb(e); if (isPrivate(addr)) return cb(new Error('blocked address'));
  opts.all ? cb(null, [{ address: addr, family: fam }]) : cb(null, addr, fam); });
function check(raw) { const u = new URL(raw); if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http(s) allowed'); if (u.username || u.password) throw new Error('Credentials in URL not allowed');
  const h = u.hostname.toLowerCase(); if (net.isIP(h) && isPrivate(h)) throw new Error('Blocked address'); if (!allowed(h)) throw new Error('Host is not on the allowlist'); return u; }
const once = u => new Promise((res, rej) => { const m = u.protocol === 'https:' ? https : http;
  const r = m.get(u, { lookup: safeLookup, timeout: TO, headers: { 'user-agent': 'ChilzzProxy/1.0', accept: 'text/html,text/plain' } }, x => {
    if (x.statusCode >= 300 && x.statusCode < 400 && x.headers.location) { x.resume(); return res({ redirect: new URL(x.headers.location, u).href }); }
    const ct = x.headers['content-type'] || ''; if (!/^text\/(html|plain)/.test(ct)) { x.resume(); return rej(new Error('Only HTML or text pages are supported')); }
    let n = 0; const c = []; x.on('data', d => { n += d.length; if (n > MAX) { x.destroy(); rej(new Error('Response too large')); } else c.push(d); }); x.on('end', () => res({ body: Buffer.concat(c).toString('utf8') })); x.on('error', rej); });
  r.on('timeout', () => r.destroy(new Error('Timed out'))); r.on('error', rej); });
const app = express(); app.disable('x-powered-by');
app.use((req, res, next) => { res.set({ 'Access-Control-Allow-Origin': ORIGIN, 'X-Content-Type-Options': 'nosniff' }); next(); });
app.use(rateLimit({ windowMs: 60000, limit: 60 }));
app.get('/health', (_q, r) => r.json({ ok: true, allowed: ALLOW }));
app.get('/api/fetch', async (q, r) => { try { let u = check(String(q.query.url || ''));
  for (let i = 0; i < 4; i++) { const o = await once(u); if (o.redirect) { u = check(o.redirect); continue; } return r.json({ body: o.body }); } throw new Error('Too many redirects'); }
  catch (e) { r.status(400).json({ error: /Invalid URL/.test(e.message) ? 'Invalid URL' : e.message }); } });
// Chilzz and its proxy ship as one app: this server also serves the desktop.
app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), { index: 'index.html', dotfiles: 'deny' }));
app.listen(process.env.PORT || 8787, () => console.log('Chilzz Proxy server up; allowlist:', ALLOW.join(', ') || '(empty: everything blocked)'));
