(function () {
  // ===== Passwords (hashed) =====
  const HASH_WUVU  = "e980fba218c0efa78ca42f5e845884db9e36ab73a46ed4e8c29b896e546c6c0b"; // pinku
  const HASH_WUVU2 = "5d503713f5c18ef61e2a731093c0c26c5b6c65a9787eb974ea1c209d80279572"; // hnnu

  const VERSION_KEY = "us_site_version"; // persist viewing version only
  const NEXT_MEET_KEY = "nextMeetISO";    // shared across both pages immediately

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ===== Gate (always ask on load) =====
  function showGate(msg = "") {
    $("#authMsg").textContent = msg || "";
    document.documentElement.classList.add("gated");
    $("#gate").style.display = "grid";
  }
  function hideGate() {
    $("#authMsg").textContent = "";
    document.documentElement.classList.remove("gated");
    $("#gate").style.display = "none";
  }
  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  let allowedVersion = null; // "pinku" | "hnnu" | null

  async function trySignin() {
    const pass = $("#gPass").value.trim();
    if (!pass) { $("#authMsg").textContent = "Enter the password."; return; }
    $("#authMsg").textContent = "Checking…";
    try {
      const h = await sha256Hex(pass);
      if (h === HASH_WUVU) {
        allowedVersion = "pinku";
        setVersion("pinku", true);
        hideGate(); loadEverything();
      } else if (h === HASH_WUVU2) {
        allowedVersion = "hnnu";
        setVersion("hnnu", true);
        hideGate(); loadEverything();
      } else {
        $("#authMsg").textContent = "Wrong password.";
      }
    } catch (e) {
      $("#authMsg").textContent = "Crypto not supported.";
    }
  }
  function signOut() {
    allowedVersion = null;
    showGate("");
  }
  $("#gSignin").onclick = trySignin;
  $("#gPass").addEventListener("keydown", (e) => { if (e.key === "Enter") trySignin(); });
  $("#signOut").onclick = signOut;
  showGate("");

  // ===== Version handling =====
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
    $("#versionToggle .tag").textContent = v;
    if (persist) localStorage.setItem(VERSION_KEY, v);
    applyEditability();
  }
  setVersion(currentVersion);

  $("#versionToggle").addEventListener("click", () => {
    const next = currentVersion === "hnnu" ? "pinku" : "hnnu";
    const url = new URL(location.href); url.searchParams.set("v", next);
    history.replaceState({}, "", url);
    setVersion(next, true);
    loadEverything();
  });

  // ===== Data loading (local JSON first; fallbacks) =====
  const META_RAW = document.querySelector('meta[name="us-raw-url"]')?.content || ""; // <-- keep this one
  const LOCAL_JSON_URL = new URL("./site-data.json", document.baseURI).toString();

  async function fetchJSON(url) {
    const u = new URL(url, document.baseURI);
    u.searchParams.set("_", Date.now().toString(36)); // cache-bust
    const res = await fetch(u.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return await res.json();
  }
  function parseInlineSiteData() {
    try {
      const tag = document.getElementById("site-data");
      if (!tag?.textContent?.trim()) return null;
      return JSON.parse(tag.textContent);
    } catch { return null; }
  }
  async function fetchSiteData() {
    const inline = parseInlineSiteData();
    if (inline) return inline;
    try { return await fetchJSON(LOCAL_JSON_URL); } catch (e) {}
    if (META_RAW && !/YOUR-USER|YOUR-REPO/i.test(META_RAW)) {
      try { return await fetchJSON(META_RAW); } catch (e) {}
    }
    return window.SITE_DATA || { relationshipStart:"", nextMeetDate:"", versions:{} };
  }

  function getProfile(v, SITE_DATA) {
    const base = {
      relationship_start: SITE_DATA.relationshipStart || "",
      // Prefer localStorage for immediate shared experience; fallback to JSON
      next_meet_date: (localStorage.getItem(NEXT_MEET_KEY) || SITE_DATA.nextMeetDate || "")
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

  // ===== Editability controller =====
  function isCurrentEditable() {
    return allowedVersion && allowedVersion === currentVersion;
  }
  function showToolbars(show) {
    $$("[data-edit-toolbar]").forEach(tb => tb.style.display = show ? "flex" : "none");
    document.documentElement.toggleAttribute("data-locked", !show);
  }
  function applyEditability() {
    const canEdit = isCurrentEditable();

    // Inline fields
    ["#pageTitleInline", "#heroHeadline", "#openingLine", "#surpriseMsg", "#yourName"]
      .map(s => $(s)).filter(Boolean)
      .forEach(n => n.setAttribute("contenteditable", canEdit ? "true" : "false"));

    // Dates
    const rel = $("#relationshipStart"); // always read-only
    const next = $("#nextMeetDate");     // editable only if allowed
    if (rel) rel.disabled = true;
    if (next) next.disabled = !canEdit;

    // Toolbars visibility
    showToolbars(canEdit);

    // Dynamic sections toggles
    markDynamicSectionEditability(canEdit);
  }

  function markDynamicSectionEditability(canEdit) {
    $$("#lettersWrap .letter .title, #lettersWrap .letter .body").forEach(n => {
      n.setAttribute("contenteditable", canEdit ? "true" : "false");
    });
    $$("#timelineList .item .title, #timelineList .item .cap").forEach(n => {
      n.setAttribute("contenteditable", canEdit ? "true" : "false");
    });
    $$("#galleryGrid .gcap").forEach(n => {
      n.setAttribute("contenteditable", canEdit ? "true" : "false");
    });
    $$("#bucketList li .btext").forEach(n => {
      n.setAttribute("contenteditable", canEdit ? "true" : "false");
    });
    $$(".del-btn").forEach(btn => btn.style.display = canEdit ? "inline-flex" : "none");
  }

  // ===== Helpers =====
  function toDatetimeLocalValue(d) {
    // Format as YYYY-MM-DDTHH:MM for <input type="datetime-local">
    if (!(d instanceof Date) || isNaN(d)) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ===== Renderers =====
  function renderBasics(p) {
    $("#pageTitle").textContent = "Us — Private Space 💌";
    $("#pageTitleInline").textContent = $("#pageTitleInline").textContent || "Us — Private Space";
    document.title = $("#pageTitle").textContent;

    $("#yourName").textContent = p.your_name || "You";
    $("#herName") && ($("#herName").textContent = p.her_name || "My Love");
    $("#openingLine").textContent = p.opening_line || "";

    $("#relationshipStart").value = p.relationship_start || "";

    // Next meet: support datetime-local and localStorage
    const nextMeetInput = $("#nextMeetDate");
    const nextFrom = p.next_meet_date ? new Date(p.next_meet_date) : null;
    if (nextMeetInput) {
      nextMeetInput.value = nextFrom ? toDatetimeLocalValue(nextFrom) : "";
    }

    $("#surpriseMsg").textContent = p.surprise_message || "";
    $("#playlistFrame").src = p.playlist_src || "";

    $("#heroHeadline").textContent = p.hero_headline || "Welcome";
    $("#year").textContent = new Date().getFullYear();

    applyEditability();
  }

  function fmtDays(n) { return `${n} day${n === 1 ? "" : "s"}`; }
  function daysBetween(a, b) { return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24)); }

  function startLiveCountdown(nextDate) {
    const nextMeetEl = $("#nextMeetCountdown");
    const daysTogetherEl = $("#daysTogether");
    const start = $("#relationshipStart")?.value ? new Date($("#relationshipStart").value) : null;

    function renderOnce() {
      const now = new Date();
      if (start && daysTogetherEl) daysTogetherEl.textContent = fmtDays(daysBetween(start, now));

      if (!(nextDate instanceof Date) || isNaN(nextDate)) {
        if (nextMeetEl) nextMeetEl.textContent = "—";
        return;
      }
      const diff = nextDate - now;
      if (diff <= 0) {
        nextMeetEl.textContent = "Now! 🎉";
        return;
      }
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      nextMeetEl.textContent = `${d}d ${h}h ${m}m ${sec}s`;
    }

    clearInterval(window.__meetTimer);
    renderOnce();
    window.__meetTimer = setInterval(renderOnce, 1000);
  }

  function renderCounters(p) {
    const start = p.relationship_start ? new Date(p.relationship_start) : null;
    const now = new Date();
    $("#daysTogether").textContent = start ? fmtDays(daysBetween(start, now)) : "—";

    const next = p.next_meet_date ? new Date(p.next_meet_date) : null;
    startLiveCountdown(next);
  }

  // Helpers to create delete buttons
  function makeDelBtn(aria, handler) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "icon-btn del-btn";
    b.title = aria;
    b.setAttribute("aria-label", aria);
    b.textContent = "🗑️";
    b.addEventListener("click", handler);
    return b;
  }

  // Timeline CRUD
  async function renderTimeline(items) {
    const wrap = $("#timelineList"); wrap.innerHTML = "";
    if (!items.length) { $("#timelineEmpty").classList.remove("hidden"); } else { $("#timelineEmpty").classList.add("hidden"); }
    for (const row of [...items].sort((a, b) => new Date(a.date) - new Date(b.date))) {
      wrap.appendChild(buildTimelineItem(row));
    }
    markDynamicSectionEditability(isCurrentEditable());
  }
  function buildTimelineItem(row = {}) {
    const imgSrc = row.img || row.img_url || "assets/cover.jpg";
    const el = document.createElement("div");
    el.className = "item";
    el.dataset.date = row.date || "";
    el.dataset.img = imgSrc || "";
    el.innerHTML = `
      <img src="${imgSrc}" alt="">
      <div>
        <div class="date">${row.date ? new Date(row.date).toLocaleDateString() : ""}</div>
        <div class="title" contenteditable="false"><strong>${row.title || ""}</strong></div>
        <div class="cap" contenteditable="false">${row.caption || ""}</div>
      </div>`;
    const del = makeDelBtn("Delete timeline item", () => el.remove());
    el.appendChild(del);
    return el;
  }

  // Gallery CRUD
  async function renderGallery(items) {
    const wrap = $("#galleryGrid"); wrap.innerHTML = "";
    if (!items.length) { $("#galleryEmpty").classList.remove("hidden"); } else { $("#galleryEmpty").classList.add("hidden"); }
    for (const row of items) {
      wrap.appendChild(buildGalleryItem(row));
    }
    markDynamicSectionEditability(isCurrentEditable());
  }
  function buildGalleryItem(row = {}) {
    const imgSrc = row.img || row.img_url || "";
    const box = document.createElement("div"); box.style.position = "relative";
    box.dataset.img = imgSrc; box.dataset.caption = row.caption || "";
    box.innerHTML = `
      <img src="${imgSrc}" alt="${row.caption || ""}"/>
      <div class="gcap" contenteditable="false" style="margin-top:6px">${row.caption || ""}</div>`;
    box.querySelector("img").addEventListener("click", () => openLightbox(imgSrc, row.caption));
    const del = makeDelBtn("Delete photo", () => box.remove());
    box.appendChild(del);
    return box;
  }

  // Letters CRUD
  function renderLetters(items) {
    const wrap = $("#lettersWrap"); wrap.innerHTML = "";
    if (!items.length) { $("#lettersEmpty").classList.remove("hidden"); } else { $("#lettersEmpty").classList.add("hidden"); }
    items.forEach((row) => wrap.appendChild(buildLetter(row)));
    markDynamicSectionEditability(isCurrentEditable());
  }
  function buildLetter(row = {}) {
    const card = document.createElement("div"); card.className = "letter";
    card.innerHTML = `
      <div class="title" contenteditable="false">${row.title || ""}</div>
      <div class="body" contenteditable="false">${row.body || ""}</div>
      <div class="row">
        <button class="btn-primary toggle" type="button">Open</button>
      </div>`;
    card.querySelector(".toggle").addEventListener("click", () => {
      card.classList.toggle("open");
      card.querySelector(".toggle").textContent = card.classList.contains("open") ? "Close" : "Open";
    });
    const del = makeDelBtn("Delete letter", () => card.remove());
    card.appendChild(del);
    return card;
  }

  // ===== QUIZ =====
  function renderQuiz(items) {
    const form = $("#quizForm"); if (!form) return;
    const qBox = form.querySelector(".q"); qBox.innerHTML = "";
    if (!items.length) { $("#quizEmpty").classList.remove("hidden"); } else { $("#quizEmpty").classList.add("hidden"); }

    items.forEach((row, i) => qBox.appendChild(buildQuizQuestion(row, i)));

    // Submit handler (score without locking or reloading)
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const allQs = $$("#quizForm .quiz-q");
      let correct = 0;
      allQs.forEach((qDiv, idx) => {
        const ans = Number(qDiv.dataset.answerIndex ?? -1);
        const picked = qDiv.querySelector(`input[name="q${idx}"]:checked`);
        if (picked && Number(picked.value) === ans) correct++;
      });
      const result = `${correct} / ${allQs.length} correct! 🎉`;
      $("#quizResult").textContent = result;
    }, { once: true }); // once per render
  }
  function buildQuizQuestion(row = {}, idx = 0) {
    const div = document.createElement("div");
    div.className = "quiz-q";
    const opts = row.options || [];
    const qTitle = (row.q || row.question || "");
    const ans = (typeof row.answerIndex === "number") ? row.answerIndex : row.answer_index;
    div.dataset.answerIndex = (typeof ans === "number" ? String(ans) : "-1");

    let inner = `<div class="q-title" contenteditable="${isCurrentEditable()}"><strong>${idx + 1}.</strong> <span class="qt">${qTitle}</span></div>`;
    inner += `<div class="q-opts">`;
    opts.forEach((opt, j) => {
      inner += `
        <label class="q-opt">
          <!-- no 'checked' here on purpose -->
          <input type="radio" name="q${idx}" value="${j}" required />
          <span class="opt" contenteditable="${isCurrentEditable()}">${opt}</span>
        </label>`;
    });
    inner += `</div>`;
    div.innerHTML = inner;
    const del = makeDelBtn("Delete question", () => div.remove());
    div.appendChild(del);
    return div;
  }

  // Bucket CRUD
  function renderBucket(items) {
    const ul = $("#bucketList"); ul.innerHTML = "";
    if (!items.length) { $("#bucketEmpty").classList.remove("hidden"); } else { $("#bucketEmpty").classList.add("hidden"); }
    items.forEach((row) => ul.appendChild(buildBucketItem(row)));
    markDynamicSectionEditability(isCurrentEditable());
  }
  function buildBucketItem(row = {}) {
    const li = document.createElement("li"); li.className = row.done ? "done" : "";
    li.innerHTML = `<span class="btext" contenteditable="false">${row.text || ""}</span>`;
    li.addEventListener("click", (e) => {
      if (!isCurrentEditable()) return;
      if (e.target.closest(".del-btn")) return;
      li.classList.toggle("done");
    });
    const del = makeDelBtn("Delete item", () => li.remove());
    li.appendChild(del);
    return li;
  }

  // Lightbox
  const lb = $("#lightbox"), lbImg = lb.querySelector(".lightbox-img"), lbCap = lb.querySelector(".lightbox-cap");
  function openLightbox(src, cap) { lbImg.src = src; lbCap.textContent = cap || ""; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); }
  lb.querySelector(".lightbox-close").addEventListener("click", () => lb.classList.remove("open"));
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("open"); });

  // ===== Add form handlers (only visible when editable) =====
  $("#addTimeline")?.addEventListener("click", () => {
    if (!isCurrentEditable()) return;
    const date = prompt("Date (YYYY-MM-DD):") || "";
    const title = prompt("Title:") || "";
    const caption = prompt("Caption:") || "";
    const img = prompt("Image URL:") || "";
    const item = buildTimelineItem({ date, title, caption, img });
    $("#timelineList").appendChild(item);
  });

  $("#addPhoto")?.addEventListener("click", () => {
    if (!isCurrentEditable()) return;
    const img = prompt("Image URL:") || "";
    if (!img) return;
    const caption = prompt("Caption (optional):") || "";
    $("#galleryGrid").appendChild(buildGalleryItem({ img, caption }));
  });

  $("#addLetter")?.addEventListener("click", () => {
    if (!isCurrentEditable()) return;
    const title = prompt("Letter title:") || "";
    const body = prompt("Letter body (plain text or simple HTML):") || "";
    $("#lettersWrap").appendChild(buildLetter({ title, body }));
  });

  $("#addBucket")?.addEventListener("click", () => {
    if (!isCurrentEditable()) return;
    const text = prompt("Bucket item text:") || "";
    if (!text) return;
    $("#bucketList").appendChild(buildBucketItem({ text, done:false }));
  });

  $("#addQuiz")?.addEventListener("click", () => {
    if (!isCurrentEditable()) return;
    const q = prompt("Question:") || "";
    const optsCSV = prompt("Options (comma-separated):") || "";
    const options = optsCSV.split(",").map(s => s.trim()).filter(Boolean);
    if ( !q || options.length < 2 ) { alert("Need a question and at least 2 options."); return; }
    let ans = parseInt(prompt(`Correct option index (1-${options.length}):`) || "1", 10);
    if (isNaN(ans) || ans < 1 || ans > options.length) ans = 1;
    const div = buildQuizQuestion({ q, options, answerIndex: ans-1 }, $$("#quizForm .quiz-q").length);
    $("#quizForm .q").appendChild(div);
    $("#quizEmpty").classList.add("hidden");
  });

  // ===== Save: collect only CURRENT VERSION (DOM → JSON)
  function collectDataForSave() {
    const relationshipStart = $("#relationshipStart")?.value || ""; // read-only

    // Prefer localStorage for nextMeet (so both pages share immediately)
    const nextMeetLocal = localStorage.getItem(NEXT_MEET_KEY) || "";
    const nextMeetFromInput = $("#nextMeetDate")?.value || "";
    const nextMeetDate = nextMeetLocal || nextMeetFromInput;

    const timeline = $$("#timelineList .item").map(item => ({
      date: item.dataset.date || "",
      title: (item.querySelector(".title")?.textContent || "").replace(/^\s+|\s+$/g,""),
      caption: (item.querySelector(".cap")?.textContent || "").replace(/^\s+|\s+$/g,""),
      img: item.dataset.img || (item.querySelector("img")?.src || "")
    }));

    const gallery = $$("#galleryGrid > div").map(box => ({
      img: box.dataset.img || (box.querySelector("img")?.src || ""),
      caption: (box.querySelector(".gcap")?.textContent || "").replace(/^\s+|\s+$/g,"")
    }));

    const letters = $$("#lettersWrap .letter").map(card => ({
      title: (card.querySelector(".title")?.textContent || "").replace(/^\s+|\s+$/g,""),
      body: (card.querySelector(".body")?.innerHTML || "").trim()
    }));

    const quiz = $$("#quizForm .quiz-q").map((div, i) => {
      const q = (div.querySelector(".qt")?.textContent || "").trim();
      const options = Array.from(div.querySelectorAll(".q-opt .opt")).map(s => s.textContent.trim());
      const answerIndex = Number(div.dataset.answerIndex ?? 0);
      return { q, options, answerIndex };
    });

    const bucket = $$("#bucketList li").map(li => ({
      text: li.querySelector(".btext")?.textContent.trim() || "",
      done: li.classList.contains("done")
    }));

    return {
      relationshipStart,
      nextMeetDate,
      versions: {
        [currentVersion]: {
          heroHeadline: $("#heroHeadline")?.textContent.trim() || "",
          yourName: $("#yourName")?.textContent.trim() || "",
          herName: $("#herName")?.textContent.trim() || "",
          openingLine: $("#openingLine")?.textContent.trim() || "",
          surpriseMessage: $("#surpriseMsg")?.textContent.trim() || "",
          playlistEmbed: { src: $("#playlistFrame")?.src || "" },
          timeline, gallery, letters, quiz, bucket
        }
      }
    };
  }

  // ===== Save button (fix GitHub URL so it doesn't 404)
  $("#saveBtn")?.addEventListener("click", () => {
    const data = collectDataForSave();
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

    // Build GitHub repo URL from META_RAW robustly → https://github.com/<user>/<repo>
    let ghBase = "https://github.com/hunlee690/us";
    if (META_RAW && META_RAW.includes("raw.githubusercontent.com/")) {
      ghBase = META_RAW
        .replace("https://raw.githubusercontent.com/", "https://github.com/")
        // strip /main/content/site-data.json (and tolerate blob/raw if present)
        .replace(/\/(blob|raw)?\/?main\/content\/site-data\.json$/i, "")
        // also tolerate just /content/site-data.json (no branch)
        .replace(/\/content\/site-data\.json$/i, "");
    }

    const url = `${ghBase}/issues/new`
      + `?title=${encodeURIComponent(`US-SITE-DATA update (${currentVersion})`)}`
      + `&labels=${encodeURIComponent('auto-update')}`
      + `&body=${encodeURIComponent(payload)}`;

    
    window.open(url, "_blank");
  });

  // ===== Surprise modal small wiring (optional nicety)
  $("#openSurprise")?.addEventListener("click", () => $("#surprise")?.showModal());
  $("#closeSurprise")?.addEventListener("click", () => $("#surprise")?.close());

  // ===== Wire Next Meet input for immediate live countdown + sharing
  function initNextMeetInput() {
    const input = $("#nextMeetDate");
    if (!input) return;

    const applyFromInput = () => {
      if (!isCurrentEditable()) return;
      if (!input.value) {
        localStorage.removeItem(NEXT_MEET_KEY);
        startLiveCountdown(null);
        return;
      }
      const d = new Date(input.value);
      if (isNaN(d)) return;
      localStorage.setItem(NEXT_MEET_KEY, d.toISOString());
      startLiveCountdown(d);
    };

    input.addEventListener("change", applyFromInput);
    input.addEventListener("input", applyFromInput);

    // If we already have a stored date, ensure countdown starts immediately
    const iso = localStorage.getItem(NEXT_MEET_KEY);
    if (iso) startLiveCountdown(new Date(iso));
  }

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
      initNextMeetInput();
    } catch (e) {
      console.error("Failed to load & render site data:", e);
      const err = $("#error");
      if (err) err.textContent = "Could not load site data. Please refresh or try again later.";
    }
  }

  // Boot
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      loadEverything(); // render behind blur
    });
  } else {
    loadEverything();
  }
})();


