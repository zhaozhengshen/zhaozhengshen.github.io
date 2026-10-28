/* ME5402 online-replanning page: replay of the recorded MuJoCo runs (window.LAB_DATA / LIVE_AUDIT from
   assets/me5402_live_replay.js) with the original mesh renderer (assets/me5402_live_render.js).
   Adapted from the experiment's own viewer.js; data and renderer load only when the viewer comes into view. */
(function () {
  'use strict';
  var SITE = window.SITE, L = SITE.L;
  var $ = function (id) { return document.getElementById(id); };
  var A = document.documentElement.getAttribute('data-assets') || 'assets/';
  var PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg>';
  var PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>';
  var NAMES = { online: ['Online replanning', '在线重规划'], wait_only: ['Wait for the original route', '仅等待原路线'] };
  var EVENTS = { INITIAL_PLAN: ['Initial route', '初始路线'], BLOCKED: ['Look-ahead finds a block', '前瞻发现阻塞'], REPLAN: ['New route accepted', '接受新路线'],
                 ARRIVED: ['Reached the goal', '到达终点'], RESUME: ['Original route clear again', '原路恢复'], STALE_PLAN: ['Re-check failed', '再次检查未通过'] };
  var MODES = { GRASP: ['Grasping', '抓取'], FOLLOW: ['Following the plan', '沿计划执行'], BRAKE: ['Braking', '制动'], WAIT: ['Waiting for a safe corridor', '等待安全通道'],
                REPLAN: ['Searching a new route', '后台搜索新路线'], PLACE: ['Placing', '放置'], RELEASE: ['Releasing', '松开夹爪'] };
  var t2 = function (pair) { return pair ? L(pair[0], pair[1]) : ''; };

  function init() {
    var canvas = $('lvCanvas'); if (!canvas) return;
    var DATA, AUDIT, R, record, index = 0, playing = false, yaw = -0.52, elevation = 0.65, zoom = 1, last = 0, drag = null;
    var mc = $('lvMap').getContext('2d');

    function options() {
      $('lvCase').innerHTML = DATA.map(function (r, i) { return '<option value="' + i + '">' + r.seed + ' · ' + t2(NAMES[r.method]) + '</option>'; }).join('');
    }
    function table() {
      $('lvResults').innerHTML = AUDIT.runs.map(function (r) {
        return '<tr><td>' + r.seed + ' · ' + t2(NAMES[r.method]) + '</td><td>' + (r.success ? L('completed', '完成') : L('failed', '未完成')) + '</td><td class="num">' + r.carry_s.toFixed(1) + ' s</td>' +
          '<td class="num">' + r.hold_s.toFixed(1) + ' s</td><td class="num">' + r.accepted_replans + '</td><td class="num">' + (r.plan_latency_p95_ms == null ? '—' : r.plan_latency_p95_ms.toFixed(0) + ' ms') + '</td>' +
          '<td class="num">' + r.collision_samples + '</td><td class="num">' + r.final_error_mm.toFixed(2) + ' mm</td></tr>';
      }).join('');
    }
    function setPlay(on) { playing = on; $('lvPlay').innerHTML = on ? PAUSE : PLAY; }
    function load() {
      record = DATA[+$('lvCase').value || 0]; index = 0; setPlay(false); $('lvScrub').value = 0;
      $('lvEvents').innerHTML = record.events.map(function (e, i) {
        return '<button type="button" data-event="' + i + '"><b>' + e.time.toFixed(1) + ' s</b>' + t2(EVENTS[e.kind]) + (e.latency_ms ? ' · ' + e.latency_ms.toFixed(0) + ' ms' : '') + '</button>';
      }).join('');
      draw();
    }
    function seek(t) {
      index = record.trace.findIndex(function (s) { return s.task_time > t + 1e-6; });
      if (index < 0) index = record.trace.length - 1;
      setPlay(false); $('lvScrub').value = index / (record.trace.length - 1) * 1000; draw();
    }
    function draw() {
      if (!record) return;
      var i = Math.min(Math.floor(index), record.trace.length - 1), s = record.trace[i], plan = record.plans[s.plan_id];
      var view = Object.assign({}, record, { plan: plan });
      R.draw(view, index, { yaw: yaw, elevation: elevation, zoom: zoom, searchMode: false, opacity: 100, showTrail: $('lvTrail').checked });
      $('lvStage').textContent = s.mode + ' · PLAN #' + s.plan_id;
      $('lvMode').textContent = t2(MODES[s.mode]) || s.mode;
      $('lvTime').textContent = L('task ', '任务 ') + s.task_time.toFixed(1) + ' s';
      var past = record.events.filter(function (e) { return e.time <= s.task_time; }), recent = past[past.length - 1];
      $('lvStats').innerHTML = [[L('Current plan', '当前计划'), '#' + s.plan_id], [L('Replans accepted', '累计接受重规划'), s.plan_id],
        [L('Latest event', '最近事件'), recent ? t2(EVENTS[recent.kind]) : L('ready', '准备')],
        [L('Orange cart x', '橙色料车 x'), s.movers[0][0].toFixed(3) + ' m'], [L('Cyan cart y', '青色料车 y'), s.movers[1][1].toFixed(3) + ' m']]
        .map(function (r) { return '<div class="stat-row"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'; }).join('');
      // plan view: obstacles, 2 s cart forecast, current plan, travelled path
      mc.clearRect(0, 0, 260, 350);
      var xy = function (p) { return [13 + (p[0] - 0.16) / 0.83 * 235, 335 - (p[1] + 0.58) / 1.17 * 285]; };
      function poly(w, pos, color, ghost) {
        var a = w.yaw || 0, c = Math.cos(a), sn = Math.sin(a);
        mc.beginPath();
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(function (v, j) {
          var x = v[0] * w.size[0], y = v[1] * w.size[1], p = xy([pos[0] + c * x - sn * y, pos[1] + sn * x + c * y]);
          if (j) mc.lineTo(p[0], p[1]); else mc.moveTo(p[0], p[1]);
        });
        mc.closePath();
        if (ghost) { mc.setLineDash([3, 3]); mc.strokeStyle = color; mc.stroke(); mc.setLineDash([]); } else { mc.fillStyle = color; mc.fill(); }
      }
      record.walls.forEach(function (w, k) { poly(w, w.moving ? s.movers[k - 11] : w.pos, k === 11 ? '#e88045' : k === 12 ? '#4abbd0' : '#8796a5'); });
      if ($('lvForecast').checked) {
        var fut = record.trace[Math.min(i + 50, record.trace.length - 1)];
        for (var k = 0; k < 2; k++) poly(record.walls[11 + k], fut.movers[k], k ? '#4abbd0' : '#e88045', true);
      }
      function path(points, color, width, dash) {
        if (points.length < 2) return;
        mc.beginPath(); mc.strokeStyle = color; mc.lineWidth = width; mc.setLineDash(dash || []);
        points.forEach(function (p, j) { var v = xy(p); if (j) mc.lineTo(v[0], v[1]); else mc.moveTo(v[0], v[1]); });
        mc.stroke(); mc.setLineDash([]);
      }
      if (s.plan_id > 0) path(record.plans[0].xyz, '#94a3b8', 1, [3, 4]);
      path(plan.xyz, '#e08a0b', 2.2);
      path(record.trace.slice(0, i + 1).filter(function (t) { return t.stage === 'CARRY'; }).map(function (t) { return t.object; }), '#0f9d98', 2.5);
      var p = xy(s.object); mc.beginPath(); mc.fillStyle = '#0f172a'; mc.arc(p[0], p[1], 4, 0, Math.PI * 2); mc.fill();
    }

    function wire() {
      $('lvCase').onchange = load; $('lvTrail').onchange = draw; $('lvForecast').onchange = draw;
      $('lvEvents').onclick = function (e) { var b = e.target.closest('[data-event]'); if (b) seek(record.events[+b.dataset.event].time); };
      $('lvFirst').onclick = function () {
        var e = record.events.find(function (x) { return x.kind === 'REPLAN'; }) || record.events.find(function (x) { return x.kind === 'BLOCKED'; });
        if (e) seek(e.time);
      };
      $('lvPlay').onclick = function () { if (!playing && index >= record.trace.length - 1) index = 0; setPlay(!playing); };
      $('lvScrub').oninput = function () { index = +$('lvScrub').value / 1000 * (record.trace.length - 1); setPlay(false); draw(); };
      $('lvTop').onclick = function () { elevation = 1.565; yaw = 0; draw(); };
      $('lvOblique').onclick = function () { elevation = 0.65; yaw = -0.52; zoom = 1; draw(); };
      canvas.onpointerdown = function (e) { drag = [e.clientX, e.clientY, yaw, elevation]; canvas.setPointerCapture(e.pointerId); };
      canvas.onpointermove = function (e) {
        if (!drag) return;
        yaw = drag[2] + (e.clientX - drag[0]) * 0.006; elevation = Math.max(0.35, Math.min(1.565, drag[3] + (e.clientY - drag[1]) * 0.004)); draw();
      };
      canvas.onpointerup = canvas.onpointercancel = function () { drag = null; };
      canvas.addEventListener('wheel', function (e) { e.preventDefault(); zoom = Math.max(0.65, Math.min(1.5, zoom * Math.exp(-e.deltaY * 0.001))); draw(); }, { passive: false });
      function tick(t) {
        var dt = Math.min(0.1, (t - last) / 1000); last = t;
        if (playing) {
          index = Math.min(record.trace.length - 1, index + dt * 25 * +$('lvSpeed').value);
          $('lvScrub').value = index / (record.trace.length - 1) * 1000;
          if (index === record.trace.length - 1) setPlay(false);
          draw();
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    SITE.lazy(canvas, function () {
      $('lvNotice').textContent = L('Loading meshes and recorded runs (about 24 MB)…', '正在载入模型与实验记录（约 24 MB）…');
      SITE.load([A + 'me5402_live_replay.js', A + 'me5402_live_mesh.js', A + 'me5402_live_render.js']).then(function () {
        DATA = window.LAB_DATA; AUDIT = window.LIVE_AUDIT;
        R = window.initLiveRender(canvas, $('lvNotice'));
        options(); table(); wire(); load();
        SITE.onLang(function () { var v = $('lvCase').value; options(); $('lvCase').value = v; table(); load(); R.draw && draw(); });
      }).catch(function () { $('lvNotice').textContent = L('The replay data could not be loaded.', '实验记录载入失败。'); });
    }, '200px 0px');
  }

  document.addEventListener('DOMContentLoaded', function () { try { init(); } catch (e) { console.error(e); } });
})();
