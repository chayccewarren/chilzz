# Chilzz
Windows-style web desktop. Static frontend (no build) plus an optional Express server for Chilzz Proxy.

## Run
1. `cp server/.env.example server/.env`, then set `ALLOWED_HOSTS` (sites you're authorized to use) in it.
2. `npm start` (needs Node 22+), then open http://localhost:8787.

One process serves the desktop and Chilzz Proxy, so the proxy is always present. For hosting, deploy the whole folder to a Node host (Render, Railway, Fly) with `ALLOWED_HOSTS` and `PORT` set. A static-only host can show the desktop and games, but Chilzz Proxy will report that its server is unreachable until you set a server URL in Settings.

## Add your games
Open `js/games.js`, pick one of the 50 entries, set `title`, `description`, `url`, optional `cover`, and `enabled: true`. Reload. Or use Games > Import game (saved in localStorage; the 50 slots are never touched by resets).

## Fonts and wallpapers
Settings > Personalization. Wallpaper files are stored in IndexedDB. Imported fonts apply as the "Pixel" font for the current session only. For a permanent pixel font, drop a licensed `.woff2` in `assets/fonts/` and add an `@font-face` named `ChilzzPixel` in `css/global.css`.

## Known limitations
- Many sites forbid iframes; the player shows a notice rather than detecting this (browsers don't expose it).
- Proxy: allowlisted hosts only, HTML/text only, rendered in a script-less sandbox. No login, WebSockets or JS-heavy sites. It is not built to bypass network filters or site protections.
- The PIN is stored in localStorage; it is a convenience, not security.
- Still not built: a bundled pixel font (add a licensed .woff2 yourself), separate per-app source files (everything is in `js/app.js`), snap-to-edge windows, a Store/Home page in the launcher, and a custom shadow-strength control.
