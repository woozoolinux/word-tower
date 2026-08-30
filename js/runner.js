'use strict';
// 계단 러너: 3레인 자동 달리기. 미션 뜻에 맞는 영어 타일에 부딪히면 수집.
const Runner = (() => {
  const LANES = 3, PX = 90, HGT = 260;
  let cv, ctx, run, lane, curY, missions, mi, tiles, coins, particles, speed, last, raf, dashLeft, active, waveActive, groundOff, missed;

  function start(r) {
    run = r; UI.show('runner');
    cv = document.getElementById('runner-canvas'); ctx = cv.getContext('2d'); resize();
    lane = 1; curY = laneY(1);
    const ws = shuffle(run.words); missions = [];
    while (missions.length < 4) missions = missions.concat(ws);
    missions = missions.slice(0, 4);
    mi = 0; tiles = []; coins = []; particles = []; missed = 0;
    speed = 170 + run.floor * 10;
    dashLeft = hasSkill('dash') ? 1 : 0;
    active = false; waveActive = false; groundOff = 0;
    hud(); draw();
    const ov = document.getElementById('runner-overlay');
    ov.textContent = 'READY'; ov.classList.add('show');
    setTimeout(() => { ov.textContent = 'GO!'; }, 700);
    setTimeout(() => { ov.classList.remove('show'); active = true; last = performance.now(); raf = requestAnimationFrame(loop); }, 1200);
  }
  function stop() { active = false; if (raf) cancelAnimationFrame(raf); }
  function resize() {
    if (!cv) return;
    const w = cv.parentElement.clientWidth || 320, dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr; cv.height = HGT * dpr; cv.style.height = HGT + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  const width = () => cv.width / (window.devicePixelRatio || 1);
  function laneY(l) { return 55 + l * 75; }

  function hud() {
    const w = missions[Math.min(mi, missions.length - 1)];
    document.getElementById('runner-hud').innerHTML = `
      <div class="mission">찾아라: <b>${esc(w.m)}</b> <span class="mission-dots">${'●'.repeat(mi)}${'○'.repeat(missions.length - mi)}</span></div>
      ${UI.hpBar(state.player.hp, playerMaxHp(), 'hp')}`;
  }

  function spawnWave() {
    const word = missions[mi];
    const ds = distractors(word, run.pool, 2, 'w');
    const ws = shuffle([word.w, ...ds.map(d => d.w)]);
    const W = width();
    ws.forEach((w, i) => tiles.push({ w, lane: i, x: W + 30 + rnd(90), correct: w === word.w, width: Math.max(72, w.length * 13 + 26) }));
    for (let i = 0; i < 3; i++) coins.push({ x: W + 260 + i * 60 + rnd(50), lane: rnd(LANES), r: 10 });
    waveActive = true;
  }

  function loop(now) {
    if (!active) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); draw();
    raf = requestAnimationFrame(loop);
  }
  function update(dt) {
    const dx = speed * dt;
    groundOff = (groundOff + dx) % 40;
    curY += (laneY(lane) - curY) * Math.min(1, dt * 14);
    tiles.forEach(t => t.x -= dx); coins.forEach(c => c.x -= dx);
    if (!waveActive) spawnWave();
    for (const t of tiles) {
      if (t.hit) continue;
      if (t.lane === lane && t.x < PX + 20 && t.x + t.width > PX - 20) { t.hit = true; if (t.correct) collect(t); else bump(t); if (!active) return; }
    }
    for (const c of coins) {
      if (!c.got && c.lane === lane && Math.abs(c.x - PX) < 24) { c.got = true; addGold(5); Sfx.coin(); burst(c.x, laneY(c.lane), '#ffc83d'); }
    }
    if (waveActive && tiles.every(t => t.hit || t.x + t.width < -10)) {
      if (!tiles.some(t => t.collected)) { missed++; UI.toast('앗, 놓쳤다! 한 번 더!', 'bad'); }
      tiles = []; waveActive = false;
    }
    coins = coins.filter(c => c.x > -30 && !c.got);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt * 1.8; });
    particles = particles.filter(p => p.life > 0);
  }
  function collect(t) {
    t.collected = true; Sfx.ok(); burst(PX, laneY(lane), '#3ee0c4');
    recordResult(run.towerId, missions[mi], true, false);
    Game.gainExpQuiet(3 + run.floor); addGold(5);
    tiles.forEach(x => x.hit = true);
    mi++;
    if (mi >= missions.length) { finish(); return; }
    hud();
  }
  function bump(t) {
    recordResult(run.towerId, missions[mi], false, false);
    if (dashLeft > 0) { dashLeft--; UI.toast('⚡ 대시! 뚫고 지나갔다', 'good'); burst(PX, laneY(lane), '#8f7bff'); return; }
    const dmg = 6 + run.floor; state.player.hp -= dmg; Sfx.bad();
    burst(PX, laneY(lane), '#ff6b7a'); UI.shake(cv.parentElement);
    UI.toast(`💥 "${t.w}"은(는) 아니야! -${dmg}`, 'bad');
    saveState(); hud();
    if (state.player.hp <= 0) { stop(); setTimeout(() => Game.playerDown(), 400); }
  }
  function burst(x, y, c) { for (let i = 0; i < 12; i++) particles.push({ x, y, vx: (Math.random() - .5) * 260, vy: (Math.random() - .9) * 260, life: 1, c }); }
  function finish() {
    stop();
    const ov = document.getElementById('runner-overlay'); ov.textContent = 'GOAL!'; ov.classList.add('show');
    Sfx.win(); saveState();
    setTimeout(() => { ov.classList.remove('show'); Game.floorClear(); }, 900);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function draw() {
    const W = width();
    const g = ctx.createLinearGradient(0, 0, 0, HGT); g.addColorStop(0, '#34378a'); g.addColorStop(1, '#1b1e46');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, HGT);
    for (let l = 0; l < LANES; l++) {
      const y = laneY(l);
      ctx.fillStyle = l === lane ? 'rgba(255,200,61,.10)' : 'rgba(255,255,255,.04)';
      ctx.fillRect(0, y - 34, W, 68);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      ctx.setLineDash([18, 22]); ctx.lineDashOffset = groundOff;
      ctx.beginPath(); ctx.moveTo(0, y + 34); ctx.lineTo(W, y + 34); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    coins.forEach(c => {
      const y = laneY(c.lane);
      ctx.fillStyle = '#ffc83d'; ctx.beginPath(); ctx.arc(c.x, y, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#9a6b00'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.fillText('$', c.x, y + 1);
    });
    tiles.forEach(t => {
      if (t.hit) return;
      const y = laneY(t.lane);
      roundRect(t.x, y - 22, t.width, 44, 12);
      ctx.fillStyle = '#fff9ec'; ctx.fill(); ctx.strokeStyle = '#d9cca8'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#2a2450'; ctx.font = '600 18px Fredoka, Jua, sans-serif'; ctx.fillText(t.w, t.x + t.width / 2, y + 1);
    });
    const bob = active ? Math.sin(performance.now() / 80) * 3 : 0;
    ctx.font = '38px serif'; ctx.fillText('🏃', PX, curY + bob);
    particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); });
    ctx.globalAlpha = 1;
  }

  function up() { if (active) lane = Math.max(0, lane - 1); }
  function down() { if (active) lane = Math.min(LANES - 1, lane + 1); }
  function key(e) {
    if (['ArrowUp', 'w', 'W'].includes(e.key)) { e.preventDefault(); up(); }
    if (['ArrowDown', 's', 'S'].includes(e.key)) { e.preventDefault(); down(); }
  }
  function init() {
    document.getElementById('runner-up').addEventListener('click', up);
    document.getElementById('runner-down').addEventListener('click', down);
    const c = document.getElementById('runner-canvas');
    c.addEventListener('touchstart', e => { const r = c.getBoundingClientRect(); if (e.touches[0].clientY - r.top < r.height / 2) up(); else down(); e.preventDefault(); }, { passive: false });
    c.addEventListener('mousedown', e => { const r = c.getBoundingClientRect(); if (e.clientY - r.top < r.height / 2) up(); else down(); });
    window.addEventListener('resize', () => { if (UI.current() === 'runner') resize(); });
  }
  return { start, stop, key, init };
})();
