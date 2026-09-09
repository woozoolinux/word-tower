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
      gateBase: a.gateBase * k, gateBonus: a.gateBonus * k, gateLose: a.gateLose * k,
      waves: a.waves.map(w => w * k), boss: a.boss * k,
      approach: Math.max(a.minApproach, a.approach - (k - 1) * a.tierRush),
      waveTime: a.waveTime, bossTime: a.bossTime, shotTime: a.shotTime,
      drawMax: a.drawMax, words: a.words, gold: a.gold, exp: a.exp,
    };
  }

  let cv, ctx, raf, last, active;
  let W = 360, H = 260;
  let troops, gateIdx, gate, aimX, x, phase, phaseT, pool, queue, hit;
  let bg, crowd, foes, shots, wave, result, runWords, msg, msgT, C, chief;
  let fireT = 0, fired = 0, sparks = [];
  let muzzles = [], bits = [], redT = 0, peak = 1;

  // ---------- 균형 ----------
  // 게이트는 **전부 곱하기**다. 맞으면 ×2, 틀리면 ×0.6.
  // +N/−N 을 섞으면 "몇 번째 문에서 틀렸나"로 결과가 달라져서 난이도를 못 박을 수 없다.
  //
  // 전투 손실은 **머릿수 상한**으로 막는다. 비율로 두면 병력이 적을 때
  // 배로 늘려도 그만큼 다시 잃어서 영영 못 올라온다 (죽음의 나선).
  // 문 하나가 부대에 더하는 수.
  //
  // 얻는 수(+6)와 잃는 수(−1)를 **따로** 둔다. 같게 두면 다섯 중 하나만 틀려도
  // 지는 판이 나온다 — 아이한테 너무 가혹하다.
  //
  // 조준 보너스는 **얻을 때만** 붙는다. 겨눠서 손해 보는 일은 없어야 한다.
  // 그리고 작다(+1) — 크게 두면 틀린 문을 잘 겨눈 아이가 맞는 문을 대충 지나간 아이를 이긴다.
  function gateAdd(ok, aim, c) {
    c = c || cfg();
    return ok ? c.gateBase + Math.round(c.gateBonus * Math.max(0, Math.min(1, aim))) : -c.gateLose;
  }
  function gateStep(n, ok, aim, c) {
    c = c || cfg();
    return Math.min(c.cap, Math.max(c.min, n + gateAdd(ok, aim, c)));
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
  // 문 다섯 개를 이렇게 지났을 때의 마지막 화력.
  // aim 은 문마다 얼마나 오래 겨눴는지(0~1). 테스트가 최선·최악을 다 돌려 본다
  function simulate(mask, lv, aim) {
    const c = cfg(lv);
    if (aim === undefined) aim = 0;
    let n = c.start;
    for (let i = 0; i < c.gates; i++) {
      const ok = typeof mask === 'number' ? !!(mask & (1 << i)) : i < mask;
      n = gateStep(n, ok, aim, c);
      n = n - waveOutcome(n, c.waves[i], c).loss;      // 전투에서는 0까지 간다
      if (n <= 0) return { troops: 0, power: 0, win: false, wiped: true, cfg: c };
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
    troops = C.start; gateIdx = 0; aimX = 0; x = 0;   // 가운데에서 출발
    hit = 0; result = null; bg = 0; foes = []; shots = []; sparks = []; wave = null; fireT = 0; fired = 0;
    muzzles = []; bits = []; redT = 0; peak = C.start;
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
  function doorX(i) { return C.lanes === 1 ? 0 : (i / (C.lanes - 1) * 2 - 1) * 0.62; }
  // 가운데 선을 갈림길 수만큼 긋는다 — 길이 몇 갈래인지 미리 보여야 고를 수 있다
  // 적장 — 마지막으로 오른 탑의 등급 동물이 무리를 이끈다.
  // 이름 없는 빨간 무리보다 "곰 대장" 이 훨씬 무섭다
  function chiefOf() {
    const t = typeof lastTower === 'function' ? lastTower() : null;
    const L = t && typeof levelOf === 'function' ? levelOf(t.level) : null;
    return L && L.animal ? { emoji: L.emoji, name: L.name + ' 대장' } : { emoji: '👹', name: '적장' };
  }

  const SHOT = { color: '#ffd633', glow: '#fff6b0', r: 4.6 };

  function brief() {
    const a = C;
    UI.modal(`
      <div class="modal-title">⚔️ 연병장</div>
      <div class="modal-sub">뜻에 맞는 <b>영어 단어가 적힌 문</b>으로 지나가요.<br>
        <b>겨누고 있으면 총알이 문에 박혀 그 문의 수가 커져요.</b><br>
        문을 지날 때마다 적이 내려와요 — 못 막으면 병사를 잃어요!</div>
      <div class="ar-tip">화면을 <b>끌어서</b> 부대를 옮겨요. 겨누고 있으면 그 문의 수가 커져요!</div>
      <div class="modal-sub">끝에는 <b>${chief.emoji} ${esc(chief.name)}</b>의 무리 <b>${a.boss}명</b>.
        문 ${a.gates}개 중 <b>4개</b>만 맞히면 쓸어버릴 수 있어요.</div>
      <div class="actions"><button class="btn" data-close="go">⚔️ 출발!</button></div>`,
      { onClose: () => go() });
  }

  function go() { active = true; last = performance.now(); nextGate(); raf = requestAnimationFrame(loop); }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function nextGate() {
    if (gateIdx >= queue.length) { startWave(C.boss, true); return; }
    gate = Object.assign({ z: GATE_Z, aim: [] }, queue[gateIdx]);
    for (let i = 0; i < C.lanes; i++) gate.aim[i] = 0;
    setAsk(gate.word.m); phase = 'gate'; phaseT = 0;
  }

  function startWave(size, boss) {
    const out = waveOutcome(troops, size);
    wave = { size, boss: !!boss, kills: out.kills, loss: out.loss, killed: 0, taken: 0, said: false };
    foes = [];
    const n = Math.min(C.drawMax, size);
    const per = size / Math.max(1, n);
    // 몇을 잡을지는 이미 정해져 있다. 그 수만큼을 **미리 골라 둔다** —
    // 총알이 몇 발 맞느냐로 승패가 갈리면 폰 성능에 따라 난이도가 달라진다
    const doomed = Math.round(out.kills / per);
    for (let i = 0; i < n; i++) {
      foes.push({
        ox: (Math.random() - .5) * 1.7, z: 1 + Math.random() * 0.3, f: Math.random() * 6.3,
        hp: A().foeHp, hpMax: A().foeHp, doomed: i < doomed, fall: 0, dead: false, atk: 0,
      });
    }
    wave.per = per;
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
      <div class="ar-wrap" id="ar-wrap"><canvas id="ar-cv"></canvas></div>
      <p class="hint-text">⚔️ 화면을 끌어서 맞는 문을 겨누세요. 오래 겨눌수록 많이 늘어나요!</p>`;
    cv = $('ar-cv'); ctx = cv.getContext('2d');
    bindDrag();
  }
  // 화면 어디를 끌어도 부대가 따라온다. 마을 조이스틱과 같은 감각
  function bindDrag() {
    const wrap = $('ar-wrap');
    let down = false;
    const at = e => {
      const r = wrap.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      aimX = Math.max(-1, Math.min(1, ((t.clientX - r.left) / r.width * 2 - 1) / 0.92));
    };
    const on = e => { down = true; at(e); e.preventDefault(); };
    const mv = e => { if (down) { at(e); e.preventDefault(); } };
    const up = () => { down = false; };
    wrap.addEventListener('touchstart', on, { passive: false });
    wrap.addEventListener('touchmove', mv, { passive: false });
    wrap.addEventListener('touchend', up); wrap.addEventListener('touchcancel', up);
    wrap.addEventListener('mousedown', on); wrap.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  }
  function resize() {
    if (!cv) return;
    const r = UI.fitCanvas(cv, { designW: 360, maxScale: 1.7, minH: 240, maxH: 500 });
    W = r.w; H = r.h;
  }

  // 원근 — z 는 0(발밑)부터 1(지평선)까지
  const HOR = 0.24;
  const LINE = 0.14;                 // 내 부대가 선 줄. 적이 여기 닿으면 병사를 잃는다
  const GATE_Z = 0.78;               // 문이 나타나는 거리 — 지평선에서 오면 글씨가 안 읽힌다
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
    shoot(dt);
    // 손가락을 따라 부드럽게 미끄러진다. 칸을 뛰면 겨눌 수가 없다
    x += (aimX - x) * Math.min(1, dt * 9);
    if (hit > 0) hit -= dt;
    if (msgT > 0) msgT -= dt;
    if (phase === 'gate' && gate) {
      gate.z -= dt * (GATE_Z - LINE) / C.approach;
      if (gate.z <= LINE) resolveGate();
    } else if (phase === 'wave' || phase === 'boss') {
      fight(dt);
    }
  }

  // 어느 문 아래에 서 있나 — 가장 가까운 문
  function doorAt(px2) {
    let best = 0, bd = 9;
    for (let i = 0; i < C.lanes; i++) { const d = Math.abs(px2 - doorX(i)); if (d < bd) { bd = d; best = i; } }
    return best;
  }
  function resolveGate() {
    const door = doorAt(x), ok = gate.ans === door;
    const aim = Math.max(0, Math.min(1, gate.aim[door] / C.approach));
    recordResult(gate.word.towerId || (lastTower() || {}).id, gate.word, ok);
    const add = gateAdd(ok, aim, C);
    troops = gateStep(troops, ok, aim, C);
    if (ok) { Sfx.ok(); say('+' + add + '명!', '#3ee0c4'); }
    else { Sfx.bad(); hit = .5; say(add + '명…', '#ff8090'); UI.shake($('ar-cv')); }
    gateIdx++; saveState();
    const ws = C.waves;
    startWave(ws[gateIdx - 1] !== undefined ? ws[gateIdx - 1] : ws[ws.length - 1]);
  }

  // 총알은 **늘 나간다.** 병사 수에 비례해서 나가니 사람이 많으면 화면이 총알로 찬다.
  // 앞으로 곧게 날아가고, 살아 있는 적을 지나가면 그 적이 쓰러진다.
  //
  // 처치 수만큼만 쏘게 했더니 적이 6명인 웨이브에선 총알이 6발뿐이라 보이지도 않았다.
  // 총알은 그림이고, 승패는 이미 정해진 숫자다 — 둘을 묶을 이유가 없다.
  function shoot(dt) {
    const a = A();
    fireT += dt;
    const shooters = Math.min(C.drawMax, troops);
    let want = Math.floor(fireT * (shooters / a.shotEvery)) - fired;
    if (want > 60) { fired += want - 60; want = 60; }     // 창을 다시 열었을 때 몰아 나오지 않게
    // 총알은 **쏘는 병사 자리**에서 나간다. 한 점에서 나오면 "내가 쏜다" 가 아니라
    // "어디선가 나온다" 가 된다. 다만 겨눌 수 있어야 하니 부대 한가운데 쪽에서 고른다
    const sp0 = spread(troops), mid0 = phase === 'gate' ? x : x;
    for (let i = 0; i < want && shots.length < a.maxShots; i++) {
      const c = crowd[(fired + i) % crowd.length];
      const bx = Math.max(-1, Math.min(1,
        x + (Math.random() - .5) * a.shotSpread + c.ox * sp0 * a.shotFrom));
      const bz = LINE - 0.06 + Math.random() * 0.03;      // 줄보다 **뒤에서** — 내 앞까지 온 적도 맞아야 한다
      shots.push({ x: bx, z: bz, v: 1 / a.shotTime });
      muzzles.push({ x: bx, z: bz + 0.02, t: 0 });
    }
    fired += want;
    muzzles.forEach(m => (m.t += dt * 11));
    muzzles = muzzles.filter(m => m.t < 1);
    bits.forEach(b => { b.t += dt * 2.6; b.x += b.vx * dt; b.z += b.vz * dt; });
    bits = bits.filter(b => b.t < 1);
    if (redT > 0) redT -= dt;
    // 문을 겨누고 있으면 그 문의 숫자가 오른다 — 총알이 박히는 게 보인다
    if (gate && phase === 'gate') {
      const d = doorAt(x);
      if (Math.abs(x - doorX(d)) < 0.34) gate.aim[d] = Math.min(C.approach, gate.aim[d] + dt);
      shots = shots.filter(s => {
        if (s.z < gate.z) return true;
        sparks.push({ x: s.x, z: gate.z, t: 0 });
        return false;                     // 문에 박히고 멈춘다
      });
    }
    sparks.forEach(s => (s.t += dt * 4));
    sparks = sparks.filter(s => s.t < 1);
    // 날아가고, 지나가는 적을 쓰러뜨린다
    const fsp = wave ? spread(wave.size) : 1;
    const per = wave && foes.length ? wave.size / foes.length : 1;
    shots.forEach(s => {
      const z0 = s.z;
      s.z += s.v * dt;
      if (!wave) return;
      for (let i = 0; i < foes.length; i++) {
        const f = foes[i];
        if (f.fall || f.dead || !f.doomed) continue;      // 죽을 적만 맞는다 (위 설명 참고)
        if (f.z <= a.range && f.z > z0 && f.z <= s.z && Math.abs(f.ox * fsp - s.x) < 0.19) {
          f.hp--; f.flash = 0.2; f.knock = 0.05; s.gone = true;
          for (let k = 0; k < 4; k++) {
            bits.push({ x: f.ox * fsp, z: f.z, vx: (Math.random() - .5) * .5, vz: .12 + Math.random() * .3, t: 0, c: '#ffd633' });
          }
          if (f.hp <= 0) {
            f.fall = 0.7; wave.killed = Math.min(wave.kills, wave.killed + per);
            hit = Math.max(hit, .18); Sfx.hit && Sfx.hit();
            for (let k = 0; k < 7; k++) {
              bits.push({ x: f.ox * fsp, z: f.z, vx: (Math.random() - .5) * .8, vz: .1 + Math.random() * .45, t: 0, c: '#ff8090' });
            }
          }
          break;
        }
      }
    });
    shots = shots.filter(s => !s.gone && s.z < 1.08);
  }

  // 전투 — 적이 내려오고, 못 막은 만큼 병사를 잃는다.
  // 결과는 이미 정해져 있고 **그림이 그 답을 따라간다**
  function fight(dt) {
    phaseT += dt;
    const dur = wave.boss ? C.bossTime : C.waveTime;
    const a2 = A();
    foes.forEach(f => {
      if (f.flash > 0) f.flash -= dt;
      if (f.knock > 0) { f.knock -= dt * 1.6; f.z = Math.min(1.1, f.z + dt * 0.22); }
      if (f.fall) { f.fall -= dt; if (f.fall <= 0) { f.fall = 0; f.dead = true; } return; }
      if (f.dead) return;
      if (f.z > LINE) { f.z = Math.max(LINE, f.z - dt / (dur * a2.foeSpeed)); return; }
      // 내 줄에 닿았다 — 때린다. 잃을 수는 이미 정해져 있고 그만큼만 데려간다
      f.atk += dt;
      if (f.atk >= a2.foeHitEvery) {
        f.atk = 0;
        if (wave.taken < wave.loss) {
          wave.taken++;
          troops = troops - 1;                    // 전투에서는 0까지 간다 — 전멸이 있어야 긴장이 산다
          hit = .55; redT = .38; Sfx.bad(); say('−1명', '#ff8090');
          for (let k = 0; k < 8; k++) {
            bits.push({ x: f.ox * spread(wave.size), z: LINE, vx: (Math.random() - .5) * .7, vz: -.05 - Math.random() * .2, t: 0, c: '#ff5a6e' });
          }
          if (troops <= 0) { troops = 0; wiped(); return; }
          setAsk(wave.boss ? chief.emoji + ' ' + chief.name + '!' : '막아라!', wave.boss ? '마지막 싸움' : '적이 내려온다');
        }
      }
    });
    // 다 막아냈으면 말해 준다 (한 명도 안 잃은 것은 칭찬할 만하다)
    if (!wave.said && wave.loss === 0 && !wave.boss && phaseT > dur * a2.foeSpeed + 0.3) {
      wave.said = true; say('막아냈다!', '#3ee0c4');
    }
    if (phaseT > dur + 1.3) {
      if (wave.boss) { finish(); return; }
      foes = []; shots = []; nextGate();
    }
  }

  function say(t, c) { msg = { t, c }; msgT = 1.1; }

  // 부대가 전부 쓰러졌다 — 그 자리에서 끝난다
  function wiped() {
    stop();
    setTimeout(() => lost(0, true), 700);
  }
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
    if (gate && phase === 'gate') { drawGate(gate); drawSparks(); drawAsk(gate); }
    drawShots();
    drawMuzzles();
    drawCrowd();
    drawBits();
    drawTroopBar();
    if (redT > 0) {
      const g = ctx.createRadialGradient(W / 2, H * .7, H * .2, W / 2, H * .7, W * .9);
      g.addColorStop(0, 'rgba(255,40,70,0)');
      g.addColorStop(1, 'rgba(255,40,70,' + (0.55 * (redT / .38)).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
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
      const dx2 = (doorX(i - 1) + doorX(i)) / 2;
      ctx.beginPath(); ctx.moveTo(pxz(dx2, 0), pz(0)); ctx.lineTo(pxz(dx2, 1), pz(1)); ctx.stroke();
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
    const z = Math.max(0, g.z), s = sz(z), y = pz(z), hgt = 88 * s;
    const sel = doorAt(x);
    for (let i = 0; i < C.lanes; i++) {
      const cx = pxz(doorX(i), z), w = W * 0.30 * s;
      ctx.fillStyle = i === sel ? '#ffd964' : '#e9dfc8';
      ctx.fillRect(cx - w / 2, y - hgt, w, hgt);
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(cx - w / 2, y - hgt, w, 6 * s);
      ctx.strokeStyle = '#7a5636'; ctx.lineWidth = Math.max(1, 3 * s);
      ctx.strokeRect(cx - w / 2, y - hgt, w, hgt);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // 단어
      const fsz = Math.max(9, 20 * s);
      ctx.font = `700 ${fsz}px "Baloo 2", sans-serif`;
      ctx.fillStyle = '#3a2d1c';
      ctx.fillText(g.doors[i], cx, y - hgt * 0.62, w - 8 * s);
      // 겨눈 만큼 차오르는 게이지.
      // 여기에 +6 / −2 를 적으면 **색만 보고 답을 안다** — 단어를 안 읽어도 된다.
      // 게이지는 정답인지 아닌지를 드러내지 않으면서 "겨누면 이득" 만 보여준다
      const gw = w - 16 * s, gh = Math.max(4, 9 * s), gy = y - hgt * 0.26;
      ctx.fillStyle = 'rgba(90,72,40,.28)';
      ctx.fillRect(cx - gw / 2, gy, gw, gh);
      const fill = Math.max(0, Math.min(1, g.aim[i] / C.approach));
      if (fill > 0) {
        ctx.fillStyle = '#ffb02e';
        ctx.fillRect(cx - gw / 2, gy, gw * fill, gh);
      }
      ctx.strokeStyle = 'rgba(90,72,40,.45)'; ctx.lineWidth = Math.max(1, 1.5 * s);
      ctx.strokeRect(cx - gw / 2, gy, gw, gh);
    }
  }
  // 뜻 — 문 바로 위에 크게. HUD 맨 위에만 있으면 눈이 위아래로 왔다 갔다 한다
  function drawAsk(g) {
    const t = g.word.m;
    ctx.font = '800 24px "Jua", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const w = Math.min(W - 24, ctx.measureText(t).width + 34), y = H * 0.13;
    ctx.fillStyle = 'rgba(10,8,28,.78)';
    ctx.beginPath(); ctx.roundRect(W / 2 - w / 2, y - 21, w, 42, 21); ctx.fill();
    ctx.fillStyle = '#ffd964';
    ctx.fillText(t, W / 2, y + 1, w - 20);
  }

  // 총구 섬광 — 쏜 자리에서 아주 짧게 번쩍. 이게 있어야 **내가 쏘는 것**이 된다
  function drawMuzzles() {
    muzzles.forEach(m => {
      const s0 = sz(m.z), r = (7 - m.t * 5) * s0 * 1.8;
      if (r <= 0) return;
      ctx.globalAlpha = 1 - m.t;
      ctx.fillStyle = '#fff6c0';
      ctx.beginPath(); ctx.arc(pxz(m.x, m.z), pz(m.z) - 17 * s0, r, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  // 파편 — 맞은 자리에서 튄다. 부딪혔다는 걸 알려주는 가장 싼 방법
  function drawBits() {
    bits.forEach(b => {
      const s0 = sz(b.z);
      ctx.globalAlpha = Math.max(0, 1 - b.t);
      ctx.fillStyle = b.c;
      const r = 3.4 * s0 * 1.6 * (1 - b.t * .5);
      ctx.beginPath(); ctx.arc(pxz(b.x, b.z), pz(b.z) - 20 * s0 - b.t * 14 * s0, r, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }
  // 내 부대 막대 — 숫자만 바뀌면 깎이는 게 안 느껴진다. **줄어드는 막대**가 보여야 한다
  function drawTroopBar() {
    peak = Math.max(peak, troops);
    const w = W * 0.44, h = 12, bx = W / 2 - w / 2, by = H - 16;
    ctx.fillStyle = 'rgba(10,8,28,.55)';
    ctx.beginPath(); ctx.roundRect(bx, by, w, h, 6); ctx.fill();
    const k = Math.max(0, Math.min(1, troops / Math.max(1, peak)));
    ctx.fillStyle = k > .35 ? '#3ee0c4' : '#ff8090';
    ctx.beginPath(); ctx.roundRect(bx, by, Math.max(4, w * k), h, 6); ctx.fill();
  }

  // 총알이 문에 박히는 자리
  function drawSparks() {
    sparks.forEach(s => {
      const s0 = sz(s.z);
      ctx.globalAlpha = 1 - s.t;
      ctx.fillStyle = SHOT.glow;
      ctx.beginPath(); ctx.arc(pxz(s.x, s.z), pz(s.z) - 46 * s0, (2 + s.t * 5) * s0 * 1.5, 0, 6.3); ctx.fill();
      ctx.globalAlpha = 1;
    });
  }

  // 무리가 커질수록 **넓게** 퍼진다. 80명이 20명과 같은 크기면 늘어난 보람이 없다
  function spread(n) { return 0.24 + 0.7 * Math.min(1, Math.log(Math.max(2, n)) / Math.log(80)); }

  function drawFoes() {
    if (!foes.length) return;
    const sp = spread(wave ? wave.size : 10);
    foes.slice().sort((a2, b2) => b2.z - a2.z).forEach(f => {
      if (f.dead) return;
      const x = pxz(Math.max(-1, Math.min(1, f.ox * sp)), f.z), y = pz(f.z), s = sz(f.z);
      if (f.fall) {
        // 맞으면 **쓰러진다.** 옆으로 넘어가며 사라진다 — 그래야 맞은 게 보인다
        const k = 1 - f.fall / 0.7;
        ctx.save(); ctx.translate(x, y); ctx.rotate(k * Math.PI / 2 * 1.05);
        ctx.globalAlpha = Math.max(0, 1 - k * 0.9);
        soldier(0, 0, s, '#d9455a', '#8f2436', 0);
        ctx.globalAlpha = 1; ctx.restore();
        // 맞은 자리에서 튀는 빛
        if (k < 0.4) {
          ctx.globalAlpha = 1 - k / 0.4;
          ctx.fillStyle = SHOT.glow;
          ctx.beginPath(); ctx.arc(x, y - 16 * s, 11 * s * (1 + k * 2), 0, 6.3); ctx.fill();
          ctx.globalAlpha = 1;
        }
        return;
      }
      soldier(x, y, s, f.flash > 0 ? '#ffd0d6' : '#d9455a', '#8f2436', f.f + phaseT * 9);
      const bw = 18 * s, bh = Math.max(2.5, 4 * s), by = y - 36 * s;
      ctx.fillStyle = 'rgba(10,8,28,.65)'; ctx.fillRect(x - bw / 2, by, bw, bh);
      ctx.fillStyle = f.hp > f.hpMax / 2 ? '#ff5a6e' : '#ffb02e';
      ctx.fillRect(x - bw / 2, by, bw * Math.max(0, f.hp / f.hpMax), bh);
    });
    if (wave.boss) drawChief();
    const left = Math.max(0, Math.round(wave.size - wave.killed));
    if (left > 0) badge(W * 0.83, H - 22, left + '명', '#ff8090');
  }

  // 적장 — 무리 맨 앞에 크게. 이름 없는 빨간 무리보다 "곰 대장" 이 훨씬 무섭다
  function drawChief() {
    const alive = foes.filter(f => !f.dead && !f.fall);
    const z = alive.length ? alive.reduce((p, q) => q.z < p.z ? q : p).z : LINE;
    const s = sz(z) * 2.1, x = pxz(0, z), y = pz(z);
    soldier(x, y, s, '#8f2436', '#5a1420', phaseT * 7);
    ctx.font = Math.round(26 * s) + 'px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(chief.emoji, x, y - 34 * s);
    const fs = Math.max(10, 15 * sz(z) * 1.6);
    ctx.font = '800 ' + fs + 'px "Jua", sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(10,8,28,.75)';
    ctx.strokeText(chief.name, x, y - 78 * s);
    ctx.fillStyle = '#ff8090'; ctx.fillText(chief.name, x, y - 78 * s);
  }

  // 총알 — 노란 빛덩이가 앞으로 곧게 날아간다. 꼬리가 있어야 날아가는 것으로 읽힌다
  function drawShots() {
    shots.forEach(s => {
      const s0 = sz(s.z), x = pxz(s.x, s.z), y = pz(s.z) - 17 * s0;
      const r = SHOT.r * s0 * 1.7;
      const tz = Math.max(0, s.z - 0.05), ty = pz(tz) - 17 * sz(tz);
      ctx.strokeStyle = SHOT.color; ctx.globalAlpha = .45;
      ctx.lineWidth = r * 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pxz(s.x, tz), ty); ctx.lineTo(x, y); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = SHOT.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
      ctx.fillStyle = SHOT.glow;
      ctx.beginPath(); ctx.arc(x, y, r * .5, 0, 6.3); ctx.fill();
    });
  }

  function drawCrowd() {
    const look = (typeof Avatar !== 'undefined' && Avatar.OUTFIT_LOOK[state.player.outfit]) || { base: '#3fae6a', belt: '#8a5a2b' };
    const n = Math.min(C.drawMax, troops);
    const t = performance.now() / 1000;
    const sp = spread(troops), mid = x;
    // 코앞에 적이 있으면 **내 병사도 맞받아친다** — 앞으로 몸을 내밀었다 돌아온다
    const melee = foes.some(f => !f.dead && !f.fall && f.z <= LINE + 0.02);
    crowd.slice(0, n).sort((a2, b2) => b2.oz - a2.oz).forEach(c => {
      const lunge = melee ? Math.max(0, Math.sin(t * 11 + c.f)) * 0.045 : 0;
      const zz = 0.03 + c.oz * (0.07 + sp * 0.07) + lunge;
      // 길 밖으로 나가면 안 보인다 — 갈림길 끝에 서면 무리가 반쯤 화면을 벗어났다
      const x = Math.max(-1, Math.min(1, mid + c.ox * sp));
      soldier(pxz(x, zz), pz(zz), sz(zz) * 0.9, look.base, look.belt, c.f + t * 9);
    });
    // 배지가 부대를 따라다니면 문 위로 올라가 단어를 가린다 — 왼쪽 아래에 고정한다
    badge(W * 0.17, H - 22, troops + '명', '#3ee0c4');
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

  // x·y 는 캔버스 좌표 그대로다 (원근 밖에 고정해 두는 것이 목적이라)
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
  function lost(power, wipe) {
    const a = C;
    addGold(a.gold.lose);
    addExp(a.exp.lose).forEach(lv => Game.pendingUps.push(lv));
    saveState();
    Sfx.down();
    UI.modal(`
      <div class="modal-title">${wipe ? '💀 전멸했다!' : '🛡️ 밀렸다!'}</div>
      <div class="ar-big lose">${wipe ? '0' : power} <span>vs</span> ${wipe ? '적' : a.boss}</div>
      <div class="modal-sub">${wipe
        ? '적이 부대를 전부 쓰러뜨렸어요.<br>맞는 문으로 가야 부하가 늘어나요!'
        : chief.emoji + ' <b>' + esc(chief.name) + '</b>의 무리는 <b>' + a.boss + '명</b>인데<br>화력이 <b>' + power + '</b>밖에 안 됐어요.'}<br>
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
    if (e.key === 'ArrowLeft' || e.key === 'a') { aimX = Math.max(-1, aimX - 0.34); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd') { aimX = Math.min(1, aimX + 0.34); e.preventDefault(); }
  }
  window.addEventListener('keydown', key);
  window.addEventListener('resize', () => { if (UI.current() === 'army') resize(); });

  // 테스트에서 정답 쪽을 알아야 한 판을 끝까지 돌려 볼 수 있다
  function debug() { return { troops, power: firepower(troops), gateIdx, ans: gate && gate.ans, phase, x, aimX }; }
  function aimTo(i) { aimX = doorX(i); }

  return { start, stop, simulate, gateStep, gateAdd, firepower, waveOutcome, tier, cfg, debug, aimTo };
})();
