'use strict';
// ⛰️ 하늘섬 — 구름을 밟고 정상까지
//
// 왜 또 만드나: 지금 게임엔 **잘한 걸 즉시 갚아주는 가속**이 없다.
// 던전은 8칸을 다 맞혀도 8칸이고, 배틀은 빨리 맞혀도 한 대다.
// 하늘섬은 연쇄가 곧 높이다 — 3연속이면 바람을 타고 두 칸을 오른다.
//
// 규칙이 네 줄로 끝난다:
//   맞는 구름을 밟는다 → 고도 +1 (바람이면 +2)
//   틀리면 고도 −1. 발밑 구름이 다 옅어져도 −1
//   6칸마다 🏝️ 섬 — 그 아래로는 안 떨어진다. 섬에서 또 틀리면 섬이 무너져 추락
//   24칸이 정상
//
// 시간은 게이지가 아니라 **발밑 구름**이다. 서 있을수록 옅어진다.
// 던전은 낭떠러지가 옆에서 오고, 여기는 발밑이 사라진다 — 같은 원리, 다른 감각.
const SkyIsland = (() => {
  const D = () => BAL.sky;

  // ---------- 인트로 ----------
  // 던전 프롤로그와 같은 방식: 지연은 CSS가 아니라 이 표에서 준다.
  const FULL = { look: 0, c1: .5, step: 1.6, c2: 2.0, foot: 3.0, c3: 3.3, go: 3.8 };
  const SHORT = { look: -9, c1: -9, step: 0, c2: -9, foot: .5, c3: .7, go: 1.1 };

  function intro(done) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = !!state.player.skySeen;
    const T = seen ? SHORT : FULL;
    state.player.skySeen = true; saveState();

    const root = document.createElement('div');
    root.className = 'sk-scene' + (reduce ? ' rush' : '');
    root.innerHTML = `
      <div class="sk-far"><i></i><i></i><i></i><i></i></div>
      <div class="sk-stair"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="sk-first"></div>
      <div class="sk-hero">${UI.charHtml(84)}</div>
      <div class="sk-caps">
        <div class="sk-cap c1">저 위엔… 뭐가 있을까?</div>
        <div class="sk-cap c2">바람이 구름 하나를 발 앞에 내려놓았다</div>
        <div class="sk-cap c3 big">올라가자!</div>
      </div>
      <button class="btn coral sk-go">☁️ 첫 구름을 밟는다</button>`;
    document.getElementById('modal-root').appendChild(root);

    const put = (sel, tt) => root.querySelectorAll(sel).forEach(el => {
      if (tt < 0) { el.style.display = 'none'; return; }
      el.style.animationDelay = tt + 's';
    });
    put('.sk-hero', T.look); put('.sk-cap.c1', T.c1); put('.sk-first', T.step);
    put('.sk-cap.c2', T.c2); put('.sk-cap.c3', T.c3); put('.sk-go', T.go);
    // 계단은 한 칸씩 차례로 — 지연을 자식마다 따로 준다 (부모에 주면 안 먹는다)
    root.querySelectorAll('.sk-stair i').forEach((el, i) => {
      if (T.foot < 0) { el.style.display = 'none'; return; }
      el.style.animationDelay = (T.foot + i * .13).toFixed(2) + 's';
    });

    const timers = [];
    const at = (tt, fn) => { if (!reduce && tt >= 0) timers.push(setTimeout(fn, tt * 1000)); };
    at(T.step, () => Sfx.door());
    at(T.foot, () => Sfx.ok());

    const finish = () => {
      timers.splice(0).forEach(clearTimeout);
      root.classList.add('out');
      setTimeout(() => { root.remove(); done(); }, 300);
    };
    root.addEventListener('click', e => {
      if (e.target.closest('.sk-go')) { finish(); return; }
      if (root.classList.contains('rush')) return;
      root.classList.add('rush');
      timers.splice(0).forEach(clearTimeout);
    });
  }

  // ---------- 후보 단어: ★이 높은 것부터 ----------
  // 던전은 오답노트(★ 낮은 순)다. 하늘섬은 반대 — **아는 걸 자랑하는 무대**다.
  // Lv20에 카드 60장이면 이미 여러 타워를 돌았을 시점이라, 타워를 가로질러 뽑는다.
  function candidates() {
    const all = [];
    (window.TOWERS || []).forEach(t => allWords(t).forEach(w => {
      const s = statFor(t.id, w);
      if (s.seen > 0) all.push({ w, score: s.stars * 10 - Math.min(9, s.wrong) });
    }));
    all.sort((a, b) => b.score - a.score);
    const top = all.slice(0, D().words).map(x => x.w);
    return top.length >= 4 ? top : all.map(x => x.w);
  }

  // ---------- 오르기 ----------
  const HGT = 320, KY = 178, STEP = 44;
  const JUMP = .46, DROP = .5;
  let cv, ctx, raf, last, active;
  let pool, queue, qi, runWords, q, lock;
  let alt, maxAlt, floorAlt, combo, wind, misses, gold;
  let phase, ph, t, camAlt, jumpFrom, jumpTo, placedWord, msg, shakeT, puffs, drift, pimg, streamer;

  function width() { return cv.width / (window.devicePixelRatio || 1); }
  // 높이 오를수록 발밑이 빨리 옅어진다. 그래도 던전보다 훨씬 여유롭다 —
  // 하늘섬의 압박은 시간이 아니라 **되돌릴 수 없는 고도**여야 한다.
  function limitNow() { return Math.max(D().timeMin, D().timeLimit - alt * D().timeStep); }
  function cloudX(a) { return width() / 2 + Math.sin(a * .9) * Math.min(46, width() * .13); }
  function cloudY(a) { return KY - (a - camAlt) * STEP; }
  function isIsland(a) { return a > 0 && a % D().safeEvery === 0 && a < D().height; }

  function start() {
    pool = candidates();
    if (pool.length < 4) { UI.toast('타워에서 단어를 조금 더 만난 뒤에 올 수 있어요', 'bad'); return; }
    intro(() => reset(() => brief(() => go())));
  }
  function reset(cb) {
    alt = 0; maxAlt = 0; floorAlt = 0; combo = 0; wind = false; misses = 0; gold = 0;
    camAlt = 0; puffs = []; drift = 0; msg = null; shakeT = 0; streamer = [];
    queue = []; qi = 0; runWords = []; placedWord = null;
    jumpFrom = 0; jumpTo = 0; phase = 'stand'; ph = 0; t = 0;
    pimg = Avatar.image();
    cb();
  }
  function go() {
    UI.show('sky');
    shell();
    nextWord();
    active = true; last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function run() { reset(() => brief(() => go())); }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function shell() {
    document.getElementById('screen-sky').innerHTML = `
      <div class="sk-hud panel">
        <div class="sk-ask"><span class="sk-ask-label">이 뜻의 구름을 밟아라</span>
          <b class="sk-ask-word" id="sk-word">…</b></div>
      </div>
      <div class="sk-canvas-wrap"><canvas id="sk-cv"></canvas>
        <div class="sk-alt" id="sk-alt"></div>
        <div class="sk-combo" id="sk-combo"></div></div>
      <div class="sk-clouds" id="sk-clouds"></div>`;
    cv = document.getElementById('sk-cv'); ctx = cv.getContext('2d');
    resize();
    document.getElementById('sk-clouds').onclick = e => {
      const b = e.target.closest('[data-pick]');
      if (b) pick(b, b.dataset.pick);
    };
  }
  function resize() {
    if (!cv) return;
    const w = cv.parentElement.clientWidth || 320, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = HGT * dpr; cv.style.height = HGT + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // 한 판의 단어 줄 세우기 — 던전과 같은 규칙. 반복이 외우게 한다.
  function buildQueue() {
    const n = Math.min(D().wordsPerRun, pool.length);
    const picks = shuffle(pool.slice(0, Math.max(n * 2, n))).slice(0, n);
    const times = Math.max(2, Math.ceil(D().height / n) + 1);
    let line = [];
    for (let i = 0; i < times; i++) line = line.concat(shuffle(picks.slice()));
    for (let i = 1; i < line.length; i++) {              // 연달아 같은 단어 방지
      if (wkey(line[i]) === wkey(line[i - 1])) {
        const j = line.findIndex((w, k) => k > i && wkey(w) !== wkey(line[i - 1]));
        if (j > 0) { const tmp = line[i]; line[i] = line[j]; line[j] = tmp; }
      }
    }
    queue = line; qi = 0; runWords = picks;
  }
  function brief(done) {
    buildQueue();
    if (!state.settings.preview) { done(); return; }
    const rows = runWords.map(w => `<div class="dg-brief-row">
      <b>${esc(w.w)}</b><span>${esc(w.m)}</span></div>`).join('');
    UI.modal(`
      <div class="modal-title">☁️ 이 구름들을 밟고 오른다</div>
      <div class="modal-sub">뜻이 뜨면 그 구름을 밟아라<br>
        <b>${D().comboFor}번 연속</b>이면 바람을 타고 <b>두 칸</b>!</div>
      <div class="dg-brief">${rows}</div>
      <div class="actions"><button class="btn coral" data-close="go">🪂 출발!</button></div>`,
      { onClose: done });
  }

  function nextWord() {
    if (alt >= D().height) { phase = 'summit'; ph = 0; lock = true; return; }
    if (!queue.length) buildQueue();
    const word = queue[qi % queue.length]; qi++;
    q = makeQuestion(word, pool, 'm2w');
    lock = false; phase = 'stand'; t = 0; ph = 0;
    document.getElementById('sk-word').textContent = q.prompt;
    hud();
    document.getElementById('sk-clouds').innerHTML = q.choices
      .map(c => `<button class="sk-cloud" data-pick="${esc(c)}">${esc(c)}</button>`).join('');
  }
  function hud() {
    const a = document.getElementById('sk-alt'), c = document.getElementById('sk-combo');
    if (a) a.textContent = `${alt} / ${D().height}칸`;
    if (c) {
      c.textContent = wind ? '🌬️ 바람! 다음은 두 칸' : combo ? '🔥'.repeat(combo) : '';
      c.classList.toggle('on', !!(wind || combo));
    }
  }

  function pick(btn, val) {
    if (lock || phase !== 'stand') return;
    lock = true;
    const good = val === q.answer;
    recordResult(q.word.towerId, q.word, good, false);
    document.querySelectorAll('[data-pick]').forEach(b => {
      if (b.dataset.pick === q.answer) b.classList.add('safe');
      else if (b === btn) b.classList.add('gone');
      b.disabled = true;
    });
    if (good) { Sfx.ok(); rise(); } else { Sfx.bad(); down(); }
  }
  // 맞히면 고른 단어가 새겨진 구름이 생기고 그 위로 뛴다.
  function rise() {
    const up = wind ? 2 : 1;
    combo++; placedWord = q.answer;
    jumpFrom = alt; jumpTo = Math.min(D().height, alt + up);
    alt = jumpTo;
    if (alt > maxAlt) {                       // 새로 오른 칸만 값을 쳐준다 (오르내리며 파밍 금지)
      const won = (alt - maxAlt) * D().gold.perStep;
      gold += won; addGold(won); maxAlt = alt;
    }
    floorAlt = Math.floor(alt / D().safeEvery) * D().safeEvery;   // 바람으로 건너뛰어도 안 놓친다
    const wasWind = wind;
    wind = combo >= D().comboFor;
    if (wind && !wasWind) msg = { t: '🌬️ 바람을 탔다! 다음은 두 칸!', cls: 'good' };
    else if (wasWind) msg = { t: `"${q.answer}" 를 밟고 두 칸!`, cls: 'good' };
    else msg = { t: `"${q.answer}" 를 밟았다!`, cls: 'good' };
    if (wind) combo = D().comboFor;           // 바람은 끊기지만 않으면 이어진다
    phase = 'jump'; ph = 0;
    hud();
  }
  function down() {
    if (q && q.word) queue.push(q.word);      // 틀린 단어는 이 판이 끝나기 전에 한 번 더
    combo = 0; wind = false; misses++; placedWord = null;
    document.querySelectorAll('[data-pick]').forEach(b => {
      if (b.dataset.pick === q.answer) b.classList.add('safe');
      b.disabled = true;
    });
    shakeT = .4;
    if (alt > floorAlt) {
      msg = { t: `"${q.answer}" 였어! 한 칸 아래로…`, cls: 'bad' };
      phase = 'drop'; ph = 0; jumpFrom = alt; jumpTo = alt - 1; alt = jumpTo;
    } else if (floorAlt <= 0) {
      // 땅은 안 무너진다. 첫 구간이 연습이 되는 이유 — 규칙을 배우다 죽지 않는다.
      msg = { t: `"${q.answer}" 였어! 땅이라 안 떨어졌다`, cls: 'bad' };
      phase = 'shake'; ph = 0;
    } else {
      msg = { t: '섬이 무너진다!', cls: 'bad' };
      phase = 'crash'; ph = 0; Sfx.down();
    }
    hud();
  }

  // ---------- 진행 ----------
  function loop(now) {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function update(dt) {
    drift += dt;
    if (shakeT > 0) shakeT -= dt;
    camAlt += (alt - camAlt) * Math.min(1, dt * 7);
    puffs = puffs.filter(p => (p.life -= dt) > 0);
    puffs.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; });
    if (wind && Math.random() < dt * 22) streamer.push({ x: (Math.random() - .5) * 130, y: HGT * .8, life: 1 });
    streamer = streamer.filter(s => (s.life -= dt * .9) > 0);
    streamer.forEach(s => { s.y -= 160 * dt; });

    if (phase === 'stand') {
      t += dt / limitNow();
      if (t >= 1 && !lock) { lock = true; fade(); }
    } else if (phase === 'jump') {
      const was = ph; ph += dt;
      if (was < JUMP * .55 && ph >= JUMP * .55) { Sfx.step(); puff(cloudX(alt), cloudY(alt) + 8, 12); }
      if (ph > JUMP) { if (alt >= D().height) { phase = 'summit'; ph = 0; lock = true; } else nextWord(); }
    } else if (phase === 'drop') {
      ph += dt;
      if (ph > DROP) nextWord();
    } else if (phase === 'shake') {
      ph += dt;
      if (ph > .7) nextWord();
    } else if (phase === 'crash') {
      ph += dt;
      if (ph > 1.5) { stop(); fell(); }
    } else if (phase === 'summit') {
      ph += dt;
      if (ph > 1.2) { stop(); summit(); }
    }
  }
  // 발밑 구름이 다 옅어졌다 = 틀린 것과 같다. 시간이 벌이 아니라 압박이어야 한다.
  function fade() {
    recordResult(q.word.towerId, q.word, false, false);
    Sfx.bad(); down();
    if (msg) msg.t = '발밑 구름이 사라졌다!';
  }
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) puffs.push({ x, y, vx: (Math.random() - .5) * 130, vy: -20 - Math.random() * 50, r: 3 + Math.random() * 6, life: .35 + Math.random() * .3 });
  }

  // ---------- 그리기 ----------
  function draw() {
    const W = width();
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - .5) * 6, (Math.random() - .5) * 6);
    // 하늘: 높이 오를수록 파랑이 짙어진다 — 숫자를 안 봐도 높이가 느껴진다
    const deep = Math.min(1, camAlt / D().height);
    const g = ctx.createLinearGradient(0, 0, 0, HGT);
    g.addColorStop(0, mix('#8ecdf5', '#2f6fc7', deep));
    g.addColorStop(.55, mix('#c8e8fb', '#6aa8e6', deep));
    g.addColorStop(1, mix('#eaf6ff', '#a9d0f2', deep));
    ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, HGT + 20);
    farClouds(W);
    if (wind) drawStreamers(W);

    // 구름 기둥: 화면에 걸리는 칸만 그린다
    const lo = Math.floor(camAlt) - 5, hi = Math.ceil(camAlt) + 6;
    for (let a = Math.max(0, lo); a <= Math.min(D().height, hi); a++) {
      if (a > alt && !(phase === 'jump' && a <= jumpTo)) ghost(a);
      else rung(a);
    }
    drawKid();
    puffs.forEach(p => {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.4));
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.3); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (msg) {
      ctx.font = 'bold 17px "Jua", sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(20,40,70,.55)';
      ctx.strokeText(msg.t, W / 2, 54);
      ctx.fillStyle = msg.cls === 'good' ? '#fff6c0' : '#ffd0d8';
      ctx.fillText(msg.t, W / 2, 54);
    }
    ctx.restore();
  }
  function mix(a, b, k) {
    const parse = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const A = parse(a), B = parse(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
  }
  function farClouds(W) {
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    for (let i = 0; i < 6; i++) {
      const y = ((i * 71 + camAlt * STEP * .35 + drift * 4) % (HGT + 90)) - 45;
      const x = ((i * 137 + drift * (7 + i * 3)) % (W + 180)) - 90;
      const s = .5 + (i % 3) * .35;
      blob(x, y, 44 * s, 15 * s);
    }
  }
  function drawStreamers(W) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    streamer.forEach(s => {
      ctx.globalAlpha = Math.max(0, s.life) * .8;
      ctx.beginPath(); ctx.moveTo(W / 2 + s.x, s.y); ctx.lineTo(W / 2 + s.x, s.y + 22); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  function blob(x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, 6.3);
    ctx.ellipse(x - rx * .55, y + ry * .2, rx * .55, ry * .75, 0, 0, 6.3);
    ctx.ellipse(x + rx * .55, y + ry * .25, rx * .5, ry * .7, 0, 0, 6.3);
    ctx.fill();
  }
  // 아직 안 밟은 칸 — 어렴풋한 자리만
  function ghost(a) {
    const y = cloudY(a);
    if (y < -40 || y > HGT + 40) return;
    ctx.globalAlpha = .45; ctx.fillStyle = '#ffffff';
    blob(cloudX(a), y + 8, 26, 8);
    ctx.globalAlpha = 1;
  }
  function rung(a) {
    const x = cloudX(a), y = cloudY(a);
    if (y < -70 || y > HGT + 70) return;
    if (a === D().height) { summitIsland(x, y); return; }
    if (a === 0) { ground(x, y); return; }
    if (isIsland(a)) { island(x, y, a <= floorAlt); return; }
    // 지금 서 있는 구름은 시간이 갈수록 옅어진다 — 이게 이 게임의 시계다
    let al = 1, sc = 1;
    if (a === alt && phase === 'stand') { al = 1 - t * .72; sc = 1 - t * .3; }
    ctx.globalAlpha = al;
    ctx.fillStyle = '#ffffff';
    blob(x, y + 8, 36 * sc, 12 * sc);
    ctx.fillStyle = 'rgba(150,190,230,.5)';
    ctx.beginPath(); ctx.ellipse(x, y + 15 * sc, 30 * sc, 5 * sc, 0, 0, 6.3); ctx.fill();
    // 내가 고른 단어가 방금 놓인 구름에 새겨진다
    if (placedWord && a === jumpTo && (phase === 'jump' || phase === 'stand')) {
      ctx.font = 'bold 15px "Fredoka", "Jua", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.strokeText(placedWord, x, y + 9);
      ctx.fillStyle = '#3f7bbf'; ctx.fillText(placedWord, x, y + 9);
    }
    ctx.globalAlpha = 1;
  }
  function ground(x, y) {
    const W = width();
    ctx.fillStyle = '#7ab85f'; ctx.fillRect(-10, y + 4, W + 20, HGT);
    ctx.fillStyle = '#a9d47f'; ctx.fillRect(-10, y + 4, W + 20, 9);
    ctx.fillStyle = 'rgba(60,120,50,.25)';
    for (let i = -1; i < W / 18 + 1; i++) ctx.fillRect(i * 18 + (x % 18), y + 13, 3, 6);
  }
  function island(x, y, reached) {
    ctx.fillStyle = '#8a6a44';
    ctx.beginPath(); ctx.moveTo(x - 42, y + 10); ctx.lineTo(x + 42, y + 10); ctx.lineTo(x + 6, y + 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = reached ? '#a9d47f' : '#8fb87a';
    ctx.beginPath(); ctx.ellipse(x, y + 9, 42, 10, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#5faa4e';
    ctx.beginPath(); ctx.ellipse(x - 30, y + 4, 7, 5, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 28, y + 5, 6, 4, 0, 0, 6.3); ctx.fill();
    if (reached) {                       // 여기까지는 안전하다는 표시
      ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🏝️', x, y - 6);
    }
  }
  function summitIsland(x, y) {
    ctx.fillStyle = '#c9971c';
    ctx.beginPath(); ctx.moveTo(x - 52, y + 10); ctx.lineTo(x + 52, y + 10); ctx.lineTo(x + 8, y + 48); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffc83d';
    ctx.beginPath(); ctx.ellipse(x, y + 8, 52, 12, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(x - 14, y + 5, 22, 5, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#8a6a44'; ctx.fillRect(x - 1.5, y - 40, 3, 44);
    ctx.fillStyle = '#ff6b7a';
    ctx.beginPath(); ctx.moveTo(x + 1, y - 40); ctx.lineTo(x + 30, y - 32); ctx.lineTo(x + 1, y - 22); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = .5 + Math.abs(Math.sin(drift * 2)) * .5;
    ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✨', x - 34, y - 20); ctx.fillText('✨', x + 38, y - 4);
    ctx.globalAlpha = 1;
  }
  function drawKid() {
    let a = alt, lift = 0, rot = 0;
    if (phase === 'jump') {
      const p = Math.min(1, ph / JUMP);
      a = jumpFrom + (jumpTo - jumpFrom) * p;
      lift = -Math.sin(p * Math.PI) * 26;
    } else if (phase === 'drop') {
      const p = Math.min(1, ph / DROP);
      a = jumpFrom + (jumpTo - jumpFrom) * p;
      rot = Math.sin(p * Math.PI) * .5;
    } else if (phase === 'crash') {
      a = alt - ph * 7; rot = ph * 3.2;
    } else if (phase === 'shake') {
      lift = Math.sin(ph * 40) * 2;
    } else if (phase === 'summit') {
      lift = -Math.abs(Math.sin(ph * 6)) * 16;
    }
    const lo = Math.floor(a);
    const x = cloudX(lo) + (cloudX(lo + 1) - cloudX(lo)) * (a - lo);
    const y = cloudY(a) + lift;
    const now = performance.now() / 1000, au = state.player.aura;
    Aura.paint(ctx, x, y + 4, au, now, 'back');
    ctx.save(); ctx.translate(x, y - 24); ctx.rotate(rot);
    if (pimg && pimg.ready) ctx.drawImage(pimg.img, -22, -28, 46, 62);
    else { ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.fillText('🧒', 0, 14); }
    ctx.restore();
    Aura.paint(ctx, x, y + 4, au, now, 'front');
  }

  // ---------- 끝 ----------
  function wordRows() {
    return runWords.map(w => `<div class="dg-brief-row"><b>${esc(w.w)}</b><span>${esc(w.m)}</span></div>`).join('');
  }
  function fell() {
    saveState(); Sfx.down();
    UI.modal(`
      <div class="modal-title">🪂 떨어졌다!</div>
      <div class="king-taunt">"구름은 흔들리는 마음을 태우지 않는다."</div>
      <div class="star-summary">${maxAlt}칸까지 올라갔다 · 💰 +${gold}</div>
      <div class="dg-brief small">${wordRows()}</div>
      <div class="modal-sub">올라간 만큼은 이미 받았어요.<br>
        <b>${D().comboFor}번 연속</b> 맞히면 바람을 타고 두 칸씩 올라가요!</div>
      <div class="actions">
        <button class="btn" data-close="again">☁️ 한 번 더!</button>
        <button class="btn ghost" data-close="book">📖 단어 보기</button>
        <button class="btn ghost" data-close="x">돌아가기</button>
      </div>`,
      { onClose: v => {
        if (v === 'again') { run(); return; }
        Game.toLobby();
        if (v === 'book') Cards.book();
      } });
  }
  function summit() {
    const bonus = misses === 0 ? D().gold.perfect : 0;
    const prize = D().gold.summit + bonus, exp = D().exp.summit;
    addGold(prize);
    state.player.skyClears = (state.player.skyClears || 0) + 1;
    const prev = state.player.skyBest;
    if (prev === null || prev === undefined || misses < prev) state.player.skyBest = misses;
    addExp(exp).forEach(lv => Game.pendingUps.push(lv));
    saveState();
    Sfx.fanfare(); UI.confetti({ count: 170, colors: ['#ffc83d', '#8ecdf5', '#ffffff'] });
    UI.modal(`
      <div class="modal-title">⛰️ 정상이다!</div>
      <div class="dg-end-art escaped">${UI.charHtml(80)}</div>
      <div class="king-taunt yield">"구름 위에서 마을이 손톱만 하게 보인다."</div>
      <div class="reward-row">💰 +${gold + prize}${bonus ? ' <b class="warn">(무실수 +' + bonus + ')</b>' : ''} · ⭐ +${exp}</div>
      <div class="star-summary">${D().height}칸을 전부 올랐다 · 떨어진 횟수 <b>${misses}번</b>${misses === 0 ? ' — 완벽!' : ''}</div>
      <div class="dg-brief small">${wordRows()}</div>
      <div class="actions">
        <button class="btn" data-close="again">☁️ 또 오른다</button>
        <button class="btn ghost" data-close="x">돌아가기</button>
      </div>`,
      { cls: 'celebrate', onClose: v => {
        if (v === 'again') { Game.flushLevelUps(() => run()); return; }
        Game.flushLevelUps(() => Game.toLobby());
      } });
  }

  window.addEventListener('resize', () => { if (UI.current() === 'sky') resize(); });

  return { start, intro, stop };
})();
