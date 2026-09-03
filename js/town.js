'use strict';
// 🏘️ 마을 — 걸어다니는 로비
//
// 로비가 "활동 목록"이라 갈 곳을 누르는 것이지 가는 게 아니었다. 여기서는 걸어서
// 문 앞에 선다. 미니게임은 그대로 두고 입구만 세계로 바꾼 것이다.
//
// 마을을 크게 만들면 안 된다. 걸어다니는 건 학습이 아니다 — 오픈월드를 주면
// 아이가 10분 돌아다니고 2분 공부한다. 끝에서 끝까지 몇 초면 되는 크기가 맞다.
//
// 길은 북쪽으로 난다. 아래가 시작(광장), 위로 갈수록 높은 등급 —
// 세계의 생김새가 곧 진도다.
const Town = (() => {
  const TILE = 28, WW = 640;          // 월드 폭
  const SPEED = 132;                  // px/초
  let cv, ctx, raf, last, active, places, solids, W, H, px, py, dir, walkT, cam, pimg, joy, keys, nearP, coolP, hint;

  const el = id => document.getElementById(id);
  const vw = () => cv.width / (window.devicePixelRatio || 1);
  const vh = () => cv.height / (window.devicePixelRatio || 1);

  // ---------- 세계 만들기 ----------
  // 등급이 늘어도 자동으로 구역이 붙도록, TOWERS/LEVELS 에서 만든다.
  function build() {
    places = []; solids = [];
    const zones = LEVELS.filter(L => levelTowers(L.id).length);
    const ZH = 118;                                   // 구역 하나의 높이 (넓히면 걷기만 길어진다)
    H = 250 + zones.length * ZH + 40;                 // 광장 + 구역들 (아래는 빈 마당)
    W = WW;

    // 광장 (맨 아래)
    const plazaY = H - 250;
    const fac = [
      { id: 'shop',    emoji: '🛒', name: '상점',   x: 36 },
      { id: 'book',    emoji: '📖', name: '도감',   x: 148 },
      { id: 'dress',   emoji: '👕', name: '옷가게', x: 400 },
      { id: 'skills',  emoji: '📜', name: '스킬',   x: 512 },
    ];
    fac.forEach(f => addPlace({ kind: 'house', act: f.id, emoji: f.emoji, name: f.name, x: f.x, y: plazaY + 86, w: 76, h: 62 }));
    addPlace({ kind: 'house', act: 'arena', emoji: '🏟️', name: '투기장', x: 96, y: plazaY, w: 84, h: 62 });
    addPlace({ kind: 'hole',  act: 'dungeon', emoji: '🕳️', name: '지하 던전', x: 448, y: plazaY + 12, w: 76, h: 52 });

    // 등급 구역: 아래에서 위로
    zones.forEach((L, i) => {
      const zy = H - 270 - (i + 1) * ZH;
      const ts = levelTowers(L.id);
      addPlace({ kind: 'sign', level: L, x: 22, y: zy + 62, w: 40, h: 40 });
      const gapX = Math.min(104, (WW - 120) / Math.max(1, ts.length));
      ts.forEach((t, j) => addPlace({
        kind: 'tower', tower: t, level: L,
        x: 74 + j * gapX, y: zy + 24, w: 54, h: 82,
      }));
      if (L.animal) addPlace({ kind: 'king', level: L, x: WW - 92, y: zy + 118, w: 70, h: 62 });
    });
    // 바깥 벽
    solids.push({ x: -40, y: -40, w: W + 80, h: 40 }, { x: -40, y: H, w: W + 80, h: 40 },
      { x: -40, y: -40, w: 40, h: H + 80 }, { x: W, y: -40, w: 40, h: H + 80 });
    px = W / 2; py = H - 34; dir = 0; walkT = 0; cam = { x: 0, y: 0 };
  }
  function addPlace(p) {
    p.cx = p.x + p.w / 2; p.cy = p.y + p.h / 2;
    places.push(p);
    // 몸통은 막고, 아래쪽 문 앞은 지나갈 수 있게 남긴다
    solids.push({ x: p.x + 4, y: p.y, w: p.w - 8, h: p.h - 14, place: p });
  }

  // ---------- 시작 ----------
  function start() {
    Game.home = 'town';
    if (!el('screen-town')) return;
    build();
    pimg = Avatar.image();
    joy = null; keys = {}; nearP = null; coolP = null; hint = '';
    shell();
    UI.show('town');
    active = true; last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function resume() {
    if (!places) { start(); return; }
    Game.home = 'town';
    coolP = nearP;                         // 나오자마자 다시 안 들어가게
    shell(); UI.show('town');
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
        <span class="tw-stat">❤️ ${p.hp}</span><span class="tw-stat">💰 ${p.gold}</span><span class="tw-stat">🃏 ${Cards.count()}</span>
        <button class="btn small ghost" id="tw-list">📋 목록</button>
      </div>
      <div class="tw-wrap"><canvas id="tw-cv"></canvas>
        <button class="tw-hint" id="tw-hint"></button>
        <div class="tw-joy" id="tw-joy"><i></i></div>
      </div>
      <div class="tw-tip">화면을 끌어서 움직이고, 문 앞에서 노란 버튼을 눌러요</div>`;
    cv = el('tw-cv'); ctx = cv.getContext('2d');
    resize();
    el('tw-list').onclick = () => { stop(); Game.home = 'lobby'; Lobby.render(); UI.show('lobby'); };
    el('tw-hint').onclick = e => { e.stopPropagation(); if (nearP) enter(nearP); };
    bindInput();
  }
  function resize() {
    if (!cv) return;
    const w = cv.parentElement.clientWidth || 320, dpr = window.devicePixelRatio || 1;
    const h = Math.max(280, Math.min(480, Math.round(window.innerHeight * 0.60)));
    cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- 입력 ----------
  function bindInput() {
    const wrap = cv.parentElement, stick = el('tw-joy');
    const at = e => { const r = wrap.getBoundingClientRect(); const t = e.touches ? e.touches[0] : e; return { x: t.clientX - r.left, y: t.clientY - r.top }; };
    const down = e => { const p = at(e); joy = { ox: p.x, oy: p.y, x: p.x, y: p.y }; showStick(stick); e.preventDefault(); };
    const move = e => { if (!joy) return; const p = at(e); joy.x = p.x; joy.y = p.y; showStick(stick); e.preventDefault(); };
    const up = () => { joy = null; stick.classList.remove('on'); };
    wrap.addEventListener('touchstart', down, { passive: false });
    wrap.addEventListener('touchmove', move, { passive: false });
    wrap.addEventListener('touchend', up); wrap.addEventListener('touchcancel', up);
    wrap.addEventListener('mousedown', down); wrap.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }
  function showStick(stick) {
    const d = clampVec(joy.x - joy.ox, joy.y - joy.oy, 42);
    stick.classList.add('on');
    stick.style.left = joy.ox + 'px'; stick.style.top = joy.oy + 'px';
    stick.firstElementChild.style.transform = `translate(${d.x}px, ${d.y}px)`;
  }
  function clampVec(x, y, max) {
    const d = Math.hypot(x, y);
    return d <= max || d === 0 ? { x, y, d } : { x: x / d * max, y: y / d * max, d: max };
  }
  function key(e, on) {
    const k = e.key;
    const m = { ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd', ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r' }[k];
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
    const moving = Math.hypot(vx, vy) > .05;
    if (moving) { walkT += dt * 9; if (Math.abs(vx) > .2) dir = vx > 0 ? 1 : -1; }
    step(vx * SPEED * dt, vy * SPEED * dt);

    // 가까운 곳 찾기 → 문 앞에 서면 들어간다
    let best = null, bd = 1e9;
    places.forEach(p => {
      const d = Math.hypot(px - p.cx, py - (p.y + p.h));
      if (d < 58 && d < bd) { bd = d; best = p; }
    });
    nearP = best;
    const label = best ? placeLabel(best) : '';
    if (label !== hint) {
      hint = label;
      const h = el('tw-hint');
      if (h) { h.innerHTML = label ? `${label}` : ''; h.classList.toggle('on', !!label); }
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
      const lock = towerLock(p.tower);
      return lock ? `🔒 ${p.tower.name} · Lv.${lock.needLv}부터` : `${p.tower.name} · 들어가기`;
    }
    if (p.kind === 'king') { const k = Game.kingInfo(p.level.id); return `👑 ${p.level.name} 왕${k && k.ok ? ' · 도전!' : k ? ` · 🃏 ${k.have}/${k.need}` : ''}`; }
    if (p.kind === 'sign') return `${p.level.emoji} ${p.level.name}${levelCode(p.level) ? ' · ' + levelCode(p.level) : ''}`;
    if (p.kind === 'hole') return '🕳️ 지하 던전 · 들어가기';
    return `${p.emoji} ${p.name}`;
  }
  function enter(p) {
    if (p.kind === 'sign') return;
    stop();
    if (p.kind === 'tower') {
      const prog = towerProg(p.tower.id), total = floorList(p.tower).length;
      Game.startFloor(p.tower.id, prog.cleared >= total ? 1 : Math.min(prog.floor, total));
      if (UI.current() === 'town') resume();          // 잠겨서 못 들어간 경우
      return;
    }
    if (p.kind === 'king') { Game.startKing(p.level.id); resume(); return; }
    const run = {
      dungeon: () => Dungeon.start(),
      arena: () => Game.startArena(),
      shop: () => Lobby.shop(), book: () => Cards.book(),
      dress: () => Lobby.charCreator(false), skills: () => Lobby.skills(),
    }[p.act];
    if (run) run();
    if (UI.current() === 'town') resume();
  }

  // ---------- 그리기 ----------
  function draw() {
    const w = vw(), h = vh();
    cam.x = Math.max(0, Math.min(W - w, px - w / 2));
    cam.y = Math.max(0, Math.min(H - h, py - h / 2));
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    ground(w, h);
    const sorted = places.slice().sort((a, b) => (a.y + a.h) - (b.y + b.h));
    let drewMe = false;
    sorted.forEach(p => {
      if (!drewMe && p.y + p.h > py) { me(); drewMe = true; }
      place(p);
    });
    if (!drewMe) me();
    ctx.restore();
    northHint(w, h);
  }
  // 탑은 위에 있다. 화면 밖이면 화살표로 알려준다.
  function northHint(w, h) {
    const up = places.filter(p => p.kind === 'tower' && p.y + p.h < cam.y + 10);
    if (!up.length) return;
    const t = up[up.length - 1];
    const a = .55 + Math.sin(performance.now() / 400) * .25;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe066'; ctx.font = 'bold 13px "Jua", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('▲ ' + (t.level ? t.level.name + ' 구역' : '탑'), w / 2, 20);
    ctx.globalAlpha = 1;
  }
  function ground(w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2a4a'); g.addColorStop(.6, '#20365a'); g.addColorStop(1, '#28406a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 북쪽으로 난 길 = 진도
    ctx.fillStyle = 'rgba(255, 236, 190, .10)';
    ctx.fillRect(W / 2 - 46, 0, 92, H);
    ctx.fillStyle = 'rgba(255, 236, 190, .10)';
    ctx.fillRect(0, H - 200, W, 120);
    // 풀 점
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 20; y < H; y += 46) for (let x = ((y / 46) % 2) * 23 + 14; x < W; x += 46) ctx.fillRect(x, y, 3, 3);
  }
  function me() {
    const bob = Math.sin(walkT) * 3;
    // 펫
    if (state.player.pet && PETS[state.player.pet]) {
      ctx.font = '18px serif'; ctx.textAlign = 'center';
      ctx.fillText(PETS[state.player.pet].emoji, px - dir * 22, py - 4 + Math.sin(walkT - 1) * 3);
    }
    ctx.save(); ctx.translate(px, py + bob);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 4 - bob, 13, 5, 0, 0, 6.3); ctx.fill();
    if (dir < 0) ctx.scale(-1, 1);
    if (pimg && pimg.ready) ctx.drawImage(pimg.img, -17, -44, 34, 46);
    else { ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.fillText(UI.charEmoji(), 0, 0); }
    ctx.restore();
  }
  function place(p) {
    const near = p === nearP;
    ctx.save();
    if (near) { ctx.shadowColor = 'rgba(255,200,61,.9)'; ctx.shadowBlur = 16; }
    if (p.kind === 'tower') tower(p);
    else if (p.kind === 'king') king(p);
    else if (p.kind === 'sign') sign(p);
    else if (p.kind === 'hole') hole(p);
    else house(p);
    ctx.restore();
  }
  function roof(x, y, w, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x + w / 2, y - 26); ctx.lineTo(x + w + 6, y); ctx.closePath(); ctx.fill();
  }
  function door(x, y, w, h, open) {
    ctx.fillStyle = open ? '#2b1d10' : '#4a3a24';
    ctx.fillRect(x + w / 2 - 9, y + h - 20, 18, 20);
    if (!open) { ctx.fillStyle = '#ffc83d'; ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText('🔒', x + w / 2, y + h - 6); }
  }
  function tower(p) {
    const lock = towerLock(p.tower);
    const prog = towerProg(p.tower.id), total = floorList(p.tower).length;
    const done = prog.cleared >= total;
    ctx.fillStyle = lock ? '#3a3560' : '#4b4a86';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(p.x, p.y, p.w, 8);
    // 창문 = 진행도
    const rows = 5;
    for (let i = 0; i < rows; i++) {
      const lit = !lock && (rows - i) <= Math.round(prog.cleared / total * rows);
      ctx.fillStyle = lit ? '#ffc83d' : 'rgba(0,0,0,.3)';
      ctx.fillRect(p.x + 12, p.y + 16 + i * 12, 10, 8);
      ctx.fillRect(p.x + p.w - 22, p.y + 16 + i * 12, 10, 8);
    }
    roof(p.x, p.y, p.w, lock ? '#5a5480' : (done ? '#c9971c' : '#7a6bb8'));
    door(p.x, p.y, p.w, p.h, !lock);
    label(p, p.tower.name.replace(/^[^\s]+\s/, ''), lock ? '#9a94c0' : '#fff6e0');
  }
  function king(p) {
    const k = Game.kingInfo(p.level.id), beaten = k && k.beaten, ready = k && k.ok;
    ctx.fillStyle = beaten ? '#1fa08a' : ready ? '#8a6a44' : '#3d3560';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(p.x + p.w / 2 - 12, p.y + p.h - 26, 24, 26);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = beaten ? '#3ee0c4' : '#5a5480'; ctx.fillRect(p.x + 4 + i * 24, p.y - 12, 14, 14); }
    ctx.font = '20px serif'; ctx.textAlign = 'center';
    ctx.fillText('👑', p.cx, p.y - 16);
    label(p, `${p.level.name} 왕`, ready ? '#ffe066' : '#c9c2e6');
  }
  function sign(p) {
    ctx.fillStyle = '#6b5433'; ctx.fillRect(p.cx - 3, p.y + 14, 6, 26);
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(p.x, p.y, p.w, 20);
    ctx.font = '15px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.level.emoji, p.cx, p.y + 10);
    label(p, p.level.name, '#e8e2ff');
  }
  function hole(p) {
    ctx.fillStyle = '#0b0818';
    ctx.beginPath(); ctx.ellipse(p.cx, p.y + p.h - 12, p.w / 2, 20, 0, 0, 6.3); ctx.fill();
    ctx.strokeStyle = '#4a3a24'; ctx.lineWidth = 4; ctx.stroke();
    ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.fillText('🕳️', p.cx, p.y + p.h - 8);
    label(p, '지하 던전', '#c9c2e6');
  }
  function house(p) {
    ctx.fillStyle = '#f0e6cc'; ctx.fillRect(p.x, p.y + 10, p.w, p.h - 10);
    roof(p.x, p.y + 10, p.w, '#d9455a');
    ctx.fillStyle = '#7a5a3a'; ctx.fillRect(p.cx - 10, p.y + p.h - 22, 20, 22);
    ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(p.emoji, p.cx, p.y + 40);
    label(p, p.name, '#fff6e0');
  }
  function label(p, text, color) {
    ctx.font = 'bold 12px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,10,30,.85)';
    ctx.strokeText(text, p.cx, p.y + p.h + 15);
    ctx.fillStyle = color; ctx.fillText(text, p.cx, p.y + p.h + 15);
  }

  window.addEventListener('resize', () => { if (UI.current() === 'town') { resize(); } });
  window.addEventListener('keydown', e => { if (UI.current() === 'town') key(e, true); });
  window.addEventListener('keyup', e => { if (UI.current() === 'town') key(e, false); });

  // 테스트에서 위치를 확인할 수 있게
  function debug() { return { px, py, W, H, near: nearP && placeLabel(nearP), places: places && places.length }; }

  return { start, resume, stop, debug };
})();
