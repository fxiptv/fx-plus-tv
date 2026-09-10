/**
 * FX+ - APP / SUPABASE CONFIGURATION
 * ------------------------------------------------------------
 * Channels are now loaded from Supabase table: public.channels
 * Only rows with active = true are shown in the TV app.
 *
 * IMPORTANT:
 * - The publishable key is safe to use in a frontend when RLS is enabled.
 * - Never put a Supabase secret/service_role key in this file.
 */

window.TV_CONFIG = {
  appName: "FX+",
  startChannel: 0,
  epgUrl: "epg.xml",
  overlayAutoCloseMs: 8000,
  miniInfoDurationMs: 3200,

  supabaseUrl: "https://nuzencjhlkecvzxuxfgq.supabase.co",
  supabasePublishableKey: "sb_publishable_mIyXtjx9YbI18gsOeIREhQ_4NhtcSCL"
};
