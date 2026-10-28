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
