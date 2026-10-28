/* ME5402 Part 2 page: kinematics explorer, open-loop dynamics replay, live PID simulator, gain/payload sweeps.
   All motion comes from window.LimbSim (src/limb_engine.js, a checked port of the coursework Python model). */
(function () {
  'use strict';
  var SITE = window.SITE, L = SITE.L, S = window.LimbSim;
  var $ = function (s) { return document.querySelector(s); };
  var A = document.documentElement.getAttribute('data-assets') || 'assets/';
  var P = S.robot(), DEG = 180 / Math.PI;
  var JC = ['#2c5be0', '#e08a0b', '#0f9d98'];  // joint 1..3
  var INK = '#0f172a', MUTED = '#94a3b8', AMBER = '#e08a0b', BLUE = '#2c5be0', TEAL = '#0f9d98', ROSE = '#c2410c';
  var FONT = 'Inter, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  var TIP = { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: INK, fontSize: 12 }, extraCssText: 'box-shadow:0 10px 30px rgba(15,23,42,.14);border-radius:10px;padding:8px 12px' };
  var AX = { axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef2f6' } }, nameTextStyle: { color: '#94a3b8', fontSize: 11 } };
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
  var charts = [];
  function merge() { var o = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) o[k] = arguments[i][k]; return o; }
  function f(v, d) { return SITE.fmt(v, d == null ? 2 : d); }
  function echartsReady() { return SITE.load([A + 'portal-echarts.js']); }
  function chart(el) { var c = window.echarts.init(el); charts.push(c); return c; }
  window.addEventListener('resize', function () { charts.forEach(function (c) { c.resize(); }); });
  function seg(el, fn) {
    if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      fn(b.dataset.v);
    });
  }
  function segSet(el, v) { el.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.dataset.v === v); }); }

  // ---------------------------------------------------------------- canvas helpers
  function canvas(cv, draw) {
    var st = { w: 0, h: 0, ctx: cv.getContext('2d') };
    function fit() {
      var r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      if (!r.width) return;
      st.w = r.width; st.h = r.height;
      cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
      st.ctx.setTransform(d, 0, 0, d, 0, 0);
      draw();
    }
    // the first fit is asynchronous so callers can keep the returned state before draw() runs
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(cv);
    else { window.addEventListener('resize', fit); setTimeout(fit, 0); }
    return st;
  }
  // world box -> screen transform that keeps the aspect ratio
  function view(st, b, pad) {
    pad = pad == null ? 18 : pad;
    var sx = (st.w - 2 * pad) / (b[1] - b[0]), sy = (st.h - 2 * pad) / (b[3] - b[2]), s = Math.min(sx, sy);
    var ox = (st.w - s * (b[1] - b[0])) / 2, oy = (st.h - s * (b[3] - b[2])) / 2;
    return { s: s, X: function (x) { return ox + (x - b[0]) * s; }, Y: function (y) { return st.h - oy - (y - b[2]) * s; },
             inv: function (px, py) { return [(px - ox) / s + b[0], (st.h - oy - py) / s + b[2]]; } };
  }
  function grid(ctx, T, b, step) {
    ctx.save(); ctx.strokeStyle = '#e6ebf2'; ctx.lineWidth = 1; ctx.beginPath();
    for (var x = Math.ceil(b[0] / step) * step; x <= b[1] + 1e-9; x += step) { ctx.moveTo(T.X(x), T.Y(b[2])); ctx.lineTo(T.X(x), T.Y(b[3])); }
    for (var y = Math.ceil(b[2] / step) * step; y <= b[3] + 1e-9; y += step) { ctx.moveTo(T.X(b[0]), T.Y(y)); ctx.lineTo(T.X(b[1]), T.Y(y)); }
    ctx.stroke(); ctx.restore();
  }
  function base(ctx, T) {
    ctx.save(); ctx.fillStyle = '#dbe3ee';
    ctx.fillRect(T.X(-0.05), T.Y(0), 0.1 * T.s, 0.045 * T.s);
    ctx.strokeStyle = '#b8c3d3'; ctx.lineWidth = 1;
    for (var i = 0; i < 6; i++) { var x = -0.05 + i * 0.02; ctx.beginPath(); ctx.moveTo(T.X(x), T.Y(-0.045)); ctx.lineTo(T.X(x + 0.012), T.Y(-0.033)); ctx.stroke(); }
    ctx.restore();
  }
  function limb(ctx, T, q, o) {
    o = o || {};
    var pts = S.joints(q, P), w = o.width || Math.max(5, T.s * 0.022);
    ctx.save(); ctx.globalAlpha = o.alpha == null ? 1 : o.alpha;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color || INK; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(T.X(pts[0][0]), T.Y(pts[0][1]));
    for (var i = 1; i < 4; i++) ctx.lineTo(T.X(pts[i][0]), T.Y(pts[i][1]));
    ctx.stroke();
    if (!o.ghost) {
      for (i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(T.X(pts[i][0]), T.Y(pts[i][1]), w * 0.62, 0, 7);
        ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = o.color || INK; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(T.X(pts[3][0]), T.Y(pts[3][1]), o.axle || w * 0.75, 0, 7); ctx.fillStyle = o.axleColor || AMBER; ctx.fill();
    }
    ctx.restore();
    return pts;
  }
  function path(ctx, T, xs, ys, from, to, color, width, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width || 2; if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (var k = from; k <= to; k++) { if (k === from) ctx.moveTo(T.X(xs(k)), T.Y(ys(k))); else ctx.lineTo(T.X(xs(k)), T.Y(ys(k))); }
    ctx.stroke(); ctx.restore();
  }
  function label(ctx, text, x, y, o) {
    o = o || {};
    ctx.save(); ctx.font = (o.weight || '500') + ' ' + (o.size || 12) + 'px ' + FONT; ctx.fillStyle = o.color || '#64748b';
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic'; ctx.fillText(text, x, y); ctx.restore();
  }
  function player(o) {  // o: T (s of data), duration (s of playback), range, btn, timeEl, onTime, loop
    var st = { t: 0, playing: false, last: 0 };
    function set(t) { st.t = Math.max(0, Math.min(o.T, t)); o.range.value = Math.round(st.t / o.T * 1000); o.onTime(st.t); }
    function tick(now) {
      if (!st.playing) return;
      var dt = (now - st.last) / 1000; st.last = now;
      var nt = st.t + o.T * dt / o.duration;
      if (nt >= o.T) { if (o.loop) nt = 0; else { set(o.T); stop(); return; } }
      set(nt); requestAnimationFrame(tick);
    }
    function play() { if (st.t >= o.T) st.t = 0; st.playing = true; st.last = performance.now(); o.btn.innerHTML = PAUSE; requestAnimationFrame(tick); }
    function stop() { st.playing = false; o.btn.innerHTML = PLAY; }
    o.btn.addEventListener('click', function () { st.playing ? stop() : play(); });
    o.range.addEventListener('input', function () { stop(); set(o.range.value / 1000 * o.T); });
    return { st: st, set: set, play: play, stop: stop };
  }
  function sliderOut(id, fmt) {
    var el = $('#' + id), out = $('#' + id + 'V');
    var upd = function () { if (out) out.textContent = fmt(+el.value); };
    el.addEventListener('input', upd); upd();
    return el;
  }

  // ---------------------------------------------------------------- 1. kinematics explorer
  function kinematics() {
    var cv = $('#kinCv'); if (!cv) return;
    var q = [+$('#kq1').value / DEG, +$('#kq2').value / DEG, +$('#kq3').value / DEG], elbow = 'down', msg = '';
    var B = [-0.62, 0.78, -0.62, 0.72], heat = null, heatKey = '';
    var st = canvas(cv, draw);
    var sl = ['kq1', 'kq2', 'kq3'].map(function (id) { return sliderOut(id, function (v) { return Math.round(v) + '°'; }); });
    var phiS = sliderOut('kphi', function (v) { return Math.round(v) + '°'; });
    function wrap(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
    function syncSliders() {
      for (var i = 0; i < 3; i++) { sl[i].value = Math.round(wrap(q[i]) * DEG); sl[i].dispatchEvent(new Event('input')); }
      phiS.value = Math.round(wrap(q[0] + q[1] + q[2]) * DEG); $('#kphiV').textContent = phiS.value + '°';
      elbow = Math.sin(q[1]) >= 0 ? 'up' : 'down'; segSet($('#kinElbow'), elbow);
    }
    function solve(x, y, phi) {
      var s = S.ikBoth(x, y, phi, P);
      if (!s) { msg = L('Out of reach at this orientation', '该姿态下不可达'); return false; }
      q = s[elbow].slice(); msg = ''; return true;
    }
    sl.forEach(function (el, i) {
      el.addEventListener('input', function (e) { if (!e.isTrusted) return; q[i] = +el.value / DEG; msg = ''; syncSliders(); draw(); });
    });
    phiS.addEventListener('input', function (e) {
      if (!e.isTrusted) return;
      var p = S.fk(q, P); if (solve(p[0], p[1], +phiS.value / DEG)) syncSliders(); draw();
    });
    seg($('#kinElbow'), function (v) { elbow = v; var p = S.fk(q, P); solve(p[0], p[1], p[2]); syncSliders(); draw(); });

    var dragging = false;
    function pick(e) {
      var r = cv.getBoundingClientRect(), T = view(st, B), w = T.inv(e.clientX - r.left, e.clientY - r.top);
      if (solve(w[0], w[1], q[0] + q[1] + q[2])) syncSliders();
      draw();
    }
    cv.addEventListener('pointerdown', function (e) {
      var r = cv.getBoundingClientRect(), T = view(st, B), p = S.fk(q, P);
      var d = Math.hypot(e.clientX - r.left - T.X(p[0]), e.clientY - r.top - T.Y(p[1]));
      if (d > 40) return;
      dragging = true; cv.setPointerCapture(e.pointerId); pick(e);
    });
    cv.addEventListener('pointermove', function (e) {
      if (dragging) { pick(e); return; }
      var r = cv.getBoundingClientRect(), T = view(st, B), p = S.fk(q, P);
      cv.style.cursor = Math.hypot(e.clientX - r.left - T.X(p[0]), e.clientY - r.top - T.Y(p[1])) < 40 ? 'grab' : 'default';
    });
    cv.addEventListener('pointerup', function () { dragging = false; });

    function heatmap(T, phi) {  // |det J| over axle positions reachable at orientation phi, low-res then scaled
      var key = st.w + 'x' + st.h + ':' + phi.toFixed(3);
      if (key === heatKey) return heat;
      var W = Math.ceil(st.w / 3), H = Math.ceil(st.h / 3), off = document.createElement('canvas');
      off.width = W; off.height = H;
      var c = off.getContext('2d'), img = c.createImageData(W, H), cx = P.l3 * Math.cos(phi), cy = P.l3 * Math.sin(phi), mx = P.l1 * P.l2;
      for (var j = 0; j < H; j++) for (var i = 0; i < W; i++) {
        var w = T.inv(i * 3 + 1.5, j * 3 + 1.5), rx = w[0] - cx, ry = w[1] - cy, r2 = rx * rx + ry * ry;
        var c2 = (r2 - P.l1 * P.l1 - P.l2 * P.l2) / (2 * P.l1 * P.l2), k = 4 * (j * W + i);
        if (c2 < -1 || c2 > 1) continue;
        var v = Math.sqrt(1 - c2 * c2);  // |sin q2| = |det J| / (l1 l2)
        img.data[k] = 44; img.data[k + 1] = 91; img.data[k + 2] = 224; img.data[k + 3] = Math.round(25 + 120 * v);
      }
      c.putImageData(img, 0, 0); heat = off; heatKey = key;
      return heat;
    }
    function draw() {
      if (!st.w) return;
      var ctx = st.ctx, T = view(st, B), phi = q[0] + q[1] + q[2];
      ctx.clearRect(0, 0, st.w, st.h);
      grid(ctx, T, B, 0.1);
      ctx.drawImage(heatmap(T, phi), 0, 0, st.w, st.h);
      // singular circles of the wrist (links 1-2 folded / stretched)
      var cx = P.l3 * Math.cos(phi), cy = P.l3 * Math.sin(phi);
      ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(44,91,224,.65)'; ctx.lineWidth = 1.2;
      [P.l2 - P.l1, P.l1 + P.l2].forEach(function (r) { ctx.beginPath(); ctx.arc(T.X(cx), T.Y(cy), r * T.s, 0, 7); ctx.stroke(); });
      ctx.restore();
      base(ctx, T);
      var pts = limb(ctx, T, q), J = S.jacobian(q, P);
      // velocity manipulability ellipse of the position rows: J_v J_v^T
      var a = 0, b = 0, d = 0, i;
      for (i = 0; i < 3; i++) { a += J[0][i] * J[0][i]; b += J[0][i] * J[1][i]; d += J[1][i] * J[1][i]; }
      var tr = (a + d) / 2, det = Math.sqrt(Math.max(0, tr * tr - (a * d - b * b))), l1 = tr + det, l2 = Math.max(0, tr - det);
      var ang = 0.5 * Math.atan2(2 * b, a - d), k = 0.3;
      ctx.save(); ctx.translate(T.X(pts[3][0]), T.Y(pts[3][1])); ctx.rotate(-ang);
      ctx.beginPath(); ctx.ellipse(0, 0, Math.sqrt(l1) * k * T.s, Math.max(1, Math.sqrt(l2) * k * T.s), 0, 0, 7);
      ctx.fillStyle = 'rgba(224,138,11,.12)'; ctx.fill(); ctx.strokeStyle = AMBER; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
      limb(ctx, T, q);
      label(ctx, L('shading: |det J| at φ = ', '底色：φ = ') + (Math.round(wrap(phi) * DEG) + 0) + '°' + L('', ' 时的 |det J|'), 12, st.h - 12);
      label(ctx, L('ellipse: EE velocity for unit joint speeds (× 0.3 s)', '椭圆：单位关节速度对应的末端速度（× 0.3 s）'), 12, st.h - 30);
      if (msg) label(ctx, msg, st.w / 2, 26, { align: 'center', color: ROSE, weight: '650', size: 13 });
      info(J);
    }
    function info(J) {
      var p = S.fk(q, P), detJ = J[0][0] * (J[1][1] * J[2][2] - J[1][2] * J[2][1]) - J[0][1] * (J[1][0] * J[2][2] - J[1][2] * J[2][0]) + J[0][2] * (J[1][0] * J[2][1] - J[1][1] * J[2][0]);
      var G = S.gravity(q, P), sing = Math.abs(Math.sin(q[1])) < 0.08;
      $('#kinInfo').innerHTML = '<dl class="kv">' +
        '<dt>' + L('Axle position', '轮轴位置') + '</dt><dd class="mono">x = ' + f(p[0], 3) + ' m, y = ' + f(p[1], 3) + ' m</dd>' +
        '<dt>' + L('Orientation', '姿态') + '</dt><dd class="mono">φ = ' + f(Math.round(wrap(p[2]) * DEG * 10) / 10 + 0, 1) + '°</dd>' +
        '<dt>det J</dt><dd class="mono"' + (sing ? ' style="color:' + ROSE + '"' : '') + '>' + f(detJ, 4) + (sing ? ' · ' + L('near singular', '接近奇异') : '') + '</dd>' +
        '<dt>' + L('IK branch', '逆解分支') + '</dt><dd>' + (Math.sin(q[1]) >= 0 ? L('elbow up', '肘上') : L('elbow down', '肘下')) + '</dd>' +
        '<dt>' + L('Gravity torque', '重力力矩') + '</dt><dd class="mono">[' + G.map(function (v) { return f(v, 2); }).join(', ') + '] N·m</dd></dl>';
    }
    syncSliders(); draw();
    SITE.onLang(function () { heatKey = ''; draw(); });
  }

  // ---------------------------------------------------------------- 2. open-loop take-off / aerial
  function openLoop() {
    var cv = $('#olCv'); if (!cv) return;
    var R = { takeoff: S.openLoop('takeoff'), aerial: S.openLoop('aerial') }, n = R.takeoff.n, dt = R.takeoff.dt, T0 = (n - 1) * dt;
    var B = [-0.22, 0.56, -0.08, 0.34], ch = null, v = 'q', k = 0, lastChart = 0;
    var st = canvas(cv, draw);
    var ee = {};
    ['takeoff', 'aerial'].forEach(function (ph) {
      var xs = [], ys = [];
      for (var i = 0; i < n; i++) { var p = S.fk([R[ph].q[3 * i], R[ph].q[3 * i + 1], R[ph].q[3 * i + 2]], P); xs.push(p[0]); ys.push(p[1]); }
      ee[ph] = { x: xs, y: ys };
    });
    function qAt(ph, i) { return [R[ph].q[3 * i], R[ph].q[3 * i + 1], R[ph].q[3 * i + 2]]; }
    function draw() {
      if (!st.w) return;
      var ctx = st.ctx, T = view(st, B);
      ctx.clearRect(0, 0, st.w, st.h); grid(ctx, T, B, 0.1); base(ctx, T);
      limb(ctx, T, qAt('takeoff', 0), { color: '#cbd5e1', ghost: true });
      path(ctx, T, function (i) { return ee.aerial.x[i]; }, function (i) { return ee.aerial.y[i]; }, 0, k, 'rgba(44,91,224,.55)', 2, [5, 4]);
      path(ctx, T, function (i) { return ee.takeoff.x[i]; }, function (i) { return ee.takeoff.y[i]; }, 0, k, 'rgba(224,138,11,.65)', 2);
      limb(ctx, T, qAt('aerial', k), { color: BLUE, axleColor: BLUE, alpha: 0.9 });
      limb(ctx, T, qAt('takeoff', k), { color: AMBER, axleColor: AMBER });
      label(ctx, 't = ' + f(k * dt, 3) + ' s  (' + L('10× slower', '10 倍慢放') + ')', 14, 24, { color: INK, weight: '650', size: 13 });
    }
    var pl = player({ T: T0, duration: T0 * 10, range: $('#olT'), btn: $('#olPlay'), loop: true, onTime: function (t) {
      k = Math.min(n - 1, Math.round(t / dt)); $('#olTime').textContent = f(t, 3) + ' / ' + f(T0, 1) + ' s'; draw();
      var now = performance.now(); if (ch && now - lastChart > 90) { lastChart = now; cursor(); }
    } });
    function series() {
      var unit = { q: 'rad', dq: 'rad/s', ddq: 'rad/s²', tau: 'N·m' }[v], out = [];
      ['takeoff', 'aerial'].forEach(function (ph) {
        for (var j = 0; j < 3; j++) {
          var d = [];
          for (var i = 0; i < n; i += 2) d.push([+(i * dt).toFixed(3), R[ph][v][3 * i + j]]);
          out.push({ id: ph + j, name: L('joint ', '关节 ') + (j + 1) + ' · ' + (ph === 'takeoff' ? L('take-off', '起跳') : L('aerial', '腾空')), type: 'line', showSymbol: false, data: d,
                     lineStyle: { color: JC[j], width: ph === 'takeoff' ? 2 : 1.6, type: ph === 'takeoff' ? 'solid' : 'dashed' }, itemStyle: { color: JC[j] } });
        }
      });
      out[0].markLine = { silent: true, symbol: 'none', animation: false, lineStyle: { color: AMBER, width: 1.2, type: 'solid' }, label: { show: false }, data: [{ xAxis: k * dt }] };
      return { unit: unit, s: out };
    }
    function drawChart() {
      var sr = series();
      ch.setOption({ animation: false, textStyle: { fontFamily: FONT }, tooltip: merge(TIP, { valueFormatter: function (x) { return f(x, 3); } }), grid: { left: 54, right: 16, top: 16, bottom: 34 },
        legend: { show: false }, xAxis: merge(AX, { type: 'value', name: 's', min: 0, max: T0 }), yAxis: merge(AX, { type: 'value', name: sr.unit, scale: true }), series: sr.s }, true);
    }
    function cursor() { ch.setOption({ series: [{ id: 'takeoff0', markLine: { data: [{ xAxis: k * dt }] } }] }); }
    seg($('#olVar'), function (x) { v = x; if (ch) drawChart(); });
    // peak speed table
    function table() {
      var row = function (ph, nm) {
        var c = [0, 1, 2].map(function (j) { var m = 0; for (var i = 0; i < n; i++) m = Math.max(m, Math.abs(R[ph].dq[3 * i + j])); return '<td class="num">' + f(m, 2) + '</td>'; }).join('');
        return '<tr><td>' + nm + '</td>' + c + '</tr>';
      };
      $('#olTable').innerHTML = '<tr><th>' + L('Phase', '阶段') + '</th><th class="num">q̇₁</th><th class="num">q̇₂</th><th class="num">q̇₃ (rad/s)</th></tr>' +
        row('takeoff', L('Take-off', '起跳')) + row('aerial', L('Aerial', '腾空'));
    }
    table(); pl.set(0);
    SITE.lazy(cv, function () { pl.play(); });
    SITE.lazy($('#olChart'), function () { echartsReady().then(function () { ch = chart($('#olChart')); drawChart(); }); });
    SITE.onLang(function () { table(); draw(); if (ch) drawChart(); });
  }

  // ---------------------------------------------------------------- 3. live PID simulator
  function pid() {
    var cv = $('#pidCv'); if (!cv) return;
    var PRE = {
      B: { base: 'B', kp: 1, ki: 1, kd: 1, lim: 11, m3: 1, rad: 30, frq: 0.2, gc: true },
      A: { base: 'A', kp: 1, ki: 1, kd: 1, lim: 11, m3: 1, rad: 30, frq: 0.2, gc: true },
      pure: { base: 'B', kp: 1, ki: 1, kd: 1, lim: 10, m3: 1, rad: 30, frq: 0.2, gc: false },
      heavy: { base: 'B', kp: 1, ki: 1, kd: 1, lim: 11, m3: 1.15, rad: 30, frq: 0.2, gc: true }
    };
    var ids = { kp: 'kpS', ki: 'kiS', kd: 'kdS', lim: 'limS', m3: 'm3S', rad: 'radS', frq: 'frqS' };
    var fmts = { kp: function (v) { return '×' + v.toFixed(2); }, ki: function (v) { return '×' + v.toFixed(1); }, kd: function (v) { return '×' + v.toFixed(2); },
                 lim: function (v) { return v.toFixed(1); }, m3: function (v) { return '×' + v.toFixed(2); }, rad: function (v) { return v.toFixed(0); }, frq: function (v) { return v.toFixed(2); } };
    var el = {}; Object.keys(ids).forEach(function (k) { el[k] = sliderOut(ids[k], fmts[k]); });
    var gc = $('#gcOn'), baseGain = 'B', ran = false, res = null, ref = null, err = null, errRef = null, k = 0, chE = null, chT = null, lastChart = 0, timer = 0;
    var st = canvas(cv, draw);

    function opts() {
      var g = S.GAINS[baseGain], sc = function (a, s) { return a.map(function (v) { return v * s; }); };
      return { gains: { Kp: sc(g.Kp, +el.kp.value), Ki: sc(g.Ki, +el.ki.value), Kd: sc(g.Kd, +el.kd.value) }, gravityComp: gc.checked, torqueLimit: +el.lim.value,
               plant: { m3: S.ROBOT.m3 * +el.m3.value }, traj: { radius: +el.rad.value / 1000, omega: 2 * Math.PI * +el.frq.value } };
    }
    function errors(r) { var e = new Float64Array(r.n); for (var i = 0; i < r.n; i++) e[i] = Math.hypot(r.xy[2 * i] - r.xyd[2 * i], r.xy[2 * i + 1] - r.xyd[2 * i + 1]) * 1000; return e; }
    function run() {
      var o = opts();
      var g = o.gains, r1 = function (a) { return '[' + a.map(function (v) { return +v.toFixed(2); }).join(', ') + ']'; };
      $('#pidGains').innerHTML = 'Kp = ' + r1(g.Kp) + '<br>Ki = ' + r1(g.Ki) + '<br>Kd = ' + r1(g.Kd);
      try { res = S.track(o); err = errors(res); }
      catch (ex) { res = null; err = null; }
      ran = true;
      stats(); draw(); drawCharts();
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(run, 60); }
    function apply(name) {
      var p = PRE[name]; baseGain = p.base;
      Object.keys(ids).forEach(function (k) { el[k].value = p[k]; el[k].dispatchEvent(new Event('input')); });
      gc.checked = p.gc; run(); pl.set(0); pl.play();
    }
    Object.keys(ids).forEach(function (k) { el[k].addEventListener('input', function (e) { if (e.isTrusted) { segSet($('#pidPreset'), ''); schedule(); } }); });
    gc.addEventListener('change', function () { segSet($('#pidPreset'), ''); schedule(); });
    seg($('#pidPreset'), apply);

    function stats() {
      var box = $('#pidStats');
      if (!res) { box.innerHTML = '<div class="stat bad" style="grid-column:1/-1"><small>' + L('Simulation', '仿真') + '</small><b>—</b><span>' + L('The circle leaves the reachable workspace at φ = 0.', '圆轨迹超出 φ = 0 时的可达空间。') + '</span></div>'; return; }
      var m = res.metrics, sat = Math.max.apply(null, m.saturation) * 100, div = res.n < 10001;
      var cell = function (cls, sm, b, unit, sp) { return '<div class="stat' + cls + '"><small>' + sm + '</small><b>' + b + '<em>' + unit + '</em></b><span>' + sp + '</span></div>'; };
      box.innerHTML = div ? '<div class="stat bad" style="grid-column:1/-1"><small>' + L('Simulation', '仿真') + '</small><b>' + L('diverged', '发散') + '</b><span>' + L('stopped at t = ', '停止于 t = ') + f(res.n * res.dt, 2) + ' s</span></div>' :
        cell(m.eeErrMean * 1000 > 10 ? ' bad' : ' hl', L('Mean EE error', '末端平均误差'), f(m.eeErrMean * 1000, m.eeErrMean > 0.01 ? 0 : 2), 'mm', L('case B: 1.01 mm', '方案 B：1.01 mm')) +
        cell(m.eeErrMax * 1000 > 20 ? ' bad' : '', L('Max EE error', '末端最大误差'), f(m.eeErrMax * 1000, m.eeErrMax > 0.01 ? 0 : 2), 'mm', L('case B: 4.06 mm', '方案 B：4.06 mm')) +
        cell('', L('Peak |τ₂|', '关节 2 峰值力矩'), f(m.torqueMax[1], 2), 'N·m', L('limit ', '限幅 ') + f(res.torqueLimit, 1) + ' N·m') +
        cell(sat > 1 ? ' bad' : '', L('Saturated', '饱和时间'), f(sat, sat < 10 ? 1 : 0), '%', L('of the run, worst joint', '占全程，取最差关节'));
    }
    var B = [-0.2, 0.52, -0.24, 0.26], cornerKey = '', cornerAt = null;
    function corner(T, sz) {  // the canvas corner the limb and its path cover least over the whole run
      var key = st.w + 'x' + st.h + ':' + (res && res.metrics.eeErrMean);
      if (key === cornerKey) return cornerAt;
      var m = 12, cs = [[st.w - sz - m, st.h - sz - m], [st.w - sz - m, m], [m, m], [m, st.h - sz - m]], hits = [0, 0, 0, 0], i, j, c;
      var hit = function (px, py) { for (c = 0; c < 4; c++) if (px > cs[c][0] - 8 && px < cs[c][0] + sz + 8 && py > cs[c][1] - 8 && py < cs[c][1] + sz + 8) hits[c]++; };
      for (i = 0; i < res.n; i += 100) {
        var pts = S.joints([res.q[3 * i], res.q[3 * i + 1], res.q[3 * i + 2]], P);
        for (j = 0; j < 4; j++) for (var s = 0; s <= 4; s++) {  // points along each link too
          var a = pts[Math.max(0, j - 1)], b = pts[j];
          hit(T.X(a[0] + (b[0] - a[0]) * s / 4), T.Y(a[1] + (b[1] - a[1]) * s / 4));
        }
      }
      for (i = 0; i < res.n; i += 50) for (j = 0; j < 3; j++) hit(T.X(res.xyd[2 * i]), T.Y(res.xyd[2 * i + 1]));  // the target circle
      for (c = 0; c < 4; c++) if (cs[c][0] < T.X(0.05) && cs[c][0] + sz > T.X(-0.05) && cs[c][1] + sz > T.Y(0)) hits[c] += 50;  // the base block
      var best = 0; for (c = 1; c < 4; c++) if (hits[c] < hits[best]) best = c;
      cornerKey = key; cornerAt = cs[best];
      return cornerAt;
    }
    function draw() {
      if (!st.w) return;
      var ctx = st.ctx, T = view(st, B, 14);
      ctx.clearRect(0, 0, st.w, st.h); grid(ctx, T, B, 0.05); base(ctx, T);
      if (!res) { if (ran) label(ctx, L('Out of the reachable workspace', '超出可达空间'), st.w / 2, st.h / 2, { align: 'center', color: ROSE, weight: '650', size: 14 }); return; }
      var r = res, kk = Math.min(k, r.n - 1);
      path(ctx, T, function (i) { return r.xyd[2 * i]; }, function (i) { return r.xyd[2 * i + 1]; }, 0, r.n - 1, MUTED, 1.4, [5, 4]);
      path(ctx, T, function (i) { return r.xy[2 * i]; }, function (i) { return r.xy[2 * i + 1]; }, 0, kk, BLUE, 2);
      limb(ctx, T, [r.q[3 * kk], r.q[3 * kk + 1], r.q[3 * kk + 2]], { width: Math.max(4, T.s * 0.018) });
      // magnified inset around the circle centre
      var tr = S.TRAJ, cx = tr.xc, cy = tr.yc, R = Math.max(+el.rad.value / 1000 * 1.25, 0.004), i;
      for (i = 0; i <= kk; i += 5) R = Math.max(R, Math.abs(r.xy[2 * i] - cx) * 1.08, Math.abs(r.xy[2 * i + 1] - cy) * 1.08);
      var sz = Math.min(st.w * 0.36, st.h * 0.44), c0 = corner(T, sz), x0 = c0[0], y0 = c0[1];
      ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.94)'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x0, y0, sz, sz, 10) : ctx.rect(x0, y0, sz, sz); ctx.fill(); ctx.stroke(); ctx.clip();
      var Ti = { s: (sz - 20) / (2 * R), X: function (x) { return x0 + sz / 2 + (x - cx) * Ti.s; }, Y: function (y) { return y0 + sz / 2 - (y - cy) * Ti.s; } };
      path(ctx, Ti, function (i) { return r.xyd[2 * i]; }, function (i) { return r.xyd[2 * i + 1]; }, 0, r.n - 1, MUTED, 1.3, [4, 3]);
      path(ctx, Ti, function (i) { return r.xy[2 * i]; }, function (i) { return r.xy[2 * i + 1]; }, 0, kk, BLUE, 1.8);
      ctx.beginPath(); ctx.arc(Ti.X(r.xy[2 * kk]), Ti.Y(r.xy[2 * kk + 1]), 4, 0, 7); ctx.fillStyle = AMBER; ctx.fill();
      ctx.restore();
      label(ctx, L('magnified · ±', '放大 · ±') + f(R * 1000, 0) + ' mm', x0 + 10, y0 + sz - 10, { size: 11.5 });
      label(ctx, 't = ' + f(kk * r.dt, 2) + ' s   |e| = ' + f(err[kk], err[kk] > 10 ? 0 : 2) + ' mm', 14, 24, { color: INK, weight: '650', size: 13 });
    }
    var pl = player({ T: 10, duration: 10, range: $('#pidT'), btn: $('#pidPlay'), loop: true, onTime: function (t) {
      k = Math.round(t / 1e-3); $('#pidTime').textContent = f(t, 1) + ' / 10 s'; draw();
      var now = performance.now(); if (chE && now - lastChart > 120) { lastChart = now; cursor(); }
    } });
    function ds(arr, n, stride, off, scale) { var d = []; for (var i = 0; i < n; i += 20) d.push([+(i * 1e-3).toFixed(2), arr[stride * i + (off || 0)] * (scale || 1)]); return d; }
    function drawCharts() {
      if (!chE || !chT) return;
      var ml = { silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: AMBER, width: 1.2, type: 'solid' }, data: [{ xAxis: k * 1e-3 }] };
      chE.setOption({ animation: false, textStyle: { fontFamily: FONT }, tooltip: merge(TIP, { valueFormatter: function (x) { return f(x, 2) + ' mm'; } }), grid: { left: 50, right: 14, top: 26, bottom: 30 },
        legend: { top: 0, right: 0, textStyle: { color: '#475569', fontSize: 11.5 }, itemWidth: 14, itemHeight: 3 },
        xAxis: merge(AX, { type: 'value', name: 's', min: 0, max: 10 }), yAxis: merge(AX, { type: 'value', name: 'mm', min: 0 }),
        series: [{ id: 'ref', name: L('case B', '方案 B'), type: 'line', showSymbol: false, data: ds(errRef, errRef.length, 1), lineStyle: { color: '#cbd5e1', width: 1.5 }, itemStyle: { color: '#cbd5e1' } },
                 { id: 'cur', name: L('current run', '当前仿真'), type: 'line', showSymbol: false, data: res ? ds(err, res.n, 1) : [], lineStyle: { color: TEAL, width: 2 }, itemStyle: { color: TEAL }, markLine: ml }] }, true);
      var tau = [0, 1, 2].map(function (j) { return { id: 't' + j, name: 'τ' + (j + 1), type: 'line', showSymbol: false, data: res ? ds(res.tau, res.n, 3, j) : [], lineStyle: { color: JC[j], width: 1.8 }, itemStyle: { color: JC[j] } }; });
      var lim = res ? res.torqueLimit : 11;
      tau[0].markLine = { silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: ROSE, type: 'dashed', width: 1.2 }, data: [{ yAxis: lim }, { yAxis: -lim }] };
      tau[1].markLine = merge(ml, {});
      chT.setOption({ animation: false, textStyle: { fontFamily: FONT }, tooltip: merge(TIP, { valueFormatter: function (x) { return f(x, 2) + ' N·m'; } }), grid: { left: 50, right: 14, top: 26, bottom: 30 },
        legend: { top: 0, right: 0, textStyle: { color: '#475569', fontSize: 11.5 }, itemWidth: 14, itemHeight: 3 },
        xAxis: merge(AX, { type: 'value', name: 's', min: 0, max: 10 }), yAxis: merge(AX, { type: 'value', name: 'N·m', min: -lim - 1, max: lim + 1 }), series: tau }, true);
    }
    function cursor() { chE.setOption({ series: [{ id: 'cur', markLine: { data: [{ xAxis: k * 1e-3 }] } }] }); chT.setOption({ series: [{ id: 't1', markLine: { data: [{ xAxis: k * 1e-3 }] } }] }); }

    ref = S.track({ gains: S.GAINS.B }); errRef = errors(ref);
    run(); pl.set(0);
    SITE.lazy(cv, function () { pl.play(); });
    SITE.lazy($('#pidErr'), function () { echartsReady().then(function () { chE = chart($('#pidErr')); chT = chart($('#pidTau')); drawCharts(); }); });
    SITE.onLang(function () { stats(); draw(); drawCharts(); });
  }

  // ---------------------------------------------------------------- 4. gain and payload sweeps (precomputed with the same engine)
  function sweeps() {
    var heat = $('#swHeat'); if (!heat) return;
    var mode = 'gc', hc = null, pc = null, D = null, legend = null;
    var STOPS = [[227, 245, 244], [143, 211, 207], [44, 91, 224], [30, 42, 110]];
    function ramp(t) {  // site palette, light teal -> deep blue
      t = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
      var i = Math.min(STOPS.length - 2, Math.floor(t)), u = t - i, a = STOPS[i], b = STOPS[i + 1];
      return 'rgb(' + [0, 1, 2].map(function (j) { return Math.round(a[j] + (b[j] - a[j]) * u); }).join(',') + ')';
    }
    function drawHeat() {  // the bundled ECharts has no heatmap series: square scatter symbols on category axes instead
      var cells = D.sweep[mode], vals = cells.map(function (c) { return c[2]; });
      var lo = Math.log10(Math.min.apply(null, vals)), hi = Math.log10(Math.max.apply(null, vals));
      var G = { left: 58, right: 18, top: 10, bottom: 44 }, cw = (hc.getWidth() - G.left - G.right) / D.kd.length, chh = (hc.getHeight() - G.top - G.bottom) / D.kp.length;
      var data = cells.map(function (c) {
        var tt = (Math.log10(c[2]) - lo) / (hi - lo || 1), isB = D.kp[c[0]] === 1 && D.kd[c[1]] === 1;
        return { value: [c[1], c[0], tt, c[2], c[3], c[4]],
                 itemStyle: { color: ramp(tt), borderColor: isB ? INK : '#fff', borderWidth: isB ? 2.5 : 1 },
                 label: { color: tt > 0.55 ? '#fff' : INK } };
      });
      legend.innerHTML = '<span>' + f(Math.pow(10, lo), lo < 0 ? 1 : 0) + ' mm</span><i style="background:linear-gradient(90deg,' +
        [0, 0.33, 0.67, 1].map(ramp).join(',') + ')"></i><span>' + f(Math.pow(10, hi), 0) + ' mm</span><span class="muted">' + L('log scale', '对数色标') + '</span>';
      hc.setOption({ animation: false, textStyle: { fontFamily: FONT },
        tooltip: { backgroundColor: '#fff', borderColor: '#e2e8f0', textStyle: { color: INK, fontSize: 12 }, formatter: function (p) {
          var v = p.data.value;
          return 'K<sub>p</sub> × ' + D.kp[v[1]] + ', K<sub>d</sub> × ' + D.kd[v[0]] + '<br>' + L('mean error ', '平均误差 ') + '<b>' + f(v[3], v[3] < 10 ? 2 : 0) + ' mm</b><br>' +
                 L('max error ', '最大误差 ') + f(v[4], v[4] < 10 ? 2 : 0) + ' mm<br>' + L('saturated ', '饱和 ') + f(v[5] * 100, 0) + ' %'; } },
        grid: G,
        xAxis: merge(AX, { type: 'category', data: D.kd.map(function (v) { return '×' + v; }), name: L('Kd scale', 'Kd 缩放'), nameLocation: 'middle', nameGap: 28, splitLine: { show: false }, axisTick: { show: false } }),
        yAxis: merge(AX, { type: 'category', data: D.kp.map(function (v) { return '×' + v; }), name: L('Kp scale', 'Kp 缩放'), nameLocation: 'middle', nameGap: 40, splitLine: { show: false }, axisTick: { show: false } }),
        series: [{ type: 'scatter', symbol: 'rect', symbolSize: [cw, chh], data: data,
          label: { show: true, position: 'inside', fontSize: 10.5, formatter: function (p) { var x = p.data.value[3]; return x < 10 ? x.toFixed(1) : Math.round(x); } },
          emphasis: { scale: false, itemStyle: { borderColor: INK, borderWidth: 1.5 } } }] }, true);
    }
    function drawPay() {
      var P2 = D.payload, line = function (key, name, color) {
        return { name: name, type: 'line', yAxisIndex: 0, symbolSize: 6, data: P2[key].map(function (r) { return [r[0], r[1]]; }), lineStyle: { color: color, width: 2 }, itemStyle: { color: color } };
      };
      pc.setOption({ animation: false, textStyle: { fontFamily: FONT }, tooltip: merge(TIP, { valueFormatter: function (x) { return f(x, 1); } }),
        legend: { bottom: 0, textStyle: { color: '#475569', fontSize: 11.5 }, itemWidth: 14, itemHeight: 8 }, grid: { left: 52, right: 46, top: 28, bottom: 72 },
        xAxis: merge(AX, { type: 'value', min: 0.55, max: 1.45, name: L('link 3 mass × nominal', '第 3 杆质量 × 名义值'), nameLocation: 'middle', nameGap: 26 }),
        yAxis: [merge(AX, { type: 'log', name: 'mm', min: 0.5, max: 1000 }), merge(AX, { type: 'value', name: '%', min: 0, max: 100, splitLine: { show: false } })],
        series: [{ name: L('saturated (with G)', '饱和占比（有前馈）'), type: 'bar', yAxisIndex: 1, barWidth: 8, data: P2.gc.map(function (r) { return [r[0], r[3] * 100]; }), itemStyle: { color: 'rgba(194,65,12,.28)' } },
                 line('gc', L('mean error, with G(q)', '平均误差，有前馈'), BLUE), line('pure', L('mean error, pure PID', '平均误差，纯 PID'), MUTED)] }, true);
    }
    seg($('#swMode'), function (v) { mode = v; if (hc) drawHeat(); });
    SITE.lazy(heat, function () {
      SITE.load([A + 'me5402_limb_sweep.js', A + 'portal-echarts.js']).then(function () {
        D = window.ME5402_SWEEP; hc = chart(heat); pc = chart($('#swPay'));
        legend = document.createElement('div'); legend.className = 'ramp'; heat.parentNode.appendChild(legend);
        drawHeat(); drawPay();
        window.addEventListener('resize', drawHeat);
        SITE.onLang(function () { drawHeat(); drawPay(); });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    [kinematics, openLoop, pid, sweeps].forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  });
})();
