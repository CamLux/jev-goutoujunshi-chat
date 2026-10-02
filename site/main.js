/* Jev 聊天助手官网脚本
 * 中英切换 / 主题 / 导航 / 复制 / 首屏演示 / 进场动效 / Star 数
 * 文案全部在 i18n.js；这里用 t("key") 取，check-i18n.mjs 会扫描这些键。
 * 页面不依赖本脚本也能完整阅读：没有 JS 时演示停在收尾状态，内容全部可见。
 * privacy.html 也用这个脚本，但不加载 i18n.js：那里只有主题、导航和 Star 数。
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var I18N = window.JEV_I18N || null;
  var LANG_KEY = "jev-lang";
  var THEME_KEY = "jev-theme";
  var GH_KEY = "jev-gh";
  var REPO = "jev-chat/jev-chat-jarvis";
  var lang = "zh";
  var reduceMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var reduce = !!(reduceMQ && reduceMQ.matches);

  function t(key) {
    if (!I18N) return "";
    var d = I18N[lang] || I18N.zh || {};
    if (d[key] != null) return d[key];
    return (I18N.zh && I18N.zh[key] != null) ? I18N.zh[key] : "";
  }
  function track(name, data) {
    try { if (window.umami && typeof window.umami.track === "function") window.umami.track(name, data); } catch (e) {}
  }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function announce(msg) { var live = $("#live"); if (live) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 30); } }

  /* ---------- 1. 中 / EN（只在首页有字典时生效） ---------- */
  var onLang = [];
  function applyLang(next) {
    lang = next === "en" ? "en" : "zh";
    if (I18N) {
      var dict = I18N[lang] || {};
      $$("[data-i18n]").forEach(function (el) {
        var v = dict[el.getAttribute("data-i18n")];
        if (v != null && el.innerHTML !== v) el.innerHTML = v;
      });
      $$("[data-i18n-attr]").forEach(function (el) {
        el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
          var kv = pair.split(":");
          if (kv.length === 2 && dict[kv[1]] != null) el.setAttribute(kv[0], dict[kv[1]]);
        });
      });
    }
    root.setAttribute("lang", lang === "en" ? "en" : "zh-CN");
    // 英文访客点隐私政策，直接落到页底的 English summary
    $$("[data-privacy-link]").forEach(function (a) { a.setAttribute("href", lang === "en" ? "privacy.html#en-summary" : "privacy.html"); });
    onLang.forEach(function (fn) { fn(); });
  }

  // 首页 head 已决定语言；共用这次判定，确保首屏标记和正文一致。
  var initial = root.getAttribute("lang") === "en" ? "en" : "zh";
  var langBtn = $("#langBtn");
  if (langBtn && I18N) {
    langBtn.addEventListener("click", function () {
      var next = lang === "en" ? "zh" : "en";
      save(LANG_KEY, next);
      track("toggle-lang", { to: next });
      var url = new URL(next === "en" ? "en.html" : "./", location.href);
      url.search = location.search;
      url.searchParams.set("lang", next);
      url.hash = location.hash;
      location.assign(url.href);
    });
  }

  /* ---------- 2. 主题 ---------- */
  var themeBtn = $("#themeBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var set = root.getAttribute("data-theme");
      var cur = set || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      save(THEME_KEY, next);
      track("toggle-theme", { to: next });
    });
  }

  /* ---------- 3. 导航 ---------- */
  var nav = $("#nav");
  var burger = $("#burger");
  var navMenu = $("#navMenu");
  function setMenu(open) {
    if (!burger || !navMenu) return;
    navMenu.classList.toggle("open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    if (I18N) burger.setAttribute("aria-label", t(open ? "a.menuClose" : "a.menuOpen"));
  }
  onLang.push(function () { setMenu(navMenu ? navMenu.classList.contains("open") : false); });
  if (burger && navMenu) {
    burger.addEventListener("click", function () { setMenu(!navMenu.classList.contains("open")); });
    navMenu.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && navMenu.classList.contains("open")) { setMenu(false); burger.focus(); } });
    document.addEventListener("click", function (e) { if (navMenu.classList.contains("open") && nav && !nav.contains(e.target)) setMenu(false); });
  }
  if (nav) {
    var onScroll = function () { nav.classList.toggle("is-stuck", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
  // 滚动时高亮当前所在的节
  if (navMenu && "IntersectionObserver" in window) {
    var links = $$("a[href^='#']", navMenu);
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = byId[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute("aria-current"); });
          a.setAttribute("aria-current", "true");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- 4. 复制 ---------- */
  function legacyCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }
  function copyText(text, cb) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { cb(true); }, function () { cb(legacyCopy(text)); });
      return;
    }
    cb(legacyCopy(text));
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-copy-from]");
    if (!btn) return;
    var src = $(btn.getAttribute("data-copy-from"));
    if (!src) return;
    copyText(src.textContent.trim(), function (ok) {
      var label = $("[data-i18n]", btn);
      if (label) label.textContent = t(ok ? "ui.copied" : "ui.copyFail");
      btn.classList.toggle("done", ok);
      announce(t(ok ? "ui.copied" : "ui.copyFail"));
      clearTimeout(btn._t);
      btn._t = setTimeout(function () {
        if (label) label.textContent = t("ui.copy");
        btn.classList.remove("done");
      }, 1800);
    });
  });

  /* ---------- 6. 首屏演示：消息进来 → 判断亮起 → 三条候选 → 填入，发送键不动 ----------
   * 时间轴按毫秒写；每一格给演示根节点加一个 class，CSS 负责样子。
   * 没有 JS / 开了减弱动效：不加 .demo-anim，页面停在收尾状态（四步全亮）。
   * 减弱动效时点步骤按钮仍可逐步查看，只是没有过渡。 */
  var demo = $("#demo");
  var LOOP = 12600;
  var TL = [
    [350, "is-msg", 1],
    [1300, "is-alert", 1],
    [2000, "is-panel", 2],
    [2500, "is-badge", 2],
    [3000, "is-intent", 2],
    [3500, "is-bits", 2],
    [4400, "is-list is-r1", 3],
    [4850, "is-r2", 3],
    [5300, "is-r3", 3],
    [6700, "is-tap", 4],
    [7100, "is-fill", 4],
    [8200, "is-send", 4],
    [11900, "is-out", 4]
  ];
  var STEP_END = { 1: 1900, 2: 4300, 3: 6600, 4: 11800 };
  var STEP_START = { 1: 0, 2: 1950, 3: 4350, 4: 6650 };
  var TYPE_AT = 7100, TYPE_MS = 46;
  var ALL = "is-msg is-alert is-panel is-badge is-intent is-bits is-list is-r1 is-r2 is-r3 is-tap is-fill is-send is-out".split(" ");

  if (demo) {
    var toggle = $("#demoToggle");
    var toggleLabel = $("#demoToggleLabel");
    var noteText = $("#demoNoteText");
    var noteNo = $("#demoNoteNo");
    var typed = $(".ph-typed", demo);
    var stepBtns = $$("[data-go]", demo);
    var elapsed = STEP_END[4];
    var playing = false;
    var userPaused = false;
    var visible = true;
    var timer = null;
    var last = 0;
    var curStep = 4;

    var stage = $(".demo-stage", demo);
    var note = $("#demoNote");
    var TARGET = { 1: ".ph-ball", 2: ".jp-word", 3: ".jp-r1", 4: ".ph-send" };
    var offsetIn = function (el, anc) {
      var x = 0, y = 0;
      while (el && el !== anc) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      return { x: x, y: y };
    };
    // 宽屏时批注在手机右边：量出目标元素的位置，让引线正好落在它旁边（不受进场动画的 transform 影响）
    var placeNote = function () {
      if (!stage || !note) return;
      if (window.getComputedStyle(note).position !== "absolute") return;
      var el = $(TARGET[curStep], demo);
      if (!el) return;
      var o = offsetIn(el, stage);
      var ty = curStep === 3 ? o.y + 16 : o.y + el.offsetHeight / 2;
      var tx = o.x + el.offsetWidth + (curStep === 1 || curStep === 4 ? 9 : 7);
      var nh = note.offsetHeight, sh = stage.offsetHeight;
      var ny = Math.max(0, Math.min(ty - 26, sh - nh));
      note.style.setProperty("--ny", ny + "px");
      note.style.setProperty("--ly", Math.round(ty - ny) + "px");
      note.style.setProperty("--lw", Math.max(10, Math.round(note.offsetLeft - tx)) + "px");
    };
    window.addEventListener("resize", function () { placeNote(); });

    var stepOf = function (ms) {
      var s = 1;
      for (var i = 0; i < TL.length; i++) if (TL[i][0] <= ms) s = TL[i][2];
      return ms >= STEP_START[4] ? 4 : ms >= STEP_START[3] ? Math.max(s, 3) : ms >= STEP_START[2] ? Math.max(s, 2) : s;
    };

    var render = function () {
      var on = {};
      for (var i = 0; i < TL.length; i++) {
        if (TL[i][0] <= elapsed) TL[i][1].split(" ").forEach(function (c) { on[c] = true; });
      }
      ALL.forEach(function (c) { demo.classList.toggle(c, !!on[c]); });
      // 输入框逐字出现
      if (typed) {
        var full = t("demo.r1");
        var chars = Array.from ? Array.from(full) : full.split("");
        var n = elapsed < TYPE_AT ? 0 : Math.min(chars.length, Math.floor((elapsed - TYPE_AT) / TYPE_MS) + 1);
        var s = chars.slice(0, n).join("");
        if (typed.textContent !== s) typed.textContent = s;
        demo.classList.toggle("is-typing", n > 0 && n < chars.length);
      }
      var step = stepOf(elapsed);
      if (step !== curStep || !noteText.getAttribute("data-rendered-lang") || noteText.getAttribute("data-rendered-lang") !== lang) {
        curStep = step;
        demo.setAttribute("data-step", String(step));
        noteText.innerHTML = t(["demo.n1", "demo.n2", "demo.n3", "demo.n4"][step - 1]);
        noteText.setAttribute("data-rendered-lang", lang);
        if (noteNo) noteNo.textContent = "0" + step;
        placeNote();
      }
      stepBtns.forEach(function (b) {
        var k = +b.getAttribute("data-go");
        var p = k < step ? 1 : k > step ? 0 : Math.max(0, Math.min(1, (elapsed - STEP_START[k]) / (STEP_END[k] - STEP_START[k])));
        b.style.setProperty("--p", p.toFixed(3));
        if (k === step) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
    };

    var tick = function (now) {
      if (!playing) return;
      var dt = last ? Math.min(now - last, 100) : 16;
      last = now;
      elapsed += dt;
      if (elapsed >= LOOP) elapsed = 0;
      render();
      timer = requestAnimationFrame(tick);
    };
    var sync = function () {
      var should = !reduce && !userPaused && visible && !document.hidden;
      if (should && !playing) { playing = true; last = 0; timer = requestAnimationFrame(tick); }
      else if (!should && playing) { playing = false; if (timer) cancelAnimationFrame(timer); }
    };
    var setToggle = function () {
      if (!toggle) return;
      toggle.classList.toggle("is-paused", userPaused);
      toggle.setAttribute("aria-pressed", userPaused ? "true" : "false");
      if (toggleLabel) toggleLabel.textContent = t(userPaused ? "demo.play" : "demo.pause");
    };

    if (!reduce) {
      demo.classList.add("demo-anim");
      elapsed = 0;
      if (toggle) {
        toggle.hidden = false;
        toggle.addEventListener("click", function () {
          userPaused = !userPaused;
          setToggle();
          track("demo-control", { action: userPaused ? "pause" : "play" });
          sync();
        });
      }
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { visible = en.isIntersecting; });
          sync();
        }, { threshold: 0.2 }).observe(demo);
      }
      document.addEventListener("visibilitychange", sync);
    } else {
      demo.classList.add("demo-static");
    }

    // 点某一步：停在这一步的完整状态
    stepBtns.forEach(function (b) {
      b.addEventListener("click", function () {
        var k = +b.getAttribute("data-go");
        if (!demo.classList.contains("demo-anim")) demo.classList.add("demo-anim", "demo-instant");
        elapsed = STEP_END[k];
        userPaused = true;
        setToggle();
        sync();
        render();
        track("demo-control", { action: "step-" + k });
      });
    });

    onLang.push(function () { noteText.removeAttribute("data-rendered-lang"); setToggle(); render(); });
    render();
    sync();
  }

  /* ---------- 7. 进场动效：默认可见；只有 JS 在且没开减弱动效时，视口下方的内容才淡入 ---------- */
  var rvs = $$(".rv");
  if (!reduce && "IntersectionObserver" in window && rvs.length) {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); rio.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    rvs.forEach(function (el) {
      if (el.getBoundingClientRect().top < vh * 0.94) el.classList.add("in");
      else rio.observe(el);
    });
    root.classList.add("anim");
    window.addEventListener("beforeprint", function () { rvs.forEach(function (el) { el.classList.add("in"); }); });
  } else {
    rvs.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---------- 8. Star 数：api.github.com 实时拉，缓存 30 分钟；拉不到就保留页面里的静态值 ---------- */
  function paint(n) {
    if (typeof n !== "number") return;
    var txt = n >= 1000 ? (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
    $$("[data-jev-stars]").forEach(function (el) { el.textContent = txt; });
  }
  (function () {
    if (!$("[data-jev-stars]")) return;
    var cached = null;
    try { cached = JSON.parse(load(GH_KEY) || "null"); } catch (e) {}
    if (cached && Date.now() - cached.t < 30 * 60 * 1000) { paint(cached.stars); return; }
    if (!window.fetch) return;
    fetch("https://api.github.com/repos/" + REPO, { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d.stargazers_count !== "number") return;
        paint(d.stargazers_count);
        save(GH_KEY, JSON.stringify({ t: Date.now(), stars: d.stargazers_count }));
      })
      .catch(function () {});
  })();

  /* ---------- 启动 ---------- */
  if (initial === "en") applyLang("en");
  else onLang.forEach(function (fn) { fn(); });
  root.classList.remove("i18n-pending");
})();
