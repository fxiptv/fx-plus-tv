(() => {
  "use strict";

  const cfg = window.TV_CONFIG || {};
  let channels = [];
  const video = document.getElementById("video");
  const bootState = document.getElementById("bootState");
  const topHUD = document.getElementById("topHUD");
  const miniInfo = document.getElementById("miniInfo");
  const channelPanel = document.getElementById("channelPanel");
  const channelList = document.getElementById("channelList");
  const numericEntry = document.getElementById("numericEntry");
  const toastEl = document.getElementById("toast");
  const errorEl = document.getElementById("streamError");
  const channelSearch = document.getElementById("channelSearch");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const wideBtn = document.getElementById("wideBtn");
  const soundUnlock = document.getElementById("soundUnlock");

  let currentIndex = Math.min(Math.max(Number(cfg.startChannel) || 0, 0), Math.max(channels.length - 1, 0));
  let browseIndex = currentIndex;
  let hls = null;
  let epg = new Map();
  let miniTimer = null;
  let panelTimer = null;
  let numericTimer = null;
  let numericBuffer = "";
  let searchQuery = "";
  let hasUserInteraction = false;
  let wideMode = false;

  const safeText = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

  function formatClock(d) {
    return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  }

  function updateClock() {
    const now = new Date();
    document.getElementById("clock").textContent = formatClock(now);
    document.getElementById("dateText").textContent = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "2-digit", month: "short" }).format(now);
  }

  function parseXmlTvDate(raw) {
    if (!raw) return null;
    const m = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4}|Z)?/);
    if (!m) return null;
    const [, y, mo, d, h, mi, s = "00", zone = "+0000"] = m;
    if (zone === "Z") return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
    const z = zone || "+0000";
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${z.slice(0,3)}:${z.slice(3)}`);
  }

  async function loadEPG() {
    if (!cfg.epgUrl) return;
    try {
      const res = await fetch(cfg.epgUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = new DOMParser().parseFromString(await res.text(), "application/xml");
      xml.querySelectorAll("programme").forEach(node => {
        const channel = node.getAttribute("channel");
        if (!channel) return;
        const item = {
          start: parseXmlTvDate(node.getAttribute("start")),
          stop: parseXmlTvDate(node.getAttribute("stop")),
          title: node.querySelector("title")?.textContent?.trim() || "Live programme",
          desc: node.querySelector("desc")?.textContent?.trim() || ""
        };
        if (!epg.has(channel)) epg.set(channel, []);
        epg.get(channel).push(item);
      });
      for (const items of epg.values()) items.sort((a, b) => (a.start || 0) - (b.start || 0));
      refreshVisibleUI();
    } catch (err) {
      console.warn("EPG unavailable:", err);
    }
  }

  function epgFor(channel) {
    const items = epg.get(channel.epgId) || [];
    const now = Date.now();
    let current = items.find(p => p.start && p.stop && p.start.getTime() <= now && p.stop.getTime() > now) || null;
    let next = null;
    if (current) {
      const i = items.indexOf(current);
      next = items[i + 1] || null;
    } else {
      next = items.find(p => p.start && p.start.getTime() > now) || null;
    }
    return { current, next };
  }

  function progressOf(programme) {
    if (!programme?.start || !programme?.stop) return 0;
    const total = programme.stop - programme.start;
    if (total <= 0) return 0;
    return Math.max(0, Math.min(100, ((Date.now() - programme.start) / total) * 100));
  }

  function channelLogoMarkup(channel) {
    if (channel.logo) return `<img src="${safeText(channel.logo)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="logo-fallback" style="display:none">${safeText(channel.shortName || channel.name.slice(0,3))}</span>`;
    return `<span class="logo-fallback">${safeText(channel.shortName || channel.name.slice(0,3))}</span>`;
  }

  function filteredChannels() {
    const q = searchQuery.trim().toLowerCase();
    return channels.map((c, i) => ({ c, i })).filter(({ c }) => !q || c.name.toLowerCase().includes(q) || String(c.number ?? "").includes(q));
  }

  function renderChannelList() {
    const list = filteredChannels();
    if (!list.length) {
      channelList.innerHTML = `<div class="search-empty">${searchQuery ? "No channels match your search." : "No channels available."}</div>`;
      return;
    }
    if (!list.some(x => x.i === browseIndex)) browseIndex = list[0].i;
    channelList.innerHTML = list.map(({ c, i }) => {
      const { current } = epgFor(c);
      const active = i === browseIndex;
      const playing = i === currentIndex;
      return `<button class="channel-row ${active ? "focused" : ""} ${playing ? "playing" : ""}" data-index="${i}">
        <span class="row-number">${String(c.number ?? i + 1).padStart(2,"0")}</span>
        <span class="row-logo">${channelLogoMarkup(c)}</span>
        <span class="row-copy"><strong>${safeText(c.name)}</strong><small>${safeText(current?.title || "Live television")}</small></span>
        <span class="row-state">${playing ? "NOW" : ""}</span>
      </button>`;
    }).join("");
    channelList.querySelectorAll("[data-index]").forEach(row => {
      row.addEventListener("mouseenter", () => { browseIndex = Number(row.dataset.index); updateBrowseFocus(); });
      row.addEventListener("click", () => { browseIndex = Number(row.dataset.index); playIndex(browseIndex, true); closePanel(); });
    });
    updateBrowseFocus();
  }

  function updateBrowseFocus() {
    channelList.querySelectorAll(".channel-row").forEach(row => row.classList.toggle("focused", Number(row.dataset.index) === browseIndex));
    const focused = channelList.querySelector(`.channel-row[data-index="${browseIndex}"]`);
    focused?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    renderProgramPanel(channels[browseIndex]);
  }

  function renderProgramPanel(channel) {
    if (!channel) return;
    const { current, next } = epgFor(channel);
    const logo = document.getElementById("programLogo");
    logo.innerHTML = channel.logo ? `<img src="${safeText(channel.logo)}" alt=""/>` : safeText(channel.shortName || channel.name.slice(0,3));
    document.getElementById("programChannel").textContent = channel.name;
    document.getElementById("programTitle").textContent = current?.title || "Live television";
    document.getElementById("programTime").textContent = current ? `${formatClock(current.start)} — ${formatClock(current.stop)}` : "Programme data unavailable";
    document.getElementById("programProgress").style.width = `${progressOf(current)}%`;
    document.getElementById("programDesc").textContent = current?.desc || "Add an XMLTV source in channels.js to display the current programme and description.";
    document.getElementById("nextProgram").textContent = next ? `${formatClock(next.start)}  ${next.title}` : "No upcoming programme data";
  }

  function showMiniInfo(channel = channels[currentIndex]) {
    if (!channel) return;
    const { current } = epgFor(channel);
    document.getElementById("miniNumber").textContent = String(channel.number ?? currentIndex + 1).padStart(2,"0");
    document.getElementById("miniName").textContent = channel.name;
    document.getElementById("miniProgram").textContent = current?.title || "Live television";
    document.getElementById("miniStart").textContent = current ? formatClock(current.start) : "LIVE";
    document.getElementById("miniEnd").textContent = current ? formatClock(current.stop) : "";
    document.getElementById("miniProgress").style.width = `${progressOf(current)}%`;
    miniInfo.classList.remove("hidden");
    topHUD.classList.remove("hud-hidden");
    clearTimeout(miniTimer);
    miniTimer = setTimeout(() => {
      miniInfo.classList.add("hidden");
      if (channelPanel.classList.contains("hidden")) topHUD.classList.add("hud-hidden");
    }, Number(cfg.miniInfoDurationMs) || 3200);
  }

  function showError(channel, text = "The stream could not be loaded.") {
    document.getElementById("errorTitle").textContent = channel ? `${channel.name} is unavailable` : "Stream unavailable";
    document.getElementById("errorText").textContent = text;
    errorEl.classList.remove("hidden");
  }

  function hideError() { errorEl.classList.add("hidden"); }

  function unlockAudio() {
    hasUserInteraction = true;
    video.muted = false;
    soundUnlock.classList.add("hidden");
    if (video.paused) video.play().catch(() => {});
  }

  async function smartPlay(isInitial = false) {
    if (!isInitial || hasUserInteraction) {
      video.muted = false;
      try { await video.play(); soundUnlock.classList.add("hidden"); return; } catch (_) {}
    }
    // Browsers commonly block autoplay with sound. Fall back to muted autoplay
    // so channel 1 starts immediately instead of looking paused.
    video.muted = true;
    try {
      await video.play();
      soundUnlock.classList.remove("hidden");
    } catch (_) {
      soundUnlock.classList.remove("hidden");
    }
  }

  function playIndex(index, announce = true, isInitial = false) {
    if (!channels.length) return;
    currentIndex = (index + channels.length) % channels.length;
    browseIndex = currentIndex;
    const channel = channels[currentIndex];
    hideError();

    if (hls) { hls.destroy(); hls = null; }
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (!channel.stream) {
      showError(channel, "Add a valid .m3u8 URL for this channel in the Admin Portal / Supabase");
      if (announce) showMiniInfo(channel);
      renderChannelList();
      return;
    }

    if (window.Hls && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, maxBufferLength: 20 });
      hls.loadSource(channel.stream);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        bootState.classList.add("hidden");
        smartPlay(isInitial);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          try { hls.startLoad(); } catch (_) { showError(channel); }
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          try { hls.recoverMediaError(); } catch (_) { showError(channel); }
        } else {
          showError(channel);
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.stream;
      video.addEventListener("loadedmetadata", () => { bootState.classList.add("hidden"); smartPlay(isInitial); }, { once: true });
      video.addEventListener("error", () => showError(channel), { once: true });
    } else {
      showError(channel, "This browser does not support HLS playback.");
    }

    if (announce) showMiniInfo(channel);
    renderChannelList();
  }

  function zap(delta) {
    playIndex(currentIndex + delta, true);
  }

  function openPanel() {
    browseIndex = currentIndex;
    channelPanel.classList.remove("hidden");
    topHUD.classList.remove("hud-hidden");
    renderChannelList();
    resetPanelTimer();
  }

  function closePanel() {
    channelPanel.classList.add("hidden");
    topHUD.classList.add("hud-hidden");
    clearTimeout(panelTimer);
  }

  function togglePanel() {
    channelPanel.classList.contains("hidden") ? openPanel() : closePanel();
  }

  function resetPanelTimer() {
    clearTimeout(panelTimer);
    panelTimer = setTimeout(closePanel, Number(cfg.overlayAutoCloseMs) || 8000);
  }

  function moveBrowse(delta) {
    const list = filteredChannels();
    if (!list.length) return;
    const pos = Math.max(0, list.findIndex(x => x.i === browseIndex));
    browseIndex = list[(pos + delta + list.length) % list.length].i;
    updateBrowseFocus();
    resetPanelTimer();
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (_) {
      toast("Fullscreen is not available in this browser");
    }
  }

  function toggleWide() {
    wideMode = !wideMode;
    video.classList.toggle("video-wide", wideMode);
    wideBtn.classList.toggle("active", wideMode);
    wideBtn.textContent = wideMode ? "Fit" : "Wide";
    toast(wideMode ? "Wide picture" : "Fit picture");
  }

  function numericInput(digit) {
    numericBuffer = (numericBuffer + digit).slice(-3);
    numericEntry.textContent = numericBuffer;
    numericEntry.classList.remove("hidden");
    clearTimeout(numericTimer);
    numericTimer = setTimeout(() => {
      const target = Number(numericBuffer);
      numericBuffer = "";
      numericEntry.classList.add("hidden");
      const index = channels.findIndex((c, i) => Number(c.number ?? i + 1) === target);
      if (index >= 0) playIndex(index, true);
      else toast(`Channel ${target} not found`);
    }, 900);
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.add("hidden"), 1800);
  }

  function refreshVisibleUI() {
    if (!channelPanel.classList.contains("hidden")) renderChannelList();
    if (!miniInfo.classList.contains("hidden")) showMiniInfo();
  }

  function handleKey(e) {
    const key = e.key;
    const panelOpen = !channelPanel.classList.contains("hidden");
    const searchFocused = document.activeElement === channelSearch;
    if (!hasUserInteraction && !["Tab", "Shift", "Control", "Alt", "Meta"].includes(key)) unlockAudio();

    if (searchFocused) {
      if (key === "Escape") { channelSearch.blur(); closePanel(); e.preventDefault(); }
      return;
    }
    if (/^[0-9]$/.test(key)) { numericInput(key); e.preventDefault(); return; }

    if (panelOpen) {
      if (["ArrowUp", "PageUp"].includes(key)) { moveBrowse(-1); e.preventDefault(); return; }
      if (["ArrowDown", "PageDown"].includes(key)) { moveBrowse(1); e.preventDefault(); return; }
      if (key === "ArrowLeft") { moveBrowse(-1); e.preventDefault(); return; }
      if (key === "ArrowRight") { moveBrowse(1); e.preventDefault(); return; }
      if (["Enter", " "].includes(key)) { playIndex(browseIndex, true); closePanel(); e.preventDefault(); return; }
      if (["Escape", "Backspace", "BrowserBack", "GoBack"].includes(key)) { closePanel(); e.preventDefault(); return; }
    } else {
      if (["ArrowUp", "ArrowRight", "ChannelUp"].includes(key)) { zap(1); e.preventDefault(); return; }
      if (["ArrowDown", "ArrowLeft", "ChannelDown"].includes(key)) { zap(-1); e.preventDefault(); return; }
      if (["Enter", " "].includes(key)) { togglePanel(); e.preventDefault(); return; }
      if (key.toLowerCase() === "i") { showMiniInfo(); e.preventDefault(); return; }
    }
  }

  document.addEventListener("keydown", handleKey, { passive: false });
  document.addEventListener("mousemove", () => { if (!channelPanel.classList.contains("hidden")) resetPanelTimer(); });
  document.addEventListener("pointerdown", () => { if (!hasUserInteraction) unlockAudio(); }, { once: true });
  document.addEventListener("click", e => { if (e.target === channelPanel) closePanel(); });

  channelSearch.addEventListener("input", e => {
    searchQuery = e.target.value || "";
    const list = filteredChannels();
    if (list.length && !list.some(x => x.i === browseIndex)) browseIndex = list[0].i;
    renderChannelList();
    resetPanelTimer();
  });
  channelSearch.addEventListener("focus", () => resetPanelTimer());
  fullscreenBtn.addEventListener("click", e => { e.stopPropagation(); toggleFullscreen(); resetPanelTimer(); });
  wideBtn.addEventListener("click", e => { e.stopPropagation(); toggleWide(); resetPanelTimer(); });
  soundUnlock.addEventListener("click", e => { e.stopPropagation(); unlockAudio(); });
  document.addEventListener("fullscreenchange", () => { fullscreenBtn.classList.toggle("active", !!document.fullscreenElement); });

  video.addEventListener("playing", () => bootState.classList.add("hidden"));
  video.addEventListener("click", togglePanel);

  updateClock();
  setInterval(updateClock, 15000);
  setInterval(refreshVisibleUI, 60000);

  async function loadChannelsFromSupabase() {
    const baseUrl = String(cfg.supabaseUrl || "").replace(/\/$/, "");
    const key = String(cfg.supabasePublishableKey || "").trim();

    if (!baseUrl || !key) {
      throw new Error("Supabase URL or publishable key is missing in channels.js");
    }

    const endpoint = `${baseUrl}/rest/v1/channels?select=id,number,name,logo,stream_url,epg_id,sort_order&active=eq.true&order=sort_order.asc,number.asc`;
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Supabase ${response.status}: ${detail || response.statusText}`);
    }

    const rows = await response.json();
    channels = (Array.isArray(rows) ? rows : []).map((row, index) => ({
      id: row.id,
      number: Number(row.number ?? index + 1),
      name: row.name || `Channel ${index + 1}`,
      shortName: String(row.name || "TV").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "TV",
      logo: row.logo || "",
      epgId: row.epg_id || "",
      stream: row.stream_url || ""
    }));

    currentIndex = Math.min(Math.max(Number(cfg.startChannel) || 0, 0), Math.max(channels.length - 1, 0));
    browseIndex = currentIndex;
  }

  async function startApp() {
    try {
      await loadChannelsFromSupabase();
      renderChannelList();
      loadEPG();
      if (channels.length) {
        playIndex(currentIndex, false, true);
      } else {
        bootState.classList.add("hidden");
        showError(null, "No active channels were found in Supabase.");
      }
    } catch (err) {
      console.error("Channel loading failed:", err);
      bootState.classList.add("hidden");
      showError(null, "Could not load channels from Supabase. Check the connection and RLS policy.");
    }
  }

  startApp();
})();
