/* ME5402 Part 2 — reduced-order planar 3R limb of a TRON 1-inspired wheel-legged robot.
   A line-by-line port of the coursework Python model (params.py, kinematics.py, dynamics.py, controller.py,
   reference.py, integrator.py) so the page can re-run the simulations live. Validated against the Python
   metrics with tools/check_limb_engine.js. Runs in the browser (window.LimbSim) and in node (module.exports). */
(function (root) {
  'use strict';

  var ROBOT = { l1: 0.15, l2: 0.30, l3: 0.25, m1: 1.0, m2: 2.0, m3: 1.7, Iz1: 1.88e-3, Iz2: 1.50e-2, Iz3: 8.85e-3, g: 9.81 };
  var TRAJ = { xc: 0.40, yc: 0.12, radius: 0.03, omega: 2 * Math.PI * 0.2, phi: 0.0 };
  var GAINS = {
    A: { Kp: [15, 20, 15], Ki: [0.5, 0.5, 0.3], Kd: [2, 3, 2] },
    B: { Kp: [25, 30, 20], Ki: [1.0, 1.0, 0.5], Kd: [4, 5, 3] }
  };
  var TWO_PI = 2 * Math.PI;

  function robot(over) { var p = {}, k; for (k in ROBOT) p[k] = ROBOT[k]; for (k in over || {}) p[k] = over[k]; return p; }

  // ---------------------------------------------------------------- kinematics
  function fk(q, p) {
    var a = q[0], b = q[0] + q[1], c = b + q[2];
    return [p.l1 * Math.cos(a) + p.l2 * Math.cos(b) + p.l3 * Math.cos(c),
            p.l1 * Math.sin(a) + p.l2 * Math.sin(b) + p.l3 * Math.sin(c), c];
  }
  function joints(q, p) {  // base, knee, ankle, wheel-axle points for drawing
    var a = q[0], b = q[0] + q[1], c = b + q[2];
    var p1 = [p.l1 * Math.cos(a), p.l1 * Math.sin(a)];
    var p2 = [p1[0] + p.l2 * Math.cos(b), p1[1] + p.l2 * Math.sin(b)];
    var p3 = [p2[0] + p.l3 * Math.cos(c), p2[1] + p.l3 * Math.sin(c)];
    return [[0, 0], p1, p2, p3];
  }
  function jacobian(q, p) {
    var a = q[0], b = q[0] + q[1], c = b + q[2];
    var s1 = Math.sin(a), c1 = Math.cos(a), s12 = Math.sin(b), c12 = Math.cos(b), s123 = Math.sin(c), c123 = Math.cos(c);
    return [[-p.l1 * s1 - p.l2 * s12 - p.l3 * s123, -p.l2 * s12 - p.l3 * s123, -p.l3 * s123],
            [p.l1 * c1 + p.l2 * c12 + p.l3 * c123, p.l2 * c12 + p.l3 * c123, p.l3 * c123],
            [1, 1, 1]];
  }
  // numpy.unwrap along the last axis of a 3-vector (the Python IK branch selection uses it this way)
  function unwrap(d) {
    var out = [d[0]], corr = 0;
    for (var i = 1; i < d.length; i++) {
      var dd = d[i] - d[i - 1];
      var ddmod = ((dd + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI;
      if (ddmod === -Math.PI && dd > 0) ddmod = Math.PI;
      var c = ddmod - dd;
      if (Math.abs(dd) < Math.PI) c = 0;
      corr += c; out.push(d[i] + corr);
    }
    return out;
  }
  function ikBoth(x, y, phi, p) {
    var xw = x - p.l3 * Math.cos(phi), yw = y - p.l3 * Math.sin(phi);
    var c2 = (xw * xw + yw * yw - p.l1 * p.l1 - p.l2 * p.l2) / (2 * p.l1 * p.l2);
    if (c2 < -1 - 1e-9 || c2 > 1 + 1e-9) return null;
    c2 = Math.max(-1, Math.min(1, c2));
    var s = Math.sqrt(Math.max(0, 1 - c2 * c2));
    function sol(q2) {
      var q1 = Math.atan2(yw, xw) - Math.atan2(p.l2 * Math.sin(q2), p.l1 + p.l2 * Math.cos(q2));
      return [q1, q2, phi - q1 - q2];
    }
    return { up: sol(Math.atan2(s, c2)), down: sol(Math.atan2(-s, c2)) };
  }
  function ik(x, y, phi, p, elbow, qPrev) {
    var s = ikBoth(x, y, phi, p);
    if (!s) throw new Error('Desired pose is outside the reachable workspace.');
    if (qPrev) {
      var n = function (q) { var u = unwrap([q[0] - qPrev[0], q[1] - qPrev[1], q[2] - qPrev[2]]); return Math.hypot(u[0], u[1], u[2]); };
      return n(s.up) <= n(s.down) ? s.up : s.down;  // min() keeps the first candidate on ties
    }
    return elbow === 'up' ? s.up : s.down;
  }

  // ---------------------------------------------------------------- dynamics
  function mass(q, p) {
    var q2 = q[1], q3 = q[2], lc1 = p.l1 / 2, lc2 = p.l2 / 2, lc3 = p.l3 / 2, l1 = p.l1, l2 = p.l2;
    var c2 = Math.cos(q2), c3 = Math.cos(q3), c23 = Math.cos(q2 + q3);
    var M11 = p.Iz1 + p.Iz2 + p.Iz3 + p.m1 * lc1 * lc1 + p.m2 * (l1 * l1 + lc2 * lc2 + 2 * l1 * lc2 * c2)
      + p.m3 * (l1 * l1 + l2 * l2 + lc3 * lc3 + 2 * l1 * l2 * c2 + 2 * l1 * lc3 * c23 + 2 * l2 * lc3 * c3);
    var M12 = p.Iz2 + p.Iz3 + p.m2 * (lc2 * lc2 + l1 * lc2 * c2) + p.m3 * (l2 * l2 + lc3 * lc3 + l1 * l2 * c2 + l1 * lc3 * c23 + 2 * l2 * lc3 * c3);
    var M13 = p.Iz3 + p.m3 * (lc3 * lc3 + l1 * lc3 * c23 + l2 * lc3 * c3);
    var M22 = p.Iz2 + p.Iz3 + p.m2 * lc2 * lc2 + p.m3 * (l2 * l2 + lc3 * lc3 + 2 * l2 * lc3 * c3);
    var M23 = p.Iz3 + p.m3 * (lc3 * lc3 + l2 * lc3 * c3);
    var M33 = p.Iz3 + p.m3 * lc3 * lc3;
    return [[M11, M12, M13], [M12, M22, M23], [M13, M23, M33]];
  }
  function gravity(q, p) {
    var a = q[0], b = q[0] + q[1], c = b + q[2], lc1 = p.l1 / 2, lc2 = p.l2 / 2, lc3 = p.l3 / 2;
    return [p.g * (lc1 * p.m1 * Math.cos(a) + p.m2 * (p.l1 * Math.cos(a) + lc2 * Math.cos(b)) + p.m3 * (p.l1 * Math.cos(a) + p.l2 * Math.cos(b) + lc3 * Math.cos(c))),
            p.g * (lc2 * p.m2 * Math.cos(b) + p.m3 * (p.l2 * Math.cos(b) + lc3 * Math.cos(c))),
            p.g * lc3 * p.m3 * Math.cos(c)];
  }
  function coriolis(q, dq, p) {  // Christoffel symbols from a central-difference dM/dq, as in dynamics.py
    var eps = 1e-6, dM = [], i, j, k;
    for (k = 0; k < 3; k++) {
      var qp = q.slice(), qm = q.slice(); qp[k] += eps; qm[k] -= eps;
      var Mp = mass(qp, p), Mm = mass(qm, p), D = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (i = 0; i < 3; i++) for (j = 0; j < 3; j++) D[i][j] = (Mp[i][j] - Mm[i][j]) / (2 * eps);
      dM.push(D);
    }
    var h = [0, 0, 0];
    for (i = 0; i < 3; i++) {
      var tot = 0;
      for (j = 0; j < 3; j++) for (k = 0; k < 3; k++) tot += 0.5 * (dM[k][i][j] + dM[j][i][k] - dM[i][j][k]) * dq[j] * dq[k];
      h[i] = tot;
    }
    return h;
  }
  function solve3(A, b) {  // Gaussian elimination with partial pivoting
    var M = [A[0].concat([b[0]]), A[1].concat([b[1]]), A[2].concat([b[2]])], i, j, k;
    for (i = 0; i < 3; i++) {
      var piv = i;
      for (j = i + 1; j < 3; j++) if (Math.abs(M[j][i]) > Math.abs(M[piv][i])) piv = j;
      var tmp = M[i]; M[i] = M[piv]; M[piv] = tmp;
      for (j = i + 1; j < 3; j++) { var f = M[j][i] / M[i][i]; for (k = i; k < 4; k++) M[j][k] -= f * M[i][k]; }
    }
    var x = [0, 0, 0];
    for (i = 2; i >= 0; i--) { var s = M[i][3]; for (k = i + 1; k < 3; k++) s -= M[i][k] * x[k]; x[i] = s / M[i][i]; }
    return x;
  }
  function accel(q, dq, tau, p) {
    var h = coriolis(q, dq, p), G = gravity(q, p);
    return solve3(mass(q, p), [tau[0] - h[0] - G[0], tau[1] - h[1] - G[1], tau[2] - h[2] - G[2]]);
  }
  function step(q, dq, tau, p, dt) {  // semi-implicit Euler, as integrator.py
    var a = accel(q, dq, tau, p);
    var dqn = [dq[0] + a[0] * dt, dq[1] + a[1] * dt, dq[2] + a[2] * dt];
    return { q: [q[0] + dqn[0] * dt, q[1] + dqn[1] * dt, q[2] + dqn[2] * dt], dq: dqn, ddq: a };
  }

  function desired(t, tr) { return [tr.xc + tr.radius * Math.cos(tr.omega * t), tr.yc + tr.radius * Math.sin(tr.omega * t), tr.phi]; }

  // ---------------------------------------------------------------- Task 4: PID tracking of a circle
  // opts: gains {Kp,Ki,Kd}, gravityComp, torqueLimit, integralLimit, dt, T, traj, plant (robot overrides for the
  // simulated limb, e.g. a heavier payload), model (robot overrides used by the controller's IK and feed-forward)
  function track(opts) {
    opts = opts || {};
    var g = opts.gains || GAINS.B, dt = opts.dt || 1e-3, T = opts.T == null ? 10 : opts.T;
    var lim = opts.torqueLimit == null ? 11 : opts.torqueLimit, ilim = opts.integralLimit == null ? 2 : opts.integralLimit;
    var gc = opts.gravityComp !== false;
    var tr = {}, k; for (k in TRAJ) tr[k] = TRAJ[k]; for (k in opts.traj || {}) tr[k] = opts.traj[k];
    var plant = robot(opts.plant), model = robot(opts.model);
    var n = Math.round(T / dt) + 1;
    var t = new Float64Array(n), q = new Float64Array(3 * n), qd = new Float64Array(3 * n), tau = new Float64Array(3 * n),
        e = new Float64Array(3 * n), xy = new Float64Array(2 * n), xyd = new Float64Array(2 * n);
    var integ = [0, 0, 0];
    var qdPrev = ik.apply(null, desired(0, tr).concat([model, 'down']));
    var qc = qdPrev.slice(), dqc = [0, 0, 0], tauK = [0, 0, 0], eK = [0, 0, 0], i;
    for (k = 0; k < n; k++) t[k] = k * dt;
    for (k = 0; k < n - 1; k++) {
      var dK = desired(t[k], tr), dN = desired(t[k + 1], tr);
      var qdK = ik(dK[0], dK[1], dK[2], model, 'down', qdPrev);
      var qdN = ik(dN[0], dN[1], dN[2], model, 'down', qdK);
      var ff = gc ? gravity(qc, model) : [0, 0, 0];
      for (i = 0; i < 3; i++) {
        eK[i] = qdK[i] - qc[i];
        var de = (qdN[i] - qdK[i]) / dt - dqc[i];
        integ[i] = Math.max(-ilim, Math.min(ilim, integ[i] + eK[i] * dt));
        tauK[i] = Math.max(-lim, Math.min(lim, g.Kp[i] * eK[i] + g.Ki[i] * integ[i] + g.Kd[i] * de + ff[i]));
      }
      var pose = fk(qc, model);
      for (i = 0; i < 3; i++) { q[3 * k + i] = qc[i]; qd[3 * k + i] = qdK[i]; tau[3 * k + i] = tauK[i]; e[3 * k + i] = eK[i]; }
      xy[2 * k] = pose[0]; xy[2 * k + 1] = pose[1]; xyd[2 * k] = dK[0]; xyd[2 * k + 1] = dK[1];
      var s = step(qc, dqc, tauK, plant, dt);
      qc = s.q; dqc = s.dq; qdPrev = qdK;
      if (!isFinite(qc[0] + qc[1] + qc[2])) { n = k + 1; break; }
    }
    // final sample, as in main.py
    var L = n - 1, dL = desired(t[L], tr), qdL = ik(dL[0], dL[1], dL[2], model, 'down', qdPrev), pL = fk(qc, model);
    for (i = 0; i < 3; i++) { q[3 * L + i] = qc[i]; qd[3 * L + i] = qdL[i]; e[3 * L + i] = qdL[i] - qc[i]; tau[3 * L + i] = tau[3 * (L - 1) + i]; }
    xy[2 * L] = pL[0]; xy[2 * L + 1] = pL[1]; xyd[2 * L] = dL[0]; xyd[2 * L + 1] = dL[1];
    var res = { n: n, dt: dt, t: t, q: q, qd: qd, tau: tau, e: e, xy: xy, xyd: xyd, torqueLimit: lim, plant: plant, model: model };
    res.metrics = metrics(res);
    return res;
  }

  function metrics(r) {
    var n = r.n, i, k, jn = 0, jmax = 0, en = 0, emax = 0, se = [0, 0], tmax = [0, 0, 0], sat = [0, 0, 0], jr = [0, 0, 0];
    for (k = 0; k < n; k++) {
      var a = r.e[3 * k], b = r.e[3 * k + 1], c = r.e[3 * k + 2], nn = Math.sqrt(a * a + b * b + c * c);
      jn += nn; if (nn > jmax) jmax = nn;
      jr[0] += a * a; jr[1] += b * b; jr[2] += c * c;
      var dx = r.xy[2 * k] - r.xyd[2 * k], dy = r.xy[2 * k + 1] - r.xyd[2 * k + 1], d = Math.sqrt(dx * dx + dy * dy);
      en += d; if (d > emax) emax = d; se[0] += dx * dx; se[1] += dy * dy;
      for (i = 0; i < 3; i++) {
        var tv = Math.abs(r.tau[3 * k + i]); if (tv > tmax[i]) tmax[i] = tv;
        if (Math.abs(tv - r.torqueLimit) <= 1e-8 + 1e-5 * r.torqueLimit) sat[i]++;
      }
    }
    return { jointErrMean: jn / n, jointErrMax: jmax, jointRmse: jr.map(function (v) { return Math.sqrt(v / n); }),
             eeErrMean: en / n, eeErrMax: emax, eeRmse: [Math.sqrt(se[0] / n), Math.sqrt(se[1] / n)],
             torqueMax: tmax, saturation: sat.map(function (v) { return v / n; }) };
  }

  // ---------------------------------------------------------------- Task 3: open-loop take-off / aerial surrogate
  function openLoop(phase, T, dt) {
    T = T || 0.4; dt = dt || 1e-3;
    var p = robot(), q0 = ik.apply(null, desired(0, TRAJ).concat([p, 'down'])), G0 = gravity(q0, p);
    var amp = phase === 'aerial'
      ? [[0.2, 0.2, 0], [0.3, 0.25, Math.PI / 6], [0.05, 0.1, Math.PI / 3]]
      : [[0.6, 0.5, 0], [0.8, 0.7, Math.PI / 4], [0.2, 0.2, Math.PI / 2]];
    var n = Math.ceil((T + dt) / dt - 1e-9);  // len(np.arange(0, T + dt, dt)) = 401 for T = 0.4
    var out = { n: n, dt: dt, t: new Float64Array(n), q: new Float64Array(3 * n), dq: new Float64Array(3 * n), ddq: new Float64Array(3 * n), tau: new Float64Array(3 * n), q0: q0 };
    var qc = q0.slice(), dqc = [0, 0, 0], k, i;
    for (k = 0; k < n; k++) out.t[k] = k * dt;
    for (i = 0; i < 3; i++) out.q[i] = qc[i];
    for (k = 0; k < n - 1; k++) {
      var tk = out.t[k], tau = [0, 1, 2].map(function (j) { return G0[j] + amp[j][0] + amp[j][1] * Math.sin(TWO_PI * tk + amp[j][2]); });
      var s = step(qc, dqc, tau, p, dt);
      for (i = 0; i < 3; i++) { out.tau[3 * k + i] = tau[i]; out.ddq[3 * k + i] = s.ddq[i]; out.q[3 * (k + 1) + i] = s.q[i]; out.dq[3 * (k + 1) + i] = s.dq[i]; }
      qc = s.q; dqc = s.dq;
    }
    for (i = 0; i < 3; i++) { out.tau[3 * (n - 1) + i] = out.tau[3 * (n - 2) + i]; out.ddq[3 * (n - 1) + i] = out.ddq[3 * (n - 2) + i]; }
    return out;
  }

  var api = { ROBOT: ROBOT, TRAJ: TRAJ, GAINS: GAINS, robot: robot, fk: fk, joints: joints, jacobian: jacobian, ik: ik, ikBoth: ikBoth,
              mass: mass, gravity: gravity, coriolis: coriolis, desired: desired, track: track, openLoop: openLoop };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LimbSim = api;
})(this);
