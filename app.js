(function () {
  // ===== Passwords (hashed) =====
  // wuvu  -> pinku
  // wuvu2 -> hnnu
  const HASH_WUVU  = "e980fba218c0efa78ca42f5e845884db9e36ab73a46ed4e8c29b896e546c6c0b";
  const HASH_WUVU2 = "5d503713f5c18ef61e2a731093c0c26c5b6c65a9787eb974ea1c209d80279572";
  const AUTH_KEY = "us_site_authed"; // kept but we still show gate on load
  const VERSION_KEY = "us_site_version"; // persist last chosen version

  // ===== Scope + next-meet persistence & countdown =====
  const AUTH_SCOPE_KEY = "us_site_auth_scope"; // 'pinku' or 'hnnu'
  const NEXT_MEET_KEY  = "us_next_meet_date";
  let countdownTimer = null;

  function saveNextMeet(d) {
    if (d) localStorage.setItem(NEXT_MEET_KEY, d);
    else localStorage.removeItem(NEXT_MEET_KEY);
  }
  function loadNextMeet() { return localStorage.getItem(NEXT_MEET_KEY) || ""; }
  function clearCountdown() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } }
  function fmt2(n){ return String(n).padStart(2,"0"); }
  function startCountdown(targetISO) {
    clearCountdown();
    const el = document.getElementById("nextMeetCountdown");
    if (!targetISO) { el.textContent = "—"; return; }
    function tick() {
      const now = new Date();
      const target = new Date(targetISO);
      let diffMs = target - now;
      if (diffMs <= 0) { el.textContent = "Today! 🎉"; clearCountdown(); return; }
      const totalSec = Math.floor(diffMs / 1000);
      const days  = Math.floor(totalSec / (24*3600));
      const rem1  = totalSec % (24*3600);
      const hours = Math.floor(rem1 / 3600);
      const rem2  = rem1 % 3600;
      const mins  = Math.floor(rem2 / 60);
      const secs  = rem2 % 60;
      el.textContent = `${days}d ${fmt2(hours)}h ${fmt2(mins)}m ${fmt2(secs)}s`;
    }
    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // Gate
  const gate = $("#gate");
  const authMsg = $("#authMsg");
  function showGate(msg = "") {
    authMsg.textContent = msg || "";
    document.documentElement.classList.add("gated");
    gate.style.display = "grid";
  }
  function hideGate() {
    authMsg.textContent = "";
    document.documentElement.classList.remove("gated");
    gate.style.display = "none";
  }

  async function sha256Hex(str) {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
  }

  async function trySignin() {
    const pass = $("#gPass").value.trim();
    if (!pass) { authMsg.textContent = "Enter the password."; return; }
    authMsg.textContent = "Checking…";
    try {
      const h = await sha256Hex(pass);
      if (h === HASH_WUVU) {
        localStorage.setItem(AUTH_KEY, "1");
        localStorage.setItem(AUTH_SCOPE_KEY, "pinku");
        setVersion("pinku", true);
        hideGate(); loadEverything();
      } else if (h === HASH_WUVU2) {
        localStorage.setItem(AUTH_KEY, "1");
        localStorage.setItem(AUTH_SCOPE_KEY, "hnnu");
        setVersion("hnnu", true);
        hideGate(); loadEverything();
      } else {
        authMsg.textContent = "Wrong password.";
      }
    } catch (e) {
      authMsg.textContent = "Your browser blocked crypto. Try a modern browser.";
    }
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_SCOPE_KEY);
    showGate("");
  }

  $("#gSignin").onclick = trySignin;
  $("#signOut").onclick = signOut;

  // IMPORTANT: Always require password on first load (no auto-unlock)
  showGate("");

  // ===== Version (hnnu ↔ pinku) =====
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
  }
  setVersion(currentVersion);

  // Editability based on password scope + current version
  function applyEditability() {
    const scope = localStorage.getItem(AUTH_SCOPE_KEY);   // 'pinku' or 'hnnu'
    const editable = (scope === "pinku" && currentVersion === "pinku");
    const nextMeetInput = document.getElementById("nextMeetDate");
    if (nextMeetInput) nextMeetInput.disabled = !editable;
  }

  $("#versionToggle").addEventListener("click", () => {
    const next = currentVersion === "hnnu" ? "pinku" : "hnnu";
    const url = new URL(location.href); url.searchParams.set("v", next);
    history.replaceState({}, "", url);
    setVersion(next, true);
    applyEditability();
    loadEverything();
  });

  // ===== Data (from data.js) =====
  const SITE_DATA = window.SITE_DATA || {};

  function getProfile(v) {
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
  $("#pageTitle").textContent = "Us — Private Space 💌";
  $("#pageTitleInline").textContent = "Us — Private Space";
  document.title = $("#pageTitle").textContent;

  $("#yourName").textContent = p.your_name || "hnnu";
  // removed: $("#herName").textContent = p.her_name || "My Love";

  $("#openingLine").textContent = p.opening_line || "";

  $("#relationshipStart").value = p.relationship_start || "";
  $("#nextMeetDate").value = p.next_meet_date || "";

  $("#surpriseMsg").textContent = p.surprise_message || "";
  $("#playlistFrame").src = p.playlist_src || "";

  // default now says "Personal Title"
  $("#heroHeadline").textContent = p.hero_headline || "Personal Title";
  $("#year").textContent = new Date().getFullYear();
}

  function fmtDays(n) { return `${n} day${n === 1 ? "" : "s"}`; }
  function daysBetween(a, b) { return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24)); }
  function renderCounters(p) {
    // Static start date
    const start = new Date("2022-09-05");
    const now = new Date();
    $("#daysTogether").textContent = fmtDays(daysBetween(start, now));

    // Live countdown
    const nextIso = loadNextMeet() || p.next_meet_date || "";
    if (nextIso) startCountdown(nextIso);
    else { clearCountdown(); $("#nextMeetCountdown").textContent = "—"; }
  }

  // Lightbox
  const lb = $("#lightbox"), lbImg = lb.querySelector(".lightbox-img"), lbCap = lb.querySelector(".lightbox-cap");
  function openLightbox(src, cap) { lbImg.src = src; lbCap.textContent = cap || ""; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); }
  lb.querySelector(".lightbox-close").addEventListener("click", () => lb.classList.remove("open"));
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("open"); });

  async function renderTimeline(items) {
    const wrap = $("#timelineList"); wrap.innerHTML = "";
    if (!items.length) { $("#timelineEmpty").classList.remove("hidden"); return; }
    $("#timelineEmpty").classList.add("hidden");
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
    const wrap = $("#galleryGrid"); wrap.innerHTML = "";
    if (!items.length) { $("#galleryEmpty").classList.remove("hidden"); return; }
    $("#galleryEmpty").classList.add("hidden");
    for (const row of items) {
      const imgSrc = row.img || row.img_url || "";
      const box = document.createElement("div"); box.style.position = "relative";
      box.innerHTML = `<img src="${imgSrc}" alt="${row.caption || ""}"/>`;
      box.querySelector("img").addEventListener("click", () => openLightbox(imgSrc, row.caption));
      wrap.appendChild(box);
    }
  }

  function renderLetters(items) {
    const wrap = $("#lettersWrap"); wrap.innerHTML = "";
    if (!items.length) { $("#lettersEmpty").classList.remove("hidden"); return; }
    $("#lettersEmpty").classList.add("hidden");
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
  const form = $("#quizForm");
  const qBox = form.querySelector(".q");
  qBox.innerHTML = "";

  if (!items.length) {
    $("#quizEmpty").classList.remove("hidden");
    return;
  }
  $("#quizEmpty").classList.add("hidden");

  items.forEach((row, i) => {
    const name = `q${i}`;

    // Build option objects with correctness flags
    const correctIdx = (typeof row.answerIndex === "number") ? row.answerIndex : row.answer_index;
    const opts = (row.options || []).map((text, idx) => ({
      text,
      isCorrect: idx === correctIdx
    }));

    // Fisher–Yates shuffle
    for (let j = opts.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [opts[j], opts[k]] = [opts[k], opts[j]];
    }

    // Render question + randomized options
    const div = document.createElement("div");
    let inner = `<div class="q-title"><strong>${i + 1}.</strong> ${row.q || row.question || ""}</div>`;
    opts.forEach((opt) => {
      // store correctness in the radio value: "1" correct, "0" incorrect
      inner += `<label><input type="radio" name="${name}" value="${opt.isCorrect ? "1" : "0"}" required/> ${opt.text}</label>`;
    });
    div.innerHTML = inner;
    qBox.appendChild(div);
  });

  // Score by summing the values (1 for correct choice, 0 otherwise)
  form.onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    let score = 0;
    items.forEach((_, i) => {
      score += Number(fd.get(`q${i}`) || 0);
    });
    const total = items.length;
    const flair = score === total ? "💖 Perfect!" : score >= Math.ceil(total * 0.6) ? "✨ Nice!" : "🌱 Keep going!";
    $("#quizResult").textContent = `Score: ${score}/${total} ${flair}`;
  };
}


  function renderBucket(items) {
    const ul = $("#bucketList"); ul.innerHTML = "";
    if (!items.length) { $("#bucketEmpty").classList.remove("hidden"); return; }
    $("#bucketEmpty").classList.add("hidden");
    items.forEach((row) => {
      const li = document.createElement("li"); li.className = row.done ? "done" : "";
      li.textContent = row.text;
      ul.appendChild(li);
    });
  }

  // Surprise + smooth scroll
  const surprise = $("#surprise");
  $("#openSurprise").addEventListener("click", () => {
    if (typeof surprise.showModal === "function") surprise.showModal();
    else surprise.setAttribute("open", "");
  });
  $("#closeSurprise").addEventListener("click", () => {
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


  // Load everything (only after gate is unlocked)
  function loadEverything() {
    const p = getProfile(currentVersion);
    renderBasics(p);
    renderCounters(p);
    renderTimeline(p.timeline);
    renderGallery(p.gallery);
    renderLetters(p.letters);
    renderQuiz(p.quiz);
    renderBucket(p.bucket);
    applyEditability();
  }
  // === Next-meet handlers: save immediately and (re)start the live countdown ===
const nextMeetInput = document.getElementById("nextMeetDate");

function applyNextMeet(val) {
  // persist to browser storage
  if (val) localStorage.setItem("us_next_meet_date", val);
  else localStorage.removeItem("us_next_meet_date");

  // start/restart the ticking countdown right away
  startCountdown(val || "");
}

// Fire as soon as the user picks/changes the date
if (nextMeetInput) {
  nextMeetInput.addEventListener("input",  () => applyNextMeet(nextMeetInput.value));
  nextMeetInput.addEventListener("change", () => applyNextMeet(nextMeetInput.value));
}
})();
