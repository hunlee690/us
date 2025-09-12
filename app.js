(function () {
  // ===== Passwords (hashed) =====
  const HASH_WUVU  = "e980fba218c0efa78ca42f5e845884db9e36ab73a46ed4e8c29b896e546c6c0b"; // pinku
  const HASH_WUVU2 = "5d503713f5c18ef61e2a731093c0c26c5b6c65a9787eb974ea1c209d80279572"; // hnnu
  const AUTH_KEY = "us_site_authed";
  const VERSION_KEY = "us_site_version";

  // ===== GitHub raw JSON (replace with your repo path) =====
  const RAW_URL = "https://raw.githubusercontent.com/YOUR-USER/YOUR-REPO/main/content/site-data.json";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // ===== Gate =====
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
        setVersion("pinku", true);
        hideGate(); loadEverything();
      } else if (h === HASH_WUVU2) {
        localStorage.setItem(AUTH_KEY, "1");
        setVersion("hnnu", true);
        hideGate(); loadEverything();
      } else {
        authMsg.textContent = "Wrong password.";
      }
    } catch (e) {
      authMsg.textContent = "Crypto not supported.";
    }
  }

  function signOut() {
    localStorage.removeItem(AUTH_KEY);
    showGate("");
  }

  $("#gSignin").onclick = trySignin;
  $("#signOut").onclick = signOut;

  // Always require login
  showGate("");

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
    $("#versionToggle .tag").textContent = v;
    if (persist) localStorage.setItem(VERSION_KEY, v);
  }
  setVersion(currentVersion);

  $("#versionToggle").addEventListener("click", () => {
    const next = currentVersion === "hnnu" ? "pinku" : "hnnu";
    const url = new URL(location.href); url.searchParams.set("v", next);
    history.replaceState({}, "", url);
    setVersion(next, true);
    loadEverything();
  });

  // ===== Load data =====
  async function fetchSiteData() {
    try {
      const res = await fetch(RAW_URL, { cache: "no-store" });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn("Fetch failed, using fallback:", e);
    }
    return window.SITE_DATA || {};
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
    $("#pageTitle").textContent = "Us — Private Space 💌";
    $("#pageTitleInline").textContent = "Us — Private Space";
    document.title = $("#pageTitle").textContent;

    $("#yourName").textContent = p.your_name || "You";
    if ($("#herName")) $("#herName").textContent = p.her_name || "My Love";
    $("#openingLine").textContent = p.opening_line || "";

    $("#relationshipStart").value = p.relationship_start || "";
    $("#nextMeetDate").value = p.next_meet_date || "";

    $("#surpriseMsg").textContent = p.surprise_message || "";
    $("#playlistFrame").src = p.playlist_src || "";

    $("#heroHeadline").textContent = p.hero_headline || "Welcome";
    $("#year").textContent = new Date().getFullYear();
  }

  function fmtDays(n) { return `${n} day${n === 1 ? "" : "s"}`; }
  function daysBetween(a, b) { return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24)); }
  function renderCounters(p) {
    const start = p.relationship_start ? new Date(p.relationship_start) : null;
    const next = p.next_meet_date ? new Date(p.next_meet_date) : null;
    const now = new Date();
    $("#daysTogether").textContent = start ? fmtDays(daysBetween(start, now)) : "—";
    const until = next ? Math.max(0, daysBetween(now, next)) : null;
    $("#nextMeetCountdown").textContent = until === null ? "—" : (until === 0 ? "Today! 🎉" : fmtDays(until));
  }

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
    const form = $("#quizForm"); const qBox = form.querySelector(".q"); qBox.innerHTML = "";
    if (!items.length) { $("#quizEmpty").classList.remove("hidden"); return; }
    $("#quizEmpty").classList.add("hidden");
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
    const ul = $("#bucketList"); ul.innerHTML = "";
    if (!items.length) { $("#bucketEmpty").classList.remove("hidden"); return; }
    $("#bucketEmpty").classList.add("hidden");
    items.forEach((row) => {
      const li = document.createElement("li"); li.className = row.done ? "done" : "";
      li.textContent = row.text;
      ul.appendChild(li);
    });
  }

  // Lightbox
  const lb = $("#lightbox"), lbImg = lb.querySelector(".lightbox-img"), lbCap = lb.querySelector(".lightbox-cap");
  function openLightbox(src, cap) { lbImg.src = src; lbCap.textContent = cap || ""; lb.classList.add("open"); lb.setAttribute("aria-hidden", "false"); }
  lb.querySelector(".lightbox-close").addEventListener("click", () => lb.classList.remove("open"));
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.classList.remove("open"); });

  // Surprise
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

  // ===== Save button: open GitHub Issue =====
  function collectDataForSave() {
    return {
      relationshipStart: $("#relationshipStart").value || "",
      nextMeetDate: $("#nextMeetDate").value || "",
      versions: {
        [currentVersion]: {
          heroHeadline: $("#heroHeadline").textContent.trim(),
          yourName: $("#yourName").textContent.trim(),
          herName: $("#herName")?.textContent.trim() || "",
          openingLine: $("#openingLine").textContent.trim(),
          surpriseMessage: $("#surpriseMsg").textContent.trim(),
          playlistEmbed: { src: $("#playlistFrame").src }
          // TODO: add collectors for timeline/gallery/etc. if you want to edit them live
        }
      }
    };
  }

  $("#saveBtn").addEventListener("click", () => {
    const data = collectDataForSave();
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
    const url = `https://github.com/YOUR-USER/YOUR-REPO/issues/new` +
                `?title=${encodeURIComponent("US-SITE-DATA update")}` +
                `&body=${encodeURIComponent(payload)}`;
    window.open(url, "_blank");
  });

  // ===== Load everything =====
  async function loadEverything() {
    const SITE_DATA = await fetchSiteData();
    const p = getProfile(currentVersion, SITE_DATA);
    renderBasics(p);
    renderCounters(p);
    renderTimeline(p.timeline);
    renderGallery(p.gallery);
    renderLetters(p.letters);
    renderQuiz(p.quiz);
    renderBucket(p.bucket);
  }

})();
