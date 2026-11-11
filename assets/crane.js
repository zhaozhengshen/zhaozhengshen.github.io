/* Crane-control modules: Unity multi-camera player, RL vs NMPC metrics, strict-test pass counts. */
(function () {
  'use strict';
  var SITE = window.SITE, L = SITE.L;
  var $ = function (s) { return document.querySelector(s); };
  var A = document.documentElement.getAttribute('data-assets') || 'assets/';
  var FONT = 'Inter, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  var TIP = { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: '#0f172a', fontSize: 12 }, extraCssText: 'box-shadow:0 10px 30px rgba(15,23,42,.14);border-radius:10px;padding:8px 12px' };
  var charts = [];
  window.addEventListener('resize', function () { charts.forEach(function (c) { c.resize(); }); });
  function merge() { var o = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) o[k] = arguments[i][k]; return o; }

  var VIEWS = [
    ['portal_crane_unity.mp4', 'portal_crane_unity_frame.webp', ['Whole crane', '塔吊全景'], ['The complete crane and the full lift, first 45 s at 1×.', '完整塔吊与吊运全过程，1× 前 45 秒。']],
    ['unity_01_Oblique_Transport_web.mp4', 'unity_01_Oblique_Transport_poster.jpg', ['Oblique transport', '斜侧运输'], ['Oblique camera on the payload and rope during transport.', '斜侧机位观察运输段的吊物与绳索。']],
    ['unity_02_Overhead_Path.mp4', 'unity_02_Overhead_Path_poster.jpg', ['Overhead path', '俯视路径'], ['Top view of the payload path, start and target tolerance circle.', '俯视吊物轨迹、起点与目标容差圈。']],
    ['unity_03_Side_Rope_and_Sway.mp4', 'unity_03_Side_Rope_and_Sway_poster.jpg', ['Side: rope & sway', '侧视摆动'], ['Side view of the rope and sway along the transport direction.', '侧视绳索与沿运输方向的摆动。']],
    ['unity_04_Front_Transverse_Sway.mp4', 'unity_04_Front_Transverse_Sway_poster.jpg', ['Front: transverse sway', '正视横摆'], ['Front view of transverse (cross-wind) sway.', '正视横向（侧风方向）摆动。']],
    ['unity_05_Close_Target_and_Settling.mp4', 'unity_05_Close_Target_and_Settling_poster.jpg', ['Target close-up', '目标近景'], ['Close-up of the target region: arrival, braking and settling.', '目标区域近景：到位、制动与停稳。']]
  ];

  function unity() {
    var tabs = $('#unityTabs'); if (!tabs) return;
    var vid = $('#unityVideo'), cap = $('#unityCap'), cur = 0, started = false;
    function caption() {
      var v = VIEWS[cur];
      cap.innerHTML = '<b>' + L(v[2][0], v[2][1]) + '</b>' + L(v[3][0], v[3][1]) + ' ' +
        L('Recorded from the Unity camera.', 'Unity 相机录制。');
    }
    function render() { tabs.innerHTML = VIEWS.map(function (v, i) { return '<button type="button" data-i="' + i + '" class="' + (i === cur ? 'on' : '') + '">' + L(v[2][0], v[2][1]) + '</button>'; }).join(''); caption(); }
    function show(i, play) {
      cur = i; render();
      vid.src = A + VIEWS[i][0];
      if (VIEWS[i][1]) vid.poster = A + VIEWS[i][1]; else vid.removeAttribute('poster');
      if (play) vid.play().catch(function () {});
    }
    tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) show(+b.dataset.i, true); });
    render();
    // autoplays (muted, looped) while visible, like every video on the site
    vid.muted = true; vid.loop = true;
    show(cur, false); started = true;
    var seen = false;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { seen = e.isIntersecting; if (seen) vid.play().catch(function () {}); else vid.pause(); }); }, { threshold: 0.25 }).observe(vid);
    SITE.onLang(render);
  }

  function nmpc() {
    var el = $('#nmpcChart'); if (!el) return;
    var c;
    function draw() {
      var M = [[L('20-s settling completed (s)', '20 秒停稳完成时间 (s)'), 33.35, 29.95], [L('Transport sway RMS (°)', '运输摆角 RMS (°)'), 0.94, 0.88], [L('Final position RMS (cm)', '末端位置 RMS (cm)'), 6.09, 6.08], [L('Target-direction overshoot (cm)', '目标方向超调 (cm)'), 3.75, 28.77]];
      var grids = [], xs = [], ys = [], series = [], titles = [];
      M.forEach(function (m, i) {
        var col = i % 2, row = Math.floor(i / 2);
        grids.push({ left: (col * 50 + 2) + '%', width: '42%', top: (row * 50 + 13) + '%', height: '27%', containLabel: true });
        titles.push({ text: m[0], left: (col * 50 + 2) + '%', top: (row * 50 + 2) + '%', textStyle: { fontSize: 12, fontWeight: 600, color: '#0f172a', fontFamily: FONT } });
        xs.push({ gridIndex: i, type: 'value', max: Math.max(m[1], m[2]) * 1.3, axisLabel: { show: false }, splitLine: { lineStyle: { color: '#eef2f6' } } });
        ys.push({ gridIndex: i, type: 'category', data: ['NMPC', L('Calibrated RL', '校准 RL')], axisTick: { show: false }, axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#334155', fontSize: 11.5 } });
        series.push({ type: 'bar', xAxisIndex: i, yAxisIndex: i, barWidth: 16, data: [{ value: m[2], itemStyle: { color: '#e08a0b' } }, { value: m[1], itemStyle: { color: '#2c5be0' } }],
          itemStyle: { barBorderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', color: '#0f172a', fontWeight: 600, fontSize: 12 } });
      });
      c.setOption({ textStyle: { fontFamily: FONT }, title: titles, grid: grids, xAxis: xs, yAxis: ys, series: series, tooltip: merge(TIP, { trigger: 'item' }) }, true);
    }
    SITE.lazy(el, function () { SITE.load([A + 'portal-echarts.js']).then(function () { c = echarts.init(el); charts.push(c); draw(); SITE.onLang(draw); }); });
  }

  function limits() {
    var el = $('#limitChart'); if (!el) return;
    var c;
    function draw() {
      var names = [L('Calibrated RL', '校准 RL'), L('Full-task precision continuation', '完整任务精密续训'), L('Local-recovery practice', '局部回正练习')];
      c.setOption({
        textStyle: { fontFamily: FONT }, grid: { left: 8, right: 44, top: 36, bottom: 6, containLabel: true },
        legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#334155', fontSize: 12 } },
        tooltip: merge(TIP, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (ps) { return '<b>' + ps[0].name + '</b><br>' + ps.map(function (p) { return p.marker + p.seriesName + ': ' + p.data.raw; }).join('<br>'); } }),
        xAxis: { type: 'value', max: 100, axisLabel: { color: '#64748b', fontSize: 11, formatter: '{value}%' }, splitLine: { lineStyle: { color: '#eef2f6' } } },
        yAxis: { type: 'category', data: names, inverse: true, axisTick: { show: false }, axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#334155', fontSize: 12 } },
        series: [
          { name: L('Precision holding (/18)', '精密守点（/18）'), type: 'bar', barWidth: 12, itemStyle: { color: '#2c5be0', barBorderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', fontSize: 11, color: '#0f172a', formatter: function (p) { return p.data.raw; } },
            data: [4, 1, 0].map(function (v) { return { value: +(v / 18 * 100).toFixed(1), raw: v + ' / 18' }; }) },
          { name: L('Disturbance recovery (/72)', '受扰回正（/72）'), type: 'bar', barWidth: 12, itemStyle: { color: '#0f9d98', barBorderRadius: [0, 3, 3, 0] }, label: { show: true, position: 'right', fontSize: 11, color: '#0f172a', formatter: function (p) { return p.data.raw; } },
            data: [44, 28, 16].map(function (v) { return { value: +(v / 72 * 100).toFixed(1), raw: v + ' / 72' }; }) }
        ]
      }, true);
    }
    SITE.lazy(el, function () { SITE.load([A + 'portal-echarts.js']).then(function () { c = echarts.init(el); charts.push(c); draw(); SITE.onLang(draw); }); });
  }

  // interactive trajectory viewer: one self-contained page per language, loaded when scrolled near
  // the ~8 MB interactive viewer is created only after an explicit click
  function viewer() {
    var gate = $('#trajGate'), btn = $('#trajLoad'); if (!gate || !btn) return;
    var f = null;
    function set() { if (f) f.src = gate.getAttribute('data-src-' + SITE.lang); }
    btn.addEventListener('click', function () {
      if (f) return;
      f = document.createElement('iframe');
      f.className = 'viewer-frame'; f.title = L('Trajectory and swing viewer', '轨迹与摆角查看器');
      gate.appendChild(f); set(); btn.disabled = true;
    });
    SITE.onLang(set);
  }

  document.addEventListener('DOMContentLoaded', function () { unity(); nmpc(); limits(); viewer(); });
})();
