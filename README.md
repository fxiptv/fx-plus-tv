# FX+ TV App v1.4

TV-first IPTV frontend connected to Supabase.

## v1.4 compatibility update
- More robust startup for Fire TV / Silk and Android TV browsers.
- Native HLS is preferred when the browser supports it; HLS.js is the fallback.
- HLS.js is pinned and has a second CDN fallback.
- The boot logo can no longer remain on screen forever: network/media startup has timeouts and visible fallback states.
- Supabase channel loading has an 8-second timeout.
- Stream failover moves to the next channel after a failed/blocked stream.
- Removed newer optional-chaining/nullish syntax from the main app script for better older-browser compatibility.

## Controls
- Outside channel panel: Up/Right = next channel, Down/Left = previous channel, OK/Enter = open channels.
- Inside channel panel: arrows navigate, OK/Enter selects, Back/Escape closes.
- Search, Wide/Fit, Fullscreen and 5-second auto-close are retained.

## Data
Channels are read from the Supabase `channels` table. Only active channels are shown.
