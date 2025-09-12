(function () {
  // ===== Passwords (hashed) =====
  const HASH_WUVU  = "e980fba218c0efa78ca42f5e845884db9e36ab73a46ed4e8c29b896e546c6c0b"; // pinku
  const HASH_WUVU2 = "5d503713f5c18ef61e2a731093c0c26c5b6c65a9787eb974ea1c209d80279572"; // hnnu

  // We intentionally do NOT persist/restore auth anymore
  const VERSION_KEY = "us_site_version";

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ===== Ensure Gate UI exists (so the prompt ALWAYS shows) =====
  function ensureGateUI() {
    let gate = $("#gate");
    if (!gate) {
      gate = document.createElement("div");
      gate.id = "gate";
      gate.innerHTML = `
        <div class="gate-card" style="
          max-width:420px;margin:auto;padding:20px;border-radius:12px;
          background:#fff;box-shadow:0 10px 30px rgba(0,0,0,.1);text-align:center
        ">
          <h2 style="margin:0 0 8px;">Private Space</h2>
          <p id="authMsg" style="min-height:1.5em;color:#444;margin:0 0 10px;"></p>
          <input id="gPass" type="password" placeholder="Enter password" autocomplete="current-password"
                 style="width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;margin-bottom:10px;">
          <button id="gSignin" class="btn-primary" style="
            width:100%;padding:10px;border:0;border-radius:8px;cursor:pointer
          ">Enter</button>
        </div>`;
      Object.assign(gate.style, {
        position:"fixed", inset:"0", display:"grid", placeItems:"center",
        background:"rgba(240,240,245,.9)", zIndex:"9999"
      });
      document.body.appendChild(gate);
    } else {
      // make sure required children exist
      if (!$("#authMsg")) {
        const p = document.createElement("p"); p.id = "authMsg"; gate.prepend(p);
      }
      if (!$("#gPass")) {
        const input = document.createElement("input"); input.id = "gPass"; input.type = "password";
        gate.appendChild(input);
      }
      if (!$("#gSignin")) {
        const btn = document.createElement("button"); btn.id = "gSignin"; btn.textContent = "Enter";
        gate.appendChild(btn);
      }
    }
    document.documentElement.classList.add("gated");
    gate.style.display = "grid";
    return gate;
  }

  function showGate(msg = "") {
    ensureGateUI();
    const gate = $("#gate");
    const authMsg = $("#authMsg");
    if (authMsg) authMsg.textContent = msg || "";
    document.documentElement.classList.add("gated");
    gate.style.display = "grid";
  }
  function hideGate() {
    const gate = $("#gate");
    const authMsg = $("#authMsg");
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
    const passEl = $("#gPass");
    const msgEl  = $("#authMsg");
    const pass = passEl?.value.trim() || "";
    if (!pass) { if (msgEl) msgEl.textContent = "Enter the password."; return; }
    if (msgEl) msgEl.textContent = "Checking…";
    try {
      const h = await sha256Hex(pass);
      if (h === HASH_WUVU) {
        setVersion("pinku", true);
        hideGate(); loadEverything();
      } else if (h === HASH_WUVU2) {
        setVersion("hnnu", true);
        hideGate(); loadEverything();
      } else {
        if (msgEl) msgEl.textContent = "Wrong password.";
      }
    } catch (e) {
      if (msgEl) msgEl.textContent = "Crypto not supported.";
    }
  }

  // Always require login on each load
  function wireGate() {
    const gate = ensureGateUI();
    $("#gSignin").onclick = trySignin;
    // Enter key submits
    $("#gPass").addEventListener("keydown", (e) => { if (e.key === "Enter") trySignin(); });
  }

  // ===== Version toggle (keeps persistence for version ONLY) =====
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
    // Only reload content after successful login; gate stays in control
    if ($("#gate")?.style.display === "none") loadEverything();
  });

  // ===== Data loading (local JSON first; safe fallbacks) =====
  async function fetchSiteData() {
    // 1) Inline JSON in HTML
    try {
      const tag = document.getElementById("site-data");
      if (tag?.textContent?.trim()) return JSON.parse(tag.textContent);
    } catch (e) {
      console.warn("Inline site-data parse failed:", e);
    }
    // 2) Local file next to index.html
    try {
      const url = new URL("./site-data.json", document.baseURI);
      url.searchParams.set("_", Date.now().toString(36)); // cache-bust
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.ok) return await res.json();
      console.warn("site-data.json HTTP", res.status, res.statusText);
    } catch (e) {
      console.warn("Local site-data.json fetch failed:", e);
    }
    // 3) window.SITE_DATA fallback (if preloaded)
    if (window.SITE_DATA) return window.SITE_DATA;
    // 4) Last resort: empty shell
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

  // ===== Renderers (null-safe) =====
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

  // Lightbox
  const lb = $("#lightbox"), lbImg = lb?.querySelector(".lightbox-img"), lbCap = lb?.querySelector(".lightbox-cap");
  function openLightbox(src, cap) { if (!lb || !lbImg || !lbCap) return; lbImg.src = src; lbCap.textContent = cap || ""; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); }
  lb?.querySelector(".lightbox-close")?.addEventListener("click", () => lb.classList.remove("open"));
  lb?.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("open"); });

  // ===== Save button (unchanged behavior: opens a GitHub issue with payload) =====
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
        }
      }
    };
  }
  $("#saveBtn")?.addEventListener("click", () => {
    const data = collectDataForSave();
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const url = `https://github.com/YOUR-USER/YOUR-REPO/issues/new` +
                `?title=${encodeURIComponent("US-SITE-DATA update")}` +
                `&body=${encodeURIComponent(payload)}`;
    window.open(url, "_blank");
  });

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

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      wireGate();          // ALWAYS show prompt
      showGate("");        // visible from the start
    });
  } else {
    wireGate();
    showGate("");
  }
})();
