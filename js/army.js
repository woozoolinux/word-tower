'use strict';
// ⚔️ 연병장 — 부하를 이끌고 두 갈래 문을 지나 적 무리와 부딪힌다.
//
// 왜 또 만드나: 우리 게임의 모든 퀴즈는 **맞으면 데미지, 틀리면 HP** 다.
// 숫자만 바뀐다. 여긴 다르다 — 맞힌 만큼 부하가 **실제로 늘어나 화면을 채운다.**
// 아이가 "많이 맞히면 이만큼 커진다" 를 눈으로 본다. 그 순간이 이 게임의 전부다.
//
// 규칙이 그림 하나로 설명된다:
//   위에 뜻이 뜬다 → 길이 둘로 갈리고 문마다 영어 단어가 적혀 있다 →
//   맞는 문으로 지나가면 부하가 두 배, 틀린 문이면 절반 → 끝에서 적 무리와 부딪힌다
//
// 부하는 **내 분신들**이다. 옷가게에서 산 옷 색이 무리 전체 색으로 나타난다.
const Army = (() => {
  const A = () => BAL.army;
  const $ = id => document.getElementById(id);

  let cv, ctx, raf, last, active;
  let W = 360, H = 260;
  let troops, gateIdx, gate, lane, laneS, phase, phaseT, pool, queue, hit, enemy, runWords;
  let bg, crowd, clashT, result;

  // ---------- 균형 ----------
  // 맞으면 ×2, 틀리면 ×0.55. **곱하기라서 순서가 상관없다** —
  // "몇 개 맞혔나" 하나로 결과가 정해지고, 그래야 난이도를 테스트로 못 박을 수 있다.
  function step(n, ok) {
    const a = A();
    return Math.max(a.min, Math.round(ok ? n * a.win : n * a.lose));
  }
  // c개를 맞혔을 때 남는 부하 수 (앞에서부터 맞혔다고 치고 계산 — 순서는 결과를 안 바꾼다)
  function simulate(c) {
    const a = A();
    let n = a.start;
    for (let i = 0; i < a.gates; i++) n = step(n, i < c);
    return n;
  }
  // 적군 수 — "4개 맞히면 이기고 3개면 진다" 에 맞춘다
  function enemyCount() {
    const a = A();
    return Math.max(3, Math.round(a.start * Math.pow(a.win, a.gates - 2) * Math.pow(a.lose, 2) * a.enemyEase));
  }

  // ---------- 단어 ----------
  // 마지막으로 오른 탑에서 뽑는다 — 방금 배운 걸 바로 써먹는 곳이다.
  // 그 탑이 없으면(아직 아무 데도 안 갔으면) 본 적 있는 단어 중에서.
  function candidates() {
    const t = typeof lastTower === 'function' ? lastTower() : null;
    if (t) {
      const ws = allWords(t).filter(w => statFor(t.id, w).seen > 0);
      if (ws.length >= 6) return shuffle(ws).slice(0, A().words);
    }
    const all = [];
    (window.TOWERS || []).forEach(x => allWords(x).forEach(w => {
      if (statFor(x.id, w).seen > 0) all.push(w);
    }));
    return shuffle(all).slice(0, A().words);
  }

  function start() {
    pool = candidates();
    if (pool.length < 4) { UI.toast('타워에서 단어를 조금 더 만난 뒤에 올 수 있어요', 'bad'); return; }
    shell();
    reset();
    UI.show('army');
    resize();
    brief();
  }

  function reset() {
    const a = A();
    troops = a.start; gateIdx = 0; lane = -1; laneS = -1;
    hit = 0; enemy = enemyCount(); clashT = 0; result = null;
    queue = []; runWords = [];
    bg = 0; crowd = [];
    for (let i = 0; i < a.drawMax; i++) {
      crowd.push({ ox: (Math.random() - .5) * 2, oz: Math.random(), f: Math.random() * 6.3 });
    }
    buildQueue();
    gate = null; phase = 'wait'; phaseT = 0;
  }

  // 문 여섯 개. 답이 왼쪽/오른쪽에 고루 나와야 한 쪽만 눌러도 되는 판이 안 나온다
  function buildQueue() {
    const a = A();
    const picks = shuffle(pool.slice()).slice(0, a.gates);
    while (picks.length < a.gates) picks.push(pick(pool));
    queue = picks.map((w, i) => {
      const other = distractors(w, pool, 1, 'w')[0] || pick(pool);
      const ansRight = Math.random() < .5;
      return { word: w, ans: ansRight ? 1 : -1, left: ansRight ? (other.w || other) : w.w, right: ansRight ? w.w : (other.w || other) };
    });
    // 같은 쪽이 셋 넘게 이어지면 아이가 규칙을 눈치챈다
    for (let i = 2; i < queue.length; i++) {
      if (queue[i].ans === queue[i - 1].ans && queue[i].ans === queue[i - 2].ans) flip(queue[i]);
    }
    runWords = queue.map(g => g.word);
  }
  function flip(g) {
    g.ans = -g.ans;
    const t = g.left; g.left = g.right; g.right = t;
  }

  function brief() {
    UI.modal(`
      <div class="modal-title">⚔️ 연병장</div>
      <div class="modal-sub">뜻에 맞는 <b>영어 단어가 적힌 문</b>으로 지나가요.<br>
        맞으면 부하가 <b>두 배</b>, 틀리면 <b>절반</b>이 돼요.<br>
        문 ${A().gates}개를 지나면 <b>적 ${enemy}명</b>과 부딪혀요!</div>
      <div class="ar-tip">화면 <b>왼쪽/오른쪽</b>을 눌러서 길을 골라요</div>
      <div class="actions"><button class="btn" data-close="go">⚔️ 출발!</button></div>`,
      { onClose: () => go() });
  }

  function go() {
    active = true; last = performance.now();
    nextGate();
    raf = requestAnimationFrame(loop);
  }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function nextGate() {
    if (gateIdx >= queue.length) { phase = 'clash'; phaseT = 0; gate = null; lane = 0; setAsk('돌격!', '적 무리와 부딪힌다'); return; }
    gate = Object.assign({ z: 1 }, queue[gateIdx]);
    setAsk(gate.word.m);
    phase = 'run';
  }
  function setAsk(t, label) {
    const lb = $('ar-ask-label');
    if (lb) lb.textContent = label || '이 뜻의 문으로';
    const el = $('ar-ask');
    if (el) el.textContent = t;
    const c = $('ar-count');
    if (c) c.innerHTML = `<b>${troops}</b>명 · 적 ${enemy}명`;
  }

  // ---------- 화면 ----------
  function shell() {
    $('screen-army').innerHTML = `
      <div class="ar-hud panel">
        <div class="ar-ask-label" id="ar-ask-label">이 뜻의 문으로</div>
        <b class="ar-ask-word" id="ar-ask">…</b>
        <div class="ar-count" id="ar-count"></div>
      </div>
      <div class="ar-wrap"><canvas id="ar-cv"></canvas>
        <button class="ar-side left" data-side="-1" aria-label="왼쪽 길"></button>
        <button class="ar-side right" data-side="1" aria-label="오른쪽 길"></button>
      </div>
      <p class="hint-text">⚔️ 뜻에 맞는 단어의 문으로! 맞으면 부하가 두 배로 늘어나요.</p>`;
    cv = $('ar-cv'); ctx = cv.getContext('2d');
    $('screen-army').querySelectorAll('.ar-side').forEach(b => {
      b.onclick = () => { lane = Number(b.dataset.side); };
    });
  }
  function resize() {
    if (!cv) return;
    const r = UI.fitCanvas(cv, { designW: 360, maxScale: 1.7, minH: 230, maxH: 480 });
    W = r.w; H = r.h;
  }

  // 원근 — z 는 0(발밑)부터 1(지평선)까지
  const HOR = 0.24;
  function pz(z) { return HOR * H + (H - HOR * H) * Math.pow(1 - z, 1.7); }
  function sz(z) { return Math.pow(1 - z, 1.5) * 0.88 + 0.12; }
  function pxz(x, z) { return W / 2 + x * W * 0.46 * sz(z); }

  function loop(now) {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }

  function update(dt) {
    bg += dt * 0.9;
    laneS += (lane - laneS) * Math.min(1, dt * 9);
    if (hit > 0) hit -= dt;
    if (phase === 'run' && gate) {
      gate.z -= dt / A().approach;
      if (gate.z <= 0.10) resolve();
    } else if (phase === 'clash') {
      phaseT += dt;
      if (phaseT > 0.9 && !result) decide();
    }
  }

  function resolve() {
    const ok = gate.ans === lane;
    recordResult(gate.word.towerId || (lastTower() || {}).id, gate.word, ok);
    troops = step(troops, ok);
    hit = ok ? 0.35 : 0.5;
    if (ok) { Sfx.ok(); UI.floatText($('ar-cv'), '×' + A().win, 'dmg-m'); }
    else { Sfx.bad(); UI.floatText($('ar-cv'), '절반!', 'dmg-p'); UI.shake($('ar-cv')); }
    gateIdx++;
    saveState();
    nextGate();
  }

  function decide() {
    result = troops > enemy ? 'win' : 'lose';
    stop();
    setTimeout(() => result === 'win' ? won() : lost(), 700);
  }

  // ---------- 그리기 ----------
  function draw() {
    ctx.save();
    if (hit > 0.3) ctx.translate((Math.random() - .5) * 5, (Math.random() - .5) * 5);
    sky(); road(); scenery();
    if (phase === 'clash') drawEnemy();
    else if (gate) drawGate(gate);
    drawCrowd();
    ctx.restore();
  }

  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, HOR * H + 20);
    g.addColorStop(0, '#3f74c4'); g.addColorStop(1, '#a9cff0');
    ctx.fillStyle = g; ctx.fillRect(-4, -4, W + 8, HOR * H + 24);
    // 먼 산 — 지평선을 앉힌다
    ctx.fillStyle = '#7f93c9';
    for (let i = -1; i < 5; i++) {
      const x = i * (W / 4) - (bg * 4) % (W / 4);
      ctx.beginPath();
      ctx.moveTo(x, HOR * H + 4); ctx.lineTo(x + W / 8, HOR * H - 26 - (i % 2) * 12);
      ctx.lineTo(x + W / 4, HOR * H + 4); ctx.closePath(); ctx.fill();
    }
  }
  function road() {
    // 길 — 아래가 넓고 위가 좁다. 이 사다리꼴 하나가 원근을 만든다
    ctx.fillStyle = '#6fb055';
    ctx.fillRect(-4, HOR * H, W + 8, H - HOR * H + 8);
    ctx.fillStyle = '#dfd0a4';
    ctx.beginPath();
    ctx.moveTo(pxz(-1.05, 0), pz(0) + 8); ctx.lineTo(pxz(1.05, 0), pz(0) + 8);
    ctx.lineTo(pxz(1.05, 1), pz(1)); ctx.lineTo(pxz(-1.05, 1), pz(1));
    ctx.closePath(); ctx.fill();
    // 가로 줄 — 달리고 있다는 느낌은 거의 이것에서 온다
    for (let i = 0; i < 12; i++) {
      const z = ((i / 12) + (1 - (bg % 1))) % 1;
      const y = pz(z), h = Math.max(1, 5 * sz(z));
      ctx.fillStyle = 'rgba(150,120,70,.16)';
      ctx.fillRect(pxz(-1.05, z), y, pxz(1.05, z) - pxz(-1.05, z), h);
    }
    // 가운데 선 — 두 갈래라는 걸 미리 알려준다
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
    ctx.beginPath(); ctx.moveTo(pxz(0, 0), pz(0)); ctx.lineTo(pxz(0, 1), pz(1)); ctx.stroke();
    ctx.setLineDash([]);
  }
  function scenery() {
    // 길가 나무 — 지나가는 게 보여야 달리는 것으로 읽힌다
    for (let i = 0; i < 8; i++) {
      const z = ((i / 8) + (1 - (bg * .5 % 1))) % 1;
      if (z > .98) continue;
      [-1.35, 1.35].forEach(sx => {
        const x = pxz(sx, z), y = pz(z), s = sz(z);
        ctx.fillStyle = '#7a5636'; ctx.fillRect(x - 2 * s, y - 22 * s, 4 * s, 22 * s);
        ctx.fillStyle = '#4f9a44';
        ctx.beginPath(); ctx.arc(x, y - 30 * s, 14 * s, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#6cbb56';
        ctx.beginPath(); ctx.arc(x - 5 * s, y - 36 * s, 8 * s, 0, 6.3); ctx.fill();
      });
    }
  }

  function drawGate(g) {
    const z = Math.max(0, g.z), s = sz(z), y = pz(z);
    const hgt = 78 * s;
    [-1, 1].forEach(side => {
      const cx = pxz(side * 0.5, z), w = W * 0.40 * s;
      // 문틀
      ctx.fillStyle = side === Math.round(laneS) ? '#ffd964' : '#e9dfc8';
      ctx.fillRect(cx - w / 2, y - hgt, w, hgt);
      ctx.fillStyle = 'rgba(0,0,0,.14)';
      ctx.fillRect(cx - w / 2, y - hgt, w, 6 * s);
      ctx.strokeStyle = '#7a5636'; ctx.lineWidth = Math.max(1, 3 * s);
      ctx.strokeRect(cx - w / 2, y - hgt, w, hgt);
      // 단어
      const txt = side < 0 ? g.left : g.right;
      const fs = Math.max(9, 22 * s);
      ctx.font = `700 ${fs}px "Baloo 2", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a2d1c';
      ctx.fillText(txt, cx, y - hgt / 2, w - 8 * s);
    });
  }

  function drawEnemy() {
    // 적 무리 — 부딪히러 온다
    const z = Math.max(0.20, 0.9 - phaseT * 0.72);
    const n = Math.min(A().drawMax, enemy);
    const sp = spread(enemy);
    for (let i = 0; i < n; i++) {
      const c = crowd[i % crowd.length];
      const zz = Math.min(0.98, z + Math.abs(c.oz) * 0.10);
      soldier(pxz(c.ox * sp, zz), pz(zz), sz(zz), '#d9455a', '#8f2436', c.f + phaseT * 9);
    }
    badge(pxz(0.55, 0.06), pz(0.06) - 118, enemy + '명', '#ff8090');
  }

  // 무리가 커질수록 **넓게** 퍼진다. 512명이 48명과 같은 크기면 늘어난 보람이 없다
  function spread(n) { return 0.22 + 0.72 * Math.min(1, Math.log(n) / Math.log(400)); }
  function drawCrowd() {
    const look = (typeof Avatar !== 'undefined' && Avatar.OUTFIT_LOOK[state.player.outfit]) || { base: '#3fae6a', belt: '#8a5a2b' };
    const n = Math.min(A().drawMax, troops);
    const t = performance.now() / 1000;
    const sp = spread(troops), mid = phase === 'clash' ? 0 : laneS * 0.5;
    const front = phase === 'clash' ? 0.03 + Math.min(0.09, phaseT * 0.09) : 0.03;
    // 뒤에 있는 사람부터 그려야 앞사람이 위로 온다
    const list = crowd.slice(0, n).sort((a2, b2) => b2.oz - a2.oz);
    list.forEach(c => {
      const zz = front + c.oz * (0.09 + sp * 0.10);
      const x = mid + c.ox * sp;
      soldier(pxz(x, zz), pz(zz), sz(zz) * 0.9, look.base, look.belt, c.f + t * 9);
    });
    const bx = phase === 'clash' ? -0.55 : mid;   // 부딪힐 땐 좌우로 갈라야 두 수가 같이 읽힌다
    badge(pxz(bx, 0.06), pz(0.06) - 118, troops + '명', '#3ee0c4');
  }

  // 부하 하나 — 머리·몸·다리 셋이면 사람으로 읽힌다. 작게 그리니 이걸로 충분하다
  function soldier(x, y, s, body, belt, f) {
    const hop = Math.abs(Math.sin(f)) * 3 * s;
    const h = 26 * s;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 2.4 * s, 0, 0, 6.3); ctx.fill();
    const top = y - h - hop;
    ctx.fillStyle = belt; ctx.fillRect(x - 4.5 * s, top + h * 0.62, 9 * s, h * 0.16);
    ctx.fillStyle = body; ctx.fillRect(x - 5 * s, top + h * 0.3, 10 * s, h * 0.4);
    ctx.fillStyle = '#3a3560'; ctx.fillRect(x - 4 * s, top + h * 0.76, 3 * s, h * 0.24);
    ctx.fillRect(x + 1 * s, top + h * 0.76, 3 * s, h * 0.24);
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath(); ctx.arc(x, top + h * 0.17, 4.6 * s, 0, 6.3); ctx.fill();
  }

  function badge(x, y, text, color) {
    ctx.font = '800 20px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 22;
    ctx.fillStyle = 'rgba(10,8,28,.72)';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 15, w, 30, 15); ctx.fill();
    ctx.fillStyle = color; ctx.fillText(text, x, y + 1);
  }

  // ---------- 끝 ----------
  function wordList() {
    return runWords.map(w => `<div class="dg-brief-row"><b>${esc(w.w)}</b><span>${esc(w.m)}</span></div>`).join('');
  }
  function won() {
    const a = A();
    const gold = Math.round(a.gold.win + troops * a.gold.perTroop);
    addGold(gold);
    addExp(a.exp.win).forEach(lv => Game.pendingUps.push(lv));
    state.player.armyBest = Math.max(state.player.armyBest || 0, troops);
    state.player.armyClears = (state.player.armyClears || 0) + 1;
    saveState();
    Sfx.fanfare(); UI.confetti({ count: 140, colors: ['#ffc83d', '#3ee0c4', '#ffffff'] });
    UI.modal(`
      <div class="modal-title">⚔️ 돌파!</div>
      <div class="ar-big">${troops} <span>vs</span> ${enemy}</div>
      <div class="modal-sub">부하 <b>${troops}명</b>으로 적 <b>${enemy}명</b>을 밀어냈어요!</div>
      <div class="reward-row">💰 +${gold} · ⭐ +${a.exp.win}</div>
      <div class="dg-brief small">${wordList()}</div>
      <div class="actions">
        <button class="btn" data-close="again">⚔️ 한 번 더!</button>
        <button class="btn ghost" data-close="x">마을로</button>
      </div>`, { onClose: v => v === 'again' ? start() : Game.town(false) });
  }
  function lost() {
    const a = A();
    addGold(a.gold.lose);
    addExp(a.exp.lose).forEach(lv => Game.pendingUps.push(lv));
    saveState();
    Sfx.down();
    UI.modal(`
      <div class="modal-title">🛡️ 밀렸다!</div>
      <div class="ar-big lose">${troops} <span>vs</span> ${enemy}</div>
      <div class="modal-sub">부하가 <b>${troops}명</b>밖에 안 남았어요.<br>
        문 ${a.gates}개 중 <b>4개</b>만 맞히면 이길 수 있어요!</div>
      <div class="reward-row">💰 +${a.gold.lose} · ⭐ +${a.exp.lose}</div>
      <div class="dg-brief small">${wordList()}</div>
      <div class="actions">
        <button class="btn" data-close="again">⚔️ 다시!</button>
        <button class="btn ghost" data-close="book">📖 단어 보기</button>
        <button class="btn ghost" data-close="x">마을로</button>
      </div>`, { onClose: v => {
        if (v === 'again') { start(); return; }
        Game.town(false);
        if (v === 'book') Cards.book();
      } });
  }

  function key(e) {
    if (UI.current() !== 'army') return;
    if (e.key === 'ArrowLeft' || e.key === 'a') { lane = -1; e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd') { lane = 1; e.preventDefault(); }
  }
  window.addEventListener('keydown', key);
  window.addEventListener('resize', () => { if (UI.current() === 'army') resize(); });

  // 테스트에서 정답 쪽을 알아야 한 판을 끝까지 돌려 볼 수 있다
  function debug() { return { troops, enemy, gateIdx, ans: gate && gate.ans, phase }; }

  return { start, stop, simulate, enemyCount, step, debug };
})();
