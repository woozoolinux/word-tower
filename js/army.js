'use strict';
// ⚔️ 연병장 — 부하를 이끌고 문을 지나며 **계속 싸운다.**
//
// 왜 또 만드나: 우리 게임의 모든 퀴즈는 **맞으면 데미지, 틀리면 HP** 다.
// 숫자만 바뀐다. 여긴 다르다 — 맞힌 만큼 부하가 **실제로 늘어나 화면을 채우고**,
// 그 부하들이 **총을 쏜다.** 많이 맞히면 화력이 눈에 보인다.
//
// 규칙이 그림 하나로 설명된다:
//   위에 뜻이 뜬다 → 길이 둘로 갈리고 문마다 영어 단어가 적혀 있다 →
//   맞는 문이면 부하 두 배, 틀린 문이면 확 줄어든다 →
//   문을 지날 때마다 적 무리가 내려온다. 못 막으면 병사를 잃는다 →
//   마지막에 적장의 무리. 다 쓸어버리면 이긴다.
//
// 부하는 **내 분신들**이다. 옷가게에서 산 옷 색이 무리 전체 색으로 나타난다.
// 그리고 **한 문 맞힐 때마다 무기가 올라간다** — 돌팔매 → 화살 → 불화살 → 번개.
const Army = (() => {
  const A = () => BAL.army;
  const $ = id => document.getElementById(id);

  // 레벨이 오르면 **수가 같이 커지고 문이 빨리 온다.**
  // 부대·적·적장을 같은 배로 키우니 "4개 맞히면 이긴다" 는 그대로다 —
  // 어려워지는 건 오직 판단할 시간이다.
  function tier(lv) {
    const a = A();
    return Math.max(1, Math.min(a.tierMax, 1 + Math.floor((lv === undefined ? state.player.lv : lv) / a.tierPer)));
  }
  // 이 판에서 실제로 쓰는 숫자들. 배율이 걸린 뒤의 값이다
  function cfg(lv) {
    const a = A(), k = tier(lv);
    return {
      k, gates: a.gates, lanes: a.lanes, win: a.win, lose: a.lose,
      fire: a.fire,
      start: a.start * k, min: a.min * k, cap: a.cap * k, maxLoss: a.maxLoss * k,
      waves: a.waves.map(w => w * k), boss: a.boss * k,
      approach: Math.max(a.minApproach, a.approach - (k - 1) * a.tierRush),
      waveTime: a.waveTime, bossTime: a.bossTime, shotTime: a.shotTime,
      drawMax: a.drawMax, words: a.words, gold: a.gold, exp: a.exp,
    };
  }

  let cv, ctx, raf, last, active;
  let W = 360, H = 260;
  let troops, gateIdx, gate, lane, laneS, phase, phaseT, pool, queue, hit;
  let bg, crowd, foes, shots, wave, result, runWords, msg, msgT, C, chief;

  // ---------- 균형 ----------
  // 게이트는 **전부 곱하기**다. 맞으면 ×2, 틀리면 ×0.6.
  // +N/−N 을 섞으면 "몇 번째 문에서 틀렸나"로 결과가 달라져서 난이도를 못 박을 수 없다.
  //
  // 전투 손실은 **머릿수 상한**으로 막는다. 비율로 두면 병력이 적을 때
  // 배로 늘려도 그만큼 다시 잃어서 영영 못 올라온다 (죽음의 나선).
  function gateStep(n, ok, c) {
    c = c || cfg();
    return Math.min(c.cap, Math.max(c.min, Math.round(ok ? n * c.win : n * c.lose)));
  }
  // 화력은 오직 **사람 수**다. 많이 맞혀서 사람이 많아지면 총알이 많이 나간다
  function firepower(n) { return Math.floor(n * A().fire); }
  // 한 웨이브의 결과 — 몇을 잡고 몇을 잃는가. **그림이 이 답을 따라간다.**
  // 반대로 하면(그림이 결과를 정하면) 폰 성능에 따라 난이도가 달라진다
  function waveOutcome(n, size, c) {
    c = c || cfg();
    const kills = Math.min(size, firepower(n));
    return { kills, loss: Math.min(c.maxLoss, size - kills) };
  }
  // 문 다섯 개를 이렇게 지났을 때의 마지막 화력.
  // 테스트가 이걸로 "4개 맞히면 이기고 3개면 진다"를 32가지 순서로 확인한다
  function simulate(mask, lv) {
    const c = cfg(lv);
    let n = c.start;
    for (let i = 0; i < c.gates; i++) {
      const ok = typeof mask === 'number' ? !!(mask & (1 << i)) : i < mask;
      n = gateStep(n, ok, c);
      n = Math.max(c.min, n - waveOutcome(n, c.waves[i], c).loss);
    }
    return { troops: n, power: firepower(n), win: firepower(n) >= c.boss, cfg: c };
  }

  // ---------- 단어 ----------
  // 마지막으로 오른 탑에서 뽑는다 — 방금 배운 걸 바로 써먹는 곳이다
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
    shell(); reset(); UI.show('army'); resize(); brief();
  }

  function reset() {
    const a = A();
    C = cfg();
    troops = C.start; gateIdx = 0; lane = 1; laneS = 1;   // 가운데에서 출발
    hit = 0; result = null; bg = 0; foes = []; shots = []; wave = null;
    msg = null; msgT = 0; chief = chiefOf();
    crowd = [];
    for (let i = 0; i < a.drawMax; i++) {
      crowd.push({ ox: (Math.random() - .5) * 2, oz: Math.random(), f: Math.random() * 6.3 });
    }
    buildQueue();
    gate = null; phase = 'wait'; phaseT = 0;
  }

  // 갈림길이 셋이라 문마다 오답 보기가 둘 필요하다
  function buildQueue() {
    const L = C.lanes;
    const picks = shuffle(pool.slice()).slice(0, C.gates);
    while (picks.length < C.gates) picks.push(pick(pool));
    queue = picks.map(w => {
      const ds = distractors(w, pool, L - 1, 'w').map(d => d.w || d);
      while (ds.length < L - 1) ds.push(pick(pool).w);
      const doors = shuffle([w.w].concat(ds));
      return { word: w, ans: doors.indexOf(w.w), doors };
    });
    // 같은 자리가 셋 넘게 이어지면 아이가 규칙을 눈치챈다
    for (let i = 2; i < queue.length; i++) {
      if (queue[i].ans === queue[i - 1].ans && queue[i].ans === queue[i - 2].ans) {
        const q = queue[i], j = (q.ans + 1) % L;
        const t = q.doors[j]; q.doors[j] = q.doors[q.ans]; q.doors[q.ans] = t; q.ans = j;
      }
    }
    runWords = queue.map(g => g.word);
  }
  // 갈림길 i(0..L-1) 의 좌우 자리. 가운데가 0 이 되게 −1..1 로 편다
  function laneX(i) { return C.lanes === 1 ? 0 : (i / (C.lanes - 1) * 2 - 1) * 0.62; }
  // 가운데 선을 갈림길 수만큼 긋는다 — 길이 몇 갈래인지 미리 보여야 고를 수 있다
  // 적장 — 마지막으로 오른 탑의 등급 동물이 무리를 이끈다.
  // 이름 없는 빨간 무리보다 "곰 대장" 이 훨씬 무섭다
  function chiefOf() {
    const t = typeof lastTower === 'function' ? lastTower() : null;
    const L = t && typeof levelOf === 'function' ? levelOf(t.level) : null;
    return L && L.animal ? { emoji: L.emoji, name: L.name + ' 대장' } : { emoji: '👹', name: '적장' };
  }

  const SHOT = { color: '#ffe27a', glow: '#fff6d8', r: 3.2 };

  function brief() {
    const a = C;
    UI.modal(`
      <div class="modal-title">⚔️ 연병장</div>
      <div class="modal-sub">뜻에 맞는 <b>영어 단어가 적힌 문</b>으로 지나가요.<br>
        맞으면 부하가 <b>두 배</b>가 돼요 — <b>사람이 많아지면 총알도 많이 나가요.</b><br>
        문을 지날 때마다 적이 내려와요 — 못 막으면 병사를 잃어요!</div>
      <div class="ar-tip">화면을 <b>왼쪽 · 가운데 · 오른쪽</b> 눌러서 길을 골라요</div>
      <div class="modal-sub">끝에는 <b>${chief.emoji} ${esc(chief.name)}</b>의 무리 <b>${a.boss}명</b>.
        문 ${a.gates}개 중 <b>4개</b>만 맞히면 쓸어버릴 수 있어요.</div>
      <div class="actions"><button class="btn" data-close="go">⚔️ 출발!</button></div>`,
      { onClose: () => go() });
  }

  function go() { active = true; last = performance.now(); nextGate(); raf = requestAnimationFrame(loop); }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function nextGate() {
    if (gateIdx >= queue.length) { startWave(C.boss, true); return; }
    gate = Object.assign({ z: 1 }, queue[gateIdx]);
    setAsk(gate.word.m); phase = 'gate'; phaseT = 0;
  }

  function startWave(size, boss) {
    const out = waveOutcome(troops, size);
    wave = { size, boss: !!boss, kills: out.kills, loss: out.loss, killed: 0, applied: false };
    foes = [];
    const n = Math.min(C.drawMax, size);
    for (let i = 0; i < n; i++) {
      foes.push({ ox: (Math.random() - .5) * 1.7, z: 1 + Math.random() * 0.3, dead: 0, f: Math.random() * 6.3 });
    }
    phase = boss ? 'boss' : 'wave'; phaseT = 0;
    setAsk(boss ? chief.emoji + ' ' + chief.name + '!' : '막아라!', boss ? '마지막 싸움' : '적이 내려온다');
  }

  function setAsk(t, label) {
    const lb = $('ar-ask-label');
    if (lb) lb.textContent = label || '이 뜻의 문으로';
    const el = $('ar-ask');
    if (el) el.textContent = t;
    const c = $('ar-count');
    if (c) c.innerHTML = `<b>${troops}</b>명 · 💥 화력 ${firepower(troops)}`;
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
        <div class="ar-lanes">
          <button class="ar-side" data-side="0" aria-label="왼쪽 길"></button>
          <button class="ar-side" data-side="1" aria-label="가운데 길"></button>
          <button class="ar-side" data-side="2" aria-label="오른쪽 길"></button>
        </div>
      </div>
      <p class="hint-text">⚔️ 맞는 문으로! 사람이 많아지면 총알도 많이 나가요.</p>`;
    cv = $('ar-cv'); ctx = cv.getContext('2d');
    $('screen-army').querySelectorAll('.ar-side').forEach(b => {
      b.onclick = () => { lane = Number(b.dataset.side); };
    });
  }
  function resize() {
    if (!cv) return;
    const r = UI.fitCanvas(cv, { designW: 360, maxScale: 1.7, minH: 240, maxH: 500 });
    W = r.w; H = r.h;
  }

  // 원근 — z 는 0(발밑)부터 1(지평선)까지
  const HOR = 0.24;
  const LINE = 0.14;                 // 내 부대가 선 줄. 적이 여기 닿으면 병사를 잃는다
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
    laneS += (lane - laneS) * Math.min(1, dt * 10);
    if (hit > 0) hit -= dt;
    if (msgT > 0) msgT -= dt;
    if (phase === 'gate' && gate) {
      gate.z -= dt / C.approach;
      if (gate.z <= LINE) resolveGate();
    } else if (phase === 'wave' || phase === 'boss') {
      fight(dt);
    }
  }

  function resolveGate() {
    const ok = gate.ans === Math.round(laneS);
    recordResult(gate.word.towerId || (lastTower() || {}).id, gate.word, ok);
    troops = gateStep(troops, ok);
    if (ok) {
      Sfx.ok(); say('×2!', '#3ee0c4');
    } else {
      Sfx.bad(); hit = .5; say('부하가 줄었다', '#ff8090'); UI.shake($('ar-cv'));
    }
    gateIdx++; saveState();
    const ws = C.waves;
    startWave(ws[gateIdx - 1] !== undefined ? ws[gateIdx - 1] : ws[ws.length - 1]);
  }

  // 전투 — 총알이 나가고 적이 쓰러진다.
  // 결과는 이미 정해져 있고 **그림이 그 답을 따라간다**
  function fight(dt) {
    phaseT += dt;
    const dur = wave.boss ? C.bossTime : C.waveTime;
    // 총알 — 처치할 수만큼 나간다. 많이 맞혔으면 화면이 총알로 찬다
    const want = Math.floor(wave.kills * Math.min(1, phaseT / (dur * 0.68)));
    let guard = 0;
    while (wave.killed < want && guard++ < 12) {
      const alive = foes.filter(f => !f.dead);
      if (!alive.length) { wave.killed = want; break; }
      const target = alive.reduce((p, q) => q.z < p.z ? q : p);
      shots.push({ x0: laneX(laneS) + (Math.random() - .5) * .5, z0: LINE, tx: target.ox, tz: target.z, t: 0, f: target });
      wave.killed++;
    }
    shots.forEach(s => {
      s.t += dt / (s.spark ? C.shotTime * 1.6 : C.shotTime);
      if (!s.spark && s.t >= 1 && s.f && !s.f.dead) { s.f.dead = 0.35; puff(s.f); }
    });
    shots = shots.filter(s => s.t < 1.2);
    // 적이 내려온다
    foes.forEach(f => {
      if (f.dead > 0) { f.dead -= dt; return; }
      f.z = Math.max(LINE, f.z - dt / dur);
    });
    // 결산 — 못 막은 적이 줄에 닿으면 병사를 잃는다
    if (!wave.applied && phaseT > dur * 0.86) {
      wave.applied = true;
      if (wave.loss > 0) {
        troops = Math.max(C.min, troops - wave.loss);
        Sfx.bad(); hit = .45; say('−' + wave.loss + '명', '#ff8090');
      } else if (!wave.boss) say('막아냈다!', '#3ee0c4');
      setAsk(wave.boss ? chief.emoji + ' ' + chief.name + '!' : '막아라!', wave.boss ? '마지막 싸움' : '적이 내려온다');
    }
    if (phaseT > dur + 0.6) {
      if (wave.boss) { finish(); return; }
      foes = []; shots = []; nextGate();
    }
  }

  function puff(f) {
    for (let i = 0; i < 3; i++) {
      shots.push({ x0: f.ox, z0: f.z, tx: f.ox + (Math.random() - .5) * .35, tz: f.z + Math.random() * .05, t: 0, spark: true });
    }
  }
  function say(t, c) { msg = { t, c }; msgT = 1.1; }

  function finish() {
    stop();
    const power = firepower(troops);
    result = power >= C.boss ? 'win' : 'lose';
    setTimeout(() => result === 'win' ? won(power) : lost(power), 500);
  }

  // ---------- 그리기 ----------
  function draw() {
    ctx.save();
    if (hit > 0.3) ctx.translate((Math.random() - .5) * 5, (Math.random() - .5) * 5);
    sky(); road(); scenery();
    drawFoes();
    if (gate && phase === 'gate') drawGate(gate);
    drawShots();
    drawCrowd();
    if (msgT > 0) {
      ctx.globalAlpha = Math.min(1, msgT * 2);
      ctx.font = '800 26px "Jua", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(10,8,28,.7)';
      ctx.strokeText(msg.t, W / 2, H * 0.33); ctx.fillStyle = msg.c; ctx.fillText(msg.t, W / 2, H * 0.33);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function sky() {
    const g = ctx.createLinearGradient(0, 0, 0, HOR * H + 20);
    g.addColorStop(0, '#3f74c4'); g.addColorStop(1, '#a9cff0');
    ctx.fillStyle = g; ctx.fillRect(-4, -4, W + 8, HOR * H + 24);
    ctx.fillStyle = '#7f93c9';
    for (let i = -1; i < 5; i++) {
      const x = i * (W / 4) - (bg * 4) % (W / 4);
      ctx.beginPath();
      ctx.moveTo(x, HOR * H + 4); ctx.lineTo(x + W / 8, HOR * H - 26 - (i % 2) * 12);
      ctx.lineTo(x + W / 4, HOR * H + 4); ctx.closePath(); ctx.fill();
    }
  }
  function road() {
    ctx.fillStyle = '#6fb055';
    ctx.fillRect(-4, HOR * H, W + 8, H - HOR * H + 8);
    ctx.fillStyle = '#dfd0a4';
    ctx.beginPath();
    ctx.moveTo(pxz(-1.05, 0), pz(0) + 8); ctx.lineTo(pxz(1.05, 0), pz(0) + 8);
    ctx.lineTo(pxz(1.05, 1), pz(1)); ctx.lineTo(pxz(-1.05, 1), pz(1));
    ctx.closePath(); ctx.fill();
    for (let i = 0; i < 12; i++) {
      const z = ((i / 12) + (1 - (bg % 1))) % 1;
      const y = pz(z), h = Math.max(1, 5 * sz(z));
      ctx.fillStyle = 'rgba(150,120,70,.16)';
      ctx.fillRect(pxz(-1.05, z), y, pxz(1.05, z) - pxz(-1.05, z), h);
    }
    // 갈림길 사이마다 선을 긋는다 — 길이 몇 갈래인지 미리 보여야 고를 수 있다
    ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 2; ctx.setLineDash([8, 10]);
    for (let i = 1; i < C.lanes; i++) {
      const x = (laneX(i - 1) + laneX(i)) / 2;
      ctx.beginPath(); ctx.moveTo(pxz(x, 0), pz(0)); ctx.lineTo(pxz(x, 1), pz(1)); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  function scenery() {
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
    const z = Math.max(0, g.z), s = sz(z), y = pz(z), hgt = 76 * s;
    const sel = Math.round(laneS);
    for (let i = 0; i < C.lanes; i++) {
      const cx = pxz(laneX(i), z), w = W * 0.30 * s;
      ctx.fillStyle = i === sel ? '#ffd964' : '#e9dfc8';
      ctx.fillRect(cx - w / 2, y - hgt, w, hgt);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(cx - w / 2, y - hgt, w, 6 * s);
      ctx.strokeStyle = '#7a5636'; ctx.lineWidth = Math.max(1, 3 * s);
      ctx.strokeRect(cx - w / 2, y - hgt, w, hgt);
      // 긴 단어는 글씨가 줄어든다. 문이 좁아졌으니 처음부터 조금 작게 시작한다
      const fs = Math.max(8, 18 * s);
      ctx.font = `700 ${fs}px "Baloo 2", sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a2d1c';
      ctx.fillText(g.doors[i], cx, y - hgt / 2, w - 6 * s);
    }
  }

  // 무리가 커질수록 **넓게** 퍼진다. 80명이 20명과 같은 크기면 늘어난 보람이 없다
  function spread(n) { return 0.24 + 0.7 * Math.min(1, Math.log(Math.max(2, n)) / Math.log(80)); }

  function drawFoes() {
    if (!foes.length) return;
    const sp = spread(wave ? wave.size : 10);
    foes.slice().sort((a2, b2) => b2.z - a2.z).forEach(f => {
      if (f.dead > 0) {
        const s = sz(f.z) * (1 + (0.35 - f.dead) * 2);
        ctx.globalAlpha = Math.max(0, f.dead / 0.35);
        ctx.fillStyle = '#ffd0d6';
        ctx.beginPath(); ctx.arc(pxz(f.ox * sp, f.z), pz(f.z) - 12 * s, 9 * s, 0, 6.3); ctx.fill();
        ctx.globalAlpha = 1; return;
      }
      soldier(pxz(Math.max(-1, Math.min(1, f.ox * sp)), f.z), pz(f.z), sz(f.z), '#d9455a', '#8f2436', f.f + phaseT * 9);
    });
    if (wave.boss) drawChief();
    const left = Math.max(0, wave.size - wave.killed);
    if (left > 0) badge(pxz(0.55, 0.06), pz(0.06) - 118, left + '명', '#ff8090');
  }

  // 적장 — 무리 맨 앞에 크게. 이름 없는 빨간 무리보다 "곰 대장" 이 훨씬 무섭다
  function drawChief() {
    const alive = foes.filter(f => !f.dead);
    const z = alive.length ? alive.reduce((p, q) => q.z < p.z ? q : p).z : LINE;
    const s = sz(z) * 2.1, x = pxz(0, z), y = pz(z);
    soldier(x, y, s, '#8f2436', '#5a1420', phaseT * 7);
    ctx.font = Math.round(26 * s) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(chief.emoji, x, y - 34 * s);
    const fs = Math.max(10, 15 * sz(z) * 1.6);
    ctx.font = '800 ' + fs + 'px "Jua", sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,8,28,.75)';
    ctx.strokeText(chief.name, x, y - 56 * s);
    ctx.fillStyle = '#ff8090'; ctx.fillText(chief.name, x, y - 56 * s);
  }

  function drawShots() {
    shots.forEach(s => {
      const t = Math.min(1, s.t);
      const x = s.x0 + (s.tx - s.x0) * t, z = s.z0 + (s.tz - s.z0) * t;
      const r = (s.spark ? 2.2 : SHOT.r) * sz(z) * 1.7;
      ctx.fillStyle = s.spark ? '#fff6e0' : SHOT.color;
      ctx.beginPath(); ctx.arc(pxz(x, z), pz(z) - 16 * sz(z), r, 0, 6.3); ctx.fill();
      if (!s.spark) {                      // 꼬리 — 날아간다는 게 이걸로 읽힌다
        ctx.globalAlpha = .38;
        ctx.beginPath(); ctx.arc(pxz(x, z), pz(z) - 16 * sz(z) + 6 * sz(z), r * .7, 0, 6.3); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }

  function drawCrowd() {
    const look = (typeof Avatar !== 'undefined' && Avatar.OUTFIT_LOOK[state.player.outfit]) || { base: '#3fae6a', belt: '#8a5a2b' };
    const n = Math.min(C.drawMax, troops);
    const t = performance.now() / 1000;
    const sp = spread(troops), mid = phase === 'gate' ? laneX(laneS) : 0;
    crowd.slice(0, n).sort((a2, b2) => b2.oz - a2.oz).forEach(c => {
      const zz = 0.03 + c.oz * (0.07 + sp * 0.07);
      // 길 밖으로 나가면 안 보인다 — 갈림길 끝에 서면 무리가 반쯤 화면을 벗어났다
      const x = Math.max(-1, Math.min(1, mid + c.ox * sp));
      soldier(pxz(x, zz), pz(zz), sz(zz) * 0.9, look.base, look.belt, c.f + t * 9);
    });
    badge(pxz(phase === 'gate' ? mid : -0.55, 0.06), pz(0.06) - 118, troops + '명', '#3ee0c4');
  }

  // 부하 하나 — 머리·몸·다리 셋이면 사람으로 읽힌다. 작게 그리니 이걸로 충분하다
  function soldier(x, y, s, body, belt, f) {
    const hop = Math.abs(Math.sin(f)) * 3 * s;
    const h = 26 * s, top = y - h - hop;
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(x, y, 6 * s, 2.4 * s, 0, 0, 6.3); ctx.fill();
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
  function won(power) {
    const a = C;
    const gold = Math.round(a.gold.win + troops * a.gold.perTroop);
    addGold(gold);
    addExp(a.exp.win).forEach(lv => Game.pendingUps.push(lv));
    state.player.armyBest = Math.max(state.player.armyBest || 0, troops);
    state.player.armyClears = (state.player.armyClears || 0) + 1;
    saveState();
    Sfx.fanfare(); UI.confetti({ count: 140, colors: ['#ffc83d', '#3ee0c4', '#ffffff'] });
    UI.modal(`
      <div class="modal-title">⚔️ 돌파!</div>
      <div class="ar-big">${power} <span>vs</span> ${a.boss}</div>
      <div class="modal-sub">부하 <b>${troops}명</b>이 쏜 총알이<br>
        ${chief.emoji} <b>${esc(chief.name)}</b>의 무리 <b>${a.boss}명</b>을 쓸어버렸어요!</div>
      <div class="reward-row">💰 +${gold} · ⭐ +${a.exp.win}</div>
      <div class="dg-brief small">${wordList()}</div>
      <div class="actions">
        <button class="btn" data-close="again">⚔️ 한 번 더!</button>
        <button class="btn ghost" data-close="x">마을로</button>
      </div>`, { onClose: v => v === 'again' ? start() : Game.town(false) });
  }
  function lost(power) {
    const a = C;
    addGold(a.gold.lose);
    addExp(a.exp.lose).forEach(lv => Game.pendingUps.push(lv));
    saveState();
    Sfx.down();
    UI.modal(`
      <div class="modal-title">🛡️ 밀렸다!</div>
      <div class="ar-big lose">${power} <span>vs</span> ${a.boss}</div>
      <div class="modal-sub">${chief.emoji} <b>${esc(chief.name)}</b>의 무리는 <b>${a.boss}명</b>인데<br>
        화력이 <b>${power}</b>밖에 안 됐어요.<br>
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
    if (e.key === 'ArrowLeft' || e.key === 'a') { lane = Math.max(0, lane - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd') { lane = Math.min(C.lanes - 1, lane + 1); e.preventDefault(); }
  }
  window.addEventListener('keydown', key);
  window.addEventListener('resize', () => { if (UI.current() === 'army') resize(); });

  // 테스트에서 정답 쪽을 알아야 한 판을 끝까지 돌려 볼 수 있다
  function debug() { return { troops, power: firepower(troops), gateIdx, ans: gate && gate.ans, phase }; }

  return { start, stop, simulate, gateStep, firepower, waveOutcome, tier, cfg, debug };
})();
