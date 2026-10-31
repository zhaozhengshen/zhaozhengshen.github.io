/* Shared behaviour: language switch, header, mobile menu, section spy, lightbox, lazy media, script loader.
   Plain script (no modules, no fetch) so the site also works when opened straight from disk. */
(function () {
  'use strict';
  var html = document.documentElement;
  var params = new URLSearchParams(location.search);
  var lang = params.get('lang') === 'zh' ? 'zh' : 'en';
  var subs = [];

  var SITE = window.SITE = {
    get lang() { return lang; },
    L: function (en, zh) { return lang === 'zh' ? zh : en; },
    onLang: function (fn) { subs.push(fn); },
    fmt: function (x, d) { return Number(x).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { maximumFractionDigits: d == null ? 1 : d, minimumFractionDigits: d && d > 0 ? d : 0 }); },
    lazy: function (el, fn, margin) {
      if (!el) return;
      if (!('IntersectionObserver' in window) || params.get('eager') === '1') { fn(); return; }
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
      }, { rootMargin: margin || '400px 0px' });
      io.observe(el);
    },
    _loaded: {},
    load: function (srcs) {
      return srcs.reduce(function (p, src) {
        return p.then(function () {
          if (SITE._loaded[src]) return SITE._loaded[src];
          SITE._loaded[src] = new Promise(function (ok, bad) {
            var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = function () { bad(new Error('load ' + src)); };
            document.head.appendChild(s);
          });
          return SITE._loaded[src];
        });
      }, Promise.resolve());
    }
  };

  function applyLang(next, silent) {
    lang = next;
    html.setAttribute('data-lang', lang);
    html.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
    var t = html.getAttribute('data-title-' + lang); if (t) document.title = t;
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.set === lang)); });
    document.querySelectorAll('[data-alt-en]').forEach(function (el) { el.setAttribute('alt', el.getAttribute('data-alt-' + lang) || ''); });
    document.querySelectorAll('[data-aria-en]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('data-aria-' + lang) || ''); });
    // keep the language when moving between pages
    document.querySelectorAll('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (!h || /^(https?:|mailto:|#|javascript:)/i.test(h) || /\.pdf($|[?#])/i.test(h)) return;
      var parts = h.split('#'), base = parts[0].replace(/[?&]lang=zh/, ''), hash = parts[1] ? '#' + parts[1] : '';
      if (!base) return;
      a.setAttribute('href', base + (lang === 'zh' ? (base.indexOf('?') > -1 ? '&' : '?') + 'lang=zh' : '') + hash);
    });
    if (!silent) {
      try {
        var u = new URL(location.href);
        if (lang === 'zh') u.searchParams.set('lang', 'zh'); else u.searchParams.delete('lang');
        history.replaceState(null, '', u.toString());
      } catch (e) { /* file:// in some browsers */ }
      subs.forEach(function (fn) { try { fn(lang); } catch (e) { console.error(e); } });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    applyLang(lang, true);
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.addEventListener('click', function () { if (b.dataset.set !== lang) applyLang(b.dataset.set); });
    });

    var top = document.querySelector('.top');
    var onScroll = function () { if (top) top.classList.toggle('scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

    var menu = document.querySelector('.menu-btn'), nav = document.querySelector('.nav');
    if (menu && nav) {
      menu.addEventListener('click', function () { nav.classList.toggle('open'); });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) nav.classList.remove('open'); });
    }

    // section spy for the top nav (home) and the side table of contents (project pages)
    var spyLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a[href^="#"], .toc a[href^="#"]'));
    var targets = spyLinks.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    if (spyLinks.length && 'IntersectionObserver' in window) {
      var visible = new Map();
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { visible.set(e.target.id, e.isIntersecting ? e.boundingClientRect.top : null); });
        var best = null, bestTop = Infinity;
        visible.forEach(function (t, id) { if (t != null && Math.abs(t) < bestTop) { bestTop = Math.abs(t); best = id; } });
        if (best) spyLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + best); });
      }, { rootMargin: '-20% 0px -60% 0px' });
      targets.forEach(function (t) { if (t) io.observe(t); });
    }

    // lightbox for figures
    var lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = '<div><img alt=""><p></p></div>';
    document.body.appendChild(lb);
    lb.addEventListener('click', function () { lb.classList.remove('on'); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') lb.classList.remove('on'); });
    document.addEventListener('click', function (e) {
      var img = e.target.closest('img.zoomable'); if (!img) return;
      lb.querySelector('img').src = img.currentSrc || img.src;
      var cap = img.closest('figure'); cap = cap && cap.querySelector('figcaption');
      lb.querySelector('p').innerHTML = cap ? cap.innerHTML : '';
      lb.classList.add('on');
    });

    // videos load their file only when they come near the viewport
    document.querySelectorAll('video[data-src]').forEach(function (v) {
      SITE.lazy(v, function () { v.src = v.getAttribute('data-src'); v.removeAttribute('data-src'); if (v.hasAttribute('data-autoplay')) { v.muted = true; v.play().catch(function () {}); } }, '600px 0px');
    });
  });
})();

/* Website interaction analytics v1. Aggregate events only; no form values or URL queries. */
(function () {
  'use strict';
  function init() {
    var page = location.pathname.replace(/\/index\.html$/, '/') || '/';
    var pageName = page === '/' ? '首页' : page;
    var queue = [], retry = null, attempts = 0;
    function flush() {
      var gc = window.goatcounter;
      if (!gc || typeof gc.count !== 'function') return;
      if (retry) { clearInterval(retry); retry = null; }
      if (gc.filter && gc.filter()) { queue = []; return; }
      queue.splice(0).forEach(function (item) {
        try { gc.count(item); } catch (ignore) { /* Analytics must not interrupt the site. */ }
      });
    }
    function track(kind, label, detail) {
      queue.push({
        path: 'event/' + kind + page + (detail ? '::' + detail : ''),
        title: label + ' · ' + pageName + (detail ? ' · ' + detail : ''),
        referrer: location.origin + page,
        event: true,
        no_session: true
      });
      if (queue.length > 30) queue.shift();
      flush();
      if (queue.length && !retry) {
        attempts = 0;
        retry = setInterval(function () {
          flush();
          if (++attempts >= 30) { clearInterval(retry); retry = null; queue = []; }
        }, 500);
      }
    }
    function resource(value) {
      try { return new URL(value, location.href).pathname; }
      catch (ignore) { return ''; }
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var lang = target.closest('.lang button[data-set]');
      if (lang && lang.getAttribute('aria-pressed') !== 'true') {
        track('language-switch', '切换语言', lang.getAttribute('data-set'));
      }
      var button = target.closest('button');
      if (button && /^(pvPlay|stepPlay)$/.test(button.id)) {
        // These controls toggle playback; only the start action is counted.
        if (/play|播放/i.test(button.getAttribute('aria-label') || button.textContent || '')) {
          track('demo-play', '启动交互演示', button.id);
        }
      }
      var link = target.closest('a[href]');
      if (!link || link.hasAttribute('data-goatcounter-click')) return;
      var href = link.getAttribute('href') || '';
      if (/^mailto:/i.test(href)) { track('email-click', '点击联系邮箱'); return; }
      var url;
      try { url = new URL(href, location.href); } catch (ignore) { return; }
      if (!/^https?:$/.test(url.protocol)) return;
      var file = url.pathname;
      if (/\.pdf$/i.test(file)) {
        track(/(?:^|[_\/-])cv(?:[_\/.\-]|$)/i.test(file) ? 'cv-download' : 'paper-download',
          /(?:^|[_\/-])cv(?:[_\/.\-]|$)/i.test(file) ? '点击简历下载' : '点击论文或文档', file);
      } else if (/^(dx\.)?doi\.org$/i.test(url.hostname)) {
        track('paper-link', '打开论文 DOI', file);
      } else if (url.origin !== location.origin) {
        track('external-link', '打开外部链接', url.hostname + file);
      } else if (/\/research\/[^/]+\.html$/.test(file)) {
        track('project-open', '进入项目详情', file);
      } else if (url.hash && (file === '/research.html' || file === page)) {
        track('section-open', '查看研究章节', url.hash);
      }
    }, true);

    document.querySelectorAll('video').forEach(function (video) {
      var automatic = video.hasAttribute('autoplay') || video.hasAttribute('data-autoplay');
      var intentional = !automatic, started = false, ranges = [], previous = null, milestones = {};
      function name() {
        return resource(video.currentSrc || video.getAttribute('data-src') || video.getAttribute('src') ||
          (video.querySelector('source') && video.querySelector('source').getAttribute('src')) || '');
      }
      function start() {
        if (intentional && !started) { started = true; track('video-play', '主动播放视频', name()); }
      }
      video.addEventListener('pointerdown', function () { intentional = true; });
      video.addEventListener('keydown', function () { intentional = true; });
      video.addEventListener('play', function () { previous = video.currentTime; start(); });
      video.addEventListener('seeking', function () { previous = null; });
      video.addEventListener('timeupdate', function () {
        if (video.seeking || video.paused || document.visibilityState !== 'visible') {
          previous = video.currentTime; return;
        }
        if (!intentional) return;
        start();
        var from = previous, delta = previous == null ? 0 : video.currentTime - previous;
        previous = video.currentTime;
        if (delta > 0 && delta < 2.5) {
          ranges.push([from, video.currentTime]);
          ranges.sort(function (a, b) { return a[0] - b[0]; });
          ranges = ranges.reduce(function (merged, range) {
            var tail = merged[merged.length - 1];
            if (tail && range[0] <= tail[1] + 0.05) tail[1] = Math.max(tail[1], range[1]);
            else merged.push(range.slice());
            return merged;
          }, []);
        }
        if (!isFinite(video.duration) || video.duration <= 0) return;
        var watched = ranges.reduce(function (sum, range) { return sum + range[1] - range[0]; }, 0);
        [25, 50, 75, 90].forEach(function (percent) {
          if (!milestones[percent] && watched >= video.duration * percent / 100) {
            milestones[percent] = true;
            track('video-watch-' + percent, '视频观看达 ' + percent + '%', name());
          }
        });
      });
      video.addEventListener('ended', function () {
        if (intentional && milestones[90] && !milestones.complete) {
          milestones.complete = true;
          track('video-complete', '视频播放完成', name());
        }
      });
    });

    var depths = {};
    function depth() {
      if (document.visibilityState !== 'visible') return;
      var height = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      if (height <= window.innerHeight + 1) return;
      var progress = (window.scrollY + window.innerHeight) / height * 100;
      [50, 90].forEach(function (percent) {
        if (progress >= percent && !depths[percent]) {
          depths[percent] = true;
          track('read-depth-' + percent, '页面阅读至 ' + percent + '%');
        }
      });
    }
    window.addEventListener('scroll', depth, {passive: true});
    // A scroll is required, so a short page's initial viewport does not count as reading.
    var visibleSeconds = 0, last = Date.now(), dwell = {}, visible = document.visibilityState === 'visible';
    function accrue() {
      var now = Date.now();
      if (visible) visibleSeconds += Math.min((now - last) / 1000, 5);
      last = now;
      [30, 60].forEach(function (seconds) {
        if (visibleSeconds >= seconds && !dwell[seconds]) {
          dwell[seconds] = true;
          track('visible-time-' + seconds, '页面前台停留 ' + seconds + ' 秒');
        }
      });
    }
    var dwellTimer = setInterval(accrue, 1000);
    document.addEventListener('visibilitychange', function () {
      accrue();
      visible = document.visibilityState === 'visible';
    });
    window.addEventListener('pagehide', function () { accrue(); clearInterval(dwellTimer); flush(); });
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) { last = Date.now(); visible = document.visibilityState === 'visible'; dwellTimer = setInterval(accrue, 1000); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
