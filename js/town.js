'use strict';
// 🏘️ 마을 — 걸어다니는 로비
//
// 로비가 "활동 목록"이라 갈 곳을 누르는 것이지 가는 게 아니었다. 여기서는 걸어서
// 문 앞에 선다. 미니게임은 그대로 두고 입구만 세계로 바꾼 것이다.
//
// 등급 하나 = 탑 하나. 권(1~6)을 마을에 늘어놓으면 등급이 늘 때마다 6채씩 불어나
// 11등급이면 66채가 된다. 탑은 하나로 세우고 권은 **탑 안에서** 고른다 —
// 권이 층층이 쌓인 모습이 그대로 "이 등급에 6권이 있다"는 설명이 된다.
//
// 마을을 크게 만들면 안 된다. 걸어다니는 건 학습이 아니다.
const Town = (() => {
  const WW = 560;                     // 월드 폭
  const SPEED = 132;                  // px/초
  // 낮의 마을. 어두운 밤 배경은 "멋있다"에는 맞지만 "예쁘다"에는 안 맞는다.
  // 그리고 빈 땅이 넓으면 휑해 보인다 — 나무·꽃·울타리·벤치로 촘촘히 채운다.
  const C = {
    grass: '#a9d47f', grass2: '#8fc468', road: '#e6d6ad', roadEdge: '#c9b183',
    wall: '#fff4dc', wallDark: '#e6d5b4',
    roof: '#e8735e', roofDark: '#c4523f',
    stone: '#8f86c9', stoneDark: '#6a61a3', stoneLit: '#a9a1de',
    wood: '#8a6a44', trunk: '#7a5636', leaf: '#5faa4e', leaf2: '#7cc55f',
    gold: '#ffc83d', ink: '#3a2d1c',
  };
  // 빛은 **왼쪽 위**에서 온다. 마을 안의 모든 그림자가 같은 쪽으로 져야 입체로 보인다.
  const LIGHT = { x: -.55, y: -.5 };            // 빛이 오는 방향
  const SH = { x: 4.5, y: 3 };                  // 그림자가 지는 쪽 (빛의 반대)
  // 벽 한 면. 왼쪽은 빛을 받고 오른쪽은 그늘진다 — 같은 사각형이 상자로 보인다.
  function wall(x, y, w, h, base) {
    ctx.fillStyle = base; ctx.fillRect(x, y, w, h);
    const g = ctx.createLinearGradient(x, y, x + w, y + h * .25);
    g.addColorStop(0, 'rgba(255,255,255,.22)');
    g.addColorStop(.42, 'rgba(255,255,255,.02)');
    g.addColorStop(1, 'rgba(26,20,58,.28)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  }
  // 지붕 밑에 드리우는 그늘 — 지붕이 벽에서 튀어나와 있다는 표시
  function eaves(x, y, w, d) {
    const g = ctx.createLinearGradient(0, y, 0, y + d);
    g.addColorStop(0, 'rgba(26,20,58,.32)'); g.addColorStop(1, 'rgba(26,20,58,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, d);
  }
  // 딱딱한 검은 타원 대신 가장자리가 흐린 그림자. 이것 하나로 물체가 땅에 붙는다.
  function softShadow(x, y, rx, ry, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(38,52,30,${alpha})`);
    g.addColorStop(.62, `rgba(38,52,30,${(alpha * .72).toFixed(3)})`);
    g.addColorStop(1, 'rgba(38,52,30,0)');
    ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rx, 0, 6.3); ctx.fill();
    ctx.restore();
  }

  const DECO = [];
  function scatter(W, H, blocked) {
    DECO.length = 0;
    const kinds = ['tree', 'tree', 'bush', 'flower', 'flower', 'rock', 'fence'];
    let guard = 0;
    while (DECO.length < 96 && guard++ < 4000) {
      const x = 14 + Math.random() * (W - 28), y = 30 + Math.random() * (H - 50);
      if (Math.abs(x - W / 2) < 92) continue;                 // 길은 비운다
      if (blocked(x, y)) continue;
      if (DECO.some(d => Math.abs(d.x - x) < 26 && Math.abs(d.y - y) < 20)) continue;
      DECO.push({ kind: kinds[(Math.random() * kinds.length) | 0], x, y, s: .8 + Math.random() * .5, f: Math.random() * 6.3 });
    }
  }
  function drawDeco(d, t) {
    const sway = Math.sin(t * 1.4 + d.f) * 1.6;
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.s, d.s);
    if (d.kind === 'tree') {
      softShadow(SH.x * 1.4, 2, 15, 5.5, .26);
      ctx.fillStyle = C.trunk; ctx.fillRect(-3, -16, 6, 17);
      ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(0, -16, 3, 17);      // 줄기 그늘진 쪽
      ctx.translate(sway, 0);
      ctx.fillStyle = C.leaf;
      [[0, -34, 15], [-11, -25, 11], [11, -25, 11]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); });
      // 빛 받는 쪽만 밝게 — 같은 원이 공처럼 보인다
      ctx.fillStyle = C.leaf2;
      [[-4, -38, 9], [7, -32, 7]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = 'rgba(255,255,255,.28)';
      ctx.beginPath(); ctx.arc(-6, -40, 5, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(20,50,20,.18)';
      ctx.beginPath(); ctx.arc(9, -22, 8, 0, 6.3); ctx.fill();
    } else if (d.kind === 'bush') {
      softShadow(SH.x, 2, 13, 4.5, .24);
      ctx.translate(sway * .5, 0);
      ctx.fillStyle = C.leaf;
      [[-7, -6, 8], [7, -6, 8], [0, -11, 10]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = C.leaf2; ctx.beginPath(); ctx.arc(-3, -13, 6, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(20,50,20,.16)'; ctx.beginPath(); ctx.arc(8, -4, 7, 0, 6.3); ctx.fill();
    } else if (d.kind === 'flower') {
      ctx.strokeStyle = '#5faa4e'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sway * .6, -9); ctx.stroke();
      const cols = ['#ff8fa8', '#ffe066', '#c9a3ff', '#fff'];
      ctx.fillStyle = cols[(d.f * 3 | 0) % cols.length];
      for (let i = 0; i < 5; i++) { const a = i * 1.256; ctx.beginPath(); ctx.arc(sway * .6 + Math.cos(a) * 3, -9 + Math.sin(a) * 3, 2.4, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(sway * .6, -9, 1.8, 0, 6.3); ctx.fill();
    } else if (d.kind === 'rock') {
      softShadow(SH.x * .8, 1, 10, 3.4, .22);
      ctx.fillStyle = '#a49dba'; ctx.beginPath(); ctx.ellipse(0, -4, 9, 6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#c4bed6'; ctx.beginPath(); ctx.ellipse(-1.5, -5, 7.5, 4.6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#e2dded'; ctx.beginPath(); ctx.ellipse(-2.5, -6.5, 4.5, 2.6, 0, 0, 6.3); ctx.fill();
    } else {
      ctx.fillStyle = C.wood;
      ctx.fillRect(-14, -14, 3.5, 15); ctx.fillRect(0, -16, 3.5, 17); ctx.fillRect(14, -14, 3.5, 15);
      ctx.fillRect(-15, -11, 32, 3); ctx.fillRect(-15, -5, 32, 3);
    }
    ctx.restore();
  }
  let cv, ctx, raf, last, active, places, solids, W, H, px, py, dir, walkT, cam, pimg, frames, moving, joy, keys, nearP, hint, lamps, tufts, props, npcs, arches;
  let dirS, dust, stepAt;      // 부드럽게 도는 방향 · 발먼지 · 마지막 발소리

  const el = id => document.getElementById(id);
  let VIEW = { w: 380, h: 400, s: 1 };
  const vw = () => VIEW.w;
  const vh = () => VIEW.h;

  // ---------- 세계 만들기 ----------
  function build() {
    places = []; solids = []; lamps = []; tufts = []; props = []; npcs = []; arches = [];
    const zones = LEVELS.filter(L => levelTowers(L.id).length);
    const ZH = 224, SKYY = 196;          // 북쪽 끝, 하늘섬이 떠 있을 자리 (높아야 못 간다는 게 보인다)
    H = 250 + zones.length * ZH + 30 + SKYY;
    W = WW;

    const plazaY = H - 236;
    [
      { act: 'shop',   emoji: '🛒', name: '상점',   x: 30,  y: plazaY + 96 },
      { act: 'book',   emoji: '📖', name: '도감',   x: 132, y: plazaY + 96 },
      { act: 'dress',  emoji: '👕', name: '옷가게', x: 340, y: plazaY + 96 },
      { act: 'skills', emoji: '📜', name: '스킬',   x: 442, y: plazaY + 96 },
      { act: 'arena',  emoji: '🏟️', name: '투기장', x: 66,  y: plazaY + 4 },
    ].forEach(f => addPlace(Object.assign({ kind: 'hut', w: 78, h: 64 }, f)));
    addPlace({ kind: 'hole', act: 'dungeon', emoji: '🕳️', name: '지하 던전', x: 400, y: plazaY + 14, w: 84, h: 46 });
    // 북쪽 길 끝의 **이륙 자리**. 하늘섬 자체는 저 위에 떠 있어서 걸어서는 못 간다.
    addPlace({ kind: 'gate', act: 'sky', x: W / 2 - 52, y: 30, w: 104, h: 138 });

    // 등급 구역: 큰 탑 하나 + 왕의 성
    zones.forEach((L, i) => {
      const zy = H - 262 - (i + 1) * ZH;
      addPlace({ kind: 'tower', level: L, towers: levelTowers(L.id), x: W / 2 - 48, y: zy, w: 96, h: 158 });
      if (L.animal) {
        const kp = { kind: 'king', level: L, x: W - 132, y: zy + 40, w: 104, h: 88 };
        addPlace(kp);
        kingApproach(kp);
      }
      // 등급 입구 아치 — 탑 아래(zy+158)와 앞 등급 사이, 그 가운데.
      // 가로등 둘을 아치 바깥에 세워 문에 불을 켠다
      const ay = zy + 191;
      arches.push({ level: L, x: W / 2, y: ay });
      lamps.push({ x: W / 2 - 100, y: ay }, { x: W / 2 + 100, y: ay });
    });
    lamps.push({ x: W / 2 - 108, y: H - 44 }, { x: W / 2 + 108, y: H - 44 });
    // 광장 소품 — 우물 하나, 노점 하나. 바닥이 넓게 비어 있으면 마을이 안 산다.
    // 길 한가운데(x 256~358)는 비워 둔다 — 북쪽으로 걸어 나가는 길이다
    props.push({ kind: 'well', x: 228, y: plazaY + 46, r: 25 });
    props.push({ kind: 'stall', x: 508, y: plazaY + 44, w: 74 });
    // ---- 왕의 성 가는 길 ----
    // 배너와 화톳불은 부딪힌다 (샛길 가장자리와 성 모서리에 있어서 지나는 데 지장 없다).
    // 경비병은 안 부딪힌다 — 문 앞에 서 있는 사람한테 끼면 왕을 만나러 못 간다
    // 아치 기둥은 부딪힌다 — 길 밖에 있어서 지나가는 데는 상관없다
    arches.forEach(a => [-72, 72].forEach(dx =>
      solids.push({ x: a.x + dx - 11, y: a.y - 10, w: 22, h: 18 })));
    props.forEach(q => solids.push({ x: q.x - (q.r || q.w / 2) + 4, y: q.y - 12, w: (q.r || q.w / 2) * 2 - 8, h: 22 }));
    // 광장에 사람 셋. **부딪히지 않는다** — 아이 게임에서 마을 사람한테 끼는 것만큼
    // 답답한 게 없다. 그래서 solids 에 넣지 않는다.
    // 가까이 가면 이쪽을 보고 한마디 한다. 말을 걸 필요는 없다 — 마을이 살아 있으면 된다
    npcs.push(
      { x: 508, y: 930, av: { skin: 2, hairStyle: 'short', hairColor: 0 }, outfit: 'wizard',
        lines: ['사과 하나 줄까? 단어 하나 맞히면!', '오늘은 장사가 잘 되네.', '탑에서 내려오면 또 들러.'] },
      { x: 186, y: 976, av: { skin: 0, hairStyle: 'twin', hairColor: 3 }, outfit: 'dress',
        lines: ['우물에 동전 던지면 소원이 이뤄진대!', '저 탑 꼭대기 가봤어?', '나도 크면 용사 될 거야.'] },
      { x: 332, y: 926, av: { skin: 2, hairStyle: 'long', hairColor: 4 }, outfit: 'knight',
        lines: ['북쪽 끝에 섬이 떠 있어. 날개가 있어야 간대.', '곰 등급은 진짜 어렵더라.', '조심해서 다녀와.'] });
    npcs.forEach(n => { n.said = 0; n.near = false; n.face = -1; n.faceS = -1; });
    for (let i = 0; i < 130; i++) tufts.push({ x: 10 + Math.random() * (W - 20), y: 20 + Math.random() * (H - 40), s: 2 + Math.random() * 3 });
    // 빈 땅이 넓으면 휑하다 — 건물과 길을 피해 나무·꽃·울타리를 촘촘히 뿌린다
    // 왕의 성 샛길에도 나무가 자라면 안 된다 — 포장 위에 나무가 서 있으면 길이 아니게 보인다
    scatter(W, H, (x, y) => places.some(p => x > p.x - 22 && x < p.x + p.w + 22 && y > p.y - 20 && y < p.y + p.h + 26)
      || places.some(p => p._spur && x > p._spur.x0 - 16 && x < p._spur.x1 + 16 && Math.abs(y - p._spur.y) < 48));

    solids.push({ x: -40, y: -40, w: W + 80, h: 40 }, { x: -40, y: H, w: W + 80, h: 40 },
      { x: -40, y: -40, w: 40, h: H + 80 }, { x: W, y: -40, w: 40, h: H + 80 });
    px = W / 2; py = H - 34; dir = 1; dirS = 1; walkT = 0; dust = []; stepAt = 0;
    cam = { x: px, y: py };      // 처음엔 캐릭터 자리에서 시작 (안 그러면 첫 프레임에 확 밀린다)
  }
  // 큰길 → 성문. 샛길 좌우에 배너 넷, 성 모서리에 화톳불 둘, 문 앞에 경비병 둘
  function kingApproach(p) {
    const cx = p.x + p.w / 2, gy = p.y + p.h + 6;      // 성문 앞
    const k = typeof Game !== 'undefined' && Game.kingInfo ? Game.kingInfo(p.level.id) : null;
    const beaten = k && k.beaten, ready = k && k.ok;
    p._spur = { y: gy - 4, x0: W / 2 + 66, x1: Math.min(W - 4, cx + 80) };
    [0, 1].forEach(i => {
      const bx = W / 2 + 86 + i * 58;      // 성문 앞(cx±40)까지 오면 문을 막는다
      [-32, 32].forEach(dy => props.push({ kind: 'banner', x: bx, y: p._spur.y + dy, r: 8, color: p.level.emoji }));
    });
    // 화톳불은 성 모서리 바깥(±64), 경비병은 문 양옆(±38) — 겹치면 경비병이 불을 가린다
    [-64, 64].forEach(dx => props.push({ kind: 'brazier', x: cx + dx, y: gy - 2, r: 11, lit: ready || beaten }));
    const say = beaten
      ? ['왕께서 자네를 기다리셨네.', '이 성은 이제 자네 것일세.']
      : ready ? ['왕께서 기다리신다. 들어가라.', '준비됐나? 되돌아올 수 없다.']
        : ['카드를 더 모아 오게.', '아직 왕을 뵐 때가 아니야.'];
    [-38, 38].forEach((dx, i) => npcs.push({
      x: cx + dx, y: gy + 16, guard: true,
      av: { skin: i ? 1 : 2, hairStyle: i ? 'short' : 'bob', hairColor: i ? 0 : 1 },
      outfit: 'knight', lines: say,
    }));
  }
  function addPlace(p) {
    p.cx = p.x + p.w / 2; p.cy = p.y + p.h / 2;
    places.push(p);
    solids.push({ x: p.x + 5, y: p.y, w: p.w - 10, h: p.h - 16 });
    p.foot = footOf(p);
  }
  // 건물이 **땅에 닿는 자리**. 2D 는 그림이 위로 길어서 그림만큼 막아도 어색하지 않았지만,
  // 3D 에서는 건물 뒤 빈 땅까지 막혀 버린다. 그래서 3D 는 이 발자국만 막는다.
  function footOf(p) {
    const cz = p.y + p.h - 12;                    // 3D 에서 건물이 서는 자리
    const dim = {
      tower: [Math.min(54, p.w * .84), 54], king: [78, 46],
      hut: [46, 42], hole: [42, 42], gate: [50, 50],
    }[p.kind] || [p.w, 30];
    return { x: p.cx - dim[0] / 2, y: cz - dim[1] / 2, w: dim[0], h: dim[1] };
  }

  // ---------- 시작 ----------
  function start() {
    Game.home = 'town';
    if (!el('screen-town')) return;
    useHost({ stop, resume });
    build();
    frames = Avatar.walkFrames(); pimg = frames[0];
    joy = null; keys = {}; nearP = null; hint = '';
    shell(); UI.show('town'); resize(); run();
  }
  function resume() {
    if (!places) { start(); return; }
    Game.home = 'town';
    useHost({ stop, resume });
    shell(); UI.show('town'); resize(); run();
  }
  function run() {
    active = true; last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function shell() {
    const p = state.player;
    el('screen-town').innerHTML = `
      <div class="tw-hud">
        <span class="tw-me">${UI.charMini()}</span>
        <b>${esc(p.name)}</b><span class="lv-badge">Lv.${p.lv}</span>
        <span class="tw-stat">💰 ${p.gold}</span><span class="tw-stat">🃏 ${Cards.count()}</span>
        <button class="btn small ghost" id="tw-list">📋 목록</button>
      </div>
      <div class="tw-wrap"><canvas id="tw-cv"></canvas>
        <button class="tw-hint" id="tw-hint"></button>
        <div class="tw-joy on idle" id="tw-joy"><i></i></div>
      </div>
      <div class="tw-tip">화면을 끌어서 움직이고, 문 앞에서 노란 버튼을 눌러요</div>`;
    cv = el('tw-cv'); ctx = cv.getContext('2d');
    resize();
    el('tw-list').onclick = () => { stop(); Game.home = 'lobby'; Lobby.render(); UI.show('lobby'); };
    el('tw-hint').onclick = e => { e.stopPropagation(); if (nearP) enter(nearP); };
    bindInput();
    requestAnimationFrame(() => {                       // 늘 보이는 조이스틱을 제자리에
      const wrap = cv.parentElement, s = el('tw-joy'), r = wrap.getBoundingClientRect();
      s.style.left = '62px'; s.style.top = (r.height - 62) + 'px';
    });
  }
  function resize() {
    if (!cv) return;
    const r = UI.fitCanvas(cv, { designW: 380, maxScale: 1.6, minH: 280, maxH: 620 });
    VIEW = r;                     // 설계 좌표계 크기 — 카메라가 이걸로 잡힌다
  }

  // ---------- 입력 ----------
  function bindInput() {
    const wrap = cv.parentElement, stick = el('tw-joy');
    const at = e => { const r = wrap.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const down = e => { if (e.target.closest('.tw-hint')) return; const p = at(e); joy = { ox: p.x, oy: p.y, x: p.x, y: p.y }; showStick(stick); e.preventDefault(); };
    const move = e => { if (!joy) return; const p = at(e); joy.x = p.x; joy.y = p.y; showStick(stick); e.preventDefault(); };
    const home = () => { const r = wrap.getBoundingClientRect(); return { x: 62, y: r.height - 62 }; };
    const rest = () => {
      const h = home();
      stick.classList.add('idle');
      stick.style.left = h.x + 'px'; stick.style.top = h.y + 'px';
      stick.firstElementChild.style.transform = 'translate(0,0)';
    };
    const up = () => { joy = null; rest(); };
    wrap.addEventListener('touchstart', down, { passive: false });
    wrap.addEventListener('touchmove', move, { passive: false });
    wrap.addEventListener('touchend', up); wrap.addEventListener('touchcancel', up);
    wrap.addEventListener('mousedown', down); wrap.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
  function showStick(stick) {
    const d = clampVec(joy.x - joy.ox, joy.y - joy.oy, 42);
    stick.classList.add('on'); stick.classList.remove('idle');
    stick.style.left = joy.ox + 'px'; stick.style.top = joy.oy + 'px';
    stick.firstElementChild.style.transform = `translate(${d.x}px, ${d.y}px)`;
  }
  function clampVec(x, y, max) {
    const d = Math.hypot(x, y);
    return d <= max || d === 0 ? { x, y, d } : { x: x / d * max, y: y / d * max, d: max };
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
  function update(dt) {
    let vx = 0, vy = 0;
    if (joy) { const d = clampVec(joy.x - joy.ox, joy.y - joy.oy, 42); if (d.d > 8) { vx = d.x / 42; vy = d.y / 42; } }
    if (keys.l) vx -= 1; if (keys.r) vx += 1; if (keys.u) vy -= 1; if (keys.d) vy += 1;
    const len = Math.hypot(vx, vy);
    if (len > 1) { vx /= len; vy /= len; }
    moving = Math.hypot(vx, vy) > .05;
    if (moving) { walkT += dt * 13; if (Math.abs(vx) > .2) dir = vx > 0 ? 1 : -1; }
    else walkT = 0;                                    // 멈추면 두 발을 모은다
    // 방향 전환을 한 프레임에 뒤집지 않는다 — 0.1초쯤 걸려 돈다
    dirS += (dir - dirS) * Math.min(1, dt * 16);
    step(vx * SPEED * dt, vy * SPEED * dt);
    // 발이 땅에 닿을 때마다 먼지 (걷는 게 땅에 닿아 있다는 느낌)
    if (moving && walkT - stepAt > Math.PI) {
      stepAt = walkT;
      for (let i = 0; i < 3; i++) {
        dust.push({ x: px + (Math.random() - .5) * 9, y: py + 2,
          vx: (Math.random() - .5) * 16 - vx * 10, vy: -6 - Math.random() * 8,
          r: 1.6 + Math.random() * 2, life: .42 });
      }
    }
    dust = dust.filter(d => (d.life -= dt) > 0);
    dust.forEach(d => { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 22 * dt; });

    let best = null, bd = 1e9;
    places.forEach(p => {
      const dx = Math.abs(px - p.cx), dy = py - (p.y + p.h);
      if (dx > p.w / 2 + 30 || dy < -22 || dy > 64) return;      // 문 앞 상자
      const d = dx + Math.abs(dy);
      if (d < bd) { bd = d; best = p; }
    });
    let talker = null, td = 96;
    npcs.forEach(n => {
      const d = Math.hypot(px - n.x, py - n.y);
      if (d < td) { td = d; talker = n; }        // 한 번에 한 사람만 말한다
    });
    npcs.forEach(n => {
      const near = n === talker;
      if (near && !n.near) n.said = (n.said + 1) % n.lines.length;   // 다시 오면 다음 말
      n.near = near;
      const see = Math.hypot(px - n.x, py - n.y) < 110;              // 보는 건 둘 다 한다
      n.face = see ? (px < n.x ? -1 : 1) : (n.x > W / 2 ? -1 : 1);
      n.faceS += (n.face - n.faceS) * Math.min(1, dt * 10);
    });
    nearP = best;
    const label = best ? placeLabel(best) : '';
    if (label !== hint) {
      hint = label;
      const h = el('tw-hint');
      if (h) { h.textContent = label; h.classList.toggle('on', !!label); }
    }
  }
  function step(dx, dy) {
    const r = 9;
    if (!hits(px + dx, py, r)) px += dx;
    if (!hits(px, py + dy, r)) py += dy;
    px = Math.max(12, Math.min(W - 12, px)); py = Math.max(24, Math.min(H - 12, py));
  }
  function hits(x, y, r) {
    return solids.some(s => x + r > s.x && x - r < s.x + s.w && y + r * .6 > s.y && y - r * .2 < s.y + s.h);
  }

  function placeLabel(p) {
    if (p.kind === 'tower') {
      const open = p.towers.filter(t => !towerLock(t)).length;
      return open ? `${p.level.emoji} ${p.level.name}의 탑 · 들어가기` : `🔒 ${p.level.emoji} ${p.level.name}의 탑`;
    }
    if (p.kind === 'king') {
      const k = Game.kingInfo(p.level.id);
      return `👑 ${p.level.name} 왕${k && k.ok ? ' · 도전!' : k ? ` · 🃏 ${k.have}/${k.need}` : ''}`;
    }
    if (p.kind === 'hole') return '🕳️ 지하 던전 · 들어가기';
    if (p.kind === 'gate') {
      const lock = zoneLock(ZONES.find(x => x.id === 'sky'));
      if (!lock) return '🦋 하늘섬으로 날아오르기';
      return lock.kind === 'aura' ? '🦋 날개가 없어 날 수 없다' : `🔒 하늘섬 · ${lock.text}`;
    }
    return `${p.emoji} ${p.name}`;
  }
  // 2D·3D 두 마을이 같은 진입 로직을 쓴다. 지금 돌고 있는 쪽을 기억해 뒀다가
  // 그쪽을 멈추고 그쪽으로 돌아온다.
  let host = null;
  function useHost(h) { host = h; }
  function hstop() { (host || { stop }).stop(); }
  function hresume() { (host || { resume }).resume(); }

  function enter(p) {
    if (p.kind === 'tower') { bookSelect(p); return; }
    hstop();
    if (p.kind === 'king') { Game.startKing(p.level.id); hresume(); return; }
    const go = {
      dungeon: () => Dungeon.start(), arena: () => Game.startArena(),
      sky: () => Lobby.enterZone('sky'),
      shop: () => Lobby.shop(), book: () => Cards.book(),
      dress: () => Lobby.charCreator(false), skills: () => Lobby.skills(),
    }[p.act];
    if (go) go();
    if (UI.current() === 'town' || UI.current() === 'town3d') hresume();
  }

  // 탑 안: 권 고르기. 마을에 6채를 늘어놓는 대신 여기서 고른다.
  function bookSelect(p) {
    const rows = p.towers.map(t => {
      const lock = towerLock(t), prog = towerProg(t.id), total = floorList(t).length;
      const words = allWords(t), have = words.filter(w => Cards.has(t.id, wkey(w))).length;
      const pct = Math.round(prog.cleared / total * 100);
      const done = prog.cleared >= total;
      return `<button class="bk-row ${lock ? 'locked' : ''}" data-book="${t.id}">
        <span class="bk-no">${lock ? '🔒' : done ? '🏆' : (t.book || '')}</span>
        <span class="bk-body">
          <span class="bk-name">${esc(t.name.replace(/^\S+\s/, ''))}</span>
          <span class="bar exp"><span class="bar-fill" style="width:${pct}%"></span>
            <span class="bar-text">${prog.cleared} / ${total}층 · 🃏 ${have}/${words.length}</span></span>
          <span class="bk-meta">${lock ? `Lv.${lock.needLv}부터 · 눌러서 문 두드리기` : `난이도 ${tierFire(towerTier(t))} · 권장 Lv.${towerRange(t)[0]}~${towerRange(t)[1]}`}</span>
        </span>
        <span class="bk-go">${lock ? '🚪' : '▶'}</span>
      </button>`;
    }).join('');
    const m = UI.modal(`
      <div class="modal-title">${p.level.emoji} ${esc(p.level.name)}의 탑</div>
      <div class="modal-sub">${p.towers.length}권이 층층이 쌓여 있어요${levelCode(p.level) ? ` · ${levelCode(p.level)}` : ''}</div>
      <div class="bk-list">${rows}</div>
      <div class="actions"><button class="btn ghost" data-close="x">나가기</button></div>`);
    m.body.querySelectorAll('[data-book]').forEach(b => b.onclick = () => {
      const t = towerById(b.dataset.book), prog = towerProg(t.id), total = floorList(t).length;
      m.close(); hstop();
      Game.startFloor(t.id, prog.cleared >= total ? 1 : Math.min(prog.floor, total));
      if (UI.current() === 'town' || UI.current() === 'town3d') hresume();
    });
  }

  // ---------- 그리기 ----------
  function draw() {
    const w = vw(), h = vh();
    // 카메라가 캐릭터에 못 박혀 있으면 화면 전체가 캐릭터와 같이 덜컹인다.
    // 살짝 늦게 따라오게 하면 그것만으로 훨씬 부드러워진다.
    const tx = Math.max(0, Math.min(W - w, px - w / 2));
    const ty = Math.max(0, Math.min(H - h, py - h / 2));
    const k = Math.min(1, (last ? 1 / 60 : 1) * 7);     // 대략 0.15초 뒤따라온다
    cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * k;
    if (Math.abs(tx - cam.x) < .3) cam.x = tx;
    if (Math.abs(ty - cam.y) < .3) cam.y = ty;
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    ground();
    lamps.forEach(lampGlow);
    const t = performance.now() / 1000;
    const items = places.map(p => ({ y: p.y + p.h, p }))
      .concat(DECO.map(d => ({ y: d.y, d })))
      .concat(props.map(q => ({ y: q.y, q })))
      .concat(npcs.map(n => ({ y: n.y, n })))
      .concat(arches.map(a => ({ y: a.y, a })));
    items.sort((a, b) => a.y - b.y);
    let drewMe = false;
    items.forEach(it => {
      if (!drewMe && it.y > py) { me(); drewMe = true; }
      if (it.d) { drawDeco(it.d, t); return; }
      if (it.q) { drawProp(it.q, t); return; }
      if (it.n) { drawNpc(it.n); return; }
      if (it.a) { drawArch(it.a); return; }
      if (it.p === nearP) ring(it.p);
      draws[it.p.kind](it.p);
    });
    if (!drewMe) me();
    lamps.forEach(lampPost);
    npcs.forEach(bubble);
    places.forEach(p => tag(p, p.tagText, p.tagColor));      // 이름표는 항상 맨 위에
    ctx.restore();
    vignette(w, h);
    northHint(w);
  }
  function ground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.grass2); g.addColorStop(.5, C.grass); g.addColorStop(1, C.grass2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 풀결 — 그림자 한 줄과 빛 한 줄을 같이 그리면 결이 살아난다
    tufts.forEach(t => {
      ctx.fillStyle = 'rgba(50,110,45,.20)'; ctx.fillRect(t.x, t.y, t.s, t.s * 2);
      ctx.fillStyle = 'rgba(220,255,190,.22)'; ctx.fillRect(t.x - .8, t.y - .8, t.s * .8, t.s * 1.2);
    });
    // 북쪽으로 난 돌길
    const x0 = W / 2 - 78;
    ctx.fillStyle = C.roadEdge; ctx.fillRect(x0 - 4, 0, 164, H);
    ctx.fillStyle = C.road; ctx.fillRect(x0, 0, 156, H);
    ctx.fillStyle = 'rgba(0,0,0,.05)';
    for (let y = 0; y < H; y += 34) for (let i = 0; i < 3; i++) ctx.fillRect(x0 + 8 + i * 50, y + 5, 44, 24);
    // 길 가장자리에 빛과 그늘 — 길이 땅보다 살짝 파여 보인다
    const eg = ctx.createLinearGradient(x0 - 4, 0, x0 + 26, 0);
    eg.addColorStop(0, 'rgba(60,50,20,.16)'); eg.addColorStop(1, 'rgba(60,50,20,0)');
    ctx.fillStyle = eg; ctx.fillRect(x0 - 4, 0, 30, H);
    const eg2 = ctx.createLinearGradient(x0 + 126, 0, x0 + 156, 0);
    eg2.addColorStop(0, 'rgba(255,240,190,0)'); eg2.addColorStop(1, 'rgba(255,240,190,.24)');
    ctx.fillStyle = eg2; ctx.fillRect(x0 + 126, 0, 30, H);
    // 광장 바닥 — 여기는 마을의 한가운데다. 돌판을 제대로 깐다
    ctx.fillStyle = C.roadEdge; ctx.fillRect(0, H - 240, W, 108);
    ctx.fillStyle = C.road; ctx.fillRect(0, H - 236, W, 100);
    // 줄마다 반 칸씩 어긋나게 — 나란히 깔면 격자무늬가 돼서 바닥이 아니라 표로 보인다
    for (let r = 0, y = H - 234; y < H - 140; y += 24, r++) {
      for (let x = -20 + (r % 2) * 26; x < W; x += 52) {
        ctx.fillStyle = 'rgba(0,0,0,.055)'; ctx.fillRect(x + 1, y + 1, 48, 20);
        ctx.fillStyle = 'rgba(255,246,220,.30)'; ctx.fillRect(x, y, 48, 19);
      }
    }
    // 왕의 성으로 가는 샛길 — 큰길에서 갈라져 나온다
    places.filter(q => q._spur).forEach(q => {
      const sp = q._spur, w = sp.x1 - sp.x0;
      ctx.fillStyle = C.roadEdge; ctx.fillRect(sp.x0, sp.y - 36, w, 72);
      ctx.fillStyle = C.road; ctx.fillRect(sp.x0, sp.y - 32, w, 64);
      for (let r = 0, y = sp.y - 30; y < sp.y + 30; y += 22, r++)
        for (let x = sp.x0 + (r % 2) * 24; x < sp.x1; x += 48) {
          ctx.fillStyle = 'rgba(0,0,0,.055)'; ctx.fillRect(x + 1, y + 1, 44, 18);
          ctx.fillStyle = 'rgba(255,246,220,.28)'; ctx.fillRect(x, y, 44, 17);
        }
    });
    // 광장 테두리 돌
    ctx.fillStyle = 'rgba(120,100,60,.28)';
    ctx.fillRect(0, H - 240, W, 5); ctx.fillRect(0, H - 137, W, 5);
  }
  // ---------- 등급 입구 아치 ----------
  // 아직 못 여는 등급이면 회색에 자물쇠. 길에서 저게 보이면 "저기까진 아직" 이 읽힌다
  function archOpen(a) {
    const ts = levelTowers(a.level.id);
    return !ts.length || ts.some(t => !towerLock(t));
  }
  function drawArch(a) {
    const open = archOpen(a), stone = open ? '#8f86c9' : '#5c5590';
    const cap = open ? '#a9a1dd' : '#6d64ab', top = a.y - 124;
    [-72, 72].forEach(dx => {
      const x = a.x + dx;
      softShadow(x + 4, a.y + 3, 15, 6, .3);
      ctx.fillStyle = stone; ctx.fillRect(x - 11, top + 10, 22, a.y - top - 10);
      ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(x - 11, top + 10, 7, a.y - top - 10);
      ctx.fillStyle = cap; ctx.fillRect(x - 15, a.y - 8, 30, 10);         // 주춧돌
      ctx.fillStyle = cap; ctx.fillRect(x - 15, top, 30, 12);             // 기둥머리
    });
    // 상인방 — 두 기둥을 잇는 가로대
    ctx.fillStyle = cap; ctx.fillRect(a.x - 88, top - 15, 176, 17);
    ctx.fillStyle = stone; ctx.fillRect(a.x - 84, top - 1, 168, 5);
    // 가로대에서 늘어뜨린 천 — 긴 가로대가 휑하지 않게
    [-52, 52].forEach(dx => {
      ctx.fillStyle = open ? C.gold : '#6a628f';
      ctx.beginPath(); ctx.moveTo(a.x + dx - 9, top + 4); ctx.lineTo(a.x + dx + 9, top + 4);
      ctx.lineTo(a.x + dx + 9, top + 24); ctx.lineTo(a.x + dx, top + 18);
      ctx.lineTo(a.x + dx - 9, top + 24); ctx.closePath(); ctx.fill();
    });
    // 현판 — 가로대 아래 매달린다
    ctx.fillStyle = '#5c4f38'; ctx.fillRect(a.x - 2, top + 2, 4, 8);
    const text = a.level.emoji + ' ' + a.level.name + ' 등급';
    ctx.font = 'bold 14px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 26;
    ctx.fillStyle = open ? '#3b2f6a' : '#2b2450';
    ctx.beginPath(); ctx.roundRect(a.x - w / 2, top + 10, w, 24, 7); ctx.fill();
    ctx.strokeStyle = open ? C.gold : '#6a628f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(a.x - w / 2 + 2, top + 12, w - 4, 20, 5); ctx.stroke();
    ctx.fillStyle = open ? '#fff6e0' : '#9a92c0'; ctx.fillText(text, a.x, top + 23);
    if (!open) { ctx.font = '13px serif'; ctx.fillText('🔒', a.x + w / 2 + 10, top + 23); }
  }

  // ---------- 마을 사람 ----------
  function drawNpc(n) {
    if (!n.img) n.img = Avatar.image({ av: n.av, outfit: n.outfit, weapon: false, hat: 'none', aura: 'none', pet: null });
    const bob = Math.sin(performance.now() / 760 + n.x) * 1.4;
    softShadow(n.x, n.y + 3, 12, 5, .3);
    ctx.save(); ctx.translate(n.x, n.y + bob);
    ctx.scale(n.faceS < 0 ? Math.min(-.18, n.faceS) : Math.max(.18, n.faceS), 1);
    if (n.img.ready) ctx.drawImage(n.img.img, -16, -41, 32, 43);
    ctx.restore();
  }
  function bubble(n) {
    if (!n.near) return;
    const text = n.lines[n.said];
    ctx.font = 'bold 12px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 18, x = n.x, y = n.y - 56;
    ctx.fillStyle = 'rgba(255,250,238,.96)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 11, w, 22, 11); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 5, y + 9); ctx.lineTo(x + 2, y + 17); ctx.lineTo(x + 5, y + 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#4a3f6b'; ctx.fillText(text, x, y + 1);
  }

  // ---------- 광장 소품 ----------
  function drawProp(q, t) {
    if (q.kind === 'well') return drawWell(q, t);
    if (q.kind === 'stall') return drawStall(q);
    if (q.kind === 'banner') return drawBanner(q, t);
    if (q.kind === 'brazier') return drawBrazier(q, t);
  }
  // 배너 — 성으로 가는 길에 줄지어 선다. 천이 바람에 조금 흔들린다
  function drawBanner(q, t) {
    softShadow(q.x + 3, q.y + 3, 7, 3, .28);
    ctx.fillStyle = '#7a5636'; ctx.fillRect(q.x - 2, q.y - 48, 4, 48);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(q.x, q.y - 50, 3.5, 0, 6.3); ctx.fill();
    const sw = Math.sin(t * 1.7 + q.x) * 2;
    ctx.fillStyle = '#6d4fd0';
    ctx.beginPath(); ctx.moveTo(q.x + 2, q.y - 47); ctx.lineTo(q.x + 18 + sw, q.y - 44);
    ctx.lineTo(q.x + 18 + sw, q.y - 24); ctx.lineTo(q.x + 10 + sw, q.y - 27);
    ctx.lineTo(q.x + 2, q.y - 22); ctx.closePath(); ctx.fill();
    ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(q.color, q.x + 10 + sw * .6, q.y - 35);
  }
  // 화톳불 — 왕을 만날 수 있으면 타오르고, 아직이면 꺼져 있다
  function drawBrazier(q, t) {
    softShadow(q.x + 3, q.y + 3, 11, 5, .3);
    ctx.fillStyle = '#5c5590'; ctx.fillRect(q.x - 3, q.y - 22, 6, 22);
    ctx.fillStyle = '#6d64ab';
    ctx.beginPath(); ctx.moveTo(q.x - 12, q.y - 34); ctx.lineTo(q.x + 12, q.y - 34);
    ctx.lineTo(q.x + 8, q.y - 22); ctx.lineTo(q.x - 8, q.y - 22); ctx.closePath(); ctx.fill();
    if (!q.lit) { ctx.fillStyle = '#2b2450'; ctx.fillRect(q.x - 9, q.y - 35, 18, 4); return; }
    const f = Math.sin(t * 7 + q.x) * .5 + .5;
    ctx.fillStyle = 'rgba(255,180,60,.22)';
    ctx.beginPath(); ctx.arc(q.x, q.y - 36, 22 + f * 4, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#ff8a3d';
    ctx.beginPath(); ctx.moveTo(q.x - 9, q.y - 33); ctx.quadraticCurveTo(q.x, q.y - 56 - f * 7, q.x + 9, q.y - 33); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.moveTo(q.x - 5, q.y - 33); ctx.quadraticCurveTo(q.x + 1, q.y - 47 - f * 5, q.x + 5, q.y - 33); ctx.fill();
  }
  function drawWell(q, t) {
    softShadow(q.x + 5, q.y + 5, 27, 11, .3);
    // 돌 테두리 → 물 → 테두리 윗면. 물이 조금 흔들린다
    ctx.fillStyle = '#b0a184'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 25, 12, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#d6c8a6'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 3, 25, 12, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1d2a4d'; ctx.beginPath(); ctx.ellipse(q.x, q.y - 4, 18, 8, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#3f7fb8';
    ctx.beginPath(); ctx.ellipse(q.x, q.y - 2 + Math.sin(t * 1.6) * .8, 14, 6, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.30)';
    ctx.beginPath(); ctx.ellipse(q.x - 4, q.y - 4 + Math.sin(t * 1.6) * .8, 5, 2, 0, 0, 6.3); ctx.fill();
    // 기둥 둘 + 맞배 지붕 + 두레박
    ctx.fillStyle = '#7a5636';
    ctx.fillRect(q.x - 22, q.y - 44, 5, 42); ctx.fillRect(q.x + 17, q.y - 44, 5, 42);
    ctx.fillStyle = '#e8735e';
    ctx.beginPath(); ctx.moveTo(q.x - 30, q.y - 42); ctx.lineTo(q.x, q.y - 60);
    ctx.lineTo(q.x + 30, q.y - 42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath(); ctx.moveTo(q.x - 30, q.y - 42); ctx.lineTo(q.x, q.y - 60); ctx.lineTo(q.x, q.y - 42); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5c4f38'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(q.x, q.y - 44); ctx.lineTo(q.x, q.y - 26); ctx.stroke();
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(q.x - 6, q.y - 26, 12, 9);
  }
  function drawStall(q) {
    const w = q.w;
    softShadow(q.x + 6, q.y + 6, w * .55, 11, .3);
    // 좌판 → 줄무늬 차양 → 기둥. 노점은 차양 줄무늬로 알아본다
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(q.x - w / 2, q.y - 22, w, 20);
    ctx.fillStyle = '#a4814f'; ctx.fillRect(q.x - w / 2, q.y - 26, w, 6);
    ctx.fillStyle = '#7a5636';
    ctx.fillRect(q.x - w / 2 + 2, q.y - 56, 4, 32); ctx.fillRect(q.x + w / 2 - 6, q.y - 56, 4, 32);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#fff4dc' : '#e8735e';
      ctx.fillRect(q.x - w / 2 - 4 + i * ((w + 8) / 6), q.y - 62, (w + 8) / 6 + 1, 12);
    }
    // 좌판에 올린 것들 — 사과 바구니와 항아리
    ctx.fillStyle = '#c98b4b'; ctx.fillRect(q.x - w / 2 + 8, q.y - 34, 18, 9);
    ctx.fillStyle = '#e05b4a';
    [0, 7, 14].forEach(dx => { ctx.beginPath(); ctx.arc(q.x - w / 2 + 12 + dx, q.y - 36, 4, 0, 6.3); ctx.fill(); });
    ctx.fillStyle = '#6d8fb0'; ctx.beginPath(); ctx.ellipse(q.x + w / 2 - 16, q.y - 33, 8, 10, 0, 0, 6.3); ctx.fill();
  }
  function lampGlow() {}
  function lampPost(l) {
    ctx.fillStyle = 'rgba(60,80,40,.2)'; ctx.beginPath(); ctx.ellipse(l.x, l.y + 1, 7, 3, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#7a6a4a'; ctx.fillRect(l.x - 2.5, l.y - 34, 5, 34);
    ctx.fillStyle = '#5c4f38'; ctx.fillRect(l.x - 7, l.y - 42, 14, 9);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(l.x, l.y - 37, 4, 0, 6.3); ctx.fill();
  }
  function shadow(p, rx) {
    softShadow(p.cx + SH.x, p.y + p.h - 2 + SH.y * .5, (rx || p.w * .5) * 1.15, 10, .3);
  }
  function ring(p) {
    ctx.strokeStyle = 'rgba(255,200,61,.8)'; ctx.lineWidth = 3;
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -(performance.now() / 40) % 12;
    ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 2, p.w * .58, 13, 0, 0, 6.3); ctx.stroke();
    ctx.setLineDash([]);
  }
  function want(p, text, color) { p.tagText = text; p.tagColor = color; }
  function tag(p, text, color, dy) {
    if (!text) return;
    ctx.font = 'bold 13px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 16, y = p.y + p.h + (dy || 16);
    ctx.fillStyle = 'rgba(10,8,28,.72)';
    ctx.beginPath(); ctx.roundRect(p.cx - w / 2, y - 10, w, 20, 10); ctx.fill();
    ctx.fillStyle = color || '#fff6e0'; ctx.fillText(text, p.cx, y + 1);
  }

  const draws = {
    // 등급의 탑 — 권이 층층이 쌓인 하나의 큰 탑
    tower(p) {
      const ts = p.towers, n = ts.length;
      const segH = (p.h - 34) / n;
      shadow(p, p.w * .46);
      for (let i = 0; i < n; i++) {
        const t = ts[n - 1 - i];                        // 위가 마지막 권
        const y = p.y + 22 + i * segH;
        const inset = (n - 1 - i) * 1.6;
        const x = p.x + inset, w = p.w - inset * 2;
        const lock = towerLock(t), prog = towerProg(t.id), total = floorList(t).length;
        const done = prog.cleared >= total;
        wall(x, y, w, segH + 1, lock ? C.stoneDark : C.stone);
        ctx.fillStyle = 'rgba(0,0,0,.26)'; ctx.fillRect(x, y + segH - 3, w, 3);
        if (i === 0) eaves(x, y, w, 9);                 // 맨 위 층은 지붕 그늘을 받는다
        const lit = lock ? 0 : (done ? 3 : Math.round(prog.cleared / total * 3));
        for (let k = 0; k < 3; k++) {
          const wx = x + 13 + k * ((w - 32) / 2);
          if (k < lit) {
            ctx.globalAlpha = .3; ctx.fillStyle = C.gold; ctx.fillRect(wx - 4, y + segH * .3 - 4, 15, 17); ctx.globalAlpha = 1;
            ctx.fillStyle = C.gold;
          } else ctx.fillStyle = 'rgba(0,0,0,.38)';
          ctx.fillRect(wx, y + segH * .3, 7, 9);
        }
      }
      const rx = p.x + 6, rw = p.w - 12;
      ctx.fillStyle = C.roof;                            // 빛 받는 왼쪽 면
      ctx.beginPath(); ctx.moveTo(rx - 9, p.y + 24); ctx.lineTo(p.cx, p.y - 8); ctx.lineTo(rx + rw + 9, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.roofDark;                        // 그늘진 오른쪽 면
      ctx.beginPath(); ctx.moveTo(p.cx, p.y - 8); ctx.lineTo(rx + rw + 9, p.y + 24); ctx.lineTo(p.cx, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.5)';            // 마루에 앉는 빛
      ctx.beginPath(); ctx.moveTo(p.cx - 2, p.y - 8); ctx.lineTo(p.cx + 2, p.y - 8);
      ctx.lineTo(rx - 2, p.y + 24); ctx.lineTo(rx - 7, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b5433'; ctx.fillRect(p.cx - 1.5, p.y - 36, 3, 30);
      ctx.font = '15px serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(p.level.emoji, p.cx + 3, p.y - 29);
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.roundRect(p.cx - 13, p.y + p.h - 30, 26, 30, [13, 13, 0, 0]); ctx.fill();
      ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(p.cx + 7, p.y + p.h - 14, 2, 0, 6.3); ctx.fill();
      const open = ts.filter(t => !towerLock(t)).length;
      want(p, `${p.level.name}의 탑 · ${open}/${n}권`, open ? '#fff6e0' : '#9a94c0');
    },
    king(p) {
      const k = Game.kingInfo(p.level.id), beaten = k && k.beaten, ready = k && k.ok;
      shadow(p);
      const base = beaten ? '#1c6f62' : ready ? '#5d5698' : '#332e5c';
      wall(p.x + 14, p.y + 26, p.w - 28, p.h - 26, base);
      [p.x, p.x + p.w - 26].forEach(bx => {
        wall(bx, p.y + 8, 26, p.h - 8, base);
        ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(bx, p.y + 8, 26, 5);
        for (let i = 0; i < 3; i++) { ctx.fillStyle = base; ctx.fillRect(bx + i * 9, p.y, 7, 10); }
      });
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.roundRect(p.cx - 12, p.y + p.h - 28, 24, 28, [12, 12, 0, 0]); ctx.fill();
      ctx.fillStyle = ready ? C.gold : 'rgba(255,200,61,.3)';
      ctx.fillRect(p.x + 24, p.y + 46, 8, 11); ctx.fillRect(p.x + p.w - 32, p.y + 46, 8, 11);
      ctx.font = '19px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(beaten ? '👑' : p.level.emoji, p.cx, p.y + 18);
      want(p, `${p.level.name} 왕${beaten ? ' ✓' : ''}`, ready ? C.gold : beaten ? '#3ee0c4' : '#c9c2e6');
    },
    hut(p) {
      shadow(p, p.w * .44);
      wall(p.x + 4, p.y + 22, p.w - 8, p.h - 22, C.wall);
      eaves(p.x + 4, p.y + 22, p.w - 8, 10);
      ctx.fillStyle = C.roof;
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y + 24); ctx.lineTo(p.cx, p.y - 2); ctx.lineTo(p.x + p.w + 5, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.roofDark;
      ctx.beginPath(); ctx.moveTo(p.cx, p.y - 2); ctx.lineTo(p.x + p.w + 5, p.y + 24); ctx.lineTo(p.cx, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,200,.5)';
      ctx.beginPath(); ctx.moveTo(p.cx - 2, p.y - 2); ctx.lineTo(p.cx + 2, p.y - 2);
      ctx.lineTo(p.x + 1, p.y + 24); ctx.lineTo(p.x - 4, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.roundRect(p.cx - 11, p.y + p.h - 26, 22, 26, [11, 11, 0, 0]); ctx.fill();
      ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.cx, p.y + 41);
      want(p, p.name);
    },
    // 하늘섬 — 땅에 없다. **저 위에 떠 있다.**
    // 여기 있는 건 이륙 자리뿐이고, 날개가 있어야 저기까지 간다.
    gate(p) {
      const lock = zoneLock(ZONES.find(x => x.id === 'sky'));
      const open = !lock;
      const t = performance.now() / 1000;
      const bob = Math.sin(t * .8) * 6;
      const iy = p.y + 20 + bob;                      // 섬이 떠 있는 높이 — 이륙 자리에서 한참 위

      // 이륙 자리 — 바람이 도는 돌판
      ctx.fillStyle = 'rgba(60,80,40,.2)';
      ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 4, 38, 12, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = open ? '#d9cff5' : '#9d97bd';
      ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 7, 36, 11, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = open ? '#f2ecff' : '#b3aecd';
      ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 9, 26, 8, 0, 0, 6.3); ctx.fill();
      // 도는 바람
      ctx.strokeStyle = open ? 'rgba(190,230,255,.85)' : 'rgba(190,200,230,.35)';
      ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = t * (open ? 1.8 : .5) + i * 2.1;
        ctx.beginPath();
        ctx.ellipse(p.cx, p.y + p.h - 9, 20 + i * 6, 6 + i * 2, 0, a, a + 1.7);
        ctx.stroke();
      }
      // 열려 있으면 빛기둥이 섬까지 이어진다 — 갈 수 있다는 표시
      if (open) {
        const g = ctx.createLinearGradient(0, iy + 30, 0, p.y + p.h - 8);
        g.addColorStop(0, 'rgba(190,230,255,.32)'); g.addColorStop(1, 'rgba(190,230,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(p.cx - 16, iy + 30); ctx.lineTo(p.cx + 16, iy + 30);
        ctx.lineTo(p.cx + 30, p.y + p.h - 8); ctx.lineTo(p.cx - 30, p.y + p.h - 8);
        ctx.closePath(); ctx.fill();
      }

      // 떠 있는 섬
      ctx.globalAlpha = open ? 1 : .55;
      ctx.fillStyle = '#8a6a44';
      ctx.beginPath(); ctx.moveTo(p.cx - 42, iy); ctx.lineTo(p.cx + 42, iy); ctx.lineTo(p.cx + 7, iy + 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6d5030';
      ctx.beginPath(); ctx.moveTo(p.cx - 24, iy + 5); ctx.lineTo(p.cx + 32, iy + 5); ctx.lineTo(p.cx + 6, iy + 35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7ab85f';
      ctx.beginPath(); ctx.ellipse(p.cx, iy, 44, 11, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#a9d47f';
      ctx.beginPath(); ctx.ellipse(p.cx, iy - 4, 44, 10, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#7a5636'; ctx.fillRect(p.cx - 12, iy - 21, 3.5, 19);
      ctx.fillStyle = '#5faa4e';
      ctx.beginPath(); ctx.arc(p.cx - 10, iy - 25, 10, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#7cc55f';
      ctx.beginPath(); ctx.arc(p.cx - 15, iy - 30, 6, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#5faa4e';
      ctx.beginPath(); ctx.arc(p.cx + 20, iy - 8, 6, 0, 6.3); ctx.fill();
      // 섬을 두른 구름 + 사이를 흘러가는 구름 (사이가 비면 높이가 안 느껴진다)
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath(); ctx.ellipse(p.cx - 42, iy + 16, 18, 6, 0, 0, 6.3); ctx.fill();
      ctx.beginPath(); ctx.ellipse(p.cx + 40, iy + 24, 15, 5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      for (let i = 0; i < 3; i++) {
        const cx = p.cx - 46 + ((t * 12 + i * 46) % 96);
        ctx.beginPath(); ctx.ellipse(cx, iy + 54 + i * 22, 13 - i * 2, 4, 0, 0, 6.3); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // 잠겼으면 날개가 없다는 표시
      if (!open) {
        ctx.font = '16px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.globalAlpha = .5 + Math.sin(t * 2) * .2;
        ctx.fillText('🦋', p.cx, p.y + p.h - 26);
        ctx.globalAlpha = 1;
      }
      want(p, open ? '하늘섬 · 날아오르기' : '하늘섬 · 날개가 없다', open ? '#bfe6ff' : '#c3bce6');
    },
    hole(p) {
      ctx.fillStyle = '#0a0718';
      ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 10, p.w / 2, 22, 0, 0, 6.3); ctx.fill();
      ctx.strokeStyle = '#3b3468'; ctx.lineWidth = 5; ctx.stroke();
      const g = ctx.createRadialGradient(p.cx, p.y + p.h - 10, 2, p.cx, p.y + p.h - 10, 34);
      g.addColorStop(0, 'rgba(255,59,82,.30)'); g.addColorStop(1, 'rgba(255,59,82,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.cx, p.y + p.h - 10, 34, 0, 6.3); ctx.fill();
      want(p, '지하 던전', '#e6b9c0');
    },
  };
  function me() {
    const bob = moving ? Math.abs(Math.sin(walkT)) * -2.5 : Math.sin(performance.now() / 700) * 1.2;
    // 발먼지는 캐릭터 뒤에
    dust.forEach(d => {
      ctx.globalAlpha = Math.max(0, d.life * 1.7);
      ctx.fillStyle = '#cbbf9a';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (state.player.pet && typeof PETS !== 'undefined' && PETS[state.player.pet]) {
      ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(PETS[state.player.pet].emoji, px - dirS * 21, py - 3 + Math.sin(walkT - 1) * 3);
    }
    softShadow(px, py + 3, 13, 5.5, .34);
    // 오라는 캔버스에서 직접 그린다 — 래스터 이미지 안의 CSS 애니메이션은 안 돈다
    const at = performance.now() / 1000, au = state.player.aura;
    Aura.paint(ctx, px, py + bob, au, at, 'back');
    ctx.save(); ctx.translate(px, py + bob);
    // 방향은 즉시 뒤집지 않고 돌아간다. 0을 지날 때 사라지지 않게 최소 폭을 남긴다.
    ctx.scale(dirS < 0 ? Math.min(-.18, dirS) : Math.max(.18, dirS), 1);
    const fi = moving ? ((Math.floor(walkT / (Math.PI / 2)) % 4) + 4) % 4 : 0;
    const fr = frames && frames[fi];
    const img = fr && fr.ready ? fr : pimg;
    if (img && img.ready) ctx.drawImage(img.img, -17, -44, 34, 46);
    else { ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.fillText(UI.charEmoji(), 0, 0); }
    ctx.restore();
    Aura.paint(ctx, px, py + bob, au, at, 'front');
  }
  // 화면 전체에 빛을 한 겹 입힌다. 왼쪽 위는 따뜻하게, 오른쪽 아래는 서늘하게 —
  // 같은 색이라도 한 방향에서 빛이 온다고 느껴지면 평평해 보이지 않는다.
  function vignette(w, h) {
    const lg = ctx.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, 'rgba(255,240,190,.20)');
    lg.addColorStop(.45, 'rgba(255,240,190,0)');
    lg.addColorStop(1, 'rgba(60,80,140,.14)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, h * .34, w / 2, h / 2, w * .8);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(30,50,25,.22)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  function northHint(w) {
    const up = places.filter(p => p.kind === 'tower' && p.y + p.h < cam.y + 6);
    if (!up.length) return;
    const t = up[up.length - 1];
    ctx.globalAlpha = .55 + Math.sin(performance.now() / 400) * .25;
    ctx.fillStyle = C.gold; ctx.font = 'bold 13px "Jua", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`▲ ${t.level.name}의 탑`, w / 2, 20);
    ctx.globalAlpha = 1;
  }

  window.addEventListener('resize', () => { if (UI.current() === 'town') resize(); });
  window.addEventListener('keydown', e => { if (UI.current() === 'town') key(e, true); });
  window.addEventListener('keyup', e => { if (UI.current() === 'town') key(e, false); });

  // 테스트에서 먼 곳을 확인할 때 좌표를 넣는다 (마을이 세로로 길어 걸어가면 오래 걸린다)
  function debug(nx, ny) {
    if (nx !== undefined) { px = nx; py = ny; }
    return { px, py, W, H, near: nearP && placeLabel(nearP), places: places && places.length };
  }
  // 3D 마을이 같은 지도와 같은 진입 로직을 쓰도록 빌려준다
  function layout() {
    build();
    // 3D 용 충돌: 건물 발자국 + 마을 바깥 벽 네 개
    const solids3 = places.map(p => p.foot)
      .concat(props.map(q => { const r = q.r || q.w / 2; return { x: q.x - r + 4, y: q.y - 12, w: r * 2 - 8, h: 22 }; }))
      .concat([].concat.apply([], arches.map(a => [-72, 72].map(dx => ({ x: a.x + dx - 11, y: a.y - 10, w: 22, h: 18 }))))) 
      .concat(solids.slice(-4));
    return { places, solids, solids3, deco: DECO, lamps, props, npcs, arches, W, H, start: { x: px, y: py } };
  }
  return { start, resume, stop, debug, layout, enter, placeLabel, useHost };
})();
