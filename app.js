(function () {
  // ===== Passwords (hashed) =====
  const HASH_WUVU  = "e980fba218c0efa78ca42f5e845884db9e36ab73a46ed4e8c29b896e546c6c0b"; // pinku
  const HASH_WUVU2 = "5d503713f5c18ef61e2a731093c0c26c5b6c65a9787eb974ea1c209d80279572"; // hnnu
  const AUTH_KEY = "us_site_authed";
  const VERSION_KEY = "us_site_version";

  // ===== Data sources (NEW) =====
  // 1) Inline <script type="application/json" id="site-data"> … </script> (preferred if present)
  // 2) Local file next to index.html: ./site-data.json
  // 3) GitHub RAW (set via <meta name="us-raw-url" content="https://raw.githubusercontent.../site-data.json">)
  const META_RAW = document.querySelector('meta[name="us-raw-url"]')?.content || "";
  const LOCAL_JSON_URL = new URL("./site-data.json", document.baseURI).toString();

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ===== Gate =====
  const gate = $("#gate");
  const authMsg = $("#authMsg");

  function showGate(msg = "") {
    if (authMsg) authMsg.textContent = msg || "";
    document.documentElement.classList.add("gated");
    if (gate) gate.style.display = "grid";
  }
  function hideGate() {
    if (authMsg) authMsg.textContent = "";
    document.documentElement.classList.remove("gated");
    if (gate) gate.style.display = "none";
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function trySignin() {
    const pass = $("#gPass")?.value.trim();
    if (!pass) { if (authMsg) authMsg.textContent = "Enter the password."; return; }
    if (authMsg) authMsg.textContent = "Checking…";
    try {
      const h = await sha256Hex(pass);
      if (h === HASH_WUVU) {
        localStorage.setItem(AUTH_KEY, "1");
        setVersion("pinku", true);
        hideGate(); loadEverything();
      } else if (h === HASH_WUVU2) {
        localStorage.setItem(AUTH_KEY, "1");
        setVersion("hnnu", true);
        hideGate(); loadEverything();
      } else {
        if (authMsg) authMsg.textContent = "Wrong password.";
      }
    } catch (e) {
      if (authMsg) authMsg.textContent = "Crypto not supported.";
    }
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY);
    showGate("");
  }

  $("#gSignin") && ($("#gSignin").onclick = trySignin);
  $("#signOut") && ($("#signOut").onclick = signOut);

  // Auto-show/restore auth state (FIX)
  if (localStorage.getItem(AUTH_KEY) === "1") {
    hideGate();
  } else {
    showGate("");
  }

  // ===== Version toggle =====
  const qs = new URLSearchParams(location.search);
  const DEFAULT_VERSION = localStorage.getItem(VERSION_KEY) || "hnnu";
  function getInitialVersion() {
    const v = qs.get("v") || DEFAULT_VERSION;
    return (v === "hnnu" || v === "pinku") ? v : "hnnu";
  }
  let currentVersion = getInitialVersion();

  function setVersion(v, persist = false) {
    currentVersion = v;
    document.documentElement.setAttribute("data-version", v);
    const t = $("#versionToggle .tag");
    if (t) t.textContent = v;
    if (persist) localStorage.setItem(VERSION_KEY, v);
  }
  setVersion(currentVersion);

  $("#versionToggle")?.addEventListener("click", () => {
    const next = currentVersion === "hnnu" ? "pinku" : "hnnu";
    const url = new URL(location.href); url.searchParams.set("v", next);
    history.replaceState({}, "", url);
    setVersion(next, true);
    loadEverything();
  });

  // ===== Load data (REWORKED) =====
  function parseInlineSiteData() {
    try {
      const tag = document.getElementById("site-data");
      if (!tag) return null;
      const raw = tag.textContent?.trim();
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn("Inline site-data parse failed:", e);
      return null;
    }
  }

  async function fetchJSON(url) {
    const bust = Date.now().toString(36);
    const u = new URL(url, document.baseURI);
    // cache busting while keeping any existing query params
    u.searchParams.set("_", bust);
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    // Defensive: ensure content is JSON when possible, but still parse if not labeled correctly
    return await res.json();
  }

  async function fetchSiteData() {
    // 1) Inline JSON wins (no fetch needed)
    const inline = parseInlineSiteData();
    if (inline) return inline;

    // 2) Local file next to the site (works on any static host / subpath)
    try {
      return await fetchJSON(LOCAL_JSON_URL);
    } catch (e) {
      console.warn("Local site-data.json not available:", e.message);
    }

    // 3) GitHub RAW fallback if provided via meta tag
    if (META_RAW && !/YOUR-USER|YOUR-REPO/.test(META_RAW)) {
      try {
        return await fetchJSON(META_RAW);
      } catch (e) {
        console.warn("GitHub RAW fetch failed:", e.message);
      }
    } else {
      console.warn("No valid RAW URL configured (set <meta name=\"us-raw-url\" ...>)");
    }

    // 4) Final fallback to window.SITE_DATA if someone preloads it
    if (window.SITE_DATA) {
      console.warn("Using window.SITE_DATA fallback");
      return window.SITE_DATA;
    }

    // 5) Give the UI something sane
    console.error("No site-data available from any source.");
    return { relationshipStart: "", nextMeetDate: "", versions: {} };
  }

  function getProfile(v, SITE_DATA) {
    const base = {
      relationship_start: SITE_DATA.relationshipStart || "",
      next_meet_date: SITE_DATA.nextMeetDate || "",
    };
    const ver = (SITE_DATA.versions && SITE_DATA.versions[v]) || {};
    return {
      ...base,
      your_name: ver.yourName || "",
      her_name: ver.herName || "",
      opening_line: ver.openingLine || "",
      surprise_message: ver.surpriseMessage || "",
      playlist_src: ver.playlistEmbed ? ver.playlistEmbed.src : "",
      timeline: ver.timeline || [],
      gallery: ver.gallery || [],
      letters: ver.letters || [],
      quiz: ver.quiz || [],
      bucket: ver.bucket || [],
      hero_headline: ver.heroHeadline || "Welcome",
    };
  }

  // ===== Renderers =====
  function renderBasics(p) {
    $("#pageTitle") && ($("#pageTitle").textContent = "Us — Private Space 💌");
    $("#pageTitleInline") && ($("#pageTitleInline").textContent = "Us — Private Space");
    document.title = $("#pageTitle")?.textContent || document.title;

    $("#yourName") && ($("#yourName").textContent = p.your_name || "You");
    $("#herName") && ($("#herName").textContent = p.her_name || "My Love");
    $("#openingLine") && ($("#openingLine").textContent = p.opening_line || "");

    $("#relationshipStart") && ($("#relationshipStart").value = p.relationship_start || "");
    $("#nextMeetDate") && ($("#nextMeetDate").value = p.next_meet_date || "");

    $("#surpriseMsg") && ($("#surpriseMsg").textContent = p.surprise_message || "");
    $("#playlistFrame") && ($("#playlistFrame").src = p.playlist_src || "");

    $("#heroHeadline") && ($("#heroHeadline").textContent = p.hero_headline || "Welcome");
    $("#year") && ($("#year").textContent = new Date().getFullYear());
  }

  function fmtDays(n) { return `${n} day${n === 1 ? "" : "s"}`; }
  function daysBetween(a, b) { return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24)); }
  function renderCounters(p) {
    const start = p.relationship_start ? new Date(p.relationship_start) : null;
    const next = p.next_meet_date ? new Date(p.next_meet_date) : null;
    const now = new Date();
    $("#daysTogether") && ($("#daysTogether").textContent = start ? fmtDays(daysBetween(start, now)) : "—");
    const until = next ? Math.max(0, daysBetween(now, next)) : null;
    $("#nextMeetCountdown") && ($("#nextMeetCountdown").textContent = (until === null ? "—" : (until === 0 ? "Today! 🎉" : fmtDays(until))));
  }

  async function renderTimeline(items) {
    const wrap = $("#timelineList"); if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) { $("#timelineEmpty")?.classList.remove("hidden"); return; }
    $("#timelineEmpty")?.classList.add("hidden");
    for (const row of [...items].sort((a, b) => new Date(a.date) - new Date(b.date))) {
      const imgSrc = row.img || row.img_url || "assets/cover.jpg";
      const el = document.createElement("div"); el.className = "item";
      el.innerHTML = `
        <img src="${imgSrc}" alt="">
        <div>
          <div class="date">${row.date ? new Date(row.date).toLocaleDateString() : ""}</div>
          <div class="title"><strong>${row.title || ""}</strong></div>
          <div class="cap">${row.caption || ""}</div>
        </div>`;
      wrap.appendChild(el);
    }
  }

  async function renderGallery(items) {
    const wrap = $("#galleryGrid"); if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) { $("#galleryEmpty")?.classList.remove("hidden"); return; }
    $("#galleryEmpty")?.classList.add("hidden");
    for (const row of items) {
      const imgSrc = row.img || row.img_url || "";
      const box = document.createElement("div"); box.style.position = "relative";
      box.innerHTML = `<img src="${imgSrc}" alt="${row.caption || ""}"/>`;
      box.querySelector("img").addEventListener("click", () => openLightbox(imgSrc, row.caption));
      wrap.appendChild(box);
    }
  }

  function renderLetters(items) {
    const wrap = $("#lettersWrap"); if (!wrap) return;
    wrap.innerHTML = "";
    if (!items.length) { $("#lettersEmpty")?.classList.remove("hidden"); return; }
    $("#lettersEmpty")?.classList.add("hidden");
    items.forEach((row) => {
      const card = document.createElement("div"); card.className = "letter";
      card.innerHTML = `
        <div class="title">${row.title || ""}</div>
        <div class="body">${row.body || ""}</div>
        <button class="btn-primary toggle">Open</button>`;
      card.querySelector(".toggle").addEventListener("click", () => {
        card.classList.toggle("open");
        card.querySelector(".toggle").textContent = card.classList.contains("open") ? "Close" : "Open";
      });
      wrap.appendChild(card);
    });
  }

  function renderQuiz(items) {
    const form = $("#quizForm"); if (!form) return;
    const qBox = form.querySelector(".q"); qBox.innerHTML = "";
    if (!items.length) { $("#quizEmpty")?.classList.remove("hidden"); return; }
    $("#quizEmpty")?.classList.add("hidden");
    items.forEach((row, i) => {
      const name = `q${i}`;
      const div = document.createElement("div");
      let inner = `<div class="q-title"><strong>${i + 1}.</strong> ${row.q || row.question || ""}</div>`;
      (row.options || []).forEach((opt, j) => {
        inner += `<label><input type="radio" name="${name}" value="${j}" required/> ${opt}</label>`;
      });
      div.innerHTML = inner; qBox.appendChild(div);
    });
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      let score = 0;
      items.forEach((row, i) => {
        const ans = typeof row.answerIndex === "number" ? row.answerIndex : row.answer_index;
        if (Number(fd.get(`q${i}`)) === ans) score++;
      });
      $("#quizResult").textContent = `Score: ${score}/${items.length} ${score === items.length ? "💖 Perfect!" : ""}`;
    };
  }

  function renderBucket(items) {
    const ul = $("#bucketList"); if (!ul) return;
    ul.innerHTML = "";
    if (!items.length) { $("#bucketEmpty")?.classList.remove("hidden"); return; }
    $("#bucketEmpty")?.classList.add("hidden");
    items.forEach((row) => {
      const li = document.createElement("li"); li.className = row.done ? "done" : "";
      li.textContent = row.text;
      ul.appendChild(li);
    });
  }

  // Lightbox
  const lb = $("#lightbox"), lbImg = lb?.querySelector(".lightbox-img"), lbCap = lb?.querySelector(".lightbox-cap");
  function openLightbox(src, cap) { if (!lb || !lbImg || !lbCap) return; lbImg.src = src; lbCap.textContent = cap || ""; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); }
  lb?.querySelector(".lightbox-close")?.addEventListener("click", () => lb.classList.remove("open"));
  lb?.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("open"); });

  // Surprise
  const surprise = $("#surprise");
  $("#openSurprise")?.addEventListener("click", () => {
    if (!surprise) return;
    if (typeof surprise.showModal === "function") surprise.showModal();
    else surprise.setAttribute("open", "");
  });
  $("#closeSurprise")?.addEventListener("click", () => {
    if (!surprise) return;
    surprise.close ? surprise.close() : surprise.removeAttribute("open");
  });

  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href").slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  // ===== Save button: open GitHub Issue =====
  function collectDataForSave() {
    return {
      relationshipStart: $("#relationshipStart")?.value || "",
      nextMeetDate: $("#nextMeetDate")?.value || "",
      versions: {
        [currentVersion]: {
          heroHeadline: $("#heroHeadline")?.textContent.trim() || "",
          yourName: $("#yourName")?.textContent.trim() || "",
          herName: $("#herName")?.textContent.trim() || "",
          openingLine: $("#openingLine")?.textContent.trim() || "",
          surpriseMessage: $("#surpriseMsg")?.textContent.trim() || "",
          playlistEmbed: { src: $("#playlistFrame")?.src || "" }
          // TODO: add collectors for timeline/gallery/etc. if you want to edit them live
        }
      }
    };
  }

  $("#saveBtn")?.addEventListener("click", () => {
    const data = collectDataForSave();
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const gh = (META_RAW && META_RAW.includes("/raw.githubusercontent.com/"))
      ? META_RAW.replace("https://raw.githubusercontent.com/", "https://github.com/")
          .replace("/content/site-data.json", "")
      : "https://github.com/YOUR-USER/YOUR-REPO";
    const url = `${gh}/issues/new` +
                `?title=${encodeURIComponent("US-SITE-DATA update")}` +
                `&body=${encodeURIComponent(payload)}`;
    window.open(url, "_blank");
  });

  // ===== Load everything =====
  async function loadEverything() {
    try {
      const SITE_DATA = await fetchSiteData();
      const p = getProfile(currentVersion, SITE_DATA);
      renderBasics(p);
      renderCounters(p);
      renderTimeline(p.timeline);
      renderGallery(p.gallery);
      renderLetters(p.letters);
      renderQuiz(p.quiz);
      renderBucket(p.bucket);
    } catch (e) {
      console.error("Failed to load & render site data:", e);
      const err = $("#error");
      if (err) err.textContent = "Could not load site data. Please refresh or try again later.";
    }
  }

  // Kickoff after DOM is ready (safer if script is in <head>)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { if (localStorage.getItem(AUTH_KEY) === "1") loadEverything(); });
  } else {
    if (localStorage.getItem(AUTH_KEY) === "1") loadEverything();
  }
})();

