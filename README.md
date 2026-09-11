# FX+ TV App v1.2

TV-first IPTV frontend connected to Supabase.

## v1.2
- Search channels in the overlay
- Fullscreen button
- Wide/Fit picture mode
- Initial channel autoplay fallback (muted until first interaction when browser policy requires it)
- Automatic channel failover: if a stream is missing, fails fatally, or does not load within 9 seconds, FX+ automatically tries the next active channel
- Failover never loops forever: if all active streams fail, FX+ shows an error

## Data
Channels are loaded from the Supabase `channels` table. Stream URLs are not hardcoded in the UI.


## v1.3
- Channel overlay closes automatically after 5 seconds without interaction.
- Mouse, touch, remote/keyboard movement, search, wheel and list scrolling reset the 5-second timer.
- Added an explicit Close (x) button; closing the overlay does not restart the current channel.
