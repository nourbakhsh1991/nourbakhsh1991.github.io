/* Reza Nourbakhsh personal site: 3D models and interactions. Plain JS, no build step. */
(function () {
  'use strict';
  class DCLogic {
    constructor() { this.state = {}; this.props = {}; }
    setState(patch, cb) { Object.assign(this.state, patch); render(); if (cb) cb(); }
  }
class Component extends DCLogic {
  componentDidMount() {
    this.alive = true; this.now = 0;
    this.cv = this.cv || {}; this.stages = {};
    this.flags = { hms: { target: 0, auto: true, last: 0, changed: -10 }, or: { idx: 0, auto: true, last: 0, speakAt: -10 }, plc: { burst: 0, sent: 0 }, stone: {}, exc: { mode: 0 } };
    this.boot();
  }
  componentWillUnmount() {
    this.alive = false; clearTimeout(this.wait);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.mq && this.mq.removeEventListener) this.mq.removeEventListener('change', this.mqFn);
    Object.keys(this.stages).forEach((k) => { try { this.stages[k].dispose(); } catch (e) {} });
  }
  boot() {
    if (!this.alive) return;
    if (!window.THREE) { this.wait = setTimeout(() => this.boot(), 120); return; }
    this.ready = true;
    if (window.matchMedia && !this.mq) {
      this.mq = window.matchMedia('(prefers-color-scheme: dark)');
      this.mqFn = () => this.applyTheme();
      if (this.mq.addEventListener) this.mq.addEventListener('change', this.mqFn);
    }
    this.setPalette(this.isDark());
    Object.keys(this.cv).forEach((k) => this.mount(k));
    if (!this.raf) {
      this.t0 = performance.now(); this.prev = this.t0;
      const loop = (now) => {
        if (!this.alive) return;
        const t = (now - this.t0) / 1000, dt = Math.min(0.05, (now - this.prev) / 1000);
        this.prev = now; this.now = t;
        Object.keys(this.stages).forEach((k) => { const s = this.stages[k]; if (s.visible) { try { s.tick(t, dt); } catch (e) { console.warn(k, e); s.visible = false; } } });
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }
  }
  isDark() {
    const th = (this.state && this.state.theme) || 'system';
    if (th === 'dark') return true;
    if (th === 'light') return false;
    return !!(this.mq && this.mq.matches);
  }
  applyTheme() {
    if (!this.ready) return;
    const d = this.isDark();
    if (d === this.darkNow) return;
    Object.keys(this.stages).forEach((k) => { try { this.stages[k].dispose(); } catch (e) {} });
    this.stages = {};
    this.setPalette(d);
    Object.keys(this.cv).forEach((k) => this.mount(k));
  }
  setTheme(th) {
    this.setState({ theme: th }, () => this.applyTheme());
  }
  setPalette(dark) {
    const T = window.THREE;
    this.darkNow = dark;
    this.P = dark
      ? { line: 0xc9ced5, fill: 0x1c2128, grid: 0x2e353f, accent: 0xd9a87c, hl: 0xe8ac76, d1: 0x8fafd6, d2: 0xa2c08a, d3: 0xbba5da, d4: 0xcdb487, off: 0x262c35 }
      : { line: 0x3a434d, fill: 0xf6f7f8, grid: 0xc9ced5, accent: 0x8e5528, hl: 0xa0521c, d1: 0x2f5f96, d2: 0x4f7330, d3: 0x76489a, d4: 0x8a5e1e, off: 0xdde1e5 };
    const P = this.P;
    this.M = {
      fill: new T.MeshBasicMaterial({ color: P.fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      ink: new T.LineBasicMaterial({ color: P.line }),
      hl: new T.LineBasicMaterial({ color: P.hl }),
      accent: new T.LineBasicMaterial({ color: P.accent }),
      d1: new T.LineBasicMaterial({ color: P.d1 })
    };
  }
  mount(k) {
    if (!this.ready || this.stages[k] || !this.cv[k]) return;
    try { this.stages[k] = this.stage(this.cv[k], this['build_' + k].bind(this)); } catch (e) { console.warn('mount ' + k, e); }
  }
  stage(el, build) {
    const T = window.THREE;
    const renderer = new T.WebGLRenderer({ canvas: el, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(32, 1, 0.1, 200);
    const pivot = new T.Group(); scene.add(pivot);
    const s = { T, renderer, scene, camera, pivot, el, visible: true, drag: null, ry: 0, rx: 0, mouse: null };
    const cfg = build(s) || {};
    const cam = cfg.cam || [0, 4, 10], look = cfg.look || [0, 1, 0];
    // On narrow panels (phones), widen the vertical field of view so the horizontal view matches desktop and the whole model stays in frame.
    const REF = cfg.refAspect || 1.55, FOV = 32;
    const resize = () => {
      const w = el.clientWidth || 1, h = el.clientHeight || 1, a = w / h;
      renderer.setSize(w, h, false); camera.aspect = a;
      camera.fov = a >= REF ? FOV : Math.min(75, 2 * Math.atan(Math.tan(FOV * Math.PI / 360) * REF / a) * 180 / Math.PI);
      camera.updateProjectionMatrix();
    };
    resize();
    s.ro = new ResizeObserver(resize); s.ro.observe(el);
    s.io = new IntersectionObserver((es) => { s.visible = es[0].isIntersecting; }); s.io.observe(el);
    const pos = (e) => { const r = el.getBoundingClientRect(); s.mouse = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }; };
    const up = () => { s.down = false; s.drag = null; if (!cfg.noDrag) el.style.cursor = 'grab'; };
    const ls = {
      pointerdown: (e) => { s.down = true; if (cfg.noDrag) return; s.drag = { x: e.clientX, y: e.clientY, ry: s.ry, rx: s.rx }; el.style.cursor = 'grabbing'; },
      pointermove: (e) => { pos(e); if (s.drag) { s.ry = s.drag.ry + (e.clientX - s.drag.x) * 0.008; s.rx = Math.max(-0.45, Math.min(0.55, s.drag.rx + (e.clientY - s.drag.y) * 0.005)); } },
      pointerup: up, pointercancel: up,
      pointerleave: () => { s.mouse = null; up(); }
    };
    Object.keys(ls).forEach((n) => el.addEventListener(n, ls[n]));
    s.tick = (t, dt) => {
      if (!s.drag && cfg.spin) s.ry += cfg.spin * dt;
      pivot.rotation.y = s.ry + (cfg.sway ? Math.sin(t * 0.25) * cfg.sway : 0);
      pivot.rotation.x = s.rx;
      camera.position.set(cam[0], cam[1], cam[2]); camera.lookAt(look[0], look[1], look[2]);
      if (cfg.update) cfg.update(t, dt);
      renderer.render(scene, camera);
    };
    s.dispose = () => { Object.keys(ls).forEach((n) => el.removeEventListener(n, ls[n])); s.ro.disconnect(); s.io.disconnect(); if (cfg.dispose) cfg.dispose(); renderer.dispose(); };
    return s;
  }
  part(s, g, parent, x, y, z) {
    const T = s.T;
    const m = new T.Mesh(g, this.M.fill); m.position.set(x || 0, y || 0, z || 0);
    m.add(new T.LineSegments(new T.EdgesGeometry(g, 22), this.M.ink));
    parent.add(m); return m;
  }
  lines(s, list, mat, y, parent) {
    const T = s.T, a = new Float32Array(list.length * 6);
    list.forEach((q, i) => { a.set([q[0], y || 0, q[1], q[2], y || 0, q[3]], i * 6); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3));
    const l = new T.LineSegments(g, mat); (parent || s.pivot).add(l); return l;
  }
  floor(s, size, n) {
    const L = [], h = size / 2;
    for (let i = 0; i <= n; i++) { const v = -h + size * i / n; L.push([v, -h, v, h]); L.push([-h, v, h, v]); }
    this.lines(s, L, new s.T.LineBasicMaterial({ color: this.P.grid }), 0);
  }
  arm(s, parent, L1, L2, SH, TIP, sc) {
    const T = s.T, k = sc || 1;
    const jc = (r, len) => { const g = new T.CylinderGeometry(r, r, len, 20); g.rotateX(Math.PI / 2); return g; };
    this.part(s, new T.CylinderGeometry(0.75 * k, 0.9 * k, 0.28 * k, 28), parent, 0, 0.14 * k, 0);
    const yaw = new T.Group(); yaw.position.y = 0.28 * k; parent.add(yaw);
    this.part(s, new T.CylinderGeometry(0.5 * k, 0.6 * k, 0.55 * k, 20), yaw, 0, 0.28 * k, 0);
    const sh = new T.Group(); sh.position.y = SH - 0.28 * k; yaw.add(sh);
    this.part(s, jc(0.32 * k, 0.7 * k), sh);
    this.part(s, new T.BoxGeometry(0.32 * k, L1, 0.4 * k), sh, 0, L1 / 2, 0);
    const elb = new T.Group(); elb.position.y = L1; sh.add(elb);
    this.part(s, jc(0.26 * k, 0.56 * k), elb);
    this.part(s, new T.BoxGeometry(0.26 * k, L2, 0.32 * k), elb, 0, L2 / 2, 0);
    const wr = new T.Group(); wr.position.y = L2; elb.add(wr);
    this.part(s, jc(0.19 * k, 0.42 * k), wr);
    const roll = new T.Group(); wr.add(roll);
    this.part(s, new T.CylinderGeometry(0.13 * k, 0.17 * k, 0.4 * k, 16), roll, 0, 0.27 * k, 0);
    const f1 = this.part(s, new T.BoxGeometry(0.07 * k, 0.34 * k, 0.18 * k), roll, 0.12 * k, 0.6 * k, 0);
    const f2 = this.part(s, new T.BoxGeometry(0.07 * k, 0.34 * k, 0.18 * k), roll, -0.12 * k, 0.6 * k, 0);
    const tip = new T.Object3D(); tip.position.y = TIP; roll.add(tip);
    const cur = { y: 0, s: 0, e: -1, w: 0 };
    const solve = (p, rate) => {
      const r = Math.hypot(p.x, p.z), h = Math.max(p.y, 0.25) + TIP - SH;
      const cl = (v) => Math.min(1, Math.max(-1, v));
      const d = Math.max(0.5, Math.min(Math.hypot(r, h), L1 + L2 - 0.02));
      const phi = Math.atan2(h, r);
      const a1 = Math.acos(cl((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), a2 = Math.acos(cl((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
      const al = phi + a1, be = al - (Math.PI - a2);
      let dy = Math.atan2(-p.z, p.x) - cur.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      cur.y += dy * rate; cur.s += ((al - Math.PI / 2) - cur.s) * rate; cur.e += ((a2 - Math.PI) - cur.e) * rate; cur.w += ((-Math.PI / 2 - be) - cur.w) * rate;
      yaw.rotation.y = cur.y; sh.rotation.z = cur.s; elb.rotation.z = cur.e; wr.rotation.z = cur.w;
    };
    return { tip, roll, f1, f2, cur, solve };
  }
  trail(s, parent, N, mat) {
    const T = s.T, a = new Float32Array(N * 3), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3));
    const l = new T.Line(g, mat); l.frustumCulled = false; parent.add(l);
    let primed = false;
    return (v) => { if (!primed) { for (let i = 0; i < N; i++) a.set([v.x, v.y, v.z], i * 3); primed = true; } a.copyWithin(0, 3); a.set([v.x, v.y, v.z], (N - 1) * 3); g.attributes.position.needsUpdate = true; };
  }
  deg(r) { const v = (r * 57.2958).toFixed(1); return v.charAt(0) === '-' ? '−' + v.slice(1) : v; }

  build_hms(s) {
    // Clean-room suite: a DWG plan that becomes a live map of Modbus devices (simulated data).
    const T = s.T, P = this.P, el = s.el;
    const ink = new T.LineBasicMaterial({ color: P.line });
    const W = [
      [-4, -2.5, 4, -2.5], [4, -2.5, 4, 2.5], [4, 2.5, -4, 2.5], [-4, 2.5, -4, -2.5],
      [-4, 1, -3.2, 1], [-2.4, 1, 0.9, 1], [1.5, 1, 2.6, 1], [3.4, 1, 4, 1],
      [-1.6, -2.5, -1.6, -0.3], [-1.6, 0.5, -1.6, 1],
      [-0.4, -2.5, -0.4, -1.9], [-0.4, -1.3, -0.4, -0.3], [-0.4, 0.5, -0.4, 1],
      [-1.6, -0.8, -0.4, -0.8]
    ];
    this.lines(s, W, ink, 0);
    // Walls rise out of the plan in live mode.
    const WH = 0.7, walls = [], wallFill = new T.MeshBasicMaterial({ color: P.fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    W.forEach((w) => {
      const L = Math.hypot(w[2] - w[0], w[3] - w[1]), g = new T.BoxGeometry(L + 0.07, WH, 0.07);
      const m = new T.Mesh(g, wallFill); m.add(new T.LineSegments(new T.EdgesGeometry(g), ink));
      m.position.set((w[0] + w[2]) / 2, WH / 2, (w[1] + w[3]) / 2); m.rotation.y = -Math.atan2(w[3] - w[1], w[2] - w[0]);
      s.pivot.add(m); walls.push(m);
    });
    // CAD furniture: benches and equipment outlines
    const furn = [];
    const rect = (x1, z1, x2, z2) => furn.push([x1, z1, x2, z1], [x2, z1, x2, z2], [x2, z2, x1, z2], [x1, z2, x1, z1]);
    rect(0.4, -2.3, 3.6, -1.9); rect(2.6, -1.2, 3.6, -0.2); rect(-3.8, -2.3, -2.2, -2.0); rect(-3.8, -1.2, -3.4, 0.6);
    const circ = (cx, cz, r) => { for (let i = 0; i < 24; i++) { const a0 = i / 24 * Math.PI * 2, a1 = (i + 1) / 24 * Math.PI * 2; furn.push([cx + r * Math.cos(a0), cz + r * Math.sin(a0), cx + r * Math.cos(a1), cz + r * Math.sin(a1)]); } };
    circ(1.2, -0.6, 0.35); circ(-1.0, -1.65, 0.25);
    this.lines(s, furn, new T.LineBasicMaterial({ color: P.grid }), 0);
    // Room labels
    const C = this.darkNow ? { text: '#8c95a3' } : { text: '#5b6370' };
    const label = (txt, x, z) => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
      g.font = '700 26px Manrope, "Segoe UI", sans-serif'; g.fillStyle = C.text; g.textAlign = 'center'; g.fillText(txt.toUpperCase(), 128, 40);
      const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), transparent: true, depthWrite: false }));
      sp.scale.set(1.6, 0.4, 1); sp.position.set(x, 0.05, z); s.pivot.add(sp); return sp;
    };
    [['Gowning', -2.8, -0.4], ['Airlock', -1.0, 0.75], ['Storage', -1.0, -2.25], ['Clean room', 2.1, 0.45], ['Corridor', -0.6, 1.75]].forEach((l) => label(l[0], l[1], l[2]));

    const objs = [], pick = [];
    const stMat = () => new T.LineBasicMaterial({ color: P.d2 });
    const tintFill = () => new T.MeshBasicMaterial({ color: P.fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    // Sealed doors: hinge position, closed angle, swing direction, rooms
    const doors = [
      { id: 'D1', name: 'Sealed door D1', rooms: 'Corridor → Gowning', unit: 11, hx: -3.2, hz: 1.0, base: 0, dir: 1 },
      { id: 'D2', name: 'Sealed door D2', rooms: 'Gowning → Airlock', unit: 12, hx: -1.6, hz: -0.3, base: -Math.PI / 2, dir: 1, lock: 'D3' },
      { id: 'D3', name: 'Sealed door D3', rooms: 'Airlock → Clean room', unit: 13, hx: -0.4, hz: -0.3, base: -Math.PI / 2, dir: 1, lock: 'D2' },
      { id: 'D4', name: 'Sealed door D4', rooms: 'Clean room → Corridor, exit', unit: 14, hx: 2.6, hz: 1.0, base: 0, dir: -1 }
    ];
    const dash = new T.LineDashedMaterial({ color: P.grid, dashSize: 0.06, gapSize: 0.05 });
    doors.forEach((d) => {
      const hg = new T.Group(); hg.position.set(d.hx, 0, d.hz); hg.rotation.y = d.base; s.pivot.add(hg);
      const sw = []; for (let i = 0; i <= 20; i++) { const a = d.dir * (i / 20) * Math.PI / 2; sw.push(new T.Vector3(0.8 * Math.cos(a), 0.002, -0.8 * Math.sin(a))); }
      const arc = new T.Line(new T.BufferGeometry().setFromPoints(sw), dash); arc.computeLineDistances(); hg.add(arc);
      const leaf = new T.Group(); hg.add(leaf);
      const geo = new T.BoxGeometry(0.8, 0.55, 0.06), lm = stMat();
      const m = new T.Mesh(geo, tintFill()); m.position.set(0.4, 0.275, 0); m.add(new T.LineSegments(new T.EdgesGeometry(geo), lm)); leaf.add(m);
      Object.assign(d, { kind: 'door', leaf, lm, mesh: m, open: 0, target: 0, until: 0, count: 0, changed: 0, pos: new T.Vector3(d.hx, 0, d.hz) });
      m.userData.obj = d; pick.push(m); objs.push(d);
    });
    // Pass boxes in the clean-room walls
    const boxes = [
      { id: 'P1', name: 'Pass box P1', rooms: 'Corridor → Clean room', unit: 21, x: 1.2, z: 1.0, ph: 0 },
      { id: 'P2', name: 'Pass box P2', rooms: 'Storage → Clean room', unit: 22, x: -0.4, z: -1.6, ph: 6 }
    ];
    boxes.forEach((b) => {
      const geo = new T.BoxGeometry(0.56, 0.42, 0.56), lm = new T.LineBasicMaterial({ color: P.line });
      const m = new T.Mesh(geo, tintFill()); m.position.set(b.x, 0.21, b.z); m.add(new T.LineSegments(new T.EdgesGeometry(geo), lm)); s.pivot.add(m);
      const lampM = new T.MeshBasicMaterial({ color: P.off }); const lamp = new T.Mesh(new T.SphereGeometry(0.07, 12, 12), lampM); lamp.position.set(0, 0.28, 0); m.add(lamp);
      Object.assign(b, { kind: 'box', mesh: m, lm, lampM, t0: -b.ph, stage: -1, changed: 0, cycles: 0, pos: new T.Vector3(b.x, 0, b.z) });
      m.userData.obj = b; pick.push(m); objs.push(b);
    });
    // Differential-pressure sensors
    const sensors = [
      { id: 'S1', name: 'Pressure sensor S1', rooms: 'Clean room', unit: 31, x: 1.9, z: -1.3, nom: 15 },
      { id: 'S2', name: 'Pressure sensor S2', rooms: 'Airlock', unit: 32, x: -1.0, z: -0.45, nom: 8 },
      { id: 'S3', name: 'Pressure sensor S3', rooms: 'Gowning', unit: 33, x: -2.7, z: -1.4, nom: 5 }
    ];
    sensors.forEach((n) => {
      const geo = new T.CylinderGeometry(0.16, 0.16, 0.12, 20), lm = new T.LineBasicMaterial({ color: P.d1 });
      const m = new T.Mesh(geo, tintFill()); m.position.set(n.x, 0.06, n.z); m.add(new T.LineSegments(new T.EdgesGeometry(geo, 30), lm)); s.pivot.add(m);
      Object.assign(n, { kind: 'sensor', mesh: m, lm, v: n.nom, changed: 0, pos: new T.Vector3(n.x, 0, n.z) });
      m.userData.obj = n; pick.push(m); objs.push(n);
    });
    // Modbus pulses
    const rings = [];
    const ringGeo = (() => { const p = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; p.push(new T.Vector3(Math.cos(a), 0.01, Math.sin(a))); } return new T.BufferGeometry().setFromPoints(p); })();
    for (let i = 0; i < 10; i++) { const rm = new T.LineBasicMaterial({ color: P.accent, transparent: true, opacity: 0 }); const r = new T.Line(ringGeo, rm); r.visible = false; s.pivot.add(r); rings.push({ r, rm, t: -10 }); }
    let now = 0;
    const pulse = (o) => { const r = rings.find((q) => now - q.t > 0.9) || rings[0]; r.t = now; r.r.position.set(o.pos.x, 0, o.pos.z); r.r.visible = true; };
    // Selection marker
    const selM = new T.LineBasicMaterial({ color: P.accent });
    const sel = new T.Line(ringGeo, selM); sel.scale.setScalar(0.5); s.pivot.add(sel);
    let selected = doors[1];
    // Click (not drag) to select
    const ray = new T.Raycaster(), ndc = new T.Vector2();
    let downAt = null;
    const cfg = { cam: [-0.6, 11.5, 8.0], look: [-0.6, 0, 0.1], sway: 0.1, noDrag: true, refAspect: 1.35 };
    const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) { downAt = null; return; }
      downAt = null;
      const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, s.camera);
      const hit = ray.intersectObjects(pick, false)[0];
      if (hit) { selected = hit.object.userData.obj; this.setHms(1, true); push(true); }
    };
    const onMove = (e) => {
      if (s.drag) return;
      const r = el.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, s.camera); el.style.cursor = ray.intersectObjects(pick, false).length ? 'pointer' : 'default';
    };
    el.addEventListener('pointerdown', onDown); el.addEventListener('pointerup', onUp); el.addEventListener('pointermove', onMove);
    cfg.dispose = () => { el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp); el.removeEventListener('pointermove', onMove); };
    // Info card
    const ago = (t) => { const d = Math.max(0, Math.round(now - t)); return d < 60 ? d + ' s ago' : Math.round(d / 60) + ' min ago'; };
    const STG = ['Idle', 'Loaded', 'UV cycle', 'Ready'], DUR = [3, 2.2, 5, 3];
    let lastPush = -1;
    const push = (force) => {
      if (!force && now - lastPush < 0.25) return; lastPush = now;
      const o = selected; let state, detail, dot;
      if (o.kind === 'door') { const op = o.target > 0; state = op ? 'Open' : 'Closed'; dot = op ? 'open' : 'ok'; detail = 'Opened ' + o.count + (o.count === 1 ? ' time' : ' times') + ' · changed ' + ago(o.changed) + (o.lock ? ' · interlocked with ' + o.lock : ''); }
      else if (o.kind === 'box') { const st = Math.max(0, o.stage); state = STG[st]; dot = st === 2 ? 'uv' : st === 1 ? 'info' : 'ok'; detail = st === 2 ? 'UV lamp on · ' + Math.max(0, Math.ceil(DUR[2] - (now - o.t0))) + ' s left' : 'Interlocked doors · ' + o.cycles + ' UV cycles'; }
      else { state = '+' + o.v.toFixed(1) + ' Pa'; dot = 'info'; detail = 'Differential pressure · target +' + o.nom + ' Pa'; }
      this.setState({ hmsName: o.name, hmsMeta: o.rooms + ' · Modbus unit ' + o.unit, hmsState: state, hmsDot: dot, hmsDetail: detail });
    };
    push(true);
    const f = this.flags.hms; let e = 0, nextEvt = 1.5;
    const byId = (id) => doors.find((d) => d.id === id);
    return Object.assign(cfg, {
      update: (t, dt) => {
        now = t;
        if (f.auto && f.target === 0 && t > 2.5) this.setHms(1, false);
        e += (f.target - e) * Math.min(1, dt * 2.6);
        const live = f.target === 1;
        // Door events, respecting the airlock interlock
        if (live && t > nextEvt) {
          nextEvt = t + 1.4 + Math.random() * 1.6;
          const free = doors.filter((d) => d.target === 0 && !(d.lock && byId(d.lock).target > 0));
          if (free.length) { const d = free[Math.floor(Math.random() * free.length)]; d.target = 1; d.until = t + 2.2 + Math.random() * 1.8; d.count++; d.changed = t; pulse(d); }
        }
        doors.forEach((d) => {
          if (d.target > 0 && t > d.until) { d.target = 0; d.changed = t; pulse(d); }
          const goal = live ? d.target : 0;
          d.open += (goal - d.open) * Math.min(1, dt * 4);
          d.leaf.rotation.y = d.dir * d.open * Math.PI / 2;
          d.lm.color.setHex(e < 0.5 ? P.line : (d.target > 0 ? P.accent : P.d2));
        });
        // Pass box cycle: Idle, Loaded, UV cycle, Ready
        boxes.forEach((b) => {
          if (!live) return;
          if (b.stage < 0) { b.stage = 0; b.t0 = t - b.ph * 0.3; }
          if (t - b.t0 > DUR[b.stage]) { b.stage = (b.stage + 1) % 4; b.t0 = t; b.changed = t; if (b.stage === 3) b.cycles++; pulse(b); }
          const col = [P.line, P.d1, P.d3, P.d2][b.stage];
          b.lm.color.setHex(e < 0.5 ? P.line : col);
          b.lampM.color.setHex(b.stage === 2 ? (Math.sin(t * 10) > 0 ? P.d3 : P.off) : (b.stage === 0 ? P.off : col));
        });
        sensors.forEach((n) => { n.v = n.nom + 0.6 * Math.sin(t * 0.7 + n.unit) + 0.15 * Math.sin(t * 3.1 + n.unit); n.lm.color.setHex(e < 0.5 ? P.line : P.d1); });
        // Objects rise out of the flat drawing in live mode
        objs.forEach((o) => { o.mesh.scale.y = 0.05 + 0.95 * e; });
        walls.forEach((m) => { const k = 0.01 + 0.99 * e; m.scale.y = k; m.position.y = WH / 2 * k; });
        rings.forEach((q) => { const a = (t - q.t) / 0.9; if (a >= 0 && a < 1) { q.r.scale.setScalar(0.2 + a * 0.9); q.rm.opacity = 1 - a; } else { q.r.visible = false; } });
        sel.position.set(selected.pos.x + (selected.kind === 'door' ? 0 : 0), 0, selected.pos.z);
        if (selected.kind === 'door') { const a = selected.base, L = 0.4; sel.position.x = selected.hx + L * Math.cos(a); sel.position.z = selected.hz - L * Math.sin(a); }
        sel.scale.setScalar(0.5 + 0.05 * Math.sin(t * 4)); sel.visible = e > 0.5;
        push(false);
      }
    });
  }
  setHms(v, manual) {
    const f = this.flags.hms;
    if (manual) f.auto = false;
    if (f.target === v) return;
    f.target = v; f.changed = this.now;
    this.setState({ hmsSel: v });
  }
  build_or(s) {
    const T = s.T, P = this.P;
    this.floor(s, 8, 8);
    const wallL = [[-4, 0, -4, 4.4], [4, 0, 4, 4.4], [-4, 4.4, 4, 4.4]];
    const wa = new Float32Array(wallL.length * 6); wallL.forEach((q, i) => wa.set([q[0], q[1], -3.2, q[2], q[3], -3.2], i * 6));
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.BufferAttribute(wa, 3)); s.pivot.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color: P.grid })));
    // Operating table and surgical lights, moved left so the wall panel is in clear view
    const TX = -1.9;
    this.part(s, new T.CylinderGeometry(0.22, 0.3, 0.8, 16), s.pivot, TX, 0.4, 0);
    this.part(s, new T.BoxGeometry(2.4, 0.14, 0.8), s.pivot, TX, 0.87, 0);
    this.part(s, new T.BoxGeometry(2.2, 0.08, 0.7), s.pivot, TX, 0.98, 0);
    const lamps = [-0.9, 0.9].map((sx) => {
      const grp = new T.Group(); grp.position.set(TX + sx, 3.1, 0.15); grp.rotation.z = sx > 0 ? 0.28 : -0.28; s.pivot.add(grp);
      this.part(s, new T.CylinderGeometry(0.55, 0.62, 0.14, 28), grp);
      this.part(s, new T.CylinderGeometry(0.035, 0.035, 1.4, 8), grp, 0, 0.75, 0);
      const cm = new T.LineDashedMaterial({ color: P.d4, dashSize: 0.08, gapSize: 0.06, transparent: true, opacity: 1 });
      const cl = []; const R = 1.25, Hh = 2.2;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; cl.push(new T.Vector3(0.45 * Math.cos(a), -0.08, 0.45 * Math.sin(a)), new T.Vector3(R * Math.cos(a), -0.08 - Hh, R * Math.sin(a))); }
      for (let i = 0; i < 48; i++) { const a0 = i / 48 * Math.PI * 2, a1 = (i + 1) / 48 * Math.PI * 2; cl.push(new T.Vector3(R * Math.cos(a0), -0.08 - Hh, R * Math.sin(a0)), new T.Vector3(R * Math.cos(a1), -0.08 - Hh, R * Math.sin(a1))); }
      const cone = new T.LineSegments(new T.BufferGeometry().setFromPoints(cl), cm); cone.computeLineDistances(); grp.add(cone);
      return { cm };
    });
    // Wall control panel running the C1 Control Panel "Lights" page
    const PX = 1.75, PY = 2.6;
    const pn = new T.Group(); pn.position.set(PX, PY, -3.12); s.pivot.add(pn);
    this.part(s, new T.BoxGeometry(4.3, 2.52, 0.08), pn);
    const cvs = document.createElement('canvas'); cvs.width = 1024; cvs.height = 576;
    const g = cvs.getContext('2d'), tex = new T.CanvasTexture(cvs); tex.anisotropy = 4;
    const scr = new T.Mesh(new T.PlaneGeometry(4.12, 2.3175), new T.MeshBasicMaterial({ map: tex })); scr.position.z = 0.045; pn.add(scr);
    const hex = (n) => '#' + n.toString(16).padStart(6, '0');
    const C = this.darkNow
      ? { bg: '#161a20', tile: '#1c2128', text: '#eef1f5', muted: '#8c95a3', line: '#2e353f', acc: '#d9a87c', ok: '#a2c08a', top: '#0b0e12' }
      : { bg: '#eff1f3', tile: '#ffffff', text: '#14171c', muted: '#5b6370', line: '#c9ced5', acc: '#8e5528', ok: '#4f7330', top: '#e2e5e9' };
    const aqi = [P.d2, P.d4, P.accent, P.hl, P.d3].map(hex);
    const F = (w, z) => w + ' ' + z + 'px Manrope, "Segoe UI", sans-serif';
    const pad2 = (n) => String(n).padStart(2, '0');
    const dateStr = (d) => { try { return d.toLocaleDateString('en-US-u-ca-persian', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }).replace(/ AP$/, ''); } catch (e) { return d.toDateString(); } };
    const slash = (x0, y0, w, h) => { g.strokeStyle = C.line; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0 + w * 0.34, y0 + 10); g.lineTo(x0 + w * 0.16, y0 + h - 8); g.stroke(); };
    const bulb = (cx, cy, on) => { g.lineWidth = 2.5; g.strokeStyle = on ? C.acc : C.muted; g.fillStyle = C.acc; g.beginPath(); g.arc(cx, cy, 15, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(cx + 6, cy + 24); g.lineTo(cx - 6, cy + 24); g.closePath(); if (on) g.fill(); g.stroke(); g.beginPath(); g.moveTo(cx - 6, cy + 30); g.lineTo(cx + 6, cy + 30); g.stroke(); };
    const draw = (st) => {
      g.fillStyle = C.bg; g.fillRect(0, 0, 1024, 576);
      // Status bar
      g.fillStyle = C.top; g.fillRect(0, 0, 1024, 30);
      g.font = F(600, 14); g.fillStyle = st.say ? C.acc : C.ok;
      g.fillText(st.say ? 'Voice command: "' + st.say + '"' : '● Modbus controller connected', 14, 20);
      g.strokeStyle = C.muted; g.lineWidth = 2; g.beginPath(); g.arc(1004, 15, 7, 0, Math.PI * 2); g.stroke();
      // Prismatic rect lights with dials
      [['Rect Light 1', 24], ['Rect Light 2', 352]].forEach((L) => {
        const x0 = L[1], y0 = 44, w = 316, h = 124;
        g.fillStyle = C.tile; g.fillRect(x0, y0, w, h); slash(x0, y0, w, h);
        const cx = x0 + 64, cy = y0 + 62, a0 = Math.PI * 0.75, sw = Math.PI * 1.5;
        g.lineWidth = 6; g.lineCap = 'round'; g.strokeStyle = C.line; g.beginPath(); g.arc(cx, cy, 40, a0, a0 + sw); g.stroke();
        if (st.pct > 0) { g.strokeStyle = C.acc; g.beginPath(); g.arc(cx, cy, 40, a0, a0 + sw * st.pct / 100); g.stroke(); }
        g.lineCap = 'butt';
        g.fillStyle = C.text; g.font = F(700, 18); g.textAlign = 'center'; g.fillText(st.pct + '%', cx, cy + 7); g.textAlign = 'left';
        g.font = F(700, 26); g.fillText('Prismatic', x0 + 150, y0 + 54);
        g.fillStyle = C.muted; g.font = F(600, 16); g.fillText(L[0], x0 + 150, y0 + 86);
      });
      // Light tiles
      [['Light', 'Operating 1', 24, 180, 'bulb', st.op], ['Light', 'Operating 2', 244, 180, 'bulb', st.op], ['Light', 'Negatoscope', 24, 316, 'neg', false], ['UV', 'Lamp', 244, 316, 'uv', false]].forEach((L) => {
        const x0 = L[2], y0 = L[3], w = 208, h = 124;
        g.fillStyle = C.tile; g.fillRect(x0, y0, w, h); slash(x0, y0, w, h);
        if (L[4] === 'bulb') bulb(x0 + 40, y0 + 40, L[5]);
        else if (L[4] === 'neg') { g.strokeStyle = C.muted; g.lineWidth = 2.5; g.strokeRect(x0 + 24, y0 + 26, 34, 42); }
        else { g.strokeStyle = C.muted; g.lineWidth = 2.5; g.beginPath(); for (let i = 0; i <= 10; i++) { const px = x0 + 22 + i * 4, py = y0 + 50 + (i % 2 ? -1 : 1) * (6 + (i % 3) * 5); if (i) g.lineTo(px, py); else g.moveTo(px, py); } g.stroke(); }
        g.fillStyle = C.text; g.font = F(700, 22); g.fillText(L[0], x0 + 78, y0 + 82);
        g.fillStyle = C.muted; g.font = F(600, 14); g.fillText(L[1], x0 + 78, y0 + 106);
      });
      // Occupation
      { const x0 = 464, y0 = 180, w = 204, h = 256;
        g.fillStyle = C.tile; g.fillRect(x0, y0, w, h);
        g.fillStyle = C.acc; g.beginPath(); g.arc(x0 + w / 2, y0 + 64, 34, 0, Math.PI * 2); g.fill();
        g.strokeStyle = C.tile; g.lineWidth = 6; g.beginPath(); g.moveTo(x0 + w / 2 - 12, y0 + 52); g.lineTo(x0 + w / 2 + 12, y0 + 76); g.moveTo(x0 + w / 2 + 12, y0 + 52); g.lineTo(x0 + w / 2 - 12, y0 + 76); g.stroke();
        g.fillStyle = C.line; g.fillRect(x0 + 16, y0 + 118, w - 32, 1.5);
        g.fillStyle = C.text; g.font = F(700, 26); g.fillText('Occupation', x0 + 18, y0 + 200);
        g.fillStyle = C.muted; g.font = F(600, 18); g.fillText('Occupied', x0 + 18, y0 + 232); }
      // Clock and date
      const now = new Date();
      g.fillStyle = C.text; g.font = F(500, 20); g.fillText(dateStr(now), 704, 72);
      g.font = F(400, 72); g.fillText(pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds()), 700, 146);
      // Medical gas and system checks
      [['VAC', 0, 0], ['AIR', 1, 0], ['O2', 2, 0], ['CO2', 0, 1], ['N2O', 1, 1], ['LIM', 2, 1], ['LAF', 1, 2]].forEach((q) => {
        const cx = 746 + q[1] * 92, cy = 186 + q[2] * 58, hl = q[0] === 'LAF' && st.airHigh;
        g.strokeStyle = hl ? C.acc : C.muted; g.lineWidth = 1.8; g.beginPath(); g.arc(cx, cy, 13, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(cx - 5, cy); g.lineTo(cx - 1, cy + 4); g.lineTo(cx + 6, cy - 4); g.stroke();
        g.fillStyle = hl ? C.acc : C.muted; g.font = F(600, 12); g.textAlign = 'center'; g.fillText(q[0], cx, cy + 30); g.textAlign = 'left';
      });
      // Temperature, humidity, air quality
      g.strokeStyle = C.muted; g.lineWidth = 2; g.beginPath(); g.arc(716, 392, 7, 0, Math.PI * 2); g.moveTo(712, 386); g.lineTo(712, 360); g.arc(716, 360, 4, Math.PI, 0); g.lineTo(720, 386); g.stroke();
      g.fillStyle = C.text; g.font = F(400, 34); g.fillText('19°', 736, 392);
      g.beginPath(); g.moveTo(866, 360); g.quadraticCurveTo(852, 380, 856, 388); g.arc(866, 386, 10, Math.PI, 0, true); g.quadraticCurveTo(880, 380, 866, 360); g.stroke();
      g.fillText('50%', 886, 392);
      g.font = F(700, 17); g.fillText('Air Quality Index', 704, 430);
      const segs = [0, 50, 100, 150, 200, 300, 500];
      for (let i = 0; i < 6; i++) { g.fillStyle = aqi[Math.min(4, i)]; g.fillRect(704 + i * 48, 440, 47, 6); }
      g.fillStyle = C.muted; g.font = F(600, 10); g.textAlign = 'center'; segs.forEach((v, i) => g.fillText(String(v), 704 + i * 48, 460)); g.textAlign = 'left';
      g.fillStyle = C.text; g.fillRect(704 + 48 * 0.84 - 1, 436, 2, 14);
      // Bottom navigation
      g.fillStyle = C.top; g.fillRect(0, 484, 1024, 92);
      ['Logs', 'Intercom', 'Music', 'Lights', 'Timers', 'About'].forEach((n, i) => {
        const cx = 86 + i * 170, on = n === 'Lights';
        g.strokeStyle = on ? C.acc : C.muted; g.fillStyle = on ? C.acc : C.muted; g.lineWidth = 2;
        if (on) bulb(cx, 512, true); else { g.beginPath(); g.arc(cx, 520, 14, 0, Math.PI * 2); g.stroke(); }
        g.font = F(on ? 700 : 500, 14); g.textAlign = 'center'; g.fillStyle = on ? C.acc : C.muted; g.fillText(n, cx, 562); g.textAlign = 'left';
      });
      tex.needsUpdate = true;
    };
    // Voice input meter under the panel
    const bars = []; const bm = new T.MeshBasicMaterial({ color: P.accent });
    for (let i = 0; i < 40; i++) { const b = new T.Mesh(new T.BoxGeometry(0.05, 0.6, 0.01), bm); b.position.set(PX - 1.76 + i * 0.09, 0.85, -3.1); s.pivot.add(b); bars.push(b); }
    const D = 300, dp = new Float32Array(D * 3);
    for (let i = 0; i < D; i++) { dp[i*3] = TX + (Math.random() - 0.5) * 5; dp[i*3+1] = Math.random() * 4.3; dp[i*3+2] = (Math.random() - 0.5) * 4; }
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dp, 3));
    s.pivot.add(new T.Points(dg, new T.PointsMaterial({ color: P.d1, size: 0.035, transparent: true, opacity: 0.7 })));
    const f = this.flags.or; let lvl = 1, air = 0.5, lastKey = '';
    const redraw = (speaking, cmd) => {
      const pct = Math.round(lvl * 100), st = { pct: pct <= 4 ? 0 : pct, op: lvl > 0.5, airHigh: air > 1, say: speaking ? cmd.say : '' };
      const key = [st.pct, st.op, st.airHigh, st.say, new Date().getSeconds()].join('|');
      if (key !== lastKey) { lastKey = key; draw(st); }
    };
    redraw(false, this.orCmds[f.idx]);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { lastKey = ''; redraw(false, this.orCmds[f.idx]); });
    return {
      cam: [0.5, 3.3, 9.8], look: [0.4, 2.0, -1.0], sway: 0.2, noDrag: true,
      update: (t, dt) => {
        if (f.auto && t - f.last > 5) { f.last = t; this.orSet((f.idx + 1) % this.orCmds.length, false); }
        const cmd = this.orCmds[f.idx], sp = t - f.speakAt, speaking = sp < 1.3;
        const env = speaking ? Math.sin(Math.PI * Math.min(1, sp / 1.3)) : 0;
        bars.forEach((b, i) => { b.scale.y = speaking ? 0.08 + Math.abs(Math.sin(t * 19 + i * 1.7) * Math.sin(t * 7 + i * 0.6)) * 1.1 * env : 0.04 + 0.03 * Math.sin(t * 2 + i * 0.4); });
        if (!speaking) { lvl += (cmd.light - lvl) * Math.min(1, dt * 3); air += (cmd.air - air) * Math.min(1, dt * 2); }
        lamps.forEach((L) => { L.cm.opacity = 0.04 + 0.96 * lvl; });
        for (let i = 0; i < D; i++) { dp[i*3+1] -= air * dt * (0.6 + (i % 7) * 0.12); if (dp[i*3+1] < 0) dp[i*3+1] = 4.3; }
        dg.attributes.position.needsUpdate = true;
        redraw(speaking, cmd);
      }
    };
  }
  orSet(i, manual) {
    const f = this.flags.or;
    if (manual) f.auto = false;
    f.idx = i; f.speakAt = this.now;
    this.setState({ orIdx: i });
  }

  build_plc(s) {
    const T = s.T, P = this.P;
    this.floor(s, 10, 10);
    const rack = new T.Group(); rack.position.set(-2.7, 0, 0.3); rack.scale.setScalar(0.8); s.pivot.add(rack);
    this.part(s, new T.BoxGeometry(2.6, 0.14, 0.7), rack, 0, 0.25, 0);
    const leds = [];
    for (let i = 0; i < 8; i++) {
      const x = -1.0 + i * 0.29;
      this.part(s, new T.BoxGeometry(0.26, 1.3, 0.56), rack, x, 0.97, 0);
      for (let k = 0; k < 2; k++) { const lm = new T.MeshBasicMaterial({ color: P.d2 }); const l = new T.Mesh(new T.SphereGeometry(0.035, 10, 10), lm); l.position.set(x, 1.45 - k * 0.13, 0.3); rack.add(l); leds.push({ lm, ph: Math.random() * 6, sp: 2 + Math.random() * 5 }); }
    }
    // Monitor showing the Ahar High Level System UI, redrawn in the site's palette
    const mon = new T.Group(); mon.position.set(1.25, 0, 0.2); mon.rotation.y = -0.12; s.pivot.add(mon);
    this.part(s, new T.CylinderGeometry(0.07, 0.07, 1.0, 10), mon, 0, 0.55, 0);
    this.part(s, new T.BoxGeometry(1.1, 0.05, 0.55), mon, 0, 0.03, 0);
    this.part(s, new T.BoxGeometry(3.7, 2.36, 0.1), mon, 0, 2.2, 0);
    const cvs = document.createElement('canvas'); cvs.width = 1024; cvs.height = 640;
    const x = cvs.getContext('2d'), tex = new T.CanvasTexture(cvs); tex.anisotropy = 4;
    const scr = new T.Mesh(new T.PlaneGeometry(3.52, 2.2), new T.MeshBasicMaterial({ map: tex })); scr.position.set(0, 2.2, 0.052); mon.add(scr);
    const C = this.darkNow
      ? { bg: '#161a20', side: '#1c2128', text: '#eef1f5', muted: '#8c95a3', line: '#2e353f', chrome: '#0b0e12', chrome2: '#262c35', ctext: '#eef1f5', sel: '#283039', group: '#5b6370', ok: '#a2c08a', warn: '#d9a87c', on: '#111419', s1: '#8fafd6', s2: '#a2c08a', acc: '#d9a87c' }
      : { bg: '#ffffff', side: '#eef0f2', text: '#14171c', muted: '#5b6370', line: '#c9ced5', chrome: '#2b323b', chrome2: '#434b56', ctext: '#eef1f5', sel: '#dde1e5', group: '#434b56', ok: '#4f7330', warn: '#8e5528', on: '#ffffff', s1: '#2f5f96', s2: '#4f7330', acc: '#8e5528' };
    const F = (w, z) => w + ' ' + z + 'px Manrope, "Segoe UI", sans-serif', MF = (z) => '500 ' + z + 'px "JetBrains Mono", Consolas, monospace';
    const fields = [['Vab', 'V', 400, 3, 1], ['Vbc', 'V', 400, 3, 1], ['Vca', 'V', 400, 3, 1], ['Frequency', 'Hz', 50, 0.04, 2], ['Ia', 'A', 120, 2, 1], ['Ib', 'A', 120, 2, 1], ['Ic', 'A', 120, 2, 1], ['Active power', 'KW', 72, 1.5, 1], ['Reactive power', 'QVAR', 18, 1, 1], ['V average', 'V', 400, 2, 1], ['I average', 'A', 120, 1.5, 1], ['Scan time', 'S', 0.1, 0, 1]]
      .map((q) => ({ name: q[0], unit: q[1], nom: q[2], amp: q[3], dec: q[4], v: q[2] }));
    const NP = 64, s1 = new Array(NP).fill(0.5), s2 = new Array(NP).fill(0.4);
    const tree = [['▾ Design', 0], ['Power meter', 1, true], ['AVR', 1], ['FCR', 1], ['Voltage feedback', 1], ['PSS', 1], ['CT', 1], ['› Configure', 0], ['› SetPoint', 0], ['› Controllers', 0], ['› Limiters', 0], ['› Protection', 0], ['› Operation', 0], ['› Charts', 0]];
    const rr = (x0, y0, w, h, r) => { x.beginPath(); x.moveTo(x0 + r, y0); x.arcTo(x0 + w, y0, x0 + w, y0 + h, r); x.arcTo(x0 + w, y0 + h, x0, y0 + h, r); x.arcTo(x0, y0 + h, x0, y0, r); x.arcTo(x0, y0, x0 + w, y0, r); x.closePath(); };
    const f = this.flags.plc;
    const draw = (writing) => {
      x.fillStyle = C.bg; x.fillRect(0, 0, 1024, 640);
      // Title bar, menu and toolbar
      x.fillStyle = C.chrome; x.fillRect(0, 0, 1024, 64);
      x.fillStyle = C.acc; x.beginPath(); x.arc(20, 18, 8, 0, Math.PI * 2); x.fill();
      x.fillStyle = C.ctext; x.font = F(600, 15); x.fillText('Ahar High Level System - Form1', 38, 23);
      x.strokeStyle = C.ctext; x.lineWidth = 1.5; [962, 984, 1006].forEach((cx) => { x.beginPath(); x.arc(cx, 18, 7, 0, Math.PI * 2); x.stroke(); });
      x.font = F(500, 13); [['File', 14], ['Communication', 54], ['Tools', 166], ['Help', 214]].forEach((m) => x.fillText(m[0], m[1], 55));
      x.fillStyle = C.chrome2; x.fillRect(0, 64, 1024, 40);
      x.fillStyle = C.ctext; x.font = F(600, 13); x.fillText('Ahar', 14, 89);
      x.strokeStyle = C.ctext; x.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const ix = 62 + i * 34 + Math.floor(i / 3) * 12;
        x.strokeRect(ix, 76, 16, 16); x.beginPath(); x.moveTo(ix + 4, 84); x.lineTo(ix + 12, 84); x.stroke();
        if (i % 3 === 2) { x.globalAlpha = 0.35; x.beginPath(); x.moveTo(ix + 29, 72); x.lineTo(ix + 29, 96); x.stroke(); x.globalAlpha = 1; }
      }
      // Project Explorer
      x.fillStyle = C.side; x.fillRect(0, 104, 180, 506);
      x.fillStyle = C.muted; x.font = F(700, 10); x.fillText('PROJECT EXPLORER', 14, 126);
      tree.forEach((r, k) => {
        const ty = 152 + k * 25, tx = r[1] ? 30 : 12;
        if (r[2]) { x.fillStyle = C.sel; x.fillRect(tx - 6, ty - 17, 150, 24); }
        x.fillStyle = C.text; x.font = F(r[1] ? 500 : 600, 13); x.fillText(r[0], tx, ty);
      });
      // Power meter group
      x.strokeStyle = C.group; x.lineWidth = 1.5; rr(198, 124, 808, 250, 10); x.stroke();
      x.font = F(600, 17); const gw = x.measureText('Power meter').width; x.fillStyle = C.bg; x.fillRect(210, 112, gw + 16, 22); x.fillStyle = C.text; x.fillText('Power meter', 218, 130);
      fields.forEach((fd, k) => {
        const fx = 220 + (k % 4) * 196, fy = 168 + Math.floor(k / 4) * 68;
        x.fillStyle = C.muted; x.font = F(500, 13); x.fillText(fd.name, fx, fy);
        x.fillStyle = C.text; x.font = MF(20); x.fillText(fd.v.toFixed(fd.dec), fx, fy + 27);
        x.fillStyle = C.muted; x.font = F(600, 13); x.textAlign = 'right'; x.fillText(fd.unit, fx + 172, fy + 27); x.textAlign = 'left';
        x.fillStyle = C.line; x.fillRect(fx, fy + 35, 172, 1.5);
      });
      // Online chart
      x.strokeStyle = C.group; x.lineWidth = 1.5; rr(198, 398, 808, 196, 10); x.stroke();
      x.font = F(600, 15); const cw = x.measureText('Online chart').width; x.fillStyle = C.bg; x.fillRect(210, 388, cw + 16, 20); x.fillStyle = C.text; x.fillText('Online chart', 218, 403);
      x.font = F(600, 12); x.fillStyle = C.s1; x.fillRect(820, 420, 12, 3); x.fillText('Vab', 838, 425); x.fillStyle = C.s2; x.fillRect(880, 420, 12, 3); x.fillText('Active power', 898, 425);
      x.strokeStyle = C.line; x.lineWidth = 1; for (let g = 0; g < 4; g++) { const gy = 442 + g * 42; x.beginPath(); x.moveTo(220, gy); x.lineTo(986, gy); x.stroke(); }
      [[s1, C.s1], [s2, C.s2]].forEach((sr) => { x.strokeStyle = sr[1]; x.lineWidth = 2.5; x.beginPath(); sr[0].forEach((v, i) => { const px = 220 + 766 * i / (NP - 1), py = 572 - v * 130; if (i) x.lineTo(px, py); else x.moveTo(px, py); }); x.stroke(); });
      // Status bar
      x.fillStyle = writing ? C.warn : C.ok; x.fillRect(0, 610, 1024, 30);
      x.fillStyle = C.on; x.font = F(600, 13);
      x.fillText(writing ? 'Writing command to PLC…' : '● Connected', 12, 630);
      x.textAlign = 'right'; x.fillText('Commands sent: ' + f.sent + '    Receiving telemetry', 1012, 630); x.textAlign = 'left';
      tex.needsUpdate = true;
    };
    draw(false);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => draw(false));
    const curve = new T.CatmullRomCurve3([new T.Vector3(-2.7, 1.45, 0.3), new T.Vector3(-2.3, 3.0, 0.5), new T.Vector3(-1.3, 3.75, 0.3), new T.Vector3(-0.5, 3.3, 0.1)]);
    const cl = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(120)), new T.LineDashedMaterial({ color: P.line, dashSize: 0.1, gapSize: 0.08 }));
    cl.computeLineDistances(); s.pivot.add(cl);
    const pool = []; const pg = new T.BoxGeometry(0.13, 0.13, 0.13);
    for (let i = 0; i < 50; i++) { const mm = new T.MeshBasicMaterial({ color: P.d1 }); const m = new T.Mesh(pg, mm); m.visible = false; s.pivot.add(m); pool.push({ m, mm, on: false, t: 0, dir: 1 }); }
    const spawn = (dir) => { const p = pool.find((q) => !q.on); if (!p) return; p.on = true; p.dir = dir; p.t = dir > 0 ? 0 : 1; p.m.visible = true; p.mm.color.setHex(dir > 0 ? P.d1 : P.d2); };
    let lastTel = 0, lastCmd = 0, flash = -10, dirty = false, lastDraw = 0, wasWriting = false;
    return {
      cam: [-0.3, 2.4, 8.4], look: [-0.3, 1.7, 0], sway: 0.15, noDrag: true,
      update: (t, dt) => {
        if (t - lastTel > 0.3) { lastTel = t; spawn(1); }
        if (f.burst > 0 && t - lastCmd > 0.12) { lastCmd = t; f.burst--; spawn(-1); }
        let writing = f.burst > 0;
        pool.forEach((p) => {
          if (!p.on) return;
          if (p.dir < 0) writing = true;
          p.t += p.dir * dt * 0.5;
          if (p.t > 1) {
            p.on = false; p.m.visible = false;
            fields.forEach((fd) => { fd.v = fd.nom + fd.amp * (0.6 * Math.sin(t * 1.3 + fd.nom) + 0.4 * (Math.random() - 0.5)); });
            s1.shift(); s1.push(0.55 + 0.25 * Math.sin(t * 1.3) + 0.08 * (Math.random() - 0.5));
            s2.shift(); s2.push(0.4 + 0.2 * Math.sin(t * 0.7 + 1) + 0.06 * (Math.random() - 0.5));
            dirty = true; return;
          }
          if (p.t < 0) { p.on = false; p.m.visible = false; flash = t; return; }
          p.m.position.copy(curve.getPointAt(p.t)); p.m.rotation.set(t * 3, t * 2, 0);
        });
        if (writing !== wasWriting) { wasWriting = writing; dirty = true; }
        if (dirty && t - lastDraw > 0.1) { dirty = false; lastDraw = t; draw(writing); }
        const fl = t - flash < 0.35;
        leds.forEach((L) => { L.lm.color.setHex(fl ? P.accent : (Math.sin(t * L.sp + L.ph) > 0.2 ? P.d2 : P.off)); });
      }
    };
  }

  build_six(s) {
    // FUM-6R: yellow links drawn in the accent colour, black housings in ink.
    const T = s.T, P = this.P;
    this.floor(s, 10, 10);
    const rig = new T.Group(); rig.position.x = -1.3; s.pivot.add(rig); s.ry = -0.6;
    const yFill = new T.MeshBasicMaterial({ color: new T.Color(P.fill).lerp(new T.Color(P.accent), 0.16), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const yp = (g, parent, x, y, z) => { const m = new T.Mesh(g, yFill); m.position.set(x || 0, y || 0, z || 0); m.add(new T.LineSegments(new T.EdgesGeometry(g, 22), this.M.accent)); parent.add(m); return m; };
    const bp = (g, parent, x, y, z) => this.part(s, g, parent, x, y, z);
    const alongZ = (r, len, n) => { const g = new T.CylinderGeometry(r, r, len, n || 28); g.rotateX(Math.PI / 2); return g; };
    const alongX = (r, len, n) => { const g = new T.CylinderGeometry(r, r, len, n || 28); g.rotateZ(Math.PI / 2); return g; };
    const BASE = 0.52, SH = 0.8, A1 = 0.2, L1 = 1.6, L2 = 1.3, A3 = 0.2, D6 = 0.62;

    // Pedestal and base flange
    bp(new T.BoxGeometry(1.3, 0.4, 1.3), rig, 0, 0.2, 0);
    bp(new T.CylinderGeometry(0.56, 0.56, 0.12, 36), rig, 0, 0.46, 0);
    // J1: turret with J1 and J2 motors
    const j1 = new T.Group(); j1.position.y = BASE; rig.add(j1);
    bp(new T.CylinderGeometry(0.5, 0.5, 0.16, 36), j1, 0, 0.08, 0);
    bp(new T.BoxGeometry(0.62, 0.7, 0.58), j1, -0.04, 0.51, 0);
    bp(new T.BoxGeometry(0.46, 0.22, 0.22), j1, -0.56, 0.36, 0);
    bp(new T.BoxGeometry(0.22, 0.22, 0.42), j1, -0.12, SH, -0.5);
    // J2: shoulder hub and the curved upper link, mounted to the side
    const j2 = new T.Group(); j2.position.set(A1, SH, 0); j1.add(j2);
    bp(alongZ(0.3, 0.6), j2);
    const r0 = 0.3, r1 = 0.25, bow = -0.2, sh = new T.Shape();
    sh.moveTo(r0, 0);
    sh.quadraticCurveTo((r0 + r1) / 2 + 2 * bow, L1 / 2, r1, L1);
    sh.absarc(0, L1, r1, 0, Math.PI, false);
    sh.quadraticCurveTo(-(r0 + r1) / 2 + 2 * bow, L1 / 2, -r0, 0);
    sh.absarc(0, 0, r0, Math.PI, Math.PI * 2, false);
    const lg = new T.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 28 }); lg.translate(0, 0, -0.11);
    yp(lg, j2, 0, 0, 0.42);
    [[0, 0.2], [L1, 0.16]].forEach((h) => { bp(alongZ(h[1], 0.26), j2, 0, h[0], 0.42); bp(alongZ(h[1] * 0.6, 0.28, 20), j2, 0, h[0], 0.42); });
    // J3: elbow housing with the wrist motors behind it
    const j3 = new T.Group(); j3.position.y = L1; j2.add(j3);
    bp(new T.BoxGeometry(0.62, 0.6, 0.58), j3, -0.04, 0.14, 0);
    bp(new T.BoxGeometry(0.42, 0.18, 0.18), j3, -0.55, 0.3, 0.13);
    bp(new T.BoxGeometry(0.42, 0.18, 0.18), j3, -0.55, 0.3, -0.13);
    // J4: forearm roll (yellow tube) and wrist block
    const j4 = new T.Group(); j4.position.set(0, A3, 0); j3.add(j4);
    yp(alongX(0.25, 0.07, 36), j4, 0.33, 0, 0);
    yp(alongX(0.18, 0.62, 8), j4, 0.67, 0, 0);
    bp(new T.BoxGeometry(0.34, 0.38, 0.4), j4, 1.13, 0, 0);
    // J5: wrist pitch, J6: tool flange roll, then the tool
    const j5 = new T.Group(); j5.position.x = L2; j4.add(j5);
    bp(alongZ(0.19, 0.44), j5);
    const j6 = new T.Group(); j6.position.x = 0.2; j5.add(j6);
    bp(alongX(0.17, 0.2, 12), j6, 0.1, 0, 0);
    const mk = new T.Mesh(new T.BoxGeometry(0.02, 0.05, 0.05), new T.MeshBasicMaterial({ color: P.accent })); mk.position.set(0.205, 0.11, 0); j6.add(mk);
    const tg = new T.CylinderGeometry(0.015, 0.06, 0.22, 16); tg.rotateZ(-Math.PI / 2);
    bp(tg, j6, 0.31, 0, 0);
    const tip = new T.Object3D(); tip.position.x = D6 - 0.2; j6.add(tip);

    // Analytic IK: yaw, then a planar 2-link solve to the wrist centre, wrist pitch keeps the tool level.
    const L2e = Math.hypot(L2, A3), dl = Math.atan2(A3, L2), q = [0, 0, 0, 0, 0, 0];
    const solve = (p) => {
      const r = Math.hypot(p.x, p.z), dx = r - D6 - A1, dy = p.y - BASE - SH;
      const D = Math.max(Math.abs(L1 - L2e) + 0.01, Math.min(Math.hypot(dx, dy), L1 + L2e - 0.01)), g = Math.atan2(dy, dx);
      const b = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + D * D - L2e * L2e) / (2 * L1 * D))));
      const f1 = g + b, th = Math.atan2(dy - L1 * Math.sin(f1), dx - L1 * Math.cos(f1)) - dl;
      q[0] = Math.atan2(-p.z, p.x); q[1] = f1 - Math.PI / 2; q[2] = th - q[1]; q[4] = -th;
      j1.rotation.y = q[0]; j2.rotation.z = q[1]; j3.rotation.z = q[2]; j4.rotation.x = q[3]; j5.rotation.z = q[4]; j6.rotation.x = q[5];
    };
    const path = (u) => new T.Vector3(2.6, 2.2 + 0.45 * Math.sin(2 * u), 0.95 * Math.sin(u));
    const pts = []; for (let i = 0; i <= 200; i++) pts.push(path(i / 200 * Math.PI * 2));
    const pathLine = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({ color: P.accent, dashSize: 0.08, gapSize: 0.06 }));
    pathLine.computeLineDistances(); rig.add(pathLine);
    const wps = [];
    for (let i = 0; i < 8; i++) { const w = new T.Mesh(new T.SphereGeometry(0.055, 12, 12), new T.MeshBasicMaterial({ color: P.accent })); w.position.copy(path(i / 8 * Math.PI * 2)); rig.add(w); wps.push(w); }
    const pushTrail = this.trail(s, rig, 140, this.M.hl);
    const tw = new T.Vector3();
    let u = 0, last = 0;
    return {
      cam: [0, 3.3, 8.6], look: [0.1, 1.75, 0], sway: 0.35, noDrag: true,
      update: (t, dt) => {
        u += dt * 0.85;
        q[5] = t * 1.4;
        solve(path(u));
        s.scene.updateMatrixWorld(); tip.getWorldPosition(tw); rig.worldToLocal(tw); pushTrail(tw);
        wps.forEach((w) => { w.scale.setScalar(w.position.distanceTo(tw) < 0.25 ? 1.7 : 1); });
        if (t - last > 0.2) { last = t; const w = (a) => Math.atan2(Math.sin(a), Math.cos(a)); this.setState({ sj1: this.deg(q[0]), sj2: this.deg(q[1]), sj3: this.deg(q[2]), sj4: this.deg(q[3]), sj5: this.deg(q[4]), sj6: this.deg(w(q[5])) }); }
      }
    };
  }

  husky(s, parent) {
    // Clearpath Husky A200 with an extrusion deck, rear LiDAR mast, Jetson box and an xArm 850 with wrist sensors.
    const T = s.T, P = this.P;
    const bp = (g, par, x, y, z) => this.part(s, g, par, x, y, z);
    const sensor = (g, par, x, y, z) => { const m = new T.Mesh(g, this.M.fill); m.position.set(x, y, z); m.add(new T.LineSegments(new T.EdgesGeometry(g, 22), this.M.d1)); par.add(m); return m; };
    const alongZ = (r, len, n) => { const g = new T.CylinderGeometry(r, r, len, n || 20); g.rotateX(Math.PI / 2); return g; };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const bot = new T.Group(); parent.add(bot);
    bp(new T.BoxGeometry(0.99, 0.22, 0.58), bot, 0, 0.25, 0);
    bp(new T.BoxGeometry(0.1, 0.06, 0.5), bot, 0.54, 0.2, 0);
    const wheels = [];
    [[0.26, 0.36], [0.26, -0.36], [-0.26, 0.36], [-0.26, -0.36]].forEach((w) => { const m = bp(alongZ(0.165, 0.11, 18), bot, w[0], 0.165, w[1]); m.side = w[1] > 0 ? 1 : -1; wheels.push(m); });
    bp(new T.BoxGeometry(1.0, 0.03, 0.7), bot, 0, 0.385, 0);
    [-0.33, 0.33].forEach((z) => bp(new T.BoxGeometry(1.04, 0.04, 0.04), bot, 0, 0.42, z));
    [-0.25, 0.25].forEach((z) => bp(new T.BoxGeometry(0.04, 0.62, 0.04), bot, -0.44, 0.71, z));
    bp(new T.BoxGeometry(0.16, 0.03, 0.6), bot, -0.44, 1.03, 0);
    sensor(new T.CylinderGeometry(0.05, 0.05, 0.07, 18), bot, -0.44, 1.08, 0);
    sensor(new T.CylinderGeometry(0.05, 0.05, 0.07, 18), bot, 0.5, 0.42, 0);
    bp(new T.BoxGeometry(0.3, 0.22, 0.4), bot, -0.22, 0.51, 0);
    const armB = new T.Group(); armB.position.set(0.28, 0.4, 0); bot.add(armB);
    const SH = 0.28, L1 = 0.39, L2 = 0.43, TOOL = 0.21;
    bp(new T.CylinderGeometry(0.06, 0.07, 0.12, 20), armB, 0, 0.06, 0);
    const ay = new T.Group(); ay.position.y = 0.12; armB.add(ay);
    bp(new T.CylinderGeometry(0.055, 0.055, 0.14, 20), ay, 0, 0.07, 0);
    const ash = new T.Group(); ash.position.y = SH - 0.12; ay.add(ash);
    bp(alongZ(0.06, 0.14), ash); bp(new T.BoxGeometry(0.07, L1, 0.08), ash, 0, L1 / 2, 0);
    const ael = new T.Group(); ael.position.y = L1; ash.add(ael);
    bp(alongZ(0.05, 0.13), ael); bp(new T.BoxGeometry(0.06, L2, 0.07), ael, 0, L2 / 2, 0);
    const awr = new T.Group(); awr.position.y = L2; ael.add(awr);
    bp(alongZ(0.042, 0.11), awr);
    const roll = new T.Group(); awr.add(roll);
    bp(new T.CylinderGeometry(0.04, 0.045, 0.1, 16), roll, 0, 0.07, 0);
    sensor(new T.BoxGeometry(0.04, 0.03, 0.09), roll, 0.06, 0.08, 0);
    sensor(new T.CylinderGeometry(0.035, 0.035, 0.05, 14), roll, -0.065, 0.08, 0);
    const f1 = bp(new T.BoxGeometry(0.015, 0.08, 0.04), roll, 0.05, 0.17, 0);
    const f2 = bp(new T.BoxGeometry(0.015, 0.08, 0.04), roll, -0.05, 0.17, 0);
    const tipO = new T.Object3D(); tipO.position.y = TOOL; roll.add(tipO);
    const q = { y: 0, s: 0, e: -1.6, w: 0 };
    const cl = (v) => Math.min(1, Math.max(-1, v));
    const solve = (p, rate, aim) => {
      // Yaw, a planar two-link solve to the wrist, and a wrist pitch that keeps the tool pointing down.
      const r = Math.hypot(p.x, p.z), h = p.y + (aim ? 0 : TOOL) - SH;
      const d = Math.max(0.15, Math.min(Math.hypot(r, h), L1 + L2 - 0.005)), phi = Math.atan2(h, r);
      const a1 = Math.acos(cl((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))), a2 = Math.acos(cl((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2)));
      const al = phi + a1, be = al - (Math.PI - a2);
      if (r > 0.02) q.y += wrap(Math.atan2(-p.z, p.x) - q.y) * rate;
      q.s += ((al - Math.PI / 2) - q.s) * rate; q.e += ((a2 - Math.PI) - q.e) * rate; q.w += ((aim ? (al - be) * 0.4 : -Math.PI / 2 - be) - q.w) * rate;
      ay.rotation.y = q.y; ash.rotation.z = q.s; ael.rotation.z = q.e; awr.rotation.z = q.w;
    };
    return { bot, wheels, armB, roll, f1, f2, tipO, q, solve, TOOL };
  }

  build_stone(s) {
    // Stonestacker on simulated stones: find stones, choose one, drive to it, line up and pick it up.
    const T = s.T, P = this.P, f = this.flags.stone;
    this.floor(s, 8, 16);
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const bp = (g, parent, x, y, z) => this.part(s, g, parent, x, y, z);
    const sensor = (g, parent, x, y, z) => { const m = new T.Mesh(g, this.M.fill); m.position.set(x, y, z); m.add(new T.LineSegments(new T.EdgesGeometry(g, 22), this.M.d1)); parent.add(m); return m; };
    const alongZ = (r, len, n) => { const g = new T.CylinderGeometry(r, r, len, n || 20); g.rotateX(Math.PI / 2); return g; };
    const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const sm = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

    // Stones: scattered ones the robot picks, plus a pile it leaves alone.
    const stones = [];
    const mkStone = (x, z, r, pile, y) => {
      const g = new T.IcosahedronGeometry(r, 0), pa = g.attributes.position, jit = {};
      for (let i = 0; i < pa.count; i++) {
        const key = pa.getX(i).toFixed(3) + ',' + pa.getY(i).toFixed(3) + ',' + pa.getZ(i).toFixed(3);
        const k = jit[key] || (jit[key] = 0.78 + rnd() * 0.44);
        pa.setXYZ(i, pa.getX(i) * k * 1.2, pa.getY(i) * k * 0.62, pa.getZ(i) * k * 0.9);
      }
      const lm = new T.LineBasicMaterial({ color: P.line });
      const m = new T.Mesh(g, this.M.fill); m.add(new T.LineSegments(new T.EdgesGeometry(g, 1), lm));
      const home = new T.Vector3(x, (y || 0) + r * 0.42, z), rot = rnd() * Math.PI * 2;
      m.position.copy(home); m.rotation.y = rot; s.pivot.add(m);
      stones.push({ m, lm, r, pile: !!pile, home, rot, pts: [], det: false, picked: false, quota: 0, name: 'S' + (stones.length + 1) });
    };
    [[-0.2, 0.6, 0.15], [0.6, 2.0, 0.12], [1.3, 1.0, 0.17], [2.7, 1.6, 0.11], [-1.6, -1.5, 0.14], [-0.1, -1.4, 0.16], [0.9, -2.1, 0.1],
      [3.1, 0.1, 0.13], [-3.1, 1.7, 0.12], [-3.2, -0.6, 0.1], [3.2, -1.8, 0.15]].forEach((p) => mkStone(p[0], p[1], p[2]));
    [[0, 0, 0.11], [0.2, 0.08, 0.09], [-0.15, 0.15, 0.1], [0.1, -0.2, 0.1], [-0.18, -0.12, 0.08], [0.02, 0.02, 0.08, 0.1], [0.24, -0.12, 0.08]].forEach((p) => mkStone(1.9 + p[0], -0.5 + p[1], p[2], true, p[3]));

    // Robot: Husky A200 base with the xArm 850 (shared with the page background).
    const R = this.husky(s, s.pivot), bot = R.bot, wheels = R.wheels, armB = R.armB, roll = R.roll, f1 = R.f1, f2 = R.f2, tipO = R.tipO, q = R.q, solve = R.solve;
    bot.position.set(-1.1, 0, 1.5);
    const STOW = new T.Vector3(0.2, 0.42, 0);

    // Point clouds: ground rings, points on stones, and the dense close-range scan of the target.
    const mkPts = (n, col, size) => {
      const a = new Float32Array(n * 3), g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(a, 3)); g.setDrawRange(0, 0);
      const p = new T.Points(g, new T.PointsMaterial({ color: col, size, sizeAttenuation: false })); p.frustumCulled = false; s.pivot.add(p);
      return { a, g, n, c: 0 };
    };
    const ground = mkPts(2000, P.grid, 2), cloud = mkPts(4000, P.d1, 3), dense = mkPts(300, P.accent, 3);
    const flush = (b) => { b.g.setDrawRange(0, b.c); b.g.attributes.position.needsUpdate = true; };
    const toP = (lx, ly, lz) => { const c = Math.cos(bot.rotation.y), sn = Math.sin(bot.rotation.y); return new T.Vector3(bot.position.x + lx * c + lz * sn, ly, bot.position.z - lx * sn + lz * c); };
    let gTotal = 0;
    const rings = () => {
      ground.c = 0; const o = toP(-0.44, 0, 0);
      for (let k = 0; k < 14; k++) {
        const rr = 0.7 + k * 0.24 + k * k * 0.012;
        for (let i = 0; i < 100 && ground.c < ground.n; i++) {
          const a = i / 100 * Math.PI * 2 + k * 0.05, x = o.x + rr * Math.cos(a), z = o.z + rr * Math.sin(a);
          if (Math.abs(x) > 4 || Math.abs(z) > 4 || Math.hypot(x - bot.position.x, z - bot.position.z) < 0.7) continue;
          ground.a.set([x, 0.004, z], ground.c * 3); ground.c++;
        }
      }
      gTotal = ground.c; ground.c = 0; flush(ground);
    };
    const writeCloud = () => {
      let c = 0;
      stones.forEach((st) => { if (st.picked) return; for (let i = 0; i < st.pts.length && c < cloud.n * 3; i++) cloud.a[c++] = st.pts[i]; });
      cloud.c = c / 3; flush(cloud);
    };
    const addPt = (st, from, buf) => {
      const d = new T.Vector3(Math.random() * 2 - 1, Math.random() * 0.9 + 0.1, Math.random() * 2 - 1).normalize();
      const tx = from.x - st.m.position.x, tz = from.z - st.m.position.z;
      if (d.x * tx + d.z * tz < 0) { d.x = -d.x; d.z = -d.z; }
      const v = [st.m.position.x + d.x * st.r * 1.05, st.m.position.y + d.y * st.r * 0.5, st.m.position.z + d.z * st.r * 0.85];
      if (buf) { if (buf.c < buf.n) { buf.a.set(v, buf.c * 3); buf.c++; } } else st.pts.push(v[0], v[1], v[2]);
    };

    // Target marker
    const ringPts = []; for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2; ringPts.push(new T.Vector3(Math.cos(a), 0.01, Math.sin(a))); }
    const marker = new T.Line(new T.BufferGeometry().setFromPoints(ringPts), this.M.accent); marker.visible = false; s.pivot.add(marker);

    const STEPS = ['Map', 'Select', 'Drive', 'Refine', 'Pick'];
    let ph = '', pt = 0, tgt = null, goal = null, heading = 0, onDeck = 0, explore = false, last = -1, msg = '', err = 30, grip = 0, mapDur = 5;
    const setPh = (p, m) => { ph = p; pt = 0; msg = m; last = -1; };
    const startMap = () => {
      stones.forEach((st) => {
        if (st.picked) return;
        st.pts.length = 0; st.det = false; st.lm.color.setHex(P.line);
        const d = Math.max(0.7, Math.hypot(st.m.position.x - bot.position.x, st.m.position.z - bot.position.z));
        st.quota = d > 4.5 ? 0 : Math.min(60, Math.round(3600 * st.r * st.r / (d * d)) + (d < 3.5 ? 2 : 0));
      });
      dense.c = 0; flush(dense); writeCloud(); rings(); marker.visible = false; tgt = null;
      mapDur = 4.5;
      setPh('Map', 'Scanning the area for stones.');
    };
    const resetWorld = () => {
      stones.forEach((st) => { if (st.m.parent !== s.pivot) { st.m.parent.remove(st.m); s.pivot.add(st.m); } st.m.position.copy(st.home); st.m.rotation.y = st.rot; st.m.scale.setScalar(1); st.picked = false; });
      onDeck = 0;
    };
    startMap();
    const detCount = () => stones.filter((st) => st.det && !st.picked).length;
    const total = () => stones.filter((st) => !st.picked).length;
    const tw = new T.Vector3(), tl = new T.Vector3();
    const spinWheels = (dl, dr) => wheels.forEach((w) => { w.rotation.z -= (w.side > 0 ? dl : dr) / 0.165; });

    return {
      cam: [0.2, 3.9, 6.6], look: [-0.3, 0.1, 0.3], sway: 0.18,
      update: (t, dt) => {
        pt += dt;
        s.scene.updateMatrixWorld();
        if (ph === 'Map') {
          solve(tl.set(0.42, 0.3, 0.38 * Math.sin(pt * 1.8)), 0.08);
          const u = Math.min(1, pt / (mapDur * 0.85)), sensorP = toP(-0.44, 1.08, 0);
          ground.c = Math.floor(gTotal * Math.min(1, pt / 0.8)); flush(ground);
          let changed = false;
          stones.forEach((st) => {
            if (st.picked) return;
            const want = Math.floor(st.quota * u);
            while (st.pts.length / 3 < want) { addPt(st, sensorP); changed = true; }
            if (!st.det && st.pts.length / 3 >= 8) { st.det = true; st.lm.color.setHex(P.d2); }
          });
          if (changed) writeCloud();
          if (pt > mapDur) {
            const cands = stones.filter((st) => st.det && !st.pile && !st.picked);
            const dist = (st) => Math.hypot(st.m.position.x - bot.position.x, st.m.position.z - bot.position.z);
            cands.sort((a, b) => dist(a) - dist(b));
            if (cands.length) { tgt = cands[0]; tgt.lm.color.setHex(P.accent); explore = false; setPh('Select', 'Choosing a stone that fits the gripper.'); }
            else {
              const left = stones.filter((st) => !st.pile && !st.picked).sort((a, b) => dist(a) - dist(b));
              if (!left.length) { resetWorld(); startMap(); return; }
              const st = left[0], dx = st.m.position.x - bot.position.x, dz = st.m.position.z - bot.position.z, L = Math.hypot(dx, dz);
              heading = Math.atan2(-dz, dx); goal = new T.Vector3(st.m.position.x - dx / L * 1.3, 0, st.m.position.z - dz / L * 1.3); explore = true;
              setPh('Drive', 'Moving closer to look again.');
            }
          }
        } else if (ph === 'Select') {
          solve(STOW, 0.08);
          if (pt > 1.4) {
            const dx = tgt.m.position.x - bot.position.x, dz = tgt.m.position.z - bot.position.z, L = Math.hypot(dx, dz);
            heading = Math.atan2(-dz, dx); goal = new T.Vector3(tgt.m.position.x - dx / L * 0.8, 0, tgt.m.position.z - dz / L * 0.8);
            setPh('Drive', 'Driving over to the stone.');
          }
        } else if (ph === 'Drive') {
          solve(STOW, 0.08);
          const e = wrap(heading - bot.rotation.y);
          if (Math.abs(e) > 0.005) { const st = Math.max(-1.3 * dt, Math.min(1.3 * dt, e)); bot.rotation.y += st; spinWheels(-st * 0.36, st * 0.36); }
          else {
            const dx = goal.x - bot.position.x, dz = goal.z - bot.position.z, L = Math.hypot(dx, dz), step = Math.min(L, 0.7 * dt);
            if (L > 0.003) { const fwd = (dx * Math.cos(heading) - dz * Math.sin(heading)) >= 0 ? 1 : -1; bot.position.x += dx / L * step; bot.position.z += dz / L * step; spinWheels(step * fwd, step * fwd); }
            else if (explore) startMap();
            else { err = 30; setPh('Refine', 'Lining the gripper up with the stone.'); }
          }
        } else if (ph === 'Refine') {
          tgt.m.getWorldPosition(tw); armB.worldToLocal(tl.copy(tw)); tl.y += tgt.r * 0.6 + 0.22;
          solve(tl, 0.1);
          if (pt > 0.6) { const want = Math.floor(160 * Math.min(1, (pt - 0.6) / 1.8)); while (dense.c < want) addPt(tgt, toP(0.5, 1, 0), dense); flush(dense); }
          err = 30 - 28 * sm((pt - 0.6) / 1.8);
          roll.rotation.y += (wrap(tgt.m.rotation.y - bot.rotation.y - q.y + Math.PI / 2) - roll.rotation.y) * 0.06;
          if (pt > 2.8) setPh('Pick', 'Picking the stone up.');
        } else if (ph === 'Pick') {
          if (pt < 1.6) {
            tgt.m.getWorldPosition(tw); armB.worldToLocal(tl.copy(tw)); tl.y += pt < 0.8 ? tgt.r * 0.6 + 0.22 * (1 - sm(pt / 0.8)) + 0.02 : 0.02 + tgt.r * 0.15;
            solve(tl, 0.14); grip += ((pt > 1.0 ? 1 : 0) - grip) * 0.2;
          } else if (pt < 3.0) {
            if (!tgt.picked) { tgt.picked = true; dense.c = 0; flush(dense); writeCloud(); marker.visible = false; }
            if (pt < 2.2) solve(tl.set(0.32, 0.45, 0), 0.08); else solve(tl.set(-0.26, 0.24, (onDeck - 1) * 0.2), 0.08);
            tipO.getWorldPosition(tw); s.pivot.worldToLocal(tw); tgt.m.position.set(tw.x, tw.y - tgt.r * 0.45, tw.z);
          } else if (pt < 3.4) {
            grip += (0 - grip) * 0.25;
            if (tgt.m.parent === s.pivot) { s.pivot.remove(tgt.m); bot.add(tgt.m); tgt.m.position.set(0.02, 0.42 + tgt.r * 0.3, (onDeck - 1) * 0.2); tgt.m.scale.setScalar(0.7); onDeck++; }
          } else {
            if (onDeck >= 3) resetWorld();
            startMap();
          }
          f1.position.x = 0.05 - 0.03 * grip; f2.position.x = -0.05 + 0.03 * grip;
        }
        if (tgt && (ph === 'Select' || ph === 'Drive' || ph === 'Refine' || (ph === 'Pick' && pt < 1.6))) {
          marker.visible = true; marker.position.set(tgt.m.position.x, 0, tgt.m.position.z); marker.scale.setScalar(tgt.r * 1.9 + 0.04 * Math.sin(t * 5));
        }
        if (t - last > 0.2) {
          last = t;
          const idx = STEPS.indexOf(ph), stp = (i) => (explore && ph === 'Drive') ? (i === 2 ? 'on' : '') : (i < idx ? 'done' : i === idx ? 'on' : '');
          const NAMES = { Map: 'Finding stones', Select: 'Choosing a stone', Drive: 'Driving', Refine: 'Lining up', Pick: 'Picking' };
          this.setState({ stPhase: explore && ph === 'Drive' ? 'Exploring' : NAMES[ph], stMsg: msg, stp0: stp(0), stp1: stp(1), stp2: stp(2), stp3: stp(3), stp4: stp(4) });
        }
      }
    };
  }

  build_exc(s) {
    // Excavator terrain mapping on simulated terrain: a boom LiDAR updates an elevation map while the machine levels a mound.
    const T = s.T, P = this.P, f = this.flags.exc;
    const NX = 37, NZ = 25, CS = 0.25, X0 = -4.5, Z0 = -3, N = NX * NZ;
    const BX = -0.9, BZ = 0.2;
    const H = new Float32Array(N), M = new Float32Array(N), seen = new Uint8Array(N);
    const gx = (i) => X0 + i * CS, gz = (j) => Z0 + j * CS, id = (i, j) => j * NX + i;
    const g2 = (x, z, cx, cz, s2) => Math.exp(-((x - cx) * (x - cx) + (z - cz) * (z - cz)) / s2);
    const initTerrain = () => {
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const x = gx(i), z = gz(j), pad = Math.min(1, Math.max(0, (Math.hypot(x - BX, z - BZ) - 1.0) / 0.8));
        H[id(i, j)] = pad * (0.12 * Math.sin(0.8 * x + 1) * Math.cos(0.9 * z) + 0.2 * g2(x, z, -3.4, 2.2, 1.5)) + 0.5 * g2(x, z, BX + 2.5, BZ, 0.7) + 0.18 * g2(x, z, 3.2, 1.9, 0.8) - 0.15 * g2(x, z, 3.0, -2.2, 0.6);
        seen[id(i, j)] = 0;
      }
    };
    initTerrain();
    this.floor(s, 9, 18);
    const bp = (g, parent, x, y, z) => this.part(s, g, parent, x, y, z);
    const alongZ = (r, len, n) => { const g = new T.CylinderGeometry(r, r, len, n || 20); g.rotateX(Math.PI / 2); return g; };
    const ext = (pts, depth) => { const sh = new T.Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => sh.lineTo(p[0], p[1])); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g; };
    const yFill = new T.MeshBasicMaterial({ color: new T.Color(P.fill).lerp(new T.Color(P.accent), 0.16), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const yp = (g, parent, x, y, z) => { const m = new T.Mesh(g, yFill); m.position.set(x || 0, y || 0, z || 0); m.add(new T.LineSegments(new T.EdgesGeometry(g, 22), this.M.accent)); parent.add(m); return m; };

    // Machine: 30-ton class proportions (boom 6.2 m, arm 3.1 m) scaled to the scene.
    const Lb = 2.2, La = 1.1, Lk = 0.5, FX = 0.3, FY = 0.66;
    const base = new T.Group(); base.position.set(BX, 0, BZ); s.pivot.add(base);
    [-0.42, 0.42].forEach((z) => { bp(new T.BoxGeometry(1.75, 0.26, 0.26), base, 0, 0.13, z); [-0.78, 0.78].forEach((x) => bp(alongZ(0.13, 0.28, 16), base, x, 0.13, z)); });
    bp(new T.BoxGeometry(0.9, 0.12, 0.6), base, 0, 0.3, 0);
    const house = new T.Group(); house.position.y = 0.36; base.add(house);
    bp(new T.CylinderGeometry(0.3, 0.3, 0.06, 24), house, 0, 0.03, 0);
    bp(new T.BoxGeometry(1.1, 0.34, 0.95), house, -0.15, 0.23, 0);
    bp(new T.BoxGeometry(0.28, 0.4, 0.95), house, -0.82, 0.26, 0);
    bp(new T.BoxGeometry(0.42, 0.44, 0.36), house, 0.2, 0.62, 0.28);
    bp(new T.BoxGeometry(0.5, 0.12, 0.5), house, -0.45, 0.46, -0.15);
    [-0.32, 0.32].forEach((z) => { bp(new T.BoxGeometry(0.02, 0.3, 0.02), house, -0.6, 0.55, z); const m = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.03, 14), this.M.fill); m.position.set(-0.6, 0.72, z); m.add(new T.LineSegments(new T.EdgesGeometry(m.geometry, 22), this.M.d1)); house.add(m); });
    const boom = new T.Group(); boom.position.set(FX, FY - 0.36, -0.05); house.add(boom);
    yp(ext([[0, -0.11], [Lb * 0.5, 0.14], [Lb + 0.02, -0.07], [Lb + 0.02, 0.07], [Lb * 0.5, 0.36], [-0.04, 0.12]], 0.2), boom);
    bp(alongZ(0.09, 0.26), boom);
    const lid = new T.Mesh(new T.BoxGeometry(0.12, 0.08, 0.1), this.M.fill); lid.position.set(Lb * 0.36, 0.33, 0); lid.add(new T.LineSegments(new T.EdgesGeometry(lid.geometry), this.M.d1)); boom.add(lid);
    const arm = new T.Group(); arm.position.x = Lb; boom.add(arm);
    yp(ext([[-0.28, 0.06], [0, 0.13], [La, 0.05], [La, -0.05], [0, -0.1], [-0.28, -0.03]], 0.15), arm);
    bp(alongZ(0.07, 0.24), arm);
    const bkt = new T.Group(); bkt.position.x = La; arm.add(bkt);
    const bm = bp(ext([[0, 0.06], [0.08, -0.16], [0.28, -0.26], [0.46, -0.14], [Lk, 0], [0.3, 0.03], [0.1, 0.1]], 0.42), bkt);
    bp(alongZ(0.05, 0.46), bkt);
    const tipO = new T.Object3D(); tipO.position.x = Lk; bkt.add(tipO);
    const ik = { sw: 0, r: 2.3, y: 1.1, k: 0.4, b: 0, a: 0, bk: 0 };
    const pose = () => {
      house.rotation.y = ik.sw;
      const wx = ik.r - Lk * Math.cos(ik.k), wy = ik.y - Lk * Math.sin(ik.k), dx = wx - FX, dy = wy - FY;
      const d = Math.max(Math.abs(Lb - La) + 0.01, Math.min(Math.hypot(dx, dy), Lb + La - 0.01)), g = Math.atan2(dy, dx);
      const b = g + Math.acos(Math.max(-1, Math.min(1, (Lb * Lb + d * d - La * La) / (2 * Lb * d))));
      const jx = FX + Lb * Math.cos(b), jy = FY + Lb * Math.sin(b), a = Math.atan2(wy - jy, wx - jx);
      boom.rotation.z = b; arm.rotation.z = a - b; bkt.rotation.z = ik.k - a;
      ik.b = b; ik.a = a - b; ik.bk = ik.k - a;
    };

    // Elevation map drawn as a line grid with per-vertex colour.
    const SEG = (NX - 1) * NZ + NX * (NZ - 1);
    const mp = new Float32Array(SEG * 6), mc = new Float32Array(SEG * 6), mg = new T.BufferGeometry();
    mg.setAttribute('position', new T.BufferAttribute(mp, 3)); mg.setAttribute('color', new T.BufferAttribute(mc, 3)); mg.setDrawRange(0, 0);
    const mapL = new T.LineSegments(mg, new T.LineBasicMaterial({ vertexColors: true })); mapL.frustumCulled = false; s.pivot.add(mapL);
    const rp = new Float32Array(16 * 6), rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    const rays = new T.LineSegments(rg, new T.LineBasicMaterial({ color: P.accent, transparent: true, opacity: 0.35 })); rays.frustumCulled = false; s.pivot.add(rays);
    const C0 = new T.Color(P.d1), C1 = new T.Color(P.d2), C2 = new T.Color(P.hl), CG = new T.Color(P.d2), CB = new T.Color(P.accent), tc = new T.Color();
    const col = new Float32Array(N * 3), vis = new Uint8Array(N);
    const rebuild = (cx, cz) => {
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const k = id(i, j);
        vis[k] = seen[k] && (f.mode !== 0 || (Math.abs(gx(i) - cx) <= 1.6 && Math.abs(gz(j) - cz) <= 1.6)) ? 1 : 0;
        if (!vis[k]) continue;
        if (f.mode === 2) {
          let sl = 0; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((o) => { const a = i + o[0], b = j + o[1]; if (a >= 0 && b >= 0 && a < NX && b < NZ && seen[id(a, b)]) sl = Math.max(sl, Math.abs(M[id(a, b)] - M[k]) / CS); });
          tc.copy(sl < 0.32 ? CG : CB);
        } else {
          const u = Math.max(0, Math.min(1, (M[k] + 0.2) / 0.85));
          if (u < 0.5) tc.copy(C0).lerp(C1, u * 2); else tc.copy(C1).lerp(C2, (u - 0.5) * 2);
        }
        col.set([tc.r, tc.g, tc.b], k * 3);
      }
      let c = 0;
      const seg = (a, b, ia, ja, ib, jb) => { mp.set([gx(ia), M[a] + 0.012, gz(ja), gx(ib), M[b] + 0.012, gz(jb)], c * 6); mc.set([col[a * 3], col[a * 3 + 1], col[a * 3 + 2], col[b * 3], col[b * 3 + 1], col[b * 3 + 2]], c * 6); c++; };
      for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
        const k = id(i, j); if (!vis[k]) continue;
        if (i + 1 < NX && vis[k + 1]) seg(k, k + 1, i, j, i + 1, j);
        if (j + 1 < NZ && vis[k + NX]) seg(k, k + NX, i, j, i, j + 1);
      }
      mg.setDrawRange(0, c * 2); mg.attributes.position.needsUpdate = true; mg.attributes.color.needsUpdate = true;
    };
    const hAt = (x, z) => { const i = Math.round((x - X0) / CS), j = Math.round((z - Z0) / CS); return i >= 0 && j >= 0 && i < NX && j < NZ ? H[id(i, j)] : 0; };
    const brush = (x, z, fn) => { for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const d = Math.hypot(gx(i) - x, gz(j) - z); if (d < 0.6) fn(id(i, j), d); } };
    const wpt = (sw, r) => new T.Vector3(BX + r * Math.cos(sw), 0, BZ - r * Math.sin(sw));

    // Dig cycle: tip keyframes in the house frame (swing, reach, height, bucket angle).
    const DIG = [0, 0.32, -0.32, 0.16, -0.16], DUMP = 1.9, GRADE = -0.08;
    let cyc = 0, step = -1, st0 = 0, from = null, to = null, dur = 1, label = '', last = -1, loaded = false;
    const plan = (n) => {
      const sw = DIG[cyc % DIG.length], p1 = wpt(sw, 2.9), p2 = wpt(sw, 1.9);
      const y1 = Math.max(hAt(p1.x, p1.z) - 0.04, GRADE), y2 = Math.max(hAt(p2.x, p2.z) - 0.1, GRADE);
      return [
        ['Swinging to the dig face', { sw, r: 2.9, y: Math.max(0.9, y1 + 0.6), k: -1.9 }, 1.6],
        ['Digging', { sw, r: 2.9, y: y1, k: -1.8 }, 0.9],
        ['Digging', { sw, r: 1.9, y: y2, k: -0.9 }, 1.6],
        ['Curling and lifting', { sw, r: 2.1, y: 1.2, k: 0.5 }, 1.1],
        ['Swinging to dump', { sw: DUMP, r: 2.6, y: 1.4, k: 0.5 }, 1.6],
        ['Dumping', { sw: DUMP, r: 2.6, y: 1.4, k: -2.0 }, 0.9]
      ][n];
    };
    const next = (t) => {
      step = (step + 1) % 6; if (step === 0) { cyc++; if (cyc > 12) { cyc = 0; initTerrain(); } }
      const p = plan(step); label = p[0]; from = { sw: ik.sw, r: ik.r, y: ik.y, k: ik.k }; to = p[1]; dur = p[2]; st0 = t;
    };
    const tw = new T.Vector3(), lw = new T.Vector3();
    pose(); next(0);
    return {
      cam: [0.4, 6.4, 9.4], look: [0, 0, 0.1], sway: 0.25,
      update: (t, dt) => {
        let u = (t - st0) / dur;
        if (u >= 1) {
          if (step === 5 && loaded) { const p = wpt(DUMP, 2.6); brush(p.x, p.z, (k, d) => { H[k] = Math.min(0.95, H[k] + 0.07 * Math.exp(-d * d / 0.12)); }); loaded = false; }
          next(t); u = 0;
        }
        const e = u * u * (3 - 2 * u);
        let dsw = to.sw - from.sw;
        ik.sw = from.sw + dsw * e; ik.r = from.r + (to.r - from.r) * e; ik.y = from.y + (to.y - from.y) * e; ik.k = from.k + (to.k - from.k) * e;
        pose();
        s.scene.updateMatrixWorld();
        // Carve the terrain where the bucket teeth pass below it.
        tipO.getWorldPosition(tw); s.pivot.worldToLocal(tw);
        if (step === 1 || step === 2) brush(tw.x, tw.z, (k, d) => { const lim = Math.max(GRADE, tw.y + 1.2 * d * d); if (H[k] > lim) { H[k] = lim; loaded = true; } });
        bm.children[0].material = loaded ? this.M.hl : this.M.ink;
        // Boom LiDAR: sample the ground in front of the house, skipping returns from the machine itself.
        lid.getWorldPosition(lw); s.pivot.worldToLocal(lw);
        let rc = 0;
        for (let n = 0; n < 90; n++) {
          const a = ik.sw + (Math.random() - 0.5) * 1.15, rr = 0.9 + Math.random() * 3.6, x = BX + rr * Math.cos(a), z = BZ - rr * Math.sin(a);
          const i = Math.round((x - X0) / CS), j = Math.round((z - Z0) / CS);
          if (i < 0 || j < 0 || i >= NX || j >= NZ) continue;
          if (Math.hypot(x - tw.x, z - tw.z) < 0.4) continue;
          const k = id(i, j); M[k] = H[k] + (Math.random() - 0.5) * 0.02; seen[k] = 1;
          if (rc < 16) { rp.set([lw.x, lw.y, lw.z, gx(i), H[k], gz(j)], rc * 6); rc++; }
        }
        rg.setDrawRange(0, rc * 2); rg.attributes.position.needsUpdate = true;
        const fc = wpt(0, 2.4); rebuild(fc.x, fc.z);
        if (t - last > 0.2) {
          last = t; let sc = 0; for (let k = 0; k < N; k++) sc += seen[k];
          this.setState({ exPhase: label, exSw: this.deg(ik.sw), exBm: this.deg(ik.b), exAr: this.deg(ik.a), exBk: this.deg(ik.bk), exCov: Math.round(100 * sc / N) + ' %' });
        }
      }
    };
  }
  setExc(m) {
    const f = this.flags.exc;
    if (f.mode === m) return;
    f.mode = m; this.setState({ exMode: m });
  }

  renderVals() {
    if (!this._fns) {
      this.cv = this.cv || {};
      this.orCmds = [
        { say: 'Lights on', status: 'Lights at 100 %, air flow normal', light: 1, air: 0.5 },
        { say: 'Dim the lights', status: 'Lights at 35 %, air flow normal', light: 0.35, air: 0.5 },
        { say: 'Air flow high', status: 'Lights at 35 %, air flow high', light: 0.35, air: 1.5 },
        { say: 'Full lights for surgery', status: 'Lights at 100 %, air flow high', light: 1, air: 1.5 },
        { say: 'Lights off', status: 'Lights off, air flow normal', light: 0.04, air: 0.5 }
      ];
      this.orPicks = this.orCmds.map((c, i) => () => { if (this.flags) this.orSet(i, true); });
      const ref = (k) => (node) => { this.cv[k] = node; if (node) this.mount(k); };
      this._fns = {
        refHms: ref('hms'), refOr: ref('or'), refPlc: ref('plc'), refSix: ref('six'), refStone: ref('stone'), refExc: ref('exc'),
        excLocal: () => { if (this.flags) this.setExc(0); },
        excGlobal: () => { if (this.flags) this.setExc(1); },
        excDrive: () => { if (this.flags) this.setExc(2); },
        hmsFlat: () => { if (this.flags) this.setHms(0, true); },
        hmsParse: () => { if (this.flags) this.setHms(1, true); },
        plcSend: () => { if (!this.flags) return; this.flags.plc.burst += 5; this.flags.plc.sent += 1; this.setState({ plcCount: this.flags.plc.sent }); },
        toSystem: () => this.setTheme('system'), toLight: () => this.setTheme('light'), toDark: () => this.setTheme('dark')
      };
    }
    const st = this.state || {};
    const hs = st.hmsSel || 0, oi = st.orIdx || 0, th = st.theme || 'system';
    return Object.assign({}, this._fns, {
      theme: th, thSys: th === 'system' ? 'true' : 'false', thLight: th === 'light' ? 'true' : 'false', thDark: th === 'dark' ? 'true' : 'false',
      j1: st.j1 || '0.0', j2: st.j2 || '0.0', j3: st.j3 || '0.0',
      hmsA: hs === 0 ? 'true' : 'false', hmsB: hs === 1 ? 'true' : 'false',
      hmsName: st.hmsName || '', hmsMeta: st.hmsMeta || '', hmsState: st.hmsState || '', hmsDot: st.hmsDot || 'ok', hmsDetail: st.hmsDetail || '',
      orStatus: this.orCmds[oi].status,
      orChips: this.orCmds.map((c, i) => ({ say: c.say, pressed: i === oi ? 'true' : 'false', pick: this.orPicks[i] })),
      plcCount: st.plcCount || 0,
      sj1: st.sj1 || '0.0', sj2: st.sj2 || '0.0', sj3: st.sj3 || '0.0', sj4: st.sj4 || '0.0', sj5: st.sj5 || '0.0', sj6: st.sj6 || '0.0',
      stPhase: st.stPhase || 'Finding stones', stMsg: st.stMsg || '',
      stp0: st.stp0 || '', stp1: st.stp1 || '', stp2: st.stp2 || '', stp3: st.stp3 || '', stp4: st.stp4 || '',
      exA: (st.exMode || 0) === 0 ? 'true' : 'false', exB: st.exMode === 1 ? 'true' : 'false', exC: st.exMode === 2 ? 'true' : 'false',
      exHeight: st.exMode === 2 ? 'none' : 'flex', exSlope: st.exMode === 2 ? 'flex' : 'none',
      exPhase: st.exPhase || '', exSw: st.exSw || '0.0', exBm: st.exBm || '0.0', exAr: st.exAr || '0.0', exBk: st.exBk || '0.0', exCov: st.exCov || '0 %'
    });
  }
}

  const app = new Component();
  const get = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  function render() {
    const v = app.renderVals();
    document.querySelectorAll('[data-bind]').forEach((el) => {
      el.getAttribute('data-bind').split(';').forEach((pair) => {
        const i = pair.indexOf(':'), attr = pair.slice(0, i), val = get(v, pair.slice(i + 1));
        if (el.getAttribute(attr) !== String(val)) el.setAttribute(attr, val);
      });
    });
    document.querySelectorAll('[data-text]').forEach((el) => {
      const val = String(get(v, el.getAttribute('data-text')));
      if (el.textContent !== val) el.textContent = val;
    });
  }
  function start() {
    const v = app.renderVals();
    document.querySelectorAll('[data-on]').forEach((el) => {
      const name = el.getAttribute('data-on');
      el.addEventListener('click', (e) => { const fn = get(app.renderVals(), name); if (fn) fn(e); });
    });
    render();
    app.componentDidMount();
    document.querySelectorAll('[data-ref]').forEach((el) => { const fn = get(v, el.getAttribute('data-ref')); if (fn) fn(el); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
