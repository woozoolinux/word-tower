'use strict';
// 🏘️ 입체 마을 — 1단계: 땅 · 길 · 걷기
//
// 왜 3D 인가: 2D 마을은 빛과 그림자까지 넣어도 결국 평평하다. 아이가 보는
// 다른 게임들은 비스듬히 내려다보는 3D라 깊이가 있다.
//
// 왜 이렇게 만드는가:
//   · **모델 파일이 없다.** 상자·원뿔·구로만 짓는다. 우리 그림체가 원래 단순해서 잘 맞는다
//   · **캐릭터는 지금 쓰는 SVG 아바타 그대로.** 판때기에 붙여 세운다(HD-2D).
//     풀 3D 로 가면 피부·머리·옷·무기·오라를 전부 버려야 한다 — 그건 손해다
//   · **2D 마을을 안 건드린다.** 설정 스위치로 고른다. 느리거나 별로면 끄면 그만이다
//   · 지도(건물 자리·충돌·진입)는 2D 마을에서 그대로 빌려 쓴다(`Town.layout()`).
//     각자 짓게 두면 언젠가 어긋난다
//
// three.js 는 614KB 라 **켤 때만** 받아온다. 안 켜면 한 바이트도 안 받는다.
const Town3D = (() => {
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.150.1/three.min.js';
  const M = 1 / 26;              // 2D 월드 26px = 3D 1미터
  const SPEED = 132;             // 2D 마을과 같은 걷는 속도(px/초)
  const CAM = { x: 15, y: 15, z: 17 };   // 아이소메트릭 시점 (비스듬히 내려다본다)
  const ZOOM = 12;                       // 한 화면에 보이는 넓이 — 클수록 멀리 보인다

  let loading = false;
  let sc, cam, rd, root, hero, heroSh, raf, last, active;
  let map, px, py, dir, dirS, walkT, stepAt, moving, joy, keys, nearP, hint, camAt;
  let frames, texes, texIdx;

  const el = id => document.getElementById(id);

  // ---------- three.js 를 필요할 때만 ----------
  function ensure(cb) {
    if (typeof THREE !== 'undefined') { cb(true); return; }
    if (loading) return;
    loading = true;
    UI.toast('🏘️ 입체 마을을 준비하고 있어요…');
    const s = document.createElement('script');
    s.src = CDN;
    s.onload = () => { loading = false; cb(true); };
    s.onerror = () => {
      loading = false;
      UI.toast('입체 마을을 못 받아왔어요 — 원래 마을로 갈게요', 'bad');
      state.settings.town3d = false; saveState();
      cb(false);
    };
    document.head.appendChild(s);
  }

  // ---------- 시작 ----------
  function start() { boot(false); }
  function resume() { boot(true); }
  function boot(isResume) {
    ensure(ok => {
      if (!ok) { Town.start(); return; }
      Game.home = 'town';
      Town.useHost({ stop, resume });
      if (!map || !isResume) {
        map = Town.layout();
        px = map.start.x; py = map.start.y;
        dir = 1; dirS = 1; walkT = 0; stepAt = 0;
        camAt = null;
      }
      frames = Avatar.walkFrames(); texes = [null, null, null, null]; texIdx = 0;
      joy = null; keys = {}; nearP = null; hint = '';
      shell();
      UI.show('town3d');
      build();
      run();
    });
  }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }
  function run() {
    active = true; last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  // ---------- 화면 틀 (2D 마을과 같은 HUD·조이스틱을 쓴다) ----------
  function shell() {
    const p = state.player;
    el('screen-town3d').innerHTML = `
      <div class="tw-hud">
        <span class="tw-me">${UI.charMini()}</span>
        <b>${esc(p.name)}</b><span class="lv-badge">Lv.${p.lv}</span>
        <span class="tw-stat">💰 ${p.gold}</span><span class="tw-stat">🃏 ${Cards.count()}</span>
        <button class="btn small ghost" id="t3-list">📋 목록</button>
      </div>
      <div class="tw-wrap" id="t3-wrap">
        <button class="tw-hint" id="t3-hint"></button>
        <div class="tw-joy on idle" id="t3-joy"><i></i></div>
      </div>
      <div class="tw-tip">화면을 끌어서 움직여요 · 설정에서 끄면 원래 마을로 돌아가요</div>`;
    el('t3-list').onclick = () => { stop(); Game.home = 'lobby'; Lobby.render(); UI.show('lobby'); };
    el('t3-hint').onclick = e => { e.stopPropagation(); if (nearP) Town.enter(nearP); };
    bindInput();
    requestAnimationFrame(() => {
      const wrap = el('t3-wrap'), s = el('t3-joy'), r = wrap.getBoundingClientRect();
      s.style.left = '62px'; s.style.top = (r.height - 62) + 'px';
    });
  }

  // ---------- 세계 ----------
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  function build() {
    const wrap = el('t3-wrap');
    const w = wrap.clientWidth || 340;
    const h = Math.max(280, Math.min(700, window.innerHeight - wrap.getBoundingClientRect().top - 60));
    wrap.style.height = h + 'px';

    sc = new THREE.Scene();
    sc.background = new THREE.Color('#9fd8f7');
    sc.fog = new THREE.Fog('#c8e8fb', 34, 58);

    const d = ZOOM;
    cam = new THREE.OrthographicCamera(-d * w / h, d * w / h, d, -d, 0.1, 160);

    rd = new THREE.WebGLRenderer({ antialias: true });
    rd.setSize(w, h);
    rd.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    rd.shadowMap.enabled = true; rd.shadowMap.type = THREE.PCFSoftShadowMap;
    rd.domElement.className = 't3-cv';
    // 조이스틱·버튼보다 아래에 깔린다
    wrap.insertBefore(rd.domElement, wrap.firstChild);

    // 빛 — 2D 마을과 같은 방향(왼쪽 위)
    const sun = new THREE.DirectionalLight(0xfff0d0, 0.95);
    sun.position.set(-8, 14, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18 });
    sun.shadow.bias = -0.0015;
    sun.target.position.set(0, 0, 0);
    sc.add(sun, sun.target, new THREE.HemisphereLight(0xbfe4ff, 0x4e7a3a, 0.42));
    root = { sun };

    ground();
    heroMake();
  }

  // 땅과 길. 2D 마을의 좌표를 그대로 옮긴다.
  function ground() {
    const W = map.W * M, H = map.H * M;
    const g = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 1, H + 4), mat(0xa9d47f));
    g.position.set(W / 2, -0.5, H / 2); g.receiveShadow = true; sc.add(g);
    // 북쪽으로 난 길 (2D 마을: x0 = W/2 - 78, 폭 156)
    const road = new THREE.Mesh(new THREE.BoxGeometry(156 * M, 0.12, H + 4), mat(0xe6d6ad));
    road.position.set(W / 2, 0.05, H / 2); road.receiveShadow = true; sc.add(road);
    // 광장 (2D: y = H-236 부터 100px)
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 0.12, 100 * M), mat(0xe6d6ad));
    plaza.position.set(W / 2, 0.05, (map.H - 186) * M); plaza.receiveShadow = true; sc.add(plaza);
    // 마을 밖 울타리 대신 낮은 둔덕 — 끝이 어디인지 보이게
    const edge = mat(0x74ad57);
    [[W / 2, -1, W + 4, 2], [W / 2, H + 1, W + 4, 2], [-1, H / 2, 2, H + 4], [W + 1, H / 2, 2, H + 4]]
      .forEach(([x, z, sx, sz]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.1, sz), edge);
        m.position.set(x, 0.2, z); m.receiveShadow = true; m.castShadow = true; sc.add(m);
      });
  }

  // 캐릭터 — 지금 쓰는 SVG 아바타를 판때기에 붙여 세운다
  function heroMake() {
    const m = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, depthWrite: false });
    hero = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.85), m);
    hero.rotation.y = Math.atan2(CAM.x, CAM.z);   // 아이소메트릭 카메라를 정면으로
    sc.add(hero);
    heroSh = new THREE.Mesh(new THREE.CircleGeometry(0.4, 20),
      new THREE.MeshBasicMaterial({ color: 0x2a3a1e, transparent: true, opacity: 0.3, depthWrite: false }));
    heroSh.rotation.x = -Math.PI / 2; sc.add(heroSh);
  }
  // 걷기 네 장을 텍스처로 (이미지가 준비된 것부터)
  function heroTex(i) {
    if (texes[i]) return texes[i];
    const f = frames && frames[i];
    if (!f || !f.ready) return null;
    const t = new THREE.Texture(f.img);
    t.needsUpdate = true; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
    texes[i] = t; return t;
  }

  // ---------- 입력 (2D 마을과 같은 방식) ----------
  function clampVec(x, y, max) {
    const d = Math.hypot(x, y);
    return d <= max || d === 0 ? { x, y, d } : { x: x / d * max, y: y / d * max, d: max };
  }
  function bindInput() {
    const wrap = el('t3-wrap'), stick = el('t3-joy');
    const at = e => { const r = wrap.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const show = () => {
      const d = clampVec(joy.x - joy.ox, joy.y - joy.oy, 42);
      stick.classList.add('on'); stick.classList.remove('idle');
      stick.style.left = joy.ox + 'px'; stick.style.top = joy.oy + 'px';
      stick.firstElementChild.style.transform = `translate(${d.x}px, ${d.y}px)`;
    };
    const down = e => { if (e.target.closest('.tw-hint')) return; const p = at(e); joy = { ox: p.x, oy: p.y, x: p.x, y: p.y }; show(); e.preventDefault(); };
    const move = e => { if (!joy) return; const p = at(e); joy.x = p.x; joy.y = p.y; show(); e.preventDefault(); };
    const up = () => {
      joy = null;
      const r = wrap.getBoundingClientRect();
      stick.classList.add('idle');
      stick.style.left = '62px'; stick.style.top = (r.height - 62) + 'px';
      stick.firstElementChild.style.transform = 'translate(0,0)';
    };
    wrap.addEventListener('touchstart', down, { passive: false });
    wrap.addEventListener('touchmove', move, { passive: false });
    wrap.addEventListener('touchend', up); wrap.addEventListener('touchcancel', up);
    wrap.addEventListener('mousedown', down); wrap.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
  function key(e, on) {
    const m = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd',
      ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' }[e.key];
    if (!m) return;
    keys[m] = on; e.preventDefault();
  }

  // ---------- 진행 ----------
  function loop(now) {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function hits(x, y, r) {
    return map.solids.some(s => x + r > s.x && x - r < s.x + s.w && y + r * .6 > s.y && y - r * .2 < s.y + s.h);
  }
  function update(dt) {
    let vx = 0, vy = 0;
    if (joy) { const d = clampVec(joy.x - joy.ox, joy.y - joy.oy, 42); if (d.d > 8) { vx = d.x / 42; vy = d.y / 42; } }
    if (keys.l) vx -= 1; if (keys.r) vx += 1; if (keys.u) vy -= 1; if (keys.d) vy += 1;
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    moving = Math.hypot(vx, vy) > .05;
    if (moving) { walkT += dt * 13; if (Math.abs(vx) > .2) dir = vx > 0 ? 1 : -1; }
    else walkT = 0;
    dirS += (dir - dirS) * Math.min(1, dt * 16);

    const r = 9, nx = vx * SPEED * dt, ny = vy * SPEED * dt;
    if (!hits(px + nx, py, r)) px += nx;
    if (!hits(px, py + ny, r)) py += ny;
    px = Math.max(12, Math.min(map.W - 12, px));
    py = Math.max(24, Math.min(map.H - 12, py));

    // 문 앞 (2D 마을과 같은 상자 판정)
    let best = null, bd = 1e9;
    map.places.forEach(p => {
      const dx = Math.abs(px - p.cx), dy = py - (p.y + p.h);
      if (dx > p.w / 2 + 30 || dy < -22 || dy > 64) return;
      const d = dx + Math.abs(dy);
      if (d < bd) { bd = d; best = p; }
    });
    nearP = best;
    const label = best ? Town.placeLabel(best) : '';
    if (label !== hint) {
      hint = label;
      const h = el('t3-hint');
      if (h) { h.textContent = label; h.classList.toggle('on', !!label); }
    }
  }

  function draw() {
    const hx = px * M, hz = py * M;
    const bob = moving ? Math.abs(Math.sin(walkT)) * 0.06 : Math.sin(performance.now() / 700) * 0.02;
    hero.position.set(hx, 0.94 + bob, hz);
    // 방향은 판때기를 좌우로 뒤집어서 (0을 지날 때 사라지지 않게 최소 폭을 남긴다)
    hero.scale.x = dirS < 0 ? Math.min(-0.18, dirS) : Math.max(0.18, dirS);
    heroSh.position.set(hx, 0.13, hz);
    const t = heroTex(moving ? ((Math.floor(walkT / (Math.PI / 2)) % 4) + 4) % 4 : 0);
    if (t && hero.material.map !== t) { hero.material.map = t; hero.material.needsUpdate = true; }

    // 카메라가 살짝 늦게 따라온다 (2D 마을과 같은 규칙)
    if (!camAt) camAt = { x: hx, z: hz };
    camAt.x += (hx - camAt.x) * Math.min(1, 1 / 60 * 7);
    camAt.z += (hz - camAt.z) * Math.min(1, 1 / 60 * 7);
    cam.position.set(camAt.x + CAM.x, CAM.y, camAt.z + CAM.z);
    cam.lookAt(camAt.x, 0.8, camAt.z);
    root.sun.position.set(camAt.x - 9, 16, camAt.z + 6);
    root.sun.target.position.set(camAt.x, 0, camAt.z);
    root.sun.target.updateMatrixWorld();

    rd.render(sc, cam);
  }

  function fit() {
    if (!rd || UI.current() !== 'town3d') return;
    const wrap = el('t3-wrap');
    const w = wrap.clientWidth || 340;
    const h = Math.max(280, Math.min(700, window.innerHeight - wrap.getBoundingClientRect().top - 60));
    wrap.style.height = h + 'px';
    rd.setSize(w, h);
    const d = ZOOM;
    cam.left = -d * w / h; cam.right = d * w / h; cam.top = d; cam.bottom = -d;
    cam.updateProjectionMatrix();
  }
  window.addEventListener('resize', fit);
  window.addEventListener('keydown', e => { if (UI.current() === 'town3d') key(e, true); });
  window.addEventListener('keyup', e => { if (UI.current() === 'town3d') key(e, false); });

  function debug(nx, ny) {
    if (nx !== undefined) { px = nx; py = ny; camAt = null; }
    return { px, py, W: map && map.W, H: map && map.H,
      near: nearP && Town.placeLabel(nearP), places: map && map.places.length,
      three: typeof THREE !== 'undefined' };
  }
  return { start, resume, stop, debug };
})();
