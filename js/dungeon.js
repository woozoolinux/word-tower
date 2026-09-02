'use strict';
// 🕳️ 지하 던전 — 무너지는 다리 위의 추격
//
// 왜 또 만드나: 지금 게임에 "내가 자꾸 틀리는 단어만 집중해서 잡는 곳"이 없다.
// 타워는 진도, 투기장은 기록. 던전은 **오답노트**다 — ★이 낮은 단어부터 나온다.
//
// 왜 끝없는 던전이 아닌가: "몇 층까지 갔나"는 순위표를 보는 어른의 동기다.
// 아이에게는 이겼다/도망쳤다가 필요하다. 한 판 2~3분, 8칸 건너면 끝.
//
// 규칙이 그림 하나로 설명된다:
//   뜻에 맞는 발판만 밟는다 → 틀리면 발판이 부서지고 몬스터가 한 칸 다가온다 → 3번이면 잡힌다
const Dungeon = (() => {
  const D = () => BAL.dungeon;

  // ---------- 그림 ----------
  function torch() {
    return `<svg viewBox="0 0 40 76" class="dg-torch-svg">
      <rect x="17" y="26" width="6" height="48" rx="3" fill="#7a5a3a"/>
      <rect x="14" y="24" width="12" height="8" rx="3" fill="#5d4429"/>
      <g class="fl">
        <path d="M20 2 C27 12 31 17 31 23 a11 11 0 0 1-22 0 C9 17 13 12 20 2z" fill="#ff9a2e"/>
        <path d="M20 9 C24 16 26 19 26 23 a6 6 0 0 1-12 0 C14 19 16 16 20 9z" fill="#ffe066"/>
      </g>
    </svg>`;
  }
  // 그림자 짐승 — 형체는 어둡고 눈만 빛난다. 정체를 다 보여주면 안 무섭다.
  function beast() {
    return `<svg viewBox="0 0 160 130" class="dg-beast-svg">
      <path d="M18 40 L34 6 L48 34z M142 40 L126 6 L112 34z" fill="#241a3a"/>
      <ellipse cx="80" cy="78" rx="62" ry="46" fill="#2b2050"/>
      <ellipse cx="80" cy="70" rx="54" ry="38" fill="#1d1636"/>
      <g class="eyes">
        <ellipse cx="58" cy="62" rx="12" ry="9" fill="#ff3b52"/>
        <ellipse cx="102" cy="62" rx="12" ry="9" fill="#ff3b52"/>
        <ellipse cx="58" cy="62" rx="4" ry="6" fill="#fff0a8"/>
        <ellipse cx="102" cy="62" rx="4" ry="6" fill="#fff0a8"/>
      </g>
      <path d="M52 92 h56 l-6 12 -8-8 -8 10 -8-10 -8 8z" fill="#fff6e0"/>
    </svg>`;
  }

  // ---------- 프롤로그 ----------
  // 컷: 추락 → 어둠 → 횃불 → 발견 → 도망.
  // 두 번째부터는 발견 컷부터 짧게 — 다 본 아이를 매번 기다리게 하면 안 된다.
  const FULL = { fall: 0, dust: .85, c1: 1.3, torch: 2.3, light: 2.5, c2: 2.7, eyes: 3.9, c3: 4.2, shout: 4.5, flash: 4.9, beast: 5.0, c4: 5.7, go: 6.2 };
  const SHORT = { fall: -9, dust: -9, c1: -9, torch: 0, light: 0, c2: -9, eyes: .5, c3: .7, shout: .9, flash: 1.2, beast: 1.3, c4: 1.8, go: 2.2 };

  function prologue(done) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = !!state.player.dungeonSeen;
    const T = seen ? SHORT : FULL;
    state.player.dungeonSeen = true; saveState();

    const root = document.createElement('div');
    root.className = 'dg-scene' + (reduce ? ' rush' : '');
    root.innerHTML = `
      <div class="dg-light"></div>
      <div class="dg-flash"></div>
      <div class="dg-stage2">
        <div class="dg-ground"></div>
        <div class="dg-fall">${UI.charHtml(84)}<span class="dg-shout">!</span></div>
        <div class="dg-dust"></div>
        <div class="dg-torch">${torch()}</div>
        <div class="dg-eyes"><i></i><i></i></div>
        <div class="dg-beast">${beast()}</div>
      </div>
      <div class="dg-caps">
        <div class="dg-cap c1">…여긴 어디지?</div>
        <div class="dg-cap c2">횃불을 들어 앞을 비췄다</div>
        <div class="dg-cap c3">저건… 뭐야?</div>
        <div class="dg-cap c4 big">뛰어!!</div>
      </div>
      <button class="btn coral dg-go">🏃 도망친다!</button>`;
    document.getElementById('modal-root').appendChild(root);

    // 지연은 CSS가 아니라 여기서 준다 — 전체판/짧은판 두 표만 갈아 끼우면 된다
    const put = (sel, t) => root.querySelectorAll(sel).forEach(el => {
      if (t < 0) { el.style.display = 'none'; return; }
      el.style.animationDelay = t + 's';
    });
    put('.dg-fall', T.fall); put('.dg-dust', T.dust); put('.dg-cap.c1', T.c1);
    put('.dg-torch', T.torch); put('.dg-light', T.light); put('.dg-cap.c2', T.c2);
    put('.dg-eyes', T.eyes); put('.dg-cap.c3', T.c3); put('.dg-shout', T.shout);
    put('.dg-flash', T.flash); put('.dg-beast', T.beast); put('.dg-cap.c4', T.c4); put('.dg-go', T.go);
    if (seen) root.querySelector('.dg-stage2').classList.add('lit');

    const timers = [];
    const at = (t, fn) => { if (!reduce && t >= 0) timers.push(setTimeout(fn, t * 1000)); };
    at(T.dust, () => { Sfx.hit(); UI.shake(root.querySelector('.dg-stage2')); });
    at(T.torch, () => Sfx.door());
    at(T.eyes, () => Sfx.bad());
    at(T.shout, () => { const f = root.querySelector('.dg-fall'); if (f) f.classList.add('scared'); });
    at(T.beast, () => { Sfx.down(); UI.shake(root.querySelector('.dg-stage2')); });

    const finish = () => {
      timers.splice(0).forEach(clearTimeout);
      root.classList.add('out');
      setTimeout(() => { root.remove(); done(); }, 300);
    };
    root.addEventListener('click', e => {
      if (e.target.closest('.dg-go')) { finish(); return; }
      if (root.classList.contains('rush')) return;
      root.classList.add('rush');
      timers.splice(0).forEach(clearTimeout);
    });
  }

  // ---------- 후보 단어: ★이 낮은 것부터 ----------
  // 던전이 오답노트가 되는 지점. 만난 적 있는 단어만 쓴다(처음 보는 단어로 쫓기면 학습이 아니라 운이다).
  function candidates() {
    const all = [];
    (window.TOWERS || []).forEach(t => allWords(t).forEach(w => {
      const s = statFor(t.id, w);
      if (s.seen > 0) all.push({ w, score: s.stars * 10 - Math.min(9, s.wrong) });
    }));
    all.sort((a, b) => a.score - b.score);
    const pool = all.slice(0, D().words).map(x => x.w);
    return pool.length >= 4 ? pool : all.map(x => x.w);
  }

  // ---------- 다리: 캔버스 추격 ----------
  // 계단달리기와 같은 캔버스지만 방식이 다르다. 거기선 레인을 바꿔 타일을 줍고,
  // 여기선 **끊긴 다리가 다가온다**. 시간이 게이지가 아니라 낭떠러지까지의 거리다.
  // 글자는 캔버스가 아니라 아래 버튼에 둔다 — 폰에서 작은 글자를 정확히 누르게 하면 안 된다.
  const HGT = 212, LINE = 150, GAPW = 92;
  const DROP = .42, WALK = .62;       // 널빤지가 박히는 시간 / 건너가는 시간   // 캔버스 높이 / 다리 높이 / 끊긴 폭
  let cv, ctx, raf, last, active;
  let pool, plank, gap, used, q, lock, phase, t, ph, bgOff, pimg, beastLunge, msg, shakeT, chosen, dust, placed;
  let queue, qi, runWords;

  function width() { return cv.width / (window.devicePixelRatio || 1); }
  // 깊이 들어갈수록 낭떠러지가 빨리 온다
  function limitNow() { return Math.max(D().timeMin, D().timeLimit - plank * D().timeStep); }
  function kidX() { return width() * 0.56; }   // 아이를 오른쪽에 두어야 뒤가 보인다

  function start() {
    pool = candidates();
    if (pool.length < 4) { UI.toast('타워에서 단어를 조금 더 만난 뒤에 올 수 있어요', 'bad'); return; }
    prologue(() => reset(() => brief(() => go())));
  }

  // reset: 판 상태 초기화 → brief 가 buildQueue 를 부를 수 있게 먼저 돈다
  function reset(cb) {
    plank = 0; gap = D().gap; used = []; bgOff = 0; beastLunge = 0; msg = null; shakeT = 0; dust = [];
    queue = []; qi = 0; runWords = [];
    pimg = Avatar.image();
    cb();
  }
  function go() {
    UI.show('dungeon');
    shell();
    next();
    active = true; last = performance.now();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }
  function run() { reset(() => brief(() => go())); }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); raf = null; }

  function shell() {
    document.getElementById('screen-dungeon').innerHTML = `
      <div class="dg-hud panel">
        <div class="dg-ask"><span class="dg-ask-label">이 뜻을 밟아라</span>
          <b class="dg-ask-word" id="dg-word">…</b></div>
      </div>
      <div class="dg-canvas-wrap"><canvas id="dg-cv"></canvas>
        <div class="dg-count" id="dg-count"></div></div>
      <div class="dg-planks" id="dg-planks"></div>`;
    cv = document.getElementById('dg-cv'); ctx = cv.getContext('2d');
    resize();
    document.getElementById('dg-planks').onclick = e => {
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

  function next() { nextWord(0); }
  // 한 판의 단어 줄 세우기: N개를 뽑아 각각 두 번씩, 연달아 같은 게 안 나오게.
  // 오답 보기는 넓은 후보(pool)에서 뽑는다 — 4개만 쓰면 보기가 매번 똑같아진다.
  function buildQueue() {
    const n = Math.min(D().wordsPerRun, pool.length);
    const head = pool.slice(0, Math.max(n * 3, n));       // ★ 낮은 쪽에서
    const picks = shuffle(head.slice()).slice(0, n);
    const times = Math.max(2, Math.ceil(D().planks / n));
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
  // 달리기 전에 오늘 놓을 널빤지를 한 번 보여준다.
  // 모르는 단어로 쫓기면 학습이 아니라 공포다 — 타워의 정찰과 같은 이유.
  function brief(done) {
    buildQueue();
    if (!state.settings.preview) { done(); return; }
    const rows = runWords.map(w => `<div class="dg-brief-row">
      <b>${esc(w.w)}</b><span>${esc(w.m)}</span></div>`).join('');
    UI.modal(`
      <div class="modal-title">🪵 이 널빤지로 건넌다</div>
      <div class="modal-sub">뜻이 뜨면 그 널빤지를 밟아라<br>
        <b>${runWords.length}개</b>가 번갈아 나온다</div>
      <div class="dg-brief">${rows}</div>
      <div class="actions"><button class="btn coral" data-close="go">🏃 출발!</button></div>`,
      { onClose: done });
  }
  function nextWord(startT) {
    if (plank >= D().planks) { toDoor(); return; }
    if (!queue.length) buildQueue();
    const word = queue[qi % queue.length]; qi++;
    if (used.indexOf(wkey(word)) < 0) used.push(wkey(word));
    q = makeQuestion(word, pool, 'm2w');
    lock = false; phase = 'run'; t = startT; ph = 0; chosen = null; msg = null; placed = null;
    document.getElementById('dg-word').textContent = q.prompt;
    document.getElementById('dg-count').textContent = `${plank} / ${D().planks}칸`;
    document.getElementById('dg-planks').innerHTML = q.choices
      .map(c => `<button class="dg-plank" data-pick="${esc(c)}">${esc(c)}</button>`).join('');
  }

  function pick(btn, val) {
    if (lock || phase !== 'run') return;
    lock = true;
    const ok = val === q.answer;
    chosen = val;
    recordResult(q.word.towerId, q.word, ok, false);
    document.querySelectorAll('[data-pick]').forEach(b => {
      if (b.dataset.pick === q.answer) b.classList.add('safe');
      else if (b === btn) b.classList.add('broken');
      b.disabled = true;
    });
    if (ok) { Sfx.ok(); plank++; addGold(D().gold.perPlank); cross(); }
    else { Sfx.bad(); miss(); }
  }
  function cross() { phase = 'cross'; ph = 0; placed = q.answer; msg = { t: `"${q.answer}" 가 다리가 됐다!`, cls: 'good' }; }
  function miss() {
    // 틀린 단어는 이 판이 끝나기 전에 한 번 더 나온다 — 놓친 채로 끝내지 않는다
    if (q && q.word) queue.push(q.word);
    phase = 'fall'; ph = 0; gap--;
    beastLunge = 1;
    shakeT = .35;
    msg = { t: `"${q.answer}" 였어!`, cls: 'bad' };
    document.querySelectorAll('[data-pick]').forEach(b => {
      if (b.dataset.pick === q.answer) b.classList.add('safe');
      b.disabled = true;
    });
  }
  function toDoor() { phase = 'door'; ph = 0; lock = true; }

  // ---------- 진행 ----------
  function loop(now) {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function update(dt) {
    if (shakeT > 0) shakeT -= dt;
    if (beastLunge > 0) beastLunge = Math.max(0, beastLunge - dt * 1.4);
    dust = dust.filter(d => (d.life -= dt) > 0);
    dust.forEach(d => { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 220 * dt; });
    if (phase === 'run') {
      bgOff += 150 * dt;
      if (gap <= 1 && Math.random() < dt * 2.2) shakeT = Math.max(shakeT, .1);
      t += dt / limitNow();
      if (t >= 1 && !lock) { lock = true; timeUp(); }
    } else if (phase === 'cross') {
      const was = ph; ph += dt;
      if (was < DROP && ph >= DROP) {          // 착지하는 순간
        Sfx.hit(); shakeT = .28;
        puff(kidX() + 10, LINE + 8, 14); puff(kidX() + GAPW - 10, LINE + 8, 14);
      }
      if (ph >= DROP) bgOff += 230 * dt;        // 놓인 뒤에야 건너간다
      if (ph > DROP + WALK) next();
    } else if (phase === 'fall') {
      ph += dt;
      if (ph > 1.5) {
        if (gap <= 0) { stop(); caught(); return; }
        // 기어올라온 자리가 곧 낭떠러지 앞이다 — 다음 판단은 시간이 절반
        nextWord(D().failRunway);
      }
    } else if (phase === 'door') {
      bgOff += 230 * dt; ph += dt;
      if (ph > 1.6) { stop(); escape(); }
    }
  }
  function timeUp() {
    recordResult(q.word.towerId, q.word, false, false);
    Sfx.bad(); miss();
  }
  function puff(x, y, n) {
    for (let i = 0; i < n; i++) dust.push({ x, y, vx: -70 - Math.random() * 90, vy: -18 - Math.random() * 40, r: 1.4 + Math.random() * 2.4, life: .3 + Math.random() * .25 });
  }

  // ---------- 그리기 ----------
  function draw() {
    const W = width(), K = kidX();
    ctx.save();
    if (shakeT > 0) ctx.translate((Math.random() - .5) * 7, (Math.random() - .5) * 7);
    // 동굴
    const g = ctx.createLinearGradient(0, 0, 0, HGT);
    g.addColorStop(0, '#241c46'); g.addColorStop(.65, '#140f2c'); g.addColorStop(1, '#0a0718');
    ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, HGT + 20);
    drawSpikes(W);

    // 낭떠러지: t가 1에 가까울수록 발밑으로 다가온다
    let edge;
    if (phase === 'run') edge = K + (1 - t) * (W - K + 30);
    else if (phase === 'fall') edge = K;
    else if (phase === 'cross') edge = K + 12 - Math.max(0, (ph - DROP) / WALK) * (GAPW + 64);
    else edge = W + 60;
    drawBridge(W, K, edge);
    drawBeast(K);
    // 횃불 불빛 (아이 주변만 따뜻하게)
    const lg = ctx.createRadialGradient(K, LINE - 18, 6, K, LINE - 18, 118);
    lg.addColorStop(0, 'rgba(255,196,92,.28)'); lg.addColorStop(1, 'rgba(255,196,92,0)');
    ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(K, LINE - 18, 118, 0, 6.3); ctx.fill();
    dust.forEach(d => { ctx.globalAlpha = Math.max(0, d.life * 2); ctx.fillStyle = '#9d90c4';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.3); ctx.fill(); });
    ctx.globalAlpha = 1;
    drawKid(K);
    // 마지막 한 번 남으면 화면 가장자리가 붉게 뛴다 — 말 없이 위험을 알린다
    if (gap <= 1) {
      const pulse = .18 + Math.sin(bgOff / 9) * .12;
      const vg = ctx.createRadialGradient(W / 2, HGT / 2, HGT * .3, W / 2, HGT / 2, W * .7);
      vg.addColorStop(0, 'rgba(255,59,82,0)'); vg.addColorStop(1, `rgba(255,59,82,${pulse.toFixed(3)})`);
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, HGT);
    }
    if (msg) {
      ctx.font = 'bold 17px "Jua", sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = msg.cls === 'good' ? '#3ee0c4' : '#ff8090';
      ctx.fillText(msg.t, W / 2, 30);
    }
    ctx.restore();
  }
  function drawSpikes(W) {
    const span = 120, shift = (bgOff * .25) % span;
    ctx.fillStyle = '#2e2456';
    for (let x = -span; x < W + span; x += span) {
      const px = x - shift;
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px + 26, 0); ctx.lineTo(px + 13, 44); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px + 58, 0); ctx.lineTo(px + 74, 0); ctx.lineTo(px + 66, 26); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    const s2 = (bgOff * .5) % 90;
    for (let x = -90; x < W + 90; x += 90) ctx.fillRect(x - s2, HGT - 34, 46, 5);
  }
  // 다리 한 줄 (from~to). 밧줄 + 널빤지.
  function span(from, to, y, off) {
    if (to <= from) return;
    ctx.strokeStyle = '#6b5433'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(from, y - 13); ctx.lineTo(to, y - 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(from, y + 12); ctx.lineTo(to, y + 12); ctx.stroke();
    const start = from - ((from + off) % 26);
    for (let px = start; px < to; px += 26) {
      const a = Math.max(px, from), b = Math.min(px + 22, to);
      if (b <= a) continue;
      ctx.fillStyle = '#8a6a44'; ctx.fillRect(a, y, b - a, 10);
      ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(a, y, b - a, 3);
    }
  }
  function drawBridge(W, K, edge) {
    const y = LINE, off = (bgOff * 1) % 26;
    const e = Math.min(edge, W + 30), far = e + GAPW;
    // 이쪽 다리
    span(-30, e, y, off);
    // 낭떠러지 — 어둠이 아가리를 벌린다
    if (e < W + 20) {
      const gg = ctx.createLinearGradient(0, y - 6, 0, HGT);
      gg.addColorStop(0, 'rgba(0,0,0,.75)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gg; ctx.fillRect(e, y - 4, Math.min(GAPW, W + 30 - e), HGT - y + 10);
      // 끊어진 널빤지 조각과 늘어진 밧줄
      ctx.fillStyle = '#5a4630';
      ctx.beginPath(); ctx.moveTo(e - 7, y); ctx.lineTo(e + 3, y + 4); ctx.lineTo(e - 5, y + 13); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#6b5433'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(e, y - 13); ctx.quadraticCurveTo(e + 12, y + 6, e + 8, y + 24); ctx.stroke();
      if (far < W + 30) {
        ctx.beginPath(); ctx.moveTo(far, y - 13); ctx.quadraticCurveTo(far - 12, y + 6, far - 8, y + 24); ctx.stroke();
      }
      // 건너편
      span(far, W + 30, y, off);
    }
    // 내가 고른 단어가 다리가 된다
    if (placed && phase === 'cross') {
      const drop = Math.min(1, ph / DROP);
      const ease = 1 - Math.pow(1 - drop, 3);
      const py = y - (1 - ease) * 110;
      const tilt = (1 - ease) * .5;
      ctx.save();
      ctx.translate(e + GAPW / 2, py + 6); ctx.rotate(tilt);
      ctx.fillStyle = '#c9971c';
      ctx.fillRect(-GAPW / 2 - 4, -7, GAPW + 8, 15);
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      ctx.fillRect(-GAPW / 2 - 4, -7, GAPW + 8, 5);
      ctx.font = 'bold 16px "Fredoka", "Jua", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(59,42,18,.85)';
      ctx.strokeText(placed, 0, -20);
      ctx.fillStyle = '#ffe066'; ctx.fillText(placed, 0, -20);
      ctx.restore();
      if (drop >= 1) {   // 박힌 뒤 잠깐 빛난다
        const glow = Math.max(0, 1 - (ph - DROP) / .35);
        ctx.globalAlpha = glow * .8;
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3;
        ctx.strokeRect(e - 5, y - 2, GAPW + 10, 17);
        ctx.globalAlpha = 1;
      }
    }
  }
  function drawKid(K) {
    const run = phase === 'run' || phase === 'cross' || phase === 'door';
    const bob = run ? Math.sin(bgOff / 13) * 4 : 0;
    let y = LINE - 44 + bob, x = K, rot = 0;
    if (phase === 'fall') {
      const p = Math.min(1, ph / 1.5);
      // 떨어졌다가 매달리고 기어오른다
      y = LINE - 44 + (p < .3 ? p / .3 * 46 : p < .75 ? 46 : 46 * (1 - (p - .75) / .25));
      x = K - (p < .75 ? 8 : 8 * (1 - (p - .75) / .25));
      rot = p < .3 ? p / .3 * .35 : .2;
    }
    ctx.save(); ctx.translate(x, y + 22); ctx.rotate(rot);
    if (pimg && pimg.ready) ctx.drawImage(pimg.img, -22, -28, 46, 62);
    else { ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.fillText('🧒', 0, 14); }
    ctx.restore();
    if (run && Math.random() < .3) puff(x - 16, LINE + 7, 1);
  }
  function drawBeast(K) {
    // 남은 기회가 줄수록 뒤가 가까워진다. 놓친 직후엔 확 달려든다.
    // gap 3이어도 화면 안에 있어야 한다 — 안 보이는 추격자는 추격자가 아니다.
    const base = Math.max(38, K - 74 - gap * 30 + beastLunge * 30);
    const bob = Math.sin(bgOff / 11) * 5;
    const x = base, y = LINE - 20 + bob;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#241a3a';
    ctx.beginPath(); ctx.moveTo(-26, -18); ctx.lineTo(-16, -44); ctx.lineTo(-6, -16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, -18); ctx.lineTo(16, -44); ctx.lineTo(6, -16); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#2b2050'; ctx.beginPath(); ctx.ellipse(0, 4, 40, 30, 0, 0, 6.3); ctx.fill();
    ctx.fillStyle = '#1d1636'; ctx.beginPath(); ctx.ellipse(0, 0, 34, 24, 0, 0, 6.3); ctx.fill();
    const glow = .65 + Math.sin(bgOff / 7) * .35;
    ctx.globalAlpha = glow; ctx.fillStyle = '#ff3b52';
    ctx.beginPath(); ctx.ellipse(-13, -4, 8, 6, 0, 0, 6.3); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, -4, 8, 6, 0, 0, 6.3); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff6e0';
    ctx.beginPath(); ctx.moveTo(-16, 14); ctx.lineTo(16, 14); ctx.lineTo(12, 24); ctx.lineTo(6, 16); ctx.lineTo(0, 26); ctx.lineTo(-6, 16); ctx.lineTo(-12, 24); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // ---------- 끝 ----------
  function caught() {
    stop(); saveState();
    Sfx.down();
    UI.modal(`
      <div class="dg-end-art">${beast()}</div>
      <div class="modal-title">😱 잡혔다!</div>
      <div class="king-taunt">"어둠에서 도망칠 수 있을 것 같았나?"</div>
      <div class="star-summary">${plank}칸까지 갔다 · 다음엔 더 멀리</div>
      <div class="dg-brief small">${runWords.map(w => `<div class="dg-brief-row"><b>${esc(w.w)}</b><span>${esc(w.m)}</span></div>`).join('')}</div>
      <div class="modal-sub">여기 나오는 단어는 <b>네가 자주 틀리는 것들</b>이야.<br>도감에서 한 번 보고 오면 훨씬 쉬워져!</div>
      <div class="actions">
        <button class="btn" data-close="again">🏃 한 번 더!</button>
        <button class="btn ghost" data-close="book">📖 단어 보기</button>
        <button class="btn ghost" data-close="x">로비로</button>
      </div>`,
      { onClose: v => {
        if (v === 'again') { run(); return; }
        Game.toLobby();
        if (v === 'book') Cards.book();
      } });
  }

  function escape() {
    stop();
    const miss = D().gap - gap;
    const bonus = miss === 0 ? D().gold.perfect : 0;
    const gold = D().gold.escape + bonus, exp = D().exp.escape;
    addGold(gold);
    state.player.dungeonClears = (state.player.dungeonClears || 0) + 1;
    const prev = state.player.dungeonBest;
    if (prev === null || prev === undefined || miss < prev) state.player.dungeonBest = miss;
    addExp(exp).forEach(lv => Game.pendingUps.push(lv));
    saveState();
    Sfx.fanfare(); UI.confetti({ count: 150, colors: ['#ffc83d', '#3ee0c4', '#ffffff'] });
    UI.modal(`
      <div class="modal-title">🚪 도망쳤다!</div>
      <div class="dg-end-art escaped">${UI.charHtml(80)}</div>
      <div class="king-taunt yield">"문이 닫혔다. 짐승의 울음이 멀어진다."</div>
      <div class="reward-row">💰 +${gold}${bonus ? ' <b class="warn">(무실수 +' + bonus + ')</b>' : ''} · ⭐ +${exp}</div>
      <div class="star-summary">${D().planks}칸을 전부 건넜다 · 틀린 횟수 <b>${miss}번</b>${miss === 0 ? ' — 완벽!' : ''}</div>
      <div class="dg-brief small">${runWords.map(w => `<div class="dg-brief-row"><b>${esc(w.w)}</b><span>${esc(w.m)}</span></div>`).join('')}</div>
      <div class="actions">
        <button class="btn" data-close="chest">🎁 보물 상자 열기</button>
        <button class="btn ghost" data-close="x">로비로</button>
      </div>`,
      { cls: 'celebrate', onClose: v => {
        const home = () => Game.flushLevelUps(() => Game.toLobby());
        if (v !== 'chest') { home(); return; }
        chest(home);
      } });
  }

  // 보물 상자 = 밀린 각인 시험. 새 카드를 뿌리지 않으니 왕 조건·오라 밸런스를 안 건드린다.
  function chest(done) {
    const pend = [];
    (window.TOWERS || []).forEach(t => Cards.pendingFor(t.id).forEach(w => pend.push(w)));
    if (!pend.length) {
      // 각인할 게 없다고 빈손으로 돌려보내면 완벽하게 건넌 보람이 없다
      const coins = Math.round(D().gold.escape / 2);
      addGold(coins); saveState(); Sfx.coin();
      UI.modal(`
        <div class="modal-title">🎁 낡은 금화 주머니</div>
        <div class="reward-row">💰 +${coins}</div>
        <div class="modal-sub">각인할 단어가 아직 없어서 금화가 들어 있었어요.<br>
          타워에서 ★★★을 만들면 다음엔 <b>카드</b>가 들어 있어요!</div>
        <div class="actions"><button class="btn" data-close="x">좋아!</button></div>`,
        { onClose: done });
      return;
    }
    Cards.runTests(shuffle(pend).slice(0, D().chestTests), () => {
      (window.TOWERS || []).forEach(t => Cards.claimRewards(t.id, () => {}));
      done();
    });
  }

  window.addEventListener('resize', () => { if (UI.current() === 'dungeon') resize(); });

  return { start, prologue, stop };
})();
