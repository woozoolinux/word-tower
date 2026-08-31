'use strict';
// 층 진행(미로 → 배틀 → 러너 → 클리어), 보스, 투기장, 레벨업 처리
const Game = {
  run: null,
  pendingUps: [],

  // 경험치는 바로 주되, 레벨업 축하 모달은 안전한 순간(층 클리어/쓰러짐)에 몰아서 보여준다
  gainExpQuiet(n) {
    const ups = addExp(n);
    if (ups.length) { this.pendingUps.push(...ups); Sfx.levelup(); UI.toast(`⬆️ 레벨 업! Lv.${ups[ups.length - 1]}`, 'good'); }
    saveState();
  },
  flushLevelUps(cb) {
    if (!this.pendingUps.length) { if (cb) cb(); return; }
    const ups = this.pendingUps; this.pendingUps = [];
    UI.levelUpModal(ups, cb);
  },

  monsterFor(floor, boss, base) {
    if (boss) {
      const b = base || BOSSES[floor % BOSSES.length];
      return { id: b.id, name: b.name, emoji: b.emoji, hp: (30 + floor * 12) * 4, atk: 10 + floor * 2 };
    }
    const m = base || pick(MONSTERS);
    return { id: m.id, name: m.name, emoji: m.emoji, hp: 30 + floor * 12, atk: 8 + floor * 2 };
  },

  startFloor(towerId, n) {
    const tower = towerById(towerId), floors = floorList(tower);
    if (n < 1 || n > floors.length) n = 1;
    const plan = floors[n - 1], pool = allWords(tower);
    const words = plan.type === 'boss' ? floorWords(tower, n) : withReview(towerId, floorWords(tower, n), pool);
    this.run = { towerId, tower, floor: n, plan, words, pool, total: floors.length };
    state.player.hp = playerMaxHp(); saveState();
    if (plan.type === 'boss') this.startBoss(); else Maze.start(this.run);
  },
  startBoss() {
    const r = this.run, base = BOSSES[r.plan.bossIdx % BOSSES.length];
    UI.toast(`👑 ${r.floor}층 보스 등장!`, 'bad');
    Battle.start({
      monster: this.monsterFor(r.floor, true, base), words: r.words, pool: r.pool, towerId: r.towerId, floor: r.floor, boss: true,
      onWin: () => this.floorClear(), onLose: () => this.playerDown(),
    });
  },

  floorClear() {
    const r = this.run, boss = r.plan.type === 'boss';
    const gold = boss ? 80 + r.floor * 10 : 30 + r.floor * 5;
    const exp = boss ? 60 + r.floor * 8 : 25 + r.floor * 4;
    addGold(gold); this.gainExpQuiet(exp);
    const prog = towerProg(r.towerId);
    if (r.floor >= prog.floor) prog.floor = r.floor + 1;
    prog.cleared = Math.max(prog.cleared, r.floor);
    let drop = '';
    if (boss) {
      const petId = BOSS_DROPS[r.plan.bossIdx % BOSS_DROPS.length];
      if (!state.player.owned.pets.includes(petId)) {
        state.player.owned.pets.push(petId); if (!state.player.pet) state.player.pet = petId;
        drop = `<div class="unlock"><span class="big">${PETS[petId].emoji}</span><div>보스가 떨어뜨렸다: <b>${PETS[petId].name}</b> 펫!<div class="toggle-desc">상점에서 데려갈 펫을 고를 수 있어요</div></div></div>`;
      } else { addGold(100); drop = '<div class="reward-row">🎁 보너스 +100G</div>'; }
    }
    saveState();
    const done = r.floor >= r.total;
    const stars = r.words.map(w => `<span class="star-chip"><span class="en">${esc(w.w)}</span> ${esc(w.m)} <span class="stars">${starsText(statFor(r.towerId, w).stars)}</span></span>`).join('');
    UI.modal(`
      <div class="modal-title">${done ? '🏆 타워 정복!' : boss ? '👑 보스 격파!' : `🎉 ${r.floor}층 클리어!`}</div>
      <div class="reward-row">💰 +${gold} &nbsp; ✨ +${exp} EXP</div>
      ${drop}
      <div class="star-list">${stars}</div>
      <div class="actions">
        ${done ? '' : '<button class="btn" data-close="next">다음 층 ➡️</button>'}
        <button class="btn ghost" data-close="lobby">로비로</button>
      </div>
    `, { onClose: v => this.flushLevelUps(() => { if (v === 'next') this.startFloor(r.towerId, r.floor + 1); else this.toLobby(); }) });
  },

  playerDown() {
    Runner.stop(); Sfx.down();
    state.player.hp = playerMaxHp(); saveState();
    UI.modal(`
      <div class="modal-title">😵 쓰러졌다…</div>
      <div class="modal-sub">로비에서 쉬면 HP가 다시 가득 차요.<br>힌트나 물약을 사서 다시 도전해 봐요!</div>
      <div class="actions"><button class="btn" data-close="ok">로비로</button></div>
    `, { onClose: () => this.flushLevelUps(() => this.toLobby()) });
  },

  toLobby() {
    Runner.stop();
    state.player.hp = playerMaxHp(); saveState();
    this.run = null;
    Lobby.render(); UI.show('lobby');
  },

  // 투기장: 지금까지 본 단어로 무한 배틀
  startArena() {
    let words = [];
    window.TOWERS.forEach(t => allWords(t).forEach(w => { if (wordStat(t.id, w.w).seen > 0) words.push(w); }));
    if (words.length < 8) { UI.toast('타워에서 단어를 8개 이상 만난 뒤에 도전할 수 있어요!'); return; }
    let kills = 0;
    state.player.hp = playerMaxHp();
    const spawn = () => {
      const lv = state.player.lv;
      const m = Object.assign({}, pick(MONSTERS));
      Battle.start({
        monster: { id: m.id, name: `${kills + 1}번째 ${m.name}`, emoji: m.emoji, hp: 20 + lv * 8 + kills * 7, atk: Math.round(6 + lv * 1.5 + kills * 1.2) },
        words, pool: words, towerId: 'arena', floor: lv, arena: true,
        onWin: () => { kills++; addGold(5); saveState(); spawn(); },
        onLose: () => end(),
      });
    };
    const end = () => {
      Sfx.down();
      const best = Math.max(state.player.arenaBest, kills), isNew = kills > state.player.arenaBest;
      state.player.arenaBest = best; state.player.hp = playerMaxHp(); saveState();
      UI.modal(`
        <div class="modal-title">🏟️ 투기장 결과</div>
        <div class="reward-row">${kills}마리 격파!</div>
        <div class="modal-sub">${isNew ? '🎊 최고 기록 갱신!' : `최고 기록: ${best}마리`}<br>레벨을 올리면 더 많이 잡을 수 있어요</div>
        <div class="actions"><button class="btn" data-close="ok">로비로</button></div>
      `, { onClose: () => this.flushLevelUps(() => this.toLobby()) });
    };
    spawn();
  },
};

// 로비 뒤 밤하늘: 별 + 달 + 멀리 보이는 탑 실루엣
function buildSky() {
  const sky = document.createElement('div');
  sky.id = 'sky'; sky.setAttribute('aria-hidden', 'true');
  let h = '<div class="moon"></div>';
  for (let i = 0; i < 48; i++) {
    const s = (0.8 + Math.random() * 2.2).toFixed(1);
    h += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 84).toFixed(1)}%;width:${s}px;height:${s}px;opacity:${(0.3 + Math.random() * 0.55).toFixed(2)};animation-delay:${(Math.random() * 4).toFixed(2)}s`;
    h += '"></i>';
  }
  let x = -4;
  while (x < 102) {
    const w = 5 + Math.random() * 8, ht = 26 + Math.random() * 78;
    h += `<u style="left:${x.toFixed(1)}%;width:${w.toFixed(1)}%;height:${ht.toFixed(0)}px"></u>`;
    x += w + Math.random() * 3;
  }
  sky.innerHTML = h;
  document.body.insertBefore(sky, document.body.firstChild);
}

window.addEventListener('DOMContentLoaded', () => {
  loadState();
  buildSky();
  Lobby.init(); Maze.init(); Battle.init(); Runner.init();
  Lobby.render();
  if (typeof Avatar === 'undefined') {
    // 오래된 캐시로 새 파일이 안 실린 경우
    UI.toast('새 버전이 있어요! 새로고침해 주세요 (Ctrl+Shift+R)', 'bad');
  } else if (!state.player.avatar) {
    Lobby.charCreator(true);
  }
  window.addEventListener('keydown', e => {
    if (document.querySelector('.modal-wrap') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const cur = UI.current();
    if (cur === 'maze') Maze.key(e); else if (cur === 'runner') Runner.key(e);
  });
});
