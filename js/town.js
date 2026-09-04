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
      ctx.fillStyle = 'rgba(60,80,40,.22)'; ctx.beginPath(); ctx.ellipse(0, 2, 13, 5, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = C.trunk; ctx.fillRect(-3, -16, 6, 17);
      ctx.translate(sway, 0);
      ctx.fillStyle = C.leaf;
      [[0, -34, 15], [-11, -25, 11], [11, -25, 11]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = C.leaf2;
      [[-4, -38, 9], [7, -32, 7]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); });
    } else if (d.kind === 'bush') {
      ctx.fillStyle = 'rgba(60,80,40,.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 12, 4, 0, 0, 6.3); ctx.fill();
      ctx.translate(sway * .5, 0);
      ctx.fillStyle = C.leaf;
      [[-7, -6, 8], [7, -6, 8], [0, -11, 10]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); });
      ctx.fillStyle = C.leaf2; ctx.beginPath(); ctx.arc(-3, -13, 6, 0, 6.3); ctx.fill();
    } else if (d.kind === 'flower') {
      ctx.strokeStyle = '#5faa4e'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sway * .6, -9); ctx.stroke();
      const cols = ['#ff8fa8', '#ffe066', '#c9a3ff', '#fff'];
      ctx.fillStyle = cols[(d.f * 3 | 0) % cols.length];
      for (let i = 0; i < 5; i++) { const a = i * 1.256; ctx.beginPath(); ctx.arc(sway * .6 + Math.cos(a) * 3, -9 + Math.sin(a) * 3, 2.4, 0, 6.3); ctx.fill(); }
      ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(sway * .6, -9, 1.8, 0, 6.3); ctx.fill();
    } else if (d.kind === 'rock') {
      ctx.fillStyle = 'rgba(60,80,40,.18)'; ctx.beginPath(); ctx.ellipse(0, 1, 9, 3, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#b6b0c9'; ctx.beginPath(); ctx.ellipse(0, -4, 9, 6, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = '#d3cee0'; ctx.beginPath(); ctx.ellipse(-2, -6, 5, 3, 0, 0, 6.3); ctx.fill();
    } else {
      ctx.fillStyle = C.wood;
      ctx.fillRect(-14, -14, 3.5, 15); ctx.fillRect(0, -16, 3.5, 17); ctx.fillRect(14, -14, 3.5, 15);
      ctx.fillRect(-15, -11, 32, 3); ctx.fillRect(-15, -5, 32, 3);
    }
    ctx.restore();
  }
  let cv, ctx, raf, last, active, places, solids, W, H, px, py, dir, walkT, cam, pimg, frames, moving, joy, keys, nearP, hint, lamps, tufts;

  const el = id => document.getElementById(id);
  const vw = () => cv.width / (window.devicePixelRatio || 1);
  const vh = () => cv.height / (window.devicePixelRatio || 1);

  // ---------- 세계 만들기 ----------
  function build() {
    places = []; solids = []; lamps = []; tufts = [];
    const zones = LEVELS.filter(L => levelTowers(L.id).length);
    const ZH = 224, SKYY = 130;          // 북쪽 끝에 하늘섬 관문이 설 자리
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
    // 북쪽 길 끝 — 마을에서 제일 먼 곳이 제일 나중에 열리는 곳이다
    addPlace({ kind: 'gate', act: 'sky', x: W / 2 - 54, y: 40, w: 108, h: 78 });

    // 등급 구역: 큰 탑 하나 + 왕의 성
    zones.forEach((L, i) => {
      const zy = H - 262 - (i + 1) * ZH;
      addPlace({ kind: 'tower', level: L, towers: levelTowers(L.id), x: W / 2 - 48, y: zy, w: 96, h: 158 });
      if (L.animal) addPlace({ kind: 'king', level: L, x: W - 132, y: zy + 40, w: 104, h: 88 });
      lamps.push({ x: W / 2 - 96, y: zy + 150 }, { x: W / 2 + 96, y: zy + 150 });
    });
    lamps.push({ x: W / 2 - 108, y: H - 44 }, { x: W / 2 + 108, y: H - 44 });
    for (let i = 0; i < 130; i++) tufts.push({ x: 10 + Math.random() * (W - 20), y: 20 + Math.random() * (H - 40), s: 2 + Math.random() * 3 });
    // 빈 땅이 넓으면 휑하다 — 건물과 길을 피해 나무·꽃·울타리를 촘촘히 뿌린다
    scatter(W, H, (x, y) => places.some(p => x > p.x - 22 && x < p.x + p.w + 22 && y > p.y - 20 && y < p.y + p.h + 26));

    solids.push({ x: -40, y: -40, w: W + 80, h: 40 }, { x: -40, y: H, w: W + 80, h: 40 },
      { x: -40, y: -40, w: 40, h: H + 80 }, { x: W, y: -40, w: 40, h: H + 80 });
    px = W / 2; py = H - 34; dir = 0; walkT = 0; cam = { x: 0, y: 0 };
  }
  function addPlace(p) {
    p.cx = p.x + p.w / 2; p.cy = p.y + p.h / 2;
    places.push(p);
    solids.push({ x: p.x + 5, y: p.y, w: p.w - 10, h: p.h - 16 });
  }

  // ---------- 시작 ----------
  function start() {
    Game.home = 'town';
    if (!el('screen-town')) return;
    build();
    frames = Avatar.walkFrames(); pimg = frames[0];
    joy = null; keys = {}; nearP = null; hint = '';
    shell(); UI.show('town'); run();
  }
  function resume() {
    if (!places) { start(); return; }
    Game.home = 'town';
    shell(); UI.show('town'); run();
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
    const w = cv.parentElement.clientWidth || 320, dpr = window.devicePixelRatio || 1;
    const h = Math.max(300, Math.min(500, Math.round(window.innerHeight * 0.62)));
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    if (moving) { walkT += dt * 9; if (Math.abs(vx) > .2) dir = vx > 0 ? 1 : -1; }
    step(vx * SPEED * dt, vy * SPEED * dt);

    let best = null, bd = 1e9;
    places.forEach(p => {
      const dx = Math.abs(px - p.cx), dy = py - (p.y + p.h);
      if (dx > p.w / 2 + 30 || dy < -22 || dy > 64) return;      // 문 앞 상자
      const d = dx + Math.abs(dy);
      if (d < bd) { bd = d; best = p; }
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
      const z = ZONES.find(x => x.id === 'sky');
      if (state.player.lv < z.lv) return `🔒 하늘섬 · Lv.${z.lv}부터`;
      if (Cards.count() < z.cards) return `🔒 하늘섬 · 🃏 ${Cards.count()}/${z.cards}`;
      return '⛰️ 하늘섬 · 오르기';
    }
    return `${p.emoji} ${p.name}`;
  }
  function enter(p) {
    if (p.kind === 'tower') { bookSelect(p); return; }
    stop();
    if (p.kind === 'king') { Game.startKing(p.level.id); resume(); return; }
    const go = {
      dungeon: () => Dungeon.start(), arena: () => Game.startArena(),
      sky: () => Lobby.enterZone('sky'),
      shop: () => Lobby.shop(), book: () => Cards.book(),
      dress: () => Lobby.charCreator(false), skills: () => Lobby.skills(),
    }[p.act];
    if (go) go();
    if (UI.current() === 'town') resume();
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
      m.close(); stop();
      Game.startFloor(t.id, prog.cleared >= total ? 1 : Math.min(prog.floor, total));
      if (UI.current() === 'town') resume();
    });
  }

  // ---------- 그리기 ----------
  function draw() {
    const w = vw(), h = vh();
    cam.x = Math.max(0, Math.min(W - w, px - w / 2));
    cam.y = Math.max(0, Math.min(H - h, py - h / 2));
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    ground();
    lamps.forEach(lampGlow);
    const t = performance.now() / 1000;
    const items = places.map(p => ({ y: p.y + p.h, p })).concat(DECO.map(d => ({ y: d.y, d })));
    items.sort((a, b) => a.y - b.y);
    let drewMe = false;
    items.forEach(it => {
      if (!drewMe && it.y > py) { me(); drewMe = true; }
      if (it.d) { drawDeco(it.d, t); return; }
      if (it.p === nearP) ring(it.p);
      draws[it.p.kind](it.p);
    });
    if (!drewMe) me();
    lamps.forEach(lampPost);
    places.forEach(p => tag(p, p.tagText, p.tagColor));      // 이름표는 항상 맨 위에
    ctx.restore();
    vignette(w, h);
    northHint(w);
  }
  function ground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.grass2); g.addColorStop(.5, C.grass); g.addColorStop(1, C.grass2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 풀결
    ctx.fillStyle = 'rgba(60,120,50,.18)';
    tufts.forEach(t => ctx.fillRect(t.x, t.y, t.s, t.s * 2));
    // 북쪽으로 난 돌길
    const x0 = W / 2 - 78;
    ctx.fillStyle = C.roadEdge; ctx.fillRect(x0 - 4, 0, 164, H);
    ctx.fillStyle = C.road; ctx.fillRect(x0, 0, 156, H);
    ctx.fillStyle = 'rgba(0,0,0,.05)';
    for (let y = 0; y < H; y += 34) for (let i = 0; i < 3; i++) ctx.fillRect(x0 + 8 + i * 50, y + 5, 44, 24);
    // 광장 바닥
    ctx.fillStyle = C.roadEdge; ctx.fillRect(0, H - 240, W, 108);
    ctx.fillStyle = C.road; ctx.fillRect(0, H - 236, W, 100);
    ctx.fillStyle = 'rgba(0,0,0,.05)';
    for (let y = H - 232; y < H - 140; y += 30) for (let x = 6; x < W; x += 44) ctx.fillRect(x, y, 38, 22);
  }
  function lampGlow() {}
  function lampPost(l) {
    ctx.fillStyle = 'rgba(60,80,40,.2)'; ctx.beginPath(); ctx.ellipse(l.x, l.y + 1, 7, 3, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#7a6a4a'; ctx.fillRect(l.x - 2.5, l.y - 34, 5, 34);
    ctx.fillStyle = '#5c4f38'; ctx.fillRect(l.x - 7, l.y - 42, 14, 9);
    ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(l.x, l.y - 37, 4, 0, 6.3); ctx.fill();
  }
  function shadow(p, rx) {
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 2, rx || p.w * .5, 8, 0, 0, 6.3); ctx.fill();
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
        ctx.fillStyle = lock ? C.stoneDark : C.stone;
        ctx.fillRect(x, y, w, segH + 1);
        ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(x, y, w * .42, segH + 1);
        ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.fillRect(x, y + segH - 3, w, 3);
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
      ctx.fillStyle = C.roof;
      ctx.beginPath(); ctx.moveTo(rx - 9, p.y + 24); ctx.lineTo(p.cx, p.y - 8); ctx.lineTo(rx + rw + 9, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.roofDark;
      ctx.beginPath(); ctx.moveTo(p.cx, p.y - 8); ctx.lineTo(rx + rw + 9, p.y + 24); ctx.lineTo(p.cx, p.y + 24); ctx.closePath(); ctx.fill();
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
      ctx.fillStyle = base; ctx.fillRect(p.x + 14, p.y + 26, p.w - 28, p.h - 26);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(p.x + 14, p.y + 26, (p.w - 28) * .4, p.h - 26);
      [p.x, p.x + p.w - 26].forEach(bx => {
        ctx.fillStyle = base; ctx.fillRect(bx, p.y + 8, 26, p.h - 8);
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
      ctx.fillStyle = C.wall; ctx.fillRect(p.x + 4, p.y + 22, p.w - 8, p.h - 22);
      ctx.fillStyle = C.wallDark; ctx.fillRect(p.x + 4 + (p.w - 8) * .62, p.y + 22, (p.w - 8) * .38, p.h - 22);
      ctx.fillStyle = C.roof;
      ctx.beginPath(); ctx.moveTo(p.x - 5, p.y + 24); ctx.lineTo(p.cx, p.y - 2); ctx.lineTo(p.x + p.w + 5, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.roofDark;
      ctx.beginPath(); ctx.moveTo(p.cx, p.y - 2); ctx.lineTo(p.x + p.w + 5, p.y + 24); ctx.lineTo(p.cx, p.y + 24); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.roundRect(p.cx - 11, p.y + p.h - 26, 22, 26, [11, 11, 0, 0]); ctx.fill();
      ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, p.cx, p.y + 41);
      want(p, p.name);
    },
    // 하늘섬 관문 — 구름 계단이 하늘로 뻗어 있다
    gate(p) {
      const z = ZONES.find(x => x.id === 'sky');
      const open = state.player.lv >= z.lv && Cards.count() >= z.cards;
      shadow(p, p.w * .4);
      ctx.fillStyle = '#8f86c9';
      ctx.beginPath(); ctx.moveTo(p.x + 8, p.y + p.h); ctx.lineTo(p.x + 20, p.y + 26); ctx.lineTo(p.x + 30, p.y + 26); ctx.lineTo(p.x + 26, p.y + p.h); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(p.x + p.w - 8, p.y + p.h); ctx.lineTo(p.x + p.w - 20, p.y + 26); ctx.lineTo(p.x + p.w - 30, p.y + 26); ctx.lineTo(p.x + p.w - 26, p.y + p.h); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a9a1de'; ctx.fillRect(p.x + 14, p.y + 18, p.w - 28, 10);
      // 구름 계단
      const t = performance.now() / 1000;
      for (let i = 0; i < 4; i++) {
        const yy = p.y + 6 - i * 15 + Math.sin(t * 1.2 + i) * 2;
        const xx = p.cx + (i % 2 ? 17 : -17);
        ctx.fillStyle = open ? 'rgba(255,255,255,.92)' : 'rgba(255,255,255,.42)';
        ctx.beginPath(); ctx.ellipse(xx, yy, 20 - i * 2, 7, 0, 0, 6.3); ctx.fill();
      }
      ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(open ? '⛰️' : '🔒', p.cx, p.y + 46);
      want(p, open ? '하늘섬' : '하늘섬 · 잠김', open ? '#bfe6ff' : '#9a94c0');
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
    const bob = Math.sin(walkT) * 3;
    if (state.player.pet && typeof PETS !== 'undefined' && PETS[state.player.pet]) {
      ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(PETS[state.player.pet].emoji, px - dir * 21, py - 3 + Math.sin(walkT - 1) * 3);
    }
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(px, py + 3, 12, 5, 0, 0, 6.3); ctx.fill();
    // 오라는 캔버스에서 직접 그린다 — 래스터 이미지 안의 CSS 애니메이션은 안 돈다
    const at = performance.now() / 1000, au = state.player.aura;
    Aura.paint(ctx, px, py + bob, au, at, 'back');
    ctx.save(); ctx.translate(px, py + bob);
    if (dir < 0) ctx.scale(-1, 1);
    const fr = frames && frames[moving && Math.sin(walkT) > 0 ? 1 : 0];
    const img = fr && fr.ready ? fr : pimg;
    if (img && img.ready) ctx.drawImage(img.img, -17, -44, 34, 46);
    else { ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.fillText(UI.charEmoji(), 0, 0); }
    ctx.restore();
    Aura.paint(ctx, px, py + bob, au, at, 'front');
  }
  function vignette(w, h) {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * .34, w / 2, h / 2, w * .78);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,60,30,.18)');
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
  return { start, resume, stop, debug };
})();
