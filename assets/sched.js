/* Steel-frame scheduling modules: BIM constraint network, DADGA, MOACS Pareto + metrics, 1,165-member 4D replay,
   and the compact 4D teaser on the home page. Data: window.PORTAL_DATA (saved research exports, nothing is re-optimised). */
(function () {
  'use strict';
  var SITE = window.SITE, L = SITE.L;
  var $ = function (s) { return document.querySelector(s); };
  var A = document.documentElement.getAttribute('data-assets') || 'assets/';
  var RUNTIME = [A + 'portal-data.js', A + 'portal-bim-runtime.js', A + 'portal-model.js'];
  var TEAM = [
    { id: 'A', en: 'Team A · high skill', zh: 'A 班组 · 高技能', color: '#2c5be0' },
    { id: 'B', en: 'Team B · standard', zh: 'B 班组 · 标准', color: '#e08a0b' },
    { id: 'C', en: 'Team C · basic', zh: 'C 班组 · 普通', color: '#0f9d98' }
  ];
  var TYPE = { C: ['Column', '柱'], B: ['Beam', '梁'], S: ['Slab', '板'] };
  var ty = function (t) { return L(TYPE[t][0], TYPE[t][1]); };
  var fl = function (f) { return L('Floor ' + f, f + ' 层'); };
  var f1 = function (v) { return SITE.fmt(Math.round(v * 10) / 10, 1); };
  var FONT = 'Inter, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  var TIP = { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: '#0f172a', fontSize: 12 }, extraCssText: 'box-shadow:0 10px 30px rgba(15,23,42,.14);border-radius:10px;padding:8px 12px' };
  var AX = { axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef2f6' } }, nameTextStyle: { color: '#94a3b8', fontSize: 11 } };
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
  var charts = [];
  function chart(el) { var c = echarts.init(el); charts.push(c); return c; }
  window.addEventListener('resize', function () { charts.forEach(function (c) { c.resize(); }); });
  function merge() { var o = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) o[k] = arguments[i][k]; return o; }

  var S, C, guids, idx;
  function data() {
    if (S) return;
    S = window.PORTAL_DATA.schedule; C = S.comps; guids = C.map(function (c) { return c.g; });
    idx = new Map(guids.map(function (g, i) { return [g, i]; }));
  }
  function makeViewer(el, opts) {
    var v = new window.BimViewer(el, opts || {});
    return v.load('', new Set(guids)).then(function () { var l = el.querySelector('.loading'); if (l) l.remove(); return v; });
  }

  /* ---------- schedule painter shared by the teaser and the 4D module ---------- */
  function paintSchedule(viewer, t) {
    viewer.paint(function (g) {
      var c = C[idx.get(g)], e = c.s + c.d;
      if (e <= t) return { color: TEAM[c.k].color, opacity: 1 };
      if (c.s <= t) return { color: '#ffe3a3', emissive: 0x9a5c00, opacity: 1 };
      return { color: '#b8c0cc', opacity: 0.16 };
    });
  }
  function player(opts) {
    // opts: T, onTime(t), playBtn, range, duration (s)
    var st = { t: opts.start || 0, playing: false, last: 0, dur: opts.duration || 40 };
    function set(t) { st.t = Math.max(0, Math.min(opts.T, t)); if (opts.range) opts.range.value = Math.round(st.t / opts.T * 1000); opts.onTime(st.t); }
    function tick(now) {
      if (!st.playing) return;
      var dt = (now - st.last) / 1000; st.last = now;
      var nt = st.t + opts.T * dt / st.dur;
      if (nt >= opts.T) { if (opts.loop) { nt = 0; } else { set(opts.T); stop(); return; } }
      set(nt); requestAnimationFrame(tick);
    }
    function play() { if (st.t >= opts.T) st.t = 0; st.playing = true; st.last = performance.now(); if (opts.playBtn) opts.playBtn.innerHTML = PAUSE; requestAnimationFrame(tick); }
    function stop() { st.playing = false; if (opts.playBtn) opts.playBtn.innerHTML = PLAY; }
    if (opts.playBtn) { opts.playBtn.innerHTML = PLAY; opts.playBtn.onclick = function () { st.playing ? stop() : play(); }; }
    if (opts.range) opts.range.oninput = function (e) { stop(); set(opts.T * e.target.value / 1000); };
    return { set: set, play: play, stop: stop, st: st };
  }

  /* ---------- home teaser ---------- */
  function teaser() {
    var el = $('#teaser'); if (!el) return;
    SITE.lazy(el, function () {
      SITE.load(RUNTIME).then(function () {
        data();
        return makeViewer(el, { onPick: function () {} });
      }).then(function (viewer) {
        viewer.controls.enableZoom = false;
        var T = S.makespan, hud = $('#teaserHud');
        var p = player({
          T: T, start: 0, duration: 28, loop: true, playBtn: $('#teaserPlay'), range: $('#teaserT'),
          onTime: function (t) {
            paintSchedule(viewer, t);
            var done = 0, act = 0; C.forEach(function (c) { if (c.s + c.d <= t) done++; else if (c.s <= t) act++; });
            hud.innerHTML = '<b>' + f1(t) + ' h</b> · ' + L('installed ', '已安装 ') + '<b>' + SITE.fmt(done, 0) + '</b> / ' + SITE.fmt(C.length, 0) + ' · ' + L('installing ', '正在安装 ') + '<b>' + act + '</b>';
          }
        });
        p.set(T * 0.38);
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduce) p.play();
        SITE.onLang(function () { p.set(p.st.t); });
        $('#teaserLegend').innerHTML = legendTeams();
        SITE.onLang(function () { $('#teaserLegend').innerHTML = legendTeams(); });
      }).catch(function (e) { console.error(e); el.querySelector('.loading').textContent = 'Model could not be loaded.'; });
    });
  }
  function legendTeams() {
    return TEAM.map(function (t) { return '<span><i style="background:' + t.color + '"></i>' + L(t.en, t.zh) + '</span>'; }).join('') +
      '<span><i style="background:#ffe3a3;box-shadow:0 0 0 2px #e08a0b inset"></i>' + L('Installing', '正在安装') + '</span>';
  }

  /* ---------- ① constraint network ---------- */
  function constraints() {
    var el = $('#cv'); if (!el) return;
    data();
    var pairs = {};
    C.forEach(function (c) { c.p.forEach(function (j) { var k = c.t + C[j].t; pairs[k] = (pairs[k] || 0) + 1; }); });
    var DESC = { CC: ['Upper column supported by lower column', '上层柱由下层柱支撑'], CB: ['Upper column restrained by lower beams', '上层柱受下层梁约束'], BC: ['Beam supported by connected columns', '梁由所连接的柱支撑'], BB: ['Secondary beam supported by main beam', '次梁由主梁支撑'] };
    function table() {
      $('#consTable').innerHTML = '<tr><th>' + L('Member ← predecessor', '受约束构件 ← 前置构件') + '</th><th>' + L('Meaning', '含义') + '</th><th class="num">' + L('Count', '数量') + '</th></tr>' +
        Object.keys(pairs).sort(function (a, b) { return pairs[b] - pairs[a]; }).map(function (k) {
          return '<tr><td><b>' + ty(k[0]) + ' ← ' + ty(k[1]) + '</b></td><td>' + (DESC[k] ? L(DESC[k][0], DESC[k][1]) : '') + '</td><td class="num">' + SITE.fmt(pairs[k], 0) + '</td></tr>';
        }).join('') +
        '<tr><td><b>' + L('Total', '合计') + '</b></td><td>' + L('Schedule check: ', '排程复核：违反 ') + '<b style="color:#0b6f6b">' + S.violations + '</b>' + L(' violations', ' 条') + '</td><td class="num"><b>' + SITE.fmt(S.constraints, 0) + '</b></td></tr>';
    }
    function pick(f, t, by) {
      return C.map(function (c, i) { return [c, i]; }).filter(function (x) { return x[0].f === f && x[0].t === t; }).sort(function (a, b) { return by(b[0]) - by(a[0]); })[0][1];
    }
    var presets = [
      [['Floor 4 · beam with most predecessors', '4 层 · 前置最多的梁'], pick(4, 'B', function (c) { return c.p.length; })],
      [['Floor 3 · column with most successors', '3 层 · 后继最多的柱'], pick(3, 'C', function (c) { return c.q.length; })],
      [['Floor 1 · first column installed', '1 层 · 首批安装的柱'], C.map(function (c, i) { return [c, i]; }).filter(function (x) { return x[0].t === 'C'; }).sort(function (a, b) { return a[0].s - b[0].s; })[0][1]],
      [['Top · last member installed', '顶层 · 最后安装的构件'], C.map(function (c, i) { return [c, i]; }).sort(function (a, b) { return (b[0].s + b[0].d) - (a[0].s + a[0].d); })[0][1]]
    ];
    function presetOptions() {
      var cur = $('#cvPreset').value;
      $('#cvPreset').innerHTML = '<option value="">' + L('Example members…', '示例构件…') + '</option>' + presets.map(function (p) { return '<option value="' + p[1] + '">' + L(p[0][0], p[0][1]) + '</option>'; }).join('');
      $('#cvPreset').value = cur;
    }
    var viewer = null, sel = null;
    // every member further up the precedence chain (predecessors of predecessors …)
    function upstream(i) {
      var seen = new Set(), stack = C[i].p.slice();
      while (stack.length) { var j = stack.pop(); if (seen.has(j)) continue; seen.add(j); C[j].p.forEach(function (k) { if (!seen.has(k)) stack.push(k); }); }
      return seen;
    }
    function paint() {
      if (!viewer) return;
      var P = sel == null ? null : new Set(C[sel].p), Q = sel == null ? null : new Set(C[sel].q), U = sel == null ? null : upstream(sel);
      viewer.paint(function (g) {
        var i = idx.get(g), c = C[i];
        if (sel == null) return { color: c.t === 'C' ? '#7d8ba3' : '#b4bfcf', opacity: 1 };
        if (i === sel) return { color: '#e08a0b', emissive: 0x6b4100, opacity: 1 };
        if (P.has(i)) return { color: '#2c5be0', emissive: 0x0b1f66, opacity: 1 };
        if (Q.has(i)) return { color: '#0f9d98', emissive: 0x053a39, opacity: 1 };
        if (U.has(i)) return { color: '#a9c0f5', opacity: 0.85 };
        return { color: '#a9b3c2', opacity: 0.16 };
      });
    }
    function info(i) {
      sel = i; paint();
      if (i == null) { $('#cvInfo').innerHTML = '<div class="empty">' + L('Click any member in the model.', '在左侧模型中点击任意构件') + '</div>'; return; }
      var c = C[i], end = c.s + c.d;
      var predEnd = c.p.length ? Math.max.apply(null, c.p.map(function (j) { return C[j].s + C[j].d; })) : null;
      function list(arr, cls) {
        return arr.slice(0, 6).map(function (j) { return '<span class="chip ' + cls + '">' + ty(C[j].t) + ' · ' + fl(C[j].f) + '</span>'; }).join(' ') +
          (arr.length > 6 ? ' <span class="muted small">+' + (arr.length - 6) + '</span>' : '');
      }
      $('#cvInfo').innerHTML = '<dl class="kv">' +
        '<dt>' + L('Member', '构件') + '</dt><dd>' + ty(c.t) + ' · ' + fl(c.f) + '</dd>' +
        '<dt>GUID</dt><dd class="mono">' + c.g + '</dd>' +
        '<dt>' + L('Team', '安装班组') + '</dt><dd><span style="color:' + TEAM[c.k].color + '">●</span> ' + L(TEAM[c.k].en, TEAM[c.k].zh) + '</dd>' +
        '<dt>' + L('Planned', '计划时间') + '</dt><dd>' + f1(c.s) + ' – ' + f1(end) + ' h <span class="muted">(' + c.d.toFixed(2) + ' h)</span></dd>' +
        '<dt>' + L('Direct predecessors', '直接前置') + '</dt><dd>' + c.p.length + '</dd>' +
        '<dt>' + L('All earlier predecessors', '全部上游前置') + '</dt><dd>' + upstream(i).size + '</dd>' +
        '<dt>' + L('Direct successors', '直接后继') + '</dt><dd>' + c.q.length + '</dd></dl>' +
        '<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
        (c.p.length ? '<div class="chips"><span class="muted small" style="align-self:center">' + L('Before:', '先装：') + '</span>' + list(c.p, 'blue') + '</div>' : '') +
        (c.q.length ? '<div class="chips"><span class="muted small" style="align-self:center">' + L('After:', '后装：') + '</span>' + list(c.q, 'green') + '</div>' : '') + '</div>' +
        (predEnd != null
          ? '<p class="note info">' + L('Latest predecessor finishes at <b>' + f1(predEnd) + ' h</b>; this member starts at <b>' + f1(c.s) + ' h</b>. Constraint satisfied ✓', '前置构件最晚 <b>' + f1(predEnd) + ' h</b> 完成，该构件 <b>' + f1(c.s) + ' h</b> 开始，满足约束 ✓') + '</p>'
          : '<p class="note">' + L('No predecessors: this member can be installed first.', '无前置构件，可最先安装。') + '</p>');
    }
    table(); presetOptions();
    SITE.onLang(function () { table(); presetOptions(); info(sel); });
    SITE.lazy(el, function () {
      SITE.load(RUNTIME).then(function () {
        return makeViewer(el, { onPick: function (g) { info(g ? idx.get(g) : null); $('#cvPreset').value = ''; } });
      }).then(function (v) {
        viewer = v;
        el.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { viewer.view(b.dataset.view); }; });
        $('#cvReset').onclick = function () { $('#cvPreset').value = ''; info(null); viewer.view('iso'); };
        $('#cvPreset').onchange = function (e) { if (e.target.value === '') return info(null); var i = +e.target.value; info(i); viewer.focus(guids[i]); };
        info(presets[0][1]); $('#cvPreset').value = presets[0][1];
      });
    });
  }

  /* ---------- ② DADGA ---------- */
  function dadga() {
    var el = $('#dadgaChart'); if (!el) return;
    var MN = { '简单': ['Simple', '简单'], '中等': ['Moderate', '中等'], '复杂': ['Complex', '复杂'] };
    var c;
    function draw() {
      var R = window.PORTAL_DATA.dadga.rows;
      var mn = function (r) { var m = MN[r.model] || [r.model, r.model]; return L(m[0], m[1]); };
      c.setOption({
        textStyle: { fontFamily: FONT }, grid: { left: 8, right: 16, top: 40, bottom: 6, containLabel: true },
        legend: { top: 0, right: 0, itemWidth: 10, itemHeight: 10, icon: 'roundRect', textStyle: { color: '#334155', fontSize: 12 }, data: ['DADGA', L('Conventional GA', '传统 GA')] },
        tooltip: merge(TIP, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (ps) {
          var r = R[ps[0].dataIndex];
          return '<b>' + mn(r) + L(' model · population ', '模型 · 种群 ') + r.pop + '</b><br>DADGA: ' + r.dTotal + ' s (' + r.dGen + L(' gen.)', ' 代)') +
            '<br>' + L('Conventional GA', '传统 GA') + ': ' + SITE.fmt(r.gTotal) + ' s (' + SITE.fmt(r.gGen, 0) + L(' gen.)', ' 代)') + '<br>' + L('Speed-up: ', '效率提升：') + '<b>' + SITE.fmt(r.times) + '×</b>';
        } }),
        xAxis: merge({ type: 'category', data: R.map(function (r) { return mn(r) + '\n' + L('pop. ', '种群 ') + r.pop; }), axisTick: { show: false } }, AX, { splitLine: { show: false } }),
        yAxis: merge({ type: 'log', name: L('seconds (log)', '秒（对数）'), min: 0.1 }, AX),
        series: [
          { name: 'DADGA', type: 'bar', barGap: '10%', barWidth: 14, itemStyle: { color: '#2c5be0', barBorderRadius: [3, 3, 0, 0] }, data: R.map(function (r) { return r.dTotal; }) },
          { name: L('Conventional GA', '传统 GA'), type: 'bar', barWidth: 14, itemStyle: { color: '#c3cad6', barBorderRadius: [3, 3, 0, 0] }, data: R.map(function (r) { return r.gTotal; }),
            label: { show: true, position: 'top', fontSize: 10.5, color: '#1e40af', fontWeight: 600, formatter: function (x) { return '×' + SITE.fmt(Math.round(R[x.dataIndex].times), 0); } } }
        ]
      }, true);
    }
    SITE.lazy(el, function () { SITE.load([A + 'portal-data.js', A + 'portal-echarts.js']).then(function () { c = chart(el); draw(); SITE.onLang(draw); }); });
  }

  /* ---------- ③ MOACS ---------- */
  function moacs() {
    var el = $('#pfChart'); if (!el) return;
    var AL = { 'MOACS': '#2c5be0', 'NSGA-II': '#e08a0b', 'MOPSO': '#8b5cf6' };
    var CASE = { simple: ['Simple model', '简单模型'], medium: ['Moderate model', '中等模型'], moderate: ['Moderate model', '中等模型'], complex: ['Complex model', '复杂模型'] };
    var ci = 0, PF, pfc, mcs = [];
    function cname(c) { var m = CASE[c.key]; return m ? L(m[0], m[1]) : c.zh; }
    function OBJ() { return [L('Duration (h)', '工期 (h)'), L('Cost (CNY, code rates)', '成本 (元，代码费率)'), L('Carbon (kgCO₂e)', '碳排放 (kgCO₂e)')]; }
    function controls() {
      $('#pfCase').innerHTML = PF.cases.map(function (c, i) { return '<button type="button" data-i="' + i + '" class="' + (i === ci ? 'on' : '') + '">' + cname(c) + '</button>'; }).join('');
      var axv = $('#pfAxis').value || '0,1';
      $('#pfAxis').innerHTML = [['0,1', L('Duration – cost', '工期 – 成本')], ['0,2', L('Duration – carbon', '工期 – 碳排放')], ['1,2', L('Cost – carbon', '成本 – 碳排放')]].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
      $('#pfAxis').value = axv;
      var tm = window.PORTAL_DATA.schedule.teams;
      $('#teamTable').innerHTML = '<tr><th>' + L('Team', '班组') + '</th><th class="num">' + L('Skill coef.', '效率系数') + '</th><th class="num">' + L('Rate (CNY/h)', '时薪 (元/h)') + '</th><th class="num">kgCO₂e/h</th></tr>' +
        tm.map(function (t, k) { return '<tr><td style="white-space:nowrap"><span style="color:' + TEAM[k].color + '">●</span> ' + L(TEAM[k].en, TEAM[k].zh) + '</td><td class="num">' + t.eff + '×</td><td class="num">' + t.ratePub + '</td><td class="num">' + t.co2h + '</td></tr>'; }).join('') +
        '<tr><td colspan="4" class="small muted">' + L('The coefficient multiplies standard labour time (column 2 h, beam 1.5 h); smaller is faster. Tower crane QTZ80, 42.25 kW, hoisting 500 m/h. Rates from paper Table 3.', '效率系数乘以标准工时（柱 2 h、梁 1.5 h），越小越快；塔吊 QTZ80，42.25 kW，吊速 500 m/h。费率取自论文表 3。') + '</td></tr>';
    }
    function draw() {
      var c = PF.cases[ci], ax = $('#pfAxis').value.split(',').map(Number), O = OBJ();
      $('#pfSub').textContent = L(cname(c) + ' (' + c.components + ' members in the paper) · reference front of ' + SITE.fmt(c.pfSize, 0) + ' solutions, sampled',
        cname(c) + '（论文：' + c.components + ' 个构件）· 参考前沿 ' + SITE.fmt(c.pfSize, 0) + ' 个解，图中抽样显示');
      var pt = function (p) { return [p[ax[0]], p[ax[1]], p[0], p[1], p[2]]; };
      pfc.setOption({
        textStyle: { fontFamily: FONT }, animation: false,
        grid: { left: 8, right: 18, top: 64, bottom: 34, containLabel: true },
        legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#334155', fontSize: 12 } },
        tooltip: merge(TIP, { trigger: 'item', formatter: function (p) { return '<b>' + p.seriesName + '</b><br>' + L('Duration ', '工期 ') + p.data[2].toFixed(1) + ' h<br>' + L('Cost ', '成本 ') + SITE.fmt(Math.round(p.data[3]), 0) + L(' CNY', ' 元') + '<br>' + L('Carbon ', '碳排放 ') + p.data[4].toFixed(1) + ' kgCO₂e'; } }),
        xAxis: merge({ type: 'value', name: O[ax[0]], nameLocation: 'middle', nameGap: 28, scale: true }, AX),
        yAxis: merge({ type: 'value', name: O[ax[1]], nameLocation: 'end', scale: true }, AX, { nameTextStyle: { color: '#94a3b8', fontSize: 11, align: 'left' } }),
        series: [{ name: L('Reference Pareto front (three algorithms merged)', '参考帕累托前沿（三种算法合并）'), type: 'scatter', symbolSize: 4, itemStyle: { color: '#cfd6e0' }, data: c.pf.map(pt), z: 1 }]
          .concat(c.algos.map(function (a) { return { name: a.name, type: 'scatter', symbolSize: a.name === 'MOACS' ? 6 : 5, itemStyle: { color: AL[a.name], opacity: .85 }, data: a.front.map(pt), z: a.name === 'MOACS' ? 4 : 3 }; }))
      }, true);
      metrics(c);
    }
    function metrics(c) {
      var names = ['HV', 'IGD', 'GD', 'Spacing'];
      var better = [L('higher is better', '越大越好'), L('lower is better', '越小越好'), L('lower is better', '越小越好'), L('lower is better', '越小越好')];
      var grid = $('#metricGrid');
      if (!mcs.length) {
        grid.innerHTML = names.map(function (n, j) { return '<div><div class="small"><b>' + n + '</b> <span class="muted" id="mb' + j + '"></span></div><div id="mc' + j + '" style="height:210px"></div></div>'; }).join('');
        names.forEach(function (n, j) { mcs.push(chart($('#mc' + j))); });
      }
      names.forEach(function (n, j) {
        $('#mb' + j).textContent = better[j];
        var series = [];
        c.algos.forEach(function (a, k) {
          var m = a.metrics[j];
          series.push({ type: 'scatter', name: a.name, symbolSize: 6, itemStyle: { color: AL[a.name], opacity: .55 },
            data: m.runs.map(function (v, r) { return [k + ((r * 37) % 30 / 30 - .5) * .5, v]; }),
            markLine: { symbol: 'none', silent: true, label: { show: false }, lineStyle: { color: '#0f172a', width: 2, type: 'solid' }, data: [[{ coord: [k - .32, m.mean] }, { coord: [k + .32, m.mean] }]] } });
        });
        mcs[j].setOption({
          textStyle: { fontFamily: FONT }, animation: false, grid: { left: 6, right: 8, top: 10, bottom: 6, containLabel: true },
          tooltip: merge(TIP, { trigger: 'item', formatter: function (p) { return p.seriesName + ': ' + (+p.data[1]).toPrecision(4) + '<br>' + L('mean ', '均值 ') + c.algos[Math.round(p.data[0])].metrics[j].mean.toPrecision(4); } }),
          xAxis: { type: 'value', min: -.6, max: 2.6, interval: 1, axisLine: AX.axisLine, splitLine: { show: false }, axisLabel: { color: '#334155', fontSize: 11, formatter: function (v) { return (c.algos[v] || {}).name || ''; } } },
          yAxis: merge({ type: n === 'HV' ? 'value' : 'log', scale: true }, AX),
          series: series
        }, true);
      });
      var ig = c.algos.map(function (a) { return a.metrics[1].mean; }), best = ig.indexOf(Math.min.apply(null, ig));
      $('#metricNote').innerHTML = L(
        cname(c) + ': mean IGD is <b>' + ig[0].toFixed(2) + '</b> for MOACS, ' + ig[1].toFixed(2) + ' for NSGA-II and ' + ig[2].toFixed(2) + ' for MOPSO' + (best === 0 ? ' — the best convergence and spread of the three.' : '.') + ' The paper also notes that on the complex model MOACS has a lower HV (less diverse solutions), which does not affect choosing the final construction plan.',
        cname(c) + '：MOACS 的 IGD 均值为 <b>' + ig[0].toFixed(2) + '</b>，NSGA-II 为 ' + ig[1].toFixed(2) + '，MOPSO 为 ' + ig[2].toFixed(2) + (best === 0 ? '，收敛性与分布性最好。' : '。') + '论文同时指出：复杂模型中 MOACS 的 HV 偏低，解的多样性有所下降，但不影响最终施工方案的选取。');
    }
    SITE.lazy(el, function () {
      SITE.load([A + 'portal-data.js', A + 'portal-echarts.js']).then(function () {
        PF = window.PORTAL_DATA.pareto; pfc = chart(el);
        controls(); draw();
        $('#pfCase').onclick = function (e) { var b = e.target.closest('button'); if (!b) return; ci = +b.dataset.i; controls(); draw(); };
        $('#pfAxis').onchange = draw;
        SITE.onLang(function () { controls(); draw(); });
      });
    });
  }

  /* ---------- ④ 1,165-member 4D ---------- */
  function case4d() {
    var el = $('#pv'); if (!el) return;
    data();
    var T = S.makespan, viewer = null, fc = null, cu = null, BIN = 20, p;
    function stats() {
      $('#caseStats').innerHTML = [
        [L('Makespan', '总工期'), f1(T) + '<em>h</em>', L('three teams in parallel', '三个班组并行'), 'hl'],
        [L('Construction cost', '施工成本'), SITE.fmt(S.costPub, 0) + '<em>' + L('CNY', '元') + '</em>', L('paper Table 3 rates', '按论文表 3 参数'), ''],
        [L('Construction carbon', '施工碳排放'), SITE.fmt(S.carbon) + '<em>kgCO₂e</em>', L('incl. ' + f1(S.liftHours) + ' h crane lifting', '其中塔吊吊运 ' + f1(S.liftHours) + ' h'), ''],
        [L('Constraints met', '约束满足'), SITE.fmt(S.constraints - S.violations, 0) + '<em>/ ' + SITE.fmt(S.constraints, 0) + '</em>', L('all precedences hold in time', '全部前置约束在时间上满足'), '']
      ].map(function (s) { return '<div class="stat ' + s[3] + '"><small>' + s[0] + '</small><b>' + s[1] + '</b><span>' + s[2] + '</span></div>'; }).join('');
      $('#teamLoad').innerHTML = S.teams.map(function (t, k) {
        return '<div class="load-row"><div class="top-line"><span><span style="color:' + TEAM[k].color + '">●</span> <b>' + L(TEAM[k].en, TEAM[k].zh) + '</b></span><span class="muted">' +
          L(t.n + ' members · ' + t.columns + ' col. / ' + t.beams + ' beams', t.n + ' 件 · 柱 ' + t.columns + ' / 梁 ' + t.beams) + '</span></div>' +
          '<div class="bar-line"><div class="bar"><span style="width:' + (t.util * 100).toFixed(1) + '%;background:' + TEAM[k].color + '"></span></div>' + (t.util * 100).toFixed(1) + '%</div>' +
          '<div class="muted small" style="margin-top:3px">' + L('busy ', '忙碌 ') + SITE.fmt(t.busy) + ' h / ' + f1(T) + ' h</div></div>';
      }).join('') + '<p class="note" style="margin-top:4px">' + L('The high-skill Team A installs the most members and has the highest load; idle time of B and C comes mainly from waiting for predecessors.', '技能最高的 A 班组承担最多构件、负荷最高；B、C 班组的空闲时间主要来自等待前置构件完成。') + '</p>';
      $('#pvLegend').innerHTML = legendTeams() + '<span><i style="background:#d7dce4"></i>' + L('Not yet installed', '未安装') + '</span>';
      $('#caseSrc').innerHTML = L('Schedule: ', '方案：') + S.source.schedule + '<br>' + L('Constraints: ', '约束：') + S.source.constraints + '<br>' + L('Formulas: ', '公式：') + S.source.formulas + '<br>' +
        L('Cost = Σ member hours × (team rate + crane 30 CNY/h) with paper Table 3 rates; the research-code rates (400/280/200 CNY/h, crane 50 CNY/h) give ' + SITE.fmt(S.costCode, 0) + ' CNY.',
          '成本 = Σ 构件工时 × (班组时薪 + 塔吊 30 元/h)，采用论文表 3 参数；研究代码中的参数（400/280/200 元/h，塔吊 50 元/h）对应 ' + SITE.fmt(S.costCode, 0) + ' 元。');
    }
    function drawCharts() {
      var F = S.floors;
      fc.setOption({
        textStyle: { fontFamily: FONT }, animation: false, grid: { left: 8, right: 16, top: 8, bottom: 26, containLabel: true },
        tooltip: merge(TIP, { trigger: 'item', formatter: function (q) { var f = F[q.dataIndex]; return '<b>' + fl(f.f) + '</b> · ' + f.n + L(' members', ' 个构件') + '<br>' + f.start + ' – ' + f.end + ' h'; } }),
        xAxis: merge({ type: 'value', min: 0, max: Math.ceil(T / 100) * 100, name: L('Construction time (h)', '施工时间 (h)'), nameLocation: 'middle', nameGap: 26 }, AX),
        yAxis: merge({ type: 'category', data: F.map(function (f) { return fl(f.f); }), axisTick: { show: false } }, AX, { splitLine: { show: false } }),
        series: [
          { type: 'bar', stack: 'w', itemStyle: { color: 'transparent' }, data: F.map(function (f) { return f.start; }), silent: true, barWidth: 14 },
          { type: 'bar', stack: 'w', itemStyle: { color: '#2c5be0', opacity: .85, barBorderRadius: 3 }, data: F.map(function (f) { return +(f.end - f.start).toFixed(1); }), barWidth: 14,
            markLine: { symbol: 'none', silent: true, lineStyle: { color: '#e08a0b', width: 2, type: 'solid' }, label: { show: false }, data: [{ xAxis: p ? p.st.t : 0 }] } }
        ]
      }, true);
      var nb = Math.ceil(T / BIN), bins = TEAM.map(function () { return new Array(nb).fill(0); });
      C.forEach(function (c) { bins[c.k][Math.min(nb - 1, Math.floor((c.s + c.d) / BIN))]++; });
      var labels = Array.from({ length: nb }, function (_, b) { return b * BIN; });
      var acc = 0, cum = labels.map(function (_, b) { acc += bins[0][b] + bins[1][b] + bins[2][b]; return +(acc / C.length * 100).toFixed(1); });
      var pctName = L('Cumulative %', '累计完成 %');
      cu.setOption({
        textStyle: { fontFamily: FONT }, animation: false, grid: { left: 8, right: 8, top: 40, bottom: 26, containLabel: true },
        legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: '#334155', fontSize: 12 } },
        tooltip: merge(TIP, { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: function (ps) { return '<b>' + labels[ps[0].dataIndex] + '–' + (labels[ps[0].dataIndex] + BIN) + ' h</b><br>' + ps.map(function (q) { return q.marker + q.seriesName + ': ' + q.value + (q.seriesName === pctName ? '%' : ''); }).join('<br>'); } }),
        xAxis: { type: 'category', data: labels, name: L('Construction time (h)', '施工时间 (h)'), nameLocation: 'middle', nameGap: 26, nameTextStyle: AX.nameTextStyle, axisTick: { show: false }, axisLine: AX.axisLine, axisLabel: { color: '#64748b', fontSize: 11, interval: 9 } },
        yAxis: [merge({ type: 'value', name: L('members / 20 h', '每 20 h 完成') }, AX), merge({ type: 'value', name: pctName, max: 100 }, AX, { splitLine: { show: false } })],
        series: TEAM.map(function (tm, k) { return { name: L('Team ', '') + tm.id + L('', ' 班组'), type: 'bar', stack: 'n', barCategoryGap: '18%', itemStyle: { color: tm.color }, data: bins[k] }; })
          .concat([{ name: pctName, type: 'line', yAxisIndex: 1, showSymbol: false, data: cum, lineStyle: { color: '#0f172a', width: 2 }, itemStyle: { color: '#0f172a' },
            markLine: { symbol: 'none', silent: true, lineStyle: { color: '#e08a0b', width: 2, type: 'solid' }, label: { show: false }, data: [{ xAxis: p ? Math.min(Math.floor(p.st.t / BIN), nb - 1) : 0 }] } }])
      }, true);
    }
    function onTime(t) {
      if (viewer) paintSchedule(viewer, t);
      var done = 0, act = [];
      C.forEach(function (c) { if (c.s + c.d <= t) done++; else if (c.s <= t) act.push(c); });
      $('#pvTime').textContent = f1(t) + ' / ' + f1(T) + ' h';
      $('#pvNow').innerHTML = '<b>' + f1(t) + ' h</b> · ' + L('installed ', '已安装 ') + '<b>' + done + '</b> / ' + C.length + ' · ' + L('installing ', '正在安装 ') + '<b>' + act.length + '</b>';
      $('#activeList').innerHTML = TEAM.map(function (tm, k) {
        var a = act.filter(function (c) { return c.k === k; })[0];
        return '<div class="active-row"><span class="dot" style="background:' + tm.color + '"></span><b>' + L('Team ', '') + tm.id + L('', ' 班组') + '</b>' +
          (a ? '<span>' + ty(a.t) + ' · ' + fl(a.f) + '</span><span class="t">' + f1(a.s) + ' → ' + f1(a.s + a.d) + ' h</span>' : '<span class="muted">' + L('waiting for predecessors', '等待前置构件') + '</span>') + '</div>';
      }).join('');
      if (fc) fc.setOption({ series: [{}, { markLine: { data: [{ xAxis: t }] } }] });
      if (cu) cu.setOption({ series: [{}, {}, {}, { markLine: { data: [{ xAxis: Math.min(Math.floor(t / BIN), Math.ceil(T / BIN) - 1) }] } }] });
    }
    stats();
    p = player({ T: T, start: T * 0.42, duration: 40, playBtn: $('#pvPlay'), range: $('#pvT'), onTime: onTime });
    $('#pvSpeed').onchange = function (e) { p.st.dur = +e.target.value; };
    function speedOpts() { var v = $('#pvSpeed').value || '40'; $('#pvSpeed').innerHTML = ['20', '40', '90'].map(function (s) { return '<option value="' + s + '">' + L('Play in ' + s + ' s', s + ' 秒播完') + '</option>'; }).join(''); $('#pvSpeed').value = v; }
    speedOpts();
    p.set(T * 0.42);
    SITE.onLang(function () { stats(); speedOpts(); if (fc) drawCharts(); p.set(p.st.t); });
    SITE.lazy($('#floorChart'), function () { SITE.load([A + 'portal-echarts.js']).then(function () { fc = chart($('#floorChart')); cu = chart($('#cumChart')); drawCharts(); p.set(p.st.t); }); });
    SITE.lazy(el, function () {
      SITE.load(RUNTIME).then(function () { return makeViewer(el); }).then(function (v) {
        viewer = v;
        el.querySelectorAll('[data-view]').forEach(function (b) { b.onclick = function () { viewer.view(b.dataset.view); }; });
        p.set(p.st.t);
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    teaser();
    if (window.PORTAL_DATA || $('#cv') || $('#pv')) {
      SITE.load([A + 'portal-data.js']).then(function () { constraints(); dadga(); moacs(); case4d(); });
    }
  });
})();
