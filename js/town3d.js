'use strict';
// 🏘️ 입체 마을 — 땅 · 건물 · 걷기
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
  // 한 화면에 보이는 세로 넓이(미터의 절반). 12 였을 때 한 화면에 24m 가 들어가서
  // 키 1.6m 캐릭터가 화면의 7% 밖에 안 됐다 — 아이 눈에 다 작아 보인다.
  const ZOOM = 7.2;

  let loading = false;
  let sc, cam, rd, root, hero, ghost, heroSh, raf, last, active;
  let map, px, py, dir, dirS, walkT, stepAt, moving, joy, keys, nearP, hint, camAt;
  let faceTo = 0;                  // 몸이 향할 방향 (라디안)
  // 각도 차이를 -π~π 로. 안 하면 359도에서 1도로 갈 때 한 바퀴를 돈다.
  function angDiff(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
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
        <div class="t3-sky"><i></i><i></i><i></i><i></i><i></i></div>
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

    tags.length = 0; npcs.length = 0;
    for (const k in GEO) delete GEO[k];
    sc = new THREE.Scene();
    sc.background = null;                    // 하늘은 CSS 그라데이션이 깔린다 (공짜다)
    sc.fog = new THREE.Fog('#cfe9fb', 36, 62);   // 카메라까지가 27m 라 그보다 멀리서 시작해야 한다

    const d = ZOOM;
    cam = new THREE.OrthographicCamera(-d * w / h, d * w / h, d, -d, 0.1, 160);

    rd = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    rd.setSize(w, h);
    rd.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    rd.shadowMap.enabled = true; rd.shadowMap.type = THREE.PCFSoftShadowMap;
    rd.domElement.className = 't3-cv';
    // 조이스틱·버튼보다 아래에 깔린다
    const sky = wrap.querySelector('.t3-sky');
    wrap.insertBefore(rd.domElement, sky ? sky.nextSibling : wrap.firstChild);

    // 빛 — 2D 마을과 같은 방향(왼쪽 위)
    const sun = new THREE.DirectionalLight(0xfff0d0, 0.8);
    sun.position.set(-8, 14, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 });   // 좁힐수록 그림자가 또렷하다
    sun.shadow.bias = -0.0015;
    sun.target.position.set(0, 0, 0);
    // 채움광 — 그림자를 만들지 않는다. 보이는 면이 검게 죽는 걸 막는 역할만 한다
    const fill = new THREE.DirectionalLight(0xcfe4ff, 0.5);
    fill.position.set(14, 7, 10); fill.target.position.set(0, 0, 0);
    sc.add(sun, sun.target, fill, fill.target, new THREE.HemisphereLight(0xbfe4ff, 0x4e7a3a, 0.46));
    root = { sun, fill };

    skyStuff();
    ground();
    map.places.forEach(place);
    deco();
    heroMake();
  }

  // ---------- 건물 ----------
  // 2D 마을과 **같은 자리, 같은 규칙**으로 세운다. 모델 파일은 없다 —
  // 상자·원뿔·구만 쓴다. 우리 그림체가 원래 단순해서 이게 오히려 잘 맞는다.
  const C3 = {
    stone: 0x8f86c9, stoneDark: 0x5c5590,
    wall: 0xfff4dc, roof: 0xe8735e, roof2: 0x8f7bff,
    wood: 0x7a5636, leaf: 0x5faa4e, leaf2: 0x7cc55f,
    gold: 0xffc83d, ink: 0x3a2d1c, grass: 0xa9d47f, dirt: 0x8a6a44,
  };
  function mesh(geo, color, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    (parent || sc).add(m); return m;
  }
  // 2D 자리(p)를 3D 좌표로. 건물의 **문이 있는 앞면**이 기준이다.
  function spot(p) { return { x: p.cx * M, z: (p.y + p.h - 12) * M, w: p.w * M }; }
  function roofCone(g, r, h, y, color) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), mat(color));
    m.position.y = y; m.rotation.y = Math.PI / 4; m.castShadow = true; g.add(m); return m;
  }
  function door(g, w, h, y, z) {
    // 문틀 → 문짝 → 인방(문 위 가로대) → 손잡이 → 디딤돌.
    // 문 하나가 다섯 부재로 되어 있으면 멀리서도 "여기가 입구다" 가 읽힌다.
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.14, h + 0.12, 0.06), mat(C3.wood));
    fr.position.set(0, y, z - 0.01); g.add(fr);
    const d = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), mat(C3.ink));
    d.position.set(0, y, z + 0.02); g.add(d);
    const li = new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, 0.09, 0.11), mat(C3.wood));
    li.position.set(0, y + h / 2 + 0.11, z + 0.02); li.castShadow = true; g.add(li);
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(C3.gold));
    k.position.set(w * 0.28, y, z + 0.08); g.add(k);
    const st = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.07, 0.24), mat(0xcfc6ea));
    st.position.set(0, 0.035, z + 0.14); st.receiveShadow = true; g.add(st);
  }
  // 창 — 틀 한 겹에 유리 한 겹. 불이 켜지면 유리만 금색이 된다
  function win(g, w, h, x, y, z, lit, frame) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.05), mat(frame || C3.wood));
    f.position.set(x, y, z); g.add(f);
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05),
      new THREE.MeshBasicMaterial({ color: lit ? C3.gold : 0x241d3c }));
    p.position.set(x, y, z + 0.02); g.add(p);
    return f;
  }
  // 깃발 — 깃대에 매달린 천. 바람에 흔들리진 않지만 실루엣이 확 산다
  function flag(g, x, y, z, color, w) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(w || 0.38, 0.24, 0.03), mat(color));
    f.position.set(x + (w || 0.38) / 2 + 0.03, y, z); f.castShadow = true; g.add(f);
  }

  function place(p) {
    const s = spot(p), g = new THREE.Group();
    g.position.set(s.x, 0, s.z);
    p._g = g; sc.add(g);
    if (p.kind === 'tower') tower3(p, g, s);
    else if (p.kind === 'king') king3(p, g, s);
    else if (p.kind === 'hut') hut3(p, g, s);
    else if (p.kind === 'hole') hole3(p, g, s);
    else if (p.kind === 'gate') gate3(p, g, s);
  }

  // 등급의 탑 — 권이 층층이 (2D 마을과 같은 규칙)
  function tower3(p, g, s) {
    const ts = p.towers, n = ts.length;
    const TALL = 3.6;                       // 탑의 전체 높이는 권수와 상관없이 같다
    const segH = TALL / n, w0 = Math.min(1.95, s.w * 0.8);
    for (let i = 0; i < n; i++) {
      const t = ts[n - 1 - i];
      const lock = towerLock(t), prog = towerProg(t.id), total = floorList(t).length;
      const done = prog.cleared >= total;
      const sz = w0 - i * (0.5 / n), y = segH / 2 + i * segH;
      mesh(new THREE.BoxGeometry(sz, segH, sz), lock ? C3.stoneDark : C3.stone, 0, y, 0, g);
      // 층과 층 사이 돌출 띠. 이게 있어야 "여러 권이 쌓인 탑" 으로 읽힌다
      const band = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.13, 0.12, sz + 0.13),
        mat(lock ? 0x494272 : 0x6d64ab));
      band.position.y = y + segH / 2 - 0.06; band.castShadow = true; g.add(band);
      // 창이 걸리는 어두운 벽감 — 창 셋을 한 메시로 받쳐 준다
      const rec = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.82, 0.44, 0.04), mat(0x4b447a));
      rec.position.set(0, y + 0.05, sz / 2 + 0.015); g.add(rec);
      const lit = lock ? 0 : (done ? 3 : Math.round(prog.cleared / total * 3));
      for (let k = 0; k < 3; k++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.34, 0.05),
          new THREE.MeshBasicMaterial({ color: k < lit ? C3.gold : 0x241d3c }));
        m.position.set((k - 1) * (sz * 0.3), y + 0.05, sz / 2 + 0.03); g.add(m);
      }
    }
    const top = TALL;
    // 처마 — 지붕이 벽 위에 그냥 얹힌 게 아니라 걸쳐 있게
    const eave = new THREE.Mesh(new THREE.BoxGeometry(w0 + 0.22, 0.1, w0 + 0.22), mat(C3.wood));
    eave.position.y = top + 0.05; eave.castShadow = true; g.add(eave);
    roofCone(g, w0 * 0.74, 1.05, top + 0.6, C3.roof);
    // 지붕 꼭대기 구슬 → 깃대 → 깃발. 깬 탑은 금색 깃발이 걸린다
    mesh(new THREE.SphereGeometry(0.11, 10, 8), C3.gold, 0, top + 1.16, 0, g);
    mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0), C3.wood, 0, top + 1.66, 0, g);
    const allOpen = ts.every(t => !towerLock(t));
    flag(g, 0.02, top + 2.0, 0, allOpen ? C3.gold : C3.roof);
    door(g, 0.52, 0.8, 0.4, w0 / 2 + 0.02);
    const open = ts.filter(t => !towerLock(t)).length;
    tag(p, p.level.name + "의 탑 · " + open + "/" + n + "권", top + 2.7);   // 깃발보다 위로 (안 그러면 이름표가 깃발을 가린다)
  }

  // 왕의 성 — 가운데 몸통 + 양쪽 망루
  function king3(p, g) {
    const k = Game.kingInfo(p.level.id), beaten = k && k.beaten, ready = k && k.ok;
    const base = beaten ? 0x1c6f62 : ready ? 0x5d5698 : 0x332e5c;
    mesh(new THREE.BoxGeometry(1.9, 1.25, 1.5), base, 0, 0.62, 0, g);
    // 가운데 몸통 위 총안 — 성이 성처럼 보이는 건 거의 이 톱니 때문이다
    for (let i = -2; i <= 2; i++)
      mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), base, i * 0.36, 1.35, 0.62, g);
    // 몸통을 두르는 돌 띠
    const belt = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.11, 1.58), mat(0x8f86c9));
    belt.position.y = 0.86; belt.castShadow = true; g.add(belt);
    [-1.05, 1.05].forEach(x => {
      mesh(new THREE.BoxGeometry(0.62, 1.9, 0.62), base, x, 0.95, 0, g);
      for (let i = -1; i <= 1; i++) mesh(new THREE.BoxGeometry(0.16, 0.18, 0.16), base, x + i * 0.2, 1.99, 0, g);
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.04),
        new THREE.MeshBasicMaterial({ color: ready ? C3.gold : 0x6a5a2a }));
      f.position.set(x, 1.15, 0.33); g.add(f);
      // 망루마다 깃대와 깃발. 왕을 잡으면 초록, 도전할 수 있으면 금색
      mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.62), C3.wood, x, 2.4, 0, g);
      flag(g, x, 2.58, 0, beaten ? 0x2fd6a8 : ready ? C3.gold : 0x6a628f, 0.3);
    });
    door(g, 0.46, 0.68, 0.34, 0.77);
    tag(p, p.level.name + ' 왕' + (beaten ? ' ✓' : ''), 2.5, '👑');
  }

  // 오두막 — 상점·도감·옷가게·스킬·투기장
  function hut3(p, g) {
    const rc = p.act === 'skills' ? C3.roof2 : C3.roof;
    mesh(new THREE.BoxGeometry(1.6, 1.05, 1.4), C3.wall, 0, 0.52, 0, g);
    // 초석 — 집이 잔디에 파묻힌 것처럼 보이지 않게 밑을 받친다
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.14, 1.52), mat(0xd8cfbb));
    base.position.y = 0.07; base.receiveShadow = true; base.castShadow = true; g.add(base);
    // 반쪽 나무 기둥(하프팀버) — 벽이 민무늬 상자로 남지 않게
    [-0.66, 0.66].forEach(x => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.95, 0.06), mat(C3.wood));
      b.position.set(x, 0.56, 0.71); g.add(b);
    });
    const gird = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.09, 0.06), mat(C3.wood));
    gird.position.set(0, 0.98, 0.71); g.add(gird);
    // 창 둘 — 밤이 아니어도 켜 두면 "열려 있는 가게" 로 보인다
    win(g, 0.26, 0.28, -0.52, 0.66, 0.71, true);
    win(g, 0.26, 0.28, 0.52, 0.66, 0.71, true);
    // 창가 화분
    [-0.52, 0.52].forEach(x => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.12), mat(C3.wood));
      box.position.set(x, 0.48, 0.75); box.castShadow = true; g.add(box);
      mesh(new THREE.SphereGeometry(0.09, 8, 6), C3.leaf2, x, 0.56, 0.75, g);
    });
    roofCone(g, 1.3, 0.85, 1.45, rc);
    // 지붕 밑 처마 널
    const eave = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.09, 1.56), mat(0xe9dfc8));
    eave.position.y = 1.06; eave.castShadow = true; g.add(eave);
    // 굴뚝
    mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), 0xb7a58e, -0.42, 1.5, -0.34, g);
    mesh(new THREE.BoxGeometry(0.26, 0.08, 0.26), 0x8f7f6b, -0.42, 1.82, -0.34, g);
    // 문 위 차양 — 가게 앞이라는 표시
    const aw = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.07, 0.34), mat(rc));
    aw.position.set(0, 0.85, 0.86); aw.rotation.x = -0.22; aw.castShadow = true; g.add(aw);
    [-0.38, 0.38].forEach(x => {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), mat(C3.wood));
      pl.position.set(x, 0.6, 1.0); g.add(pl);
    });
    door(g, 0.44, 0.68, 0.34, 0.72);
    tag(p, p.name, 2.15, p.emoji);
  }

  // 지하 던전 — 땅에 뚫린 구멍
  function hole3(p, g) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.13, 8, 20), mat(0x3b3468));
    rim.rotation.x = -Math.PI / 2; rim.position.y = 0.08; rim.castShadow = true; g.add(rim);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.72, 24),
      new THREE.MeshBasicMaterial({ color: 0x0a0718 }));
    hole.rotation.x = -Math.PI / 2; hole.position.y = 0.14; g.add(hole);
    tag(p, '지하 던전', 1.0, '🕳️');
  }

  // 하늘섬 관문 — 이륙 자리, 그리고 저 위에 떠 있는 섬
  function gate3(p, g) {
    const lock = zoneLock(ZONES.find(x => x.id === 'sky')), open = !lock;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.14, 24),
      mat(open ? 0xd9cff5 : 0x9d97bd));
    pad.position.y = 0.07; pad.receiveShadow = true; g.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 8, 24),
      new THREE.MeshBasicMaterial({ color: open ? 0xbfe6ff : 0x8079a8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.16; g.add(ring);
    // 걸어서는 못 간다 — 섬은 저 위에 있다
    const isle = new THREE.Group(); isle.position.y = 4.3; g.add(isle);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15, 1.3, 7), mat(C3.dirt));
    cone.rotation.x = Math.PI; cone.position.y = -0.62; cone.castShadow = true; isle.add(cone);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.15, 0.22, 7), mat(C3.grass));
    top.position.y = 0.05; top.castShadow = true; isle.add(top);
    mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.5), C3.wood, -0.35, 0.4, 0.1, isle);
    mesh(new THREE.SphereGeometry(0.34, 12, 10), C3.leaf, -0.35, 0.85, 0.1, isle);
    if (!open) isle.children.forEach(c => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = 0.55; } });
    p._isle = isle;
    tag(p, open ? '하늘섬 · 날아오르기' : '하늘섬 · 날개가 없다', 6.2, open ? '⛰️' : '🦋');
  }

  // ---------- 하늘 · 구름 · 먼 산 ----------
  // 하늘이 단색이면 마을이 종이 위에 놓인 것처럼 보인다.
  // 그라데이션은 CSS 로 깔고(공짜다) 그 위에 구름과 먼 산만 3D 로 얹는다.
  function skyStuff() {
    const W = map.W * M, H = map.H * M;
    // 먼 산 — 마을 둘레에 눌러 놓은 구. 여기가 세상의 끝이라는 표시.
    // 마을은 세로로 긴 직사각형이라 **타원**으로 둘러야 한다.
    // (원으로 두르면 가로 쪽 산이 마을 안까지 들어와 광장을 덮는다)
    const hills = [];
    const HR = 9;                                  // 산 하나의 최대 반지름
    const rx = W / 2 + HR + 7, rz = H / 2 + HR + 7;
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2 + 0.25;
      const jitter = 1 + (i % 3) * 0.06;
      hills.push({
        x: W / 2 + Math.cos(a) * rx * jitter, y: -1.6, z: H / 2 + Math.sin(a) * rz * jitter,
        sx: 5 + (i % 4) * 1.3, sy: 2.4 + (i % 3) * 1.0, sz: 5 + (i % 5) * 0.9,
      });
    }
    const hm = instance(geo('hill', () => new THREE.SphereGeometry(1, 10, 7)), 0x86ac9a, hills, false);
    if (hm) { hm.receiveShadow = false; hm.material.fog = true; }

  }

  // ---------- 나무·풀·소품 ----------
  // 2D 마을이 뿌려 둔 자리(DECO)를 그대로 쓴다. 96개나 되니 InstancedMesh 로
  // 종류마다 한 번에 그린다 — 하나씩 Mesh 로 만들면 폰에서 드로우콜이 300개가 넘는다.
  const GEO = {};
  function geo(key, make) { return GEO[key] || (GEO[key] = make()); }
  function instance(g, color, items, shadow) {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(g, mat(color), items.length);
    im.castShadow = !!shadow; im.receiveShadow = true;
    const m4 = new THREE.Matrix4(), pos = new THREE.Vector3(),
      q = new THREE.Quaternion(), sca = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach((t, i) => {
      pos.set(t.x, t.y, t.z);
      sca.set(t.sx || t.s || 1, t.sy || t.s || 1, t.sz || t.s || 1);
      q.setFromAxisAngle(up, t.r || 0);
      m4.compose(pos, q, sca);
      im.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    sc.add(im);
    return im;
  }
  function deco() {
    const list = map.deco || [];
    const by = {};
    list.forEach(d => (by[d.kind] = by[d.kind] || []).push(d));
    const at = d => ({ x: d.x * M, z: d.y * M, s: d.s, r: d.f });

    // 나무 — 기둥 + 잎 두 덩이
    const trees = (by.tree || []).map(at);
    instance(geo('trunk', () => new THREE.CylinderGeometry(0.11, 0.15, 1.1, 6)), C3.wood,
      trees.map(t => ({ x: t.x, y: 0.55 * t.s, z: t.z, s: t.s, r: t.r })), true);
    instance(geo('leaf1', () => new THREE.SphereGeometry(0.62, 10, 8)), C3.leaf,
      trees.map(t => ({ x: t.x, y: 1.5 * t.s, z: t.z, s: t.s, r: t.r })), true);
    instance(geo('leaf2', () => new THREE.SphereGeometry(0.38, 8, 6)), C3.leaf2,
      trees.map(t => ({ x: t.x - 0.26 * t.s, y: 1.86 * t.s, z: t.z + 0.12 * t.s, s: t.s })), false);

    // 덤불
    const bush = (by.bush || []).map(at);
    instance(geo('bush1', () => new THREE.SphereGeometry(0.36, 8, 6)), C3.leaf,
      bush.map(t => ({ x: t.x, y: 0.26 * t.s, z: t.z, s: t.s })), true);
    instance(geo('bush2', () => new THREE.SphereGeometry(0.24, 8, 6)), C3.leaf2,
      bush.map(t => ({ x: t.x - 0.16 * t.s, y: 0.44 * t.s, z: t.z, s: t.s })), false);

    // 바위 — 구를 눌러 놓는다
    const rock = (by.rock || []).map(at);
    instance(geo('rock', () => new THREE.SphereGeometry(0.3, 8, 6)), 0xb6b0c9,
      rock.map(t => ({ x: t.x, y: 0.14 * t.s, z: t.z, sx: t.s, sy: 0.62 * t.s, sz: t.s * 0.85, r: t.r })), true);

    // 꽃 — 줄기 하나에 머리 하나. 머리는 색을 섞는다
    const fl = (by.flower || []).map(at);
    instance(geo('stem', () => new THREE.CylinderGeometry(0.03, 0.035, 0.44, 4)), 0x5faa4e,
      fl.map(t => ({ x: t.x, y: 0.22, z: t.z, s: 1 })), false);
    const heads = instance(geo('head', () => new THREE.SphereGeometry(0.15, 7, 6)), 0xffffff,
      fl.map(t => ({ x: t.x, y: 0.5, z: t.z, s: 1 })), false);
    if (heads) {
      const cols = [0xff8fa8, 0xffe066, 0xc9a3ff, 0xffffff];
      const c = new THREE.Color();
      fl.forEach((t, i) => heads.setColorAt(i, c.setHex(cols[Math.floor(t.r * 3) % cols.length])));
      if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
    }

    // 울타리 — 기둥 셋과 가로대 둘
    const fen = (by.fence || []).map(at);
    const posts = [], rails = [];
    fen.forEach(t => {
      [-0.5, 0, 0.5].forEach(dx => posts.push({ x: t.x + dx * t.s, y: 0.26 * t.s, z: t.z, s: t.s }));
      [0.18, 0.36].forEach(dy => rails.push({ x: t.x, y: dy * t.s, z: t.z, sx: t.s, sy: t.s, sz: t.s }));
    });
    instance(geo('post', () => new THREE.BoxGeometry(0.08, 0.52, 0.08)), C3.wood, posts, true);
    instance(geo('rail', () => new THREE.BoxGeometry(1.2, 0.07, 0.07)), C3.wood, rails, true);
  }

  // 이름표 — 3D 안에 세우면 건물에 가린다. 늘 앞에 보이게 띄운다.
  const tags = [];
  function tag(p, text, y, emoji) {
    const label = (emoji ? emoji + ' ' : '') + text;
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d');
    c.font = 'bold 26px "Jua", sans-serif';
    const w = Math.ceil(c.measureText(label).width) + 34;
    cv.width = w; cv.height = 44;
    c.fillStyle = 'rgba(10,8,28,.78)';
    c.beginPath(); c.roundRect(0, 0, w, 44, 22); c.fill();
    c.font = 'bold 26px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#fff6e0'; c.fillText(label, w / 2, 24);
    const tex = new THREE.CanvasTexture(cv);
    tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    // 스프라이트는 월드 크기라 카메라를 당기면 같이 커진다.
    // ZOOM 에 비례해 줄여야 화면에서 보이는 글자 크기가 그대로다.
    const ts = 0.66 * (ZOOM / 12);
    sp.scale.set(w / 44 * ts, ts, 1);
    sp.position.set(p.cx * M, y, (p.y + p.h - 12) * M);
    sp.renderOrder = 10;
    sc.add(sp); tags.push(sp);
  }

  // 돌 포장 무늬. 바닥을 단색으로 두면 아무리 넓어도 **아무것도 없는 면**으로 읽힌다.
  // 줄마다 반 칸씩 어긋나게 깐다 — 나란히 깔면 격자가 돼서 바닥이 아니라 표로 보인다
  function paveTex() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#e6d6ad'; x.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 4; r++) {
      for (let i = -1; i < 3; i++) {
        const px = i * 64 + (r % 2) * 32, py = r * 32;
        x.fillStyle = 'rgba(120,100,60,.20)'; x.fillRect(px, py, 62, 30);
        x.fillStyle = ['#efe0ba', '#e3d2a6', '#eadcb3', '#e7d8ad'][(r + i + 8) % 4];
        x.fillRect(px + 2, py + 2, 58, 26);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  // 땅과 길. 2D 마을의 좌표를 그대로 옮긴다.
  function ground() {
    const W = map.W * M, H = map.H * M;
    const g = new THREE.Mesh(new THREE.BoxGeometry(W + 24, 1, H + 24), mat(0xa9d47f));
    g.position.set(W / 2, -0.5, H / 2); g.receiveShadow = true; sc.add(g);
    // 마을 밖은 조금 어둡게 — 여기가 끝이라는 표시
    // 북쪽으로 난 길 (2D 마을: x0 = W/2 - 78, 폭 156)
    const road = new THREE.Mesh(new THREE.BoxGeometry(156 * M, 0.12, H + 4), mat(0xc9b183));
    road.position.set(W / 2, 0.05, H / 2); road.receiveShadow = true; sc.add(road);
    // 광장 (2D: y = H-236 부터 100px)
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(W + 4, 0.12, 100 * M), mat(0xc9b183));
    plaza.position.set(W / 2, 0.05, (map.H - 186) * M); plaza.receiveShadow = true; sc.add(plaza);
    // 포장 — 상자 윗면에 텍스처를 직접 입히면 옆면까지 늘어난다. 얇은 판을 한 장 덮는다
    const TILE = 1.9;                                  // 돌판 한 칸이 대략 1.9m
    pave(W / 2, H / 2, 150 * M, H + 2, TILE);
    pave(W / 2, (map.H - 186) * M, W - 2, 96 * M, TILE);
    // 길 가장자리 돌 — 길이 땅보다 살짝 파여 보인다
    [W / 2 - 79 * M, W / 2 + 79 * M].forEach(x => {
      const k = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, H + 4), mat(0xb49a71));
      k.position.set(x, 0.09, H / 2); k.receiveShadow = true; k.castShadow = true; sc.add(k);
    });
    // 마을 밖 울타리 대신 낮은 둔덕 — 끝이 어디인지 보이게
    const edge = mat(0x74ad57);
    [[W / 2, -1, W + 4, 2], [W / 2, H + 1, W + 4, 2], [-1, H / 2, 2, H + 4], [W + 1, H / 2, 2, H + 4]]
      .forEach(([x, z, sx, sz]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.1, sz), edge);
        m.position.set(x, 0.2, z); m.receiveShadow = true; m.castShadow = true; sc.add(m);
      });
    (map.lamps || []).forEach(lamp3);
    (map.props || []).forEach(prop3);
    (map.npcs || []).forEach(npc3);
  }
  function pave(x, z, w, d, tile) {
    const t = paveTex(); t.repeat.set(w / tile, d / tile);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
      new THREE.MeshLambertMaterial({ map: t }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.115, z);
    m.receiveShadow = true; sc.add(m);
  }

  // ---------- 가로등·광장 소품 ----------
  // 2D 마을이 이미 세워 둔 자리를 그대로 쓴다. 두 마을이 다르게 생기면 그때부터 관리가 안 된다
  function lamp3(l) {
    const g = new THREE.Group(); g.position.set(l.x * M, 0, l.y * M); sc.add(g);
    mesh(new THREE.CylinderGeometry(0.06, 0.09, 1.5, 6), 0x7a6a4a, 0, 0.75, 0, g);
    mesh(new THREE.BoxGeometry(0.24, 0.1, 0.24), 0x5c4f38, 0, 1.72, 0, g);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2),
      new THREE.MeshBasicMaterial({ color: 0xffd964 }));
    lamp.position.y = 1.56; g.add(lamp);
    // 발밑에 빛 웅덩이 — 등이 정말 켜져 있는 것처럼 보이는 건 거의 이것 때문이다
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 18),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.2, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.13; g.add(pool);
  }
  const npcs = [];
  function npc3(n) {
    const c = Char3D.build({ av: n.av, outfit: n.outfit, hat: 'none', weapon: 'none', aura: 'none' });
    c.group.scale.setScalar(0.92);
    c.group.position.set(n.x * M, 0, n.y * M);
    sc.add(c.group);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0x2a3a1e, transparent: true, opacity: 0.3, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(n.x * M, 0.14, n.y * M); sc.add(sh);
    // 말풍선 — 가까이 갔을 때만 켠다. 세 마디가 미리 만들어져 있고 번갈아 나온다
    const said = n.lines.map(t => bubble3(t, n));
    npcs.push({ n, c, said, near: false, idx: -1 });
  }
  function bubble3(text, n) {
    const cv = document.createElement('canvas');
    const c = cv.getContext('2d');
    c.font = 'bold 24px "Jua", sans-serif';
    const w = Math.ceil(c.measureText(text).width) + 30;
    cv.width = w; cv.height = 52;
    c.fillStyle = 'rgba(255,250,238,.97)';
    c.beginPath(); c.roundRect(0, 0, w, 40, 20); c.fill();
    c.beginPath(); c.moveTo(w / 2 - 7, 38); c.lineTo(w / 2 + 2, 51); c.lineTo(w / 2 + 7, 38); c.closePath(); c.fill();
    c.font = 'bold 24px "Jua", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#4a3f6b'; c.fillText(text, w / 2, 21);
    const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearFilter;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    const ts = 0.62 * (ZOOM / 12);
    sp.scale.set(w / 52 * ts * 1.18, ts * 1.18, 1);
    sp.position.set(n.x * M, 2.5, n.y * M);
    sp.renderOrder = 11; sp.visible = false;
    sc.add(sp); return sp;
  }
  function prop3(q) {
    const g = new THREE.Group(); g.position.set(q.x * M, 0, q.y * M); sc.add(g);
    if (q.kind === 'well') well3(g);
    else if (q.kind === 'stall') stall3(g, (q.w || 74) * M);
  }
  function well3(g) {
    // 돌 테두리 → 갓돌 → 물 → 기둥 둘 → 맞배 지붕 → 도르래에 매달린 두레박
    mesh(new THREE.CylinderGeometry(0.56, 0.6, 0.42, 14), 0xb0a184, 0, 0.21, 0, g);
    mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.1, 14), 0xd6c8a6, 0, 0.45, 0, g);
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.46, 16),
      new THREE.MeshBasicMaterial({ color: 0x2b5f92 }));
    w.rotation.x = -Math.PI / 2; w.position.y = 0.47; g.add(w);
    [-0.5, 0.5].forEach(x => mesh(new THREE.BoxGeometry(0.14, 1.15, 0.14), C3.wood, x, 1.05, 0, g));
    const rf = new THREE.Mesh(new THREE.ConeGeometry(0.72, 0.46, 4), mat(C3.roof));
    rf.position.y = 1.82; rf.rotation.y = Math.PI / 4; rf.castShadow = true; g.add(rf);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.07, 1.24), mat(C3.wood));
    eave.position.y = 1.6; eave.castShadow = true; g.add(eave);
    const bar = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0), 0x5c4f38, 0, 1.5, 0, g);
    bar.rotation.z = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44), 0x4a3f2c, 0, 1.28, 0, g);
    mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.2, 8), 0x8a6a44, 0, 0.96, 0, g);
    mesh(new THREE.TorusGeometry(0.13, 0.017, 6, 12), 0x5c4f38, 0, 1.02, 0, g).rotation.x = Math.PI / 2;
  }
  function stall3(g, w) {
    // 좌판 → 기둥 → 줄무늬 차양 → 올려 둔 것들. 노점은 차양 줄무늬로 알아본다
    mesh(new THREE.BoxGeometry(w, 0.1, 0.7), 0xa4814f, 0, 0.72, 0, g);
    mesh(new THREE.BoxGeometry(w - 0.14, 0.62, 0.6), 0x8a6a44, 0, 0.4, 0, g);
    [-w / 2 + 0.08, w / 2 - 0.08].forEach(x => {
      mesh(new THREE.BoxGeometry(0.08, 1.5, 0.08), C3.wood, x, 0.75, -0.28, g);
      mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), C3.wood, x, 0.65, 0.3, g);
    });
    const n = 6, sw = (w + 0.24) / n;
    for (let i = 0; i < n; i++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(sw, 0.06, 0.86), mat(i % 2 ? 0xfff4dc : C3.roof));
      st.position.set(-(w + 0.24) / 2 + sw * (i + 0.5), 1.42, 0.03);
      st.rotation.x = -0.16; st.castShadow = true; g.add(st);
    }
    // 사과 바구니와 항아리
    mesh(new THREE.BoxGeometry(0.34, 0.14, 0.28), 0xc98b4b, -w / 2 + 0.3, 0.84, 0.02, g);
    [-0.08, 0.06].forEach(dx => mesh(new THREE.SphereGeometry(0.07, 8, 6), 0xe05b4a, -w / 2 + 0.3 + dx, 0.94, 0.02, g));
    mesh(new THREE.SphereGeometry(0.16, 10, 8), 0x6d8fb0, w / 2 - 0.3, 0.9, 0, g);
  }

  // 캐릭터 — 상자로 조립한 **진짜 3D**. 걸어가는 쪽으로 몸이 돌고 팔다리가 흔들린다.
  // 판때기(평면 그림)로는 북쪽으로 걸어도 이쪽을 보고 있었다.
  function heroMake() {
    hero = Char3D.build({});
    hero.group.scale.setScalar(0.95);
    sc.add(hero.group);
    heroSh = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20),
      new THREE.MeshBasicMaterial({ color: 0x2a3a1e, transparent: true, opacity: 0.32, depthWrite: false }));
    heroSh.rotation.x = -Math.PI / 2; sc.add(heroSh);
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
    return (map.solids3 || map.solids).some(s => x + r > s.x && x - r < s.x + s.w && y + r * .6 > s.y && y - r * .2 < s.y + s.h);
  }
  function update(dt) {
    let vx = 0, vy = 0;
    if (joy) { const d = clampVec(joy.x - joy.ox, joy.y - joy.oy, 42); if (d.d > 8) { vx = d.x / 42; vy = d.y / 42; } }
    if (keys.l) vx -= 1; if (keys.r) vx += 1; if (keys.u) vy -= 1; if (keys.d) vy += 1;
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    moving = Math.hypot(vx, vy) > .05;
    if (moving) { walkT += dt * 13; faceTo = Math.atan2(vx, vy); }
    else walkT = 0;

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
    const now2 = performance.now() / 1000;
    hero.group.position.set(hx, 0, hz);
    // 몸이 **걸어가는 쪽**으로 돈다 (얼굴은 +z 를 보게 만들어 두었다)
    hero.group.rotation.y += angDiff(faceTo - hero.group.rotation.y) * Math.min(1, 1 / 60 * 12);
    Char3D.animate(hero, now2, moving, 1 / 60);
    hero.group.position.y += 0;
    heroSh.position.set(hx, 0.06, hz);

    // 마을 사람 — 숨을 쉬고, 가까이 가면 이쪽으로 돈다
    npcs.forEach(o => {
      Char3D.animate(o.c, now2 + o.n.x, false, 1 / 60);
      const near = Math.hypot(px - o.n.x, py - o.n.y) < 96;
      const face = near ? Math.atan2(hx - o.c.group.position.x, hz - o.c.group.position.z)
        : (o.n.x > map.W / 2 ? -Math.PI / 2 : Math.PI / 2);
      o.c.group.rotation.y += angDiff(face - o.c.group.rotation.y) * Math.min(1, 1 / 60 * 8);
      if (near !== o.near) {
        o.near = near;
        if (near) o.idx = (o.idx + 1) % o.said.length;             // 다시 오면 다음 말
        o.said.forEach((sp, i) => (sp.visible = near && i === o.idx));
      }
    });

    // 하늘섬은 둥둥 떠 있다
    const now = performance.now() / 1000;
    map.places.forEach(p => { if (p._isle) p._isle.position.y = 4.3 + Math.sin(now * 0.8) * 0.16; });

    // 카메라가 살짝 늦게 따라온다 (2D 마을과 같은 규칙)
    if (!camAt) camAt = { x: hx, z: hz };
    camAt.x += (hx - camAt.x) * Math.min(1, 1 / 60 * 7);
    camAt.z += (hz - camAt.z) * Math.min(1, 1 / 60 * 7);
    cam.position.set(camAt.x + CAM.x, CAM.y, camAt.z + CAM.z);
    cam.lookAt(camAt.x, 0.8, camAt.z);
    root.sun.position.set(camAt.x - 9, 16, camAt.z + 6);
    root.sun.target.position.set(camAt.x, 0, camAt.z);
    root.sun.target.updateMatrixWorld();
    // 채움광도 따라다녀야 한다. 방향광은 위치가 아니라 **위치−목표** 가 방향이라,
    // 목표를 원점에 두고 오면 마을 끝으로 갈수록 빛이 옆에서 든다
    root.fill.position.set(camAt.x + 14, 7, camAt.z + 10);
    root.fill.target.position.set(camAt.x, 0, camAt.z);
    root.fill.target.updateMatrixWorld();

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
