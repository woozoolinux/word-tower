'use strict';
// 미로 층: 열쇠(영어)를 주워 문(한글 뜻)을 연다. 몬스터 → 배틀, 상자 → 골드, 열린 문 → 러너.
const Maze = (() => {
  const CW = 6, CH = 5, W = CW * 2 + 1, H = CH * 2 + 1;
  let run, grid, px, py, keys, door, monsters, chest, holding, seen, opened, busy, trail, face, doorBlocks;
  const gridEl = () => document.getElementById('maze-grid');
  const cellsEl = () => gridEl().querySelector('.maze-cells');
  const k = (x, y) => x + ',' + y;

  function gen() {
    grid = Array.from({ length: H }, () => Array(W).fill(1));
    const stack = [[1, 1]]; grid[1][1] = 0;
    while (stack.length) {
      const [x, y] = stack[stack.length - 1];
      const dirs = shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]);
      let moved = false;
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx > 0 && nx < W - 1 && ny > 0 && ny < H - 1 && grid[ny][nx] === 1) {
          grid[y + dy / 2][x + dx / 2] = 0; grid[ny][nx] = 0; stack.push([nx, ny]); moved = true; break;
        }
      }
      if (!moved) stack.pop();
    }
    // 벽 몇 개를 더 뚫어서 갈림길(루프)을 만든다 — 덜 외길
    for (let i = 0; i < 3; i++) {
      const x = 1 + 2 * rnd(CW), y = 1 + 2 * rnd(CH);
      const [dx, dy] = pick([[1, 0], [0, 1]]);
      if (x + 2 * dx < W - 1 && y + 2 * dy < H - 1) grid[y + dy][x + dx] = 0;
    }
  }
  function bfs(sx, sy) {
    const dist = {}, prev = {}, q = [[sx, sy]]; dist[k(sx, sy)] = 0;
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, nk = k(nx, ny);
        if (grid[ny] && grid[ny][nx] === 0 && dist[nk] === undefined) { dist[nk] = dist[k(x, y)] + 1; prev[nk] = k(x, y); q.push([nx, ny]); }
      }
    }
    return { dist, prev };
  }
  function pathTo(prev, target) { const p = []; let c = target; while (c) { p.unshift(c); c = prev[c]; } return p; }
  function cells() { const c = []; for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) c.push(k(x, y)); return c; }
  // 출구가 하나뿐인 방 = 막다른 길. 여기에 문을 두면 문이 길을 막을 일이 없다.
  function deadEnds() {
    const out = [];
    for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
      let n = 0;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { if (grid[y + dy] && grid[y + dy][x + dx] === 0) n++; });
      if (n === 1) out.push(k(x, y));
    }
    return out;
  }

  function start(r) {
    run = r; busy = false; holding = []; opened = false; seen = new Set();
    gen(); px = 1; py = 1; trail = null; face = 1;
    gridEl().innerHTML =
      `<div class="maze-cells" style="grid-template-columns:repeat(${W},1fr);grid-template-rows:repeat(${H},1fr);aspect-ratio:${W}/${H}"></div>` +
      '<div class="maze-sprites"><div class="sprite pet no-anim" id="mz-pet"></div><div class="sprite player no-anim" id="mz-player"></div></div>';
    const { dist, prev } = bfs(1, 1);
    const cs = cells();
    const de = deadEnds().filter(c => c !== '1,1' && dist[c] !== undefined);
    doorBlocks = de.length > 0;
    door = (doorBlocks ? de : cs.filter(c => c !== '1,1')).reduce((a, b) => dist[a] >= dist[b] ? a : b);
    const doorWord = pickWord(run.towerId, run.words);
    run.doorWord = doorWord;
    const ds = distractors(doorWord, run.pool, 3, 'w');
    const used = new Set([door, '1,1']);
    const spots = shuffle(cs.filter(c => dist[c] >= 4 && !used.has(c)));
    keys = {};
    [doorWord, ...ds].forEach(w => { const c = spots.pop(); if (!c) return; used.add(c); keys[c] = { w: w.w, correct: w.w === doorWord.w }; });
    const correctCell = Object.keys(keys).find(c => keys[c].correct);
    monsters = {};
    [pathTo(prev, door), pathTo(prev, correctCell)].forEach(p => {
      let c = p[Math.floor(p.length / 2)];
      if (!c || used.has(c) || dist[c] < 2) c = p.find(x => !used.has(x) && dist[x] >= 2);
      if (c && !used.has(c)) { used.add(c); monsters[c] = pick(MONSTERS); }
    });
    chest = spots.find(c => !used.has(c)) || null;
    reveal(); render(); UI.show('maze');
    UI.toast(`${run.floor}층 · "${doorWord.m}" 열쇠를 찾아요!`);
  }

  // 캐릭터/펫은 칸 위를 미끄러지듯 이동한다 (격자 다시 그려도 안 끊기게 분리)
  function renderSprites() {
    const p = document.getElementById('mz-player'), pe = document.getElementById('mz-pet');
    if (!p) return;
    const petId = state.player.pet && PETS[state.player.pet] ? state.player.pet : null;
    const cw = 100 / W, ch = 100 / H;
    p.style.width = cw + '%'; p.style.height = ch + '%';
    pe.style.width = cw + '%'; pe.style.height = ch + '%';
    if (!p.firstChild) p.innerHTML = UI.charWalk();
    if (petId && pe.dataset.pet !== petId) { pe.innerHTML = `<span class="petwrap">${Art.pet(petId)}</span>`; pe.dataset.pet = petId; }
    pe.style.display = petId && trail ? '' : 'none';
    place(p, px, py);
    if (trail) { const t = trail.split(',').map(Number); place(pe, t[0], t[1]); }
    requestAnimationFrame(() => { p.classList.remove('no-anim'); pe.classList.remove('no-anim'); });
  }
  function place(el, x, y) {
    el.style.transform = `translate(${x * 100}%, ${y * 100}%) scaleX(${el.id === 'mz-player' ? face : 1})`;
  }
  function step() {
    const p = document.getElementById('mz-player');
    if (!p) return;
    p.classList.remove('walking'); void p.offsetWidth; p.classList.add('walking');
  }

  function reveal() {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.abs(dx) + Math.abs(dy) <= 2) seen.add(k(px + dx, py + dy));
  }

  function render() {
    let h = '';
    const sight = hasSkill('sight');
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = k(x, y), wall = grid[y][x] === 1, vis = seen.has(c);
      let cls = 'cell ' + (wall ? 'wall' : 'floor') + (vis ? '' : ' fog') + (c === door && opened ? ' door-open' : '');
      let inner = '';
      if (c === door) inner = `<span class="ent">${opened ? '🪜' : vis ? '🚪' : ''}</span>`;
      else if (keys[c] && (vis || sight)) inner = `<span class="ent key ${vis ? '' : 'ghost'}">🔑<i>${esc(keys[c].w)}</i></span>`;
      else if (monsters[c] && vis) inner = `<span class="ent mon">${Art.monster(monsters[c].id, false)}</span>`;
      else if (chest === c && vis) inner = '<span class="ent">🎁</span>';
      h += `<div class="${cls}">${inner}</div>`;
    }
    cellsEl().innerHTML = h;
    renderSprites();
    document.getElementById('maze-door-word').textContent = run.doorWord.m;
    document.getElementById('maze-holding').innerHTML = holding.length ? holding.map(h => `🔑 <b>${esc(h.w)}</b>`).join(' ') : '<span class="dim">없음</span>';
    document.getElementById('maze-hp').innerHTML = UI.hpBar(state.player.hp, playerMaxHp(), 'hp');
    document.getElementById('maze-floor').textContent = `${run.floor}층`;
  }

  function move(dx, dy) {
    if (busy || UI.current() !== 'maze') return;
    const nx = px + dx, ny = py + dy;
    if (!grid[ny] || grid[ny][nx] !== 0) return;
    const c = k(nx, ny);
    if (c === door && !opened) {
      if (holding.length) { tryDoor(); return; }
      if (doorBlocks) { UI.toast(`🔒 "${run.doorWord.m}" 열쇠를 먼저 찾아요!`); Sfx.bad(); return; }
      // 막다른 길이 아니면 길을 막지 않는다 (열쇠 주우러 돌아가지 않게)
    }
    trail = k(px, py); px = nx; py = ny; if (dx) face = dx > 0 ? 1 : -1;
    reveal(); Sfx.step(); step();
    if (keys[c]) {
      holding.push(keys[c]); delete keys[c];
      Sfx.coin(); UI.toast(`🔑 ${holding[holding.length - 1].w} 열쇠를 주웠다!`);
    } else if (monsters[c]) {
      busy = true; render();
      setTimeout(() => encounter(c), 350); return;
    } else if (chest === c) {
      chest = null; const g = Math.round((15 + run.floor * 3) * run.tier); Game.gainGold(g); saveState();
      Sfx.coin(); UI.toast(`🎁 보물상자! +${g}G`, 'gold');
    } else if (c === door && opened) {
      busy = true; render();
      setTimeout(() => { UI.toast('🪜 계단이다! 달려!', 'good'); Runner.start(run); }, 450); return;
    }
    render();
  }

  // 문 앞: 들고 있는 열쇠 중 하나를 고른다 — 여기가 단어 판단 순간
  function tryDoor() {
    if (!holding.length) { UI.toast(`🔒 "${run.doorWord.m}" 열쇠가 필요해! 미로에서 찾아요`); Sfx.bad(); return; }
    if (busy) return;
    busy = true;
    UI.modal(`
      <div class="modal-title">🚪 "${esc(run.doorWord.m)}"</div>
      <div class="modal-sub">어떤 열쇠로 열까?</div>
      <div class="choices">${holding.map((h, i) => `<button class="choice en" data-close="${i}">🔑 ${esc(h.w)}</button>`).join('')}</div>
      <div class="actions"><button class="btn ghost small" data-close="x">더 찾아볼래</button></div>
    `, { onClose: v => { busy = false; if (v !== 'x') useKey(+v); } });
  }
  function useKey(i) {
    const key = holding.splice(i, 1)[0];
    if (key.correct) {
      opened = true; Sfx.door();
      recordResult(run.towerId, run.doorWord, true, false);
      Game.gainExpQuiet(Math.round(3 + run.floor * 0.6)); Game.gainGold(2);
      UI.toast('🔓 문이 열렸다! 계단으로 가자', 'good');
    } else {
      Sfx.bad();
      recordResult(run.towerId, run.doorWord, false, false);
      const dmg = hazardDmg(0.05, run.tower); state.player.hp -= dmg;
      UI.shake(gridEl());
      UI.toast(`💥 삐-! "${key.w}"은(는) "${run.doorWord.m}"이(가) 아니야. 열쇠가 부서졌다! -${dmg}`, 'bad');
      if (state.player.hp <= 0) { busy = true; setTimeout(() => Game.playerDown(), 500); return; }
    }
    saveState(); render();
  }

  function encounter(c) {
    const m = monsters[c];
    Battle.start({
      monster: Game.monsterFor(run.floor, false, m, run.tower), words: run.words, pool: run.pool, towerId: run.towerId, floor: run.floor,
      onWin: () => { delete monsters[c]; busy = false; UI.show('maze'); render(); UI.toast('몬스터를 물리쳤다!', 'good'); },
      onLose: () => Game.playerDown(),
    });
  }

  function key(e) {
    const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
    const d = map[e.key]; if (!d) return;
    e.preventDefault(); move(d[0], d[1]);
  }

  function init() {
    document.querySelectorAll('.dpad-btn[data-dir]').forEach(b => b.addEventListener('click', () => { const [dx, dy] = b.dataset.dir.split(',').map(Number); move(dx, dy); }));
    document.getElementById('maze-quit').addEventListener('click', () => { if (confirm('로비로 돌아갈까요? 이 층은 처음부터 다시 해요.')) Game.toLobby(); });
    // 스와이프
    let sx = 0, sy = 0;
    const g = gridEl();
    g.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    g.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
      if (Math.abs(dx) > Math.abs(dy)) move(Math.sign(dx), 0); else move(0, Math.sign(dy));
    }, { passive: true });
  }

  // 검증/디버그용 상태 조회
  function debug() {
    const openNb = c => {
      const [x, y] = c.split(',').map(Number);
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => grid[y + dy] && grid[y + dy][x + dx] === 0).length;
    };
    return { door, doorBlocks, doorOpenNeighbors: openNb(door), keys: Object.keys(keys), chest, grid };
  }

  return { start, key, init, debug };
})();
