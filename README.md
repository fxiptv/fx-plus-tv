# FX+ TV App — Supabase Edition

FX+ is a TV-first IPTV frontend designed for Android TV / Fire TV / TV boxes and desktop browsers.

## Current setup

The TV app now loads its channel list directly from Supabase.

- Supabase table: `public.channels`
- Only channels where `active = true` are shown
- Ordering: first by `sort_order`, then by `number`
- XMLTV / EPG remains local in `epg.xml` for now
- Categories have been removed; the channel browser shows `All Channels`

## Supabase configuration

The connection is stored in `channels.js`:

- `supabaseUrl`
- `supabasePublishableKey`

Never place a `service_role`, secret key, or database password in frontend files.

## Required channels columns

The app expects:

- `id`
- `number`
- `name`
- `logo`
- `stream_url`
- `epg_id`
- `active`
- `sort_order`

## Navigation

When the app opens, it loads the first active channel automatically.

- Arrow Up / Right: next channel
- Arrow Down / Left: previous channel
- Enter / OK: open the All Channels overlay
- In overlay: arrows move through channels
- Enter / OK: play selected channel
- Back / Escape: close overlay
- Number keys: jump directly to a channel number

## Test locally

Do not test XMLTV by double-clicking `index.html`. Use a local web server.

VS Code: use Live Server.

Or:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Next step

Build the FX+ Admin Portal with Supabase Authentication so an administrator can add, edit, activate/deactivate, reorder and delete channels without editing code.
