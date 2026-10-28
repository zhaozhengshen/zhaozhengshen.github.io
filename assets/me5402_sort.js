/* ME5402 Part 1 page: step-through of the sorting policy's Q maps, learning curves from the authors' logs, baseline vs
   perception-layer evaluation. Data: window.ME5402_STEPS / ME5402_TRAIN / ME5402_SORT (generated files in assets/). */
(function () {
  'use strict';
  var SITE = window.SITE, L = SITE.L;
  var $ = function (s) { return document.querySelector(s); };
  var A = document.documentElement.getAttribute('data-assets') || 'assets/';
  var FONT = 'Inter, "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';
  var INK = '#0f172a', BLUE = '#2c5be0', AMBER = '#e08a0b', TEAL = '#0f9d98', MUTED = '#94a3b8', ROSE = '#c2410c';
  var TIP = { trigger: 'axis', backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, textStyle: { color: INK, fontSize: 12 }, extraCssText: 'box-shadow:0 10px 30px rgba(15,23,42,.14);border-radius:10px;padding:8px 12px' };
  var AX = { axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b', fontSize: 11 }, splitLine: { lineStyle: { color: '#eef2f6' } }, nameTextStyle: { color: '#94a3b8', fontSize: 11 } };
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
  var charts = [];
  function merge() { var o = {}; for (var i = 0; i < arguments.length; i++) for (var k in arguments[i]) o[k] = arguments[i][k]; return o; }
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
  function p0(v) { return Math.round(v * 100) + '%'; }
  var ACT = { push: ['Push', '推'], grasp: ['Grasp', '抓取'], place: ['Place', '放置'] };

  // ---------------------------------------------------------------- step-through viewer
  function steps() {
    var img = $('#stepImg'); if (!img) return;
    var variant = 'base', i = 0, timer = 0, D = null;
    function cur() { return D[variant]; }
    function show(k) {
      var v = cur(), s = v.steps[k]; i = k;
      img.style.backgroundImage = 'url(' + A + v.sprite + ')';
      img.style.backgroundSize = '100% ' + (v.steps.length * 100) + '%';
      img.style.backgroundPosition = '0 ' + (v.steps.length > 1 ? (k / (v.steps.length - 1) * 100) : 0) + '%';
      img.style.aspectRatio = v.w + ' / ' + v.h;
      $('#stepT').max = v.steps.length - 1; $('#stepT').value = k;
      $('#stepTime').textContent = L('step ', '第 ') + (k + 1) + L(' / ', ' / ') + v.steps.length + L('', ' 步');
      $('#stepQLabel').textContent = L('Q map · ', 'Q 值图 · ') + L(ACT[s.action][0], ACT[s.action][1]) + (s.action !== 'place' ? L(' at ', '，') + (s.rot * 22.5) + '°' : '');
      $('#stepList').querySelectorAll('button').forEach(function (b, j) { b.classList.toggle('on', j === k); });
      var on = $('#stepList button.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    function list() {
      var v = cur();
      $('#stepList').innerHTML = v.steps.map(function (s, j) {
        var res = s.ok === true ? '✓' : s.ok === false ? '✗' : '·';
        var cls = s.ok === true ? 'ok' : s.ok === false ? 'bad' : '';
        return '<button type="button" class="' + cls + '" data-i="' + j + '"><b>' + (j + 1) + '</b> ' + L(ACT[s.action][0], ACT[s.action][1]) + ' <i>' + res + '</i>' +
               '<small>' + L('sorted ', '已分拣 ') + s.sorted + (s.q != null ? ' · Q ' + s.q.toFixed(2) : '') + '</small>' + (s.episode_end ? '<em>' + L('episode end', '回合结束') + '</em>' : '') + '</button>';
      }).join('');
    }
    function stop() { clearInterval(timer); timer = 0; $('#stepPlay').innerHTML = PLAY; }
    function play() { stop(); $('#stepPlay').innerHTML = PAUSE; timer = setInterval(function () { show((i + 1) % cur().steps.length); }, 1400); }
    $('#stepPlay').addEventListener('click', function () { timer ? stop() : play(); });
    $('#stepT').addEventListener('input', function () { stop(); show(+$('#stepT').value); });
    $('#stepList').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { stop(); show(+b.dataset.i); } });
    seg($('#stepVariant'), function (v) { variant = v; list(); show(Math.min(i, cur().steps.length - 1)); });
    SITE.lazy(img, function () {
      SITE.load([A + 'me5402_sort_steps.js']).then(function () {
        D = window.ME5402_STEPS;
        $('#stepVariant').querySelectorAll('button').forEach(function (b) { if (!D[b.dataset.v]) b.hidden = true; });
        list(); show(0); play();
        SITE.onLang(function () { list(); show(i); });
      });
    });
  }

  // ---------------------------------------------------------------- learning curves (authors' logs)
  function training() {
    var el = $('#trainChart'); if (!el) return;
    var metric = 'sort', c = null;
    var SETS = [['four-fixed', ['4 blocks, fixed colours', '4 块，固定颜色'], MUTED], ['four-random', ['4 blocks, random colours', '4 块，随机颜色'], TEAL], ['six-random', ['6 blocks, random colours (Model 3)', '6 块，随机颜色（模型 3）'], BLUE]];
    var NAMES = { sort: ['blocks sorted per episode (50-episode window)', '每回合分拣比例（50 回合窗口）'], grasp: ['grasp success (500-action window)', '抓取成功率（500 动作窗口）'],
                  place: ['place success (500-action window)', '放置成功率（500 动作窗口）'], efficiency: ['action efficiency: ideal ÷ actual actions (500-action window)', '动作效率：理想动作数 ÷ 实际动作数（500 动作窗口）'] };
    function draw() {
      var T = window.ME5402_TRAIN;
      $('#trainSub').textContent = L(NAMES[metric][0], NAMES[metric][1]);
      c.setOption({ animation: false, textStyle: { fontFamily: FONT }, tooltip: merge(TIP, { valueFormatter: function (v) { return p0(v); } }),
        legend: { top: 0, textStyle: { color: '#475569', fontSize: 11.5 }, itemWidth: 14, itemHeight: 3 }, grid: { left: 48, right: 18, top: 34, bottom: 40 },
        xAxis: merge(AX, { type: 'value', name: L('training actions', '训练动作数'), nameLocation: 'middle', nameGap: 26, max: 30000, axisLabel: { color: '#64748b', fontSize: 11, formatter: function (v) { return v >= 1000 ? (v / 1000) + 'k' : v; } } }),
        yAxis: merge(AX, { type: 'value', min: 0, max: 1, axisLabel: { color: '#64748b', fontSize: 11, formatter: function (v) { return Math.round(v * 100) + '%'; } } }),
        series: SETS.map(function (s) {
          var d = T[s[0]], xs = metric === 'sort' ? d.sort_iter : d.iter, ys = d[metric];
          return { name: L(s[1][0], s[1][1]), type: 'line', showSymbol: false, data: xs.map(function (x, k) { return [x, ys[k]]; }), lineStyle: { color: s[2], width: s[0] === 'six-random' ? 2.4 : 1.6 }, itemStyle: { color: s[2] } };
        }) }, true);
    }
    seg($('#trainMetric'), function (m) { metric = m; if (c) draw(); });
    SITE.lazy(el, function () { SITE.load([A + 'me5402_sort_train.js', A + 'portal-echarts.js']).then(function () { c = chart(el); draw(); SITE.onLang(draw); }); });
  }

  // ---------------------------------------------------------------- evaluation
  function results() {
    var el = $('#resBars'); if (!el) return;
    var bc = null, sc = null;
    function draw() {
      var R = window.ME5402_SORT, b = R.summary.base, m = R.summary.improve;
      var keys = [['sort_rate', ['Blocks sorted', '分拣率']], ['complete_rate', ['Scene fully sorted', '整场完成']], ['grasp_rate', ['Grasp success', '抓取成功']], ['place_rate', ['Place success', '放置成功']], ['efficiency', ['Action efficiency', '动作效率']]];
      bc.setOption({ animation: false, textStyle: { fontFamily: FONT }, tooltip: merge(TIP, { valueFormatter: function (v) { return p0(v); } }),
        legend: { top: 0, textStyle: { color: '#475569', fontSize: 11.5 }, itemWidth: 12, itemHeight: 8 }, grid: { left: 44, right: 12, top: 34, bottom: 52 },
        xAxis: merge(AX, { type: 'category', data: keys.map(function (k) { return L(k[1][0], k[1][1]); }), axisLabel: { color: '#475569', fontSize: 11, interval: 0, width: 70, overflow: 'break' } }),
        yAxis: merge(AX, { type: 'value', min: 0, max: 1, axisLabel: { color: '#64748b', fontSize: 11, formatter: function (v) { return Math.round(v * 100) + '%'; } } }),
        series: [{ name: L('Baseline', '基线'), type: 'bar', barGap: '12%', data: keys.map(function (k) { return b[k[0]]; }), itemStyle: { color: MUTED, borderRadius: [4, 4, 0, 0] },
                   label: { show: true, position: 'top', fontSize: 10.5, color: '#475569', formatter: function (p) { return Math.round(p.value * 100); } } },
                 { name: L('With perception layer', '加感知层'), type: 'bar', data: m ? keys.map(function (k) { return m[k[0]]; }) : [], itemStyle: { color: BLUE, borderRadius: [4, 4, 0, 0] },
                   label: { show: true, position: 'top', fontSize: 10.5, color: '#1e40af', formatter: function (p) { return Math.round(p.value * 100); } } }] }, true);
      var scenes = Object.keys(R.runs.base || {}).sort(), pts = function (v, off, color) {
        var d = []; scenes.forEach(function (s, si) { ((R.runs[v] || {})[s] || { episodes: [] }).episodes.forEach(function (e, k) { d.push([si + off + (k - 0.5) * 0.08, e.sorted, e.actions]); }); });
        return { name: v === 'base' ? L('Baseline', '基线') : L('With perception layer', '加感知层'), type: 'scatter', symbolSize: 10, data: d, itemStyle: { color: color, opacity: 0.9 } };
      };
      sc.setOption({ animation: false, textStyle: { fontFamily: FONT },
        tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#e2e8f0', textStyle: { color: INK, fontSize: 12 }, formatter: function (p) { return p.seriesName + '<br>' + L('scene ', '场景 ') + scenes[Math.round(p.value[0])] + ': <b>' + p.value[1] + ' / 6</b> ' + L('sorted in ', '块，用 ') + p.value[2] + L(' actions', ' 个动作'); } },
        legend: { top: 0, textStyle: { color: '#475569', fontSize: 11.5 }, itemWidth: 10, itemHeight: 10 }, grid: { left: 40, right: 12, top: 34, bottom: 40 },
        xAxis: merge(AX, { type: 'value', min: -0.5, max: scenes.length - 0.5, interval: 1, name: L('preset scene', '预设场景'), nameLocation: 'middle', nameGap: 26, axisLabel: { color: '#64748b', fontSize: 11, formatter: function (v) { return scenes[v] || ''; } }, splitLine: { show: false } }),
        yAxis: merge(AX, { type: 'value', min: 0, max: 6, interval: 1, name: L('blocks sorted', '分拣块数') }),
        series: [pts('base', -0.14, MUTED), pts('improve', 0.14, BLUE)] }, true);
      var st = { grasp_refined: 0, grasp_kept: 0, place_overridden: 0, place_kept: 0, masked_retries: 0 };
      Object.keys(R.runs.improve || {}).forEach(function (s) { var x = R.runs.improve[s].improve_stats || {}; for (var k in st) st[k] += x[k] || 0; });
      $('#resStats').innerHTML = '<b>' + L('What the perception layer changed', '感知层做了什么') + '</b><div class="small muted" style="margin-top:6px">' +
        L('Grasp point moved to the contour centre in ', '抓取点移到轮廓质心：') + st.grasp_refined + L(' of ', ' / ') + (st.grasp_refined + st.grasp_kept) + L(' grasps; place redirected to the matching bin in ', ' 次抓取；放置位置改到同色料框：') +
        st.place_overridden + L(' of ', ' / ') + (st.place_overridden + st.place_kept) + L(' places; a failed grasp location was masked ', ' 次放置；失败抓取位置被屏蔽 ') + st.masked_retries + L(' times. Actions per episode: ', ' 次。每回合动作数：') +
        b.actions.toFixed(1) + ' → ' + (m ? m.actions.toFixed(1) : '—') + L('.', '。') + '</div>';
    }
    SITE.lazy(el, function () { SITE.load([A + 'me5402_sort_results.js', A + 'portal-echarts.js']).then(function () { bc = chart(el); sc = chart($('#resScenes')); draw(); SITE.onLang(draw); }); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    [steps, training, results].forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  });
})();
