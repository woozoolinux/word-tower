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

  monsterFor(floor, boss, base, tower) {
    const src = base || (boss ? BOSSES[floor % BOSSES.length] : pick(MONSTERS));
    return {
      id: src.id, name: src.name, emoji: src.emoji,
      hp: monsterHp(floor, boss, tower), atk: monsterAtk(floor, boss, tower),
    };
  },

  // 이미 깬 층을 다시 돌면 보상이 크게 준다 (반복 파밍 방지)
  gainGold(n) { addGold(Math.max(1, Math.round(n * (this.run ? this.run.mul : 1)))); },

  startFloor(towerId, n) {
    const tower = towerById(towerId), floors = floorList(tower);
    if (n < 1 || n > floors.length) n = 1;
    const plan = floors[n - 1], pool = allWords(tower);
    const words = plan.type === 'boss' ? floorWords(tower, n) : withReview(towerId, floorWords(tower, n), pool);
    if (plan.type === 'boss' && !this.bossGate(tower, plan, n)) return;
    const prog0 = towerProg(towerId);
    this.run = {
      towerId, tower, floor: n, plan, words, pool, total: floors.length,
      tier: towerTier(tower), mul: n <= prog0.cleared ? 0.3 : 1,
    };
    state.player.hp = playerMaxHp(); saveState();
    if (plan.type === 'boss') this.startBoss(); else Maze.start(this.run);
  },
  startBoss() {
    const r = this.run, base = BOSSES[r.plan.bossIdx % BOSSES.length];
    UI.toast(`👑 ${r.floor}층 보스 등장!`, 'bad');
    Battle.start({
      monster: this.monsterFor(r.floor, true, base, r.tower), words: r.words, pool: r.pool, towerId: r.towerId, floor: r.floor, boss: true,
      onWin: () => this.floorClear(), onLose: () => this.playerDown(),
    });
  },

  // 보스 층은 해당 단원 카드를 일정 비율 모아야 들어갈 수 있다 (일반 층은 자유)
  bossGate(tower, plan, n) {
    const g = Cards.gateInfo(tower, plan.upTo);
    if (g.ok) return true;
    Sfx.bad();
    const list = shuffle(g.missing).slice(0, 10);
    const chips = list.map(w => `<span class="star-chip"><span class="en">${esc(w.w)}</span> ${esc(w.m)} <span class="stars">${starsText(statFor(tower.id, w).stars)}</span></span>`).join("")
      + (g.missing.length > list.length ? `<span class="star-chip more">외 ${g.missing.length - list.length}개</span>` : "");
    UI.modal(`
      <div class="modal-title">🔒 보스가 문을 막았다!</div>
      <div class="modal-sub">Unit ${plan.upTo}까지의 단어 카드가 더 필요해요<br>
        <b style="font-size:22px">${g.have} / ${g.need}장</b> <span class="dim">(전체 ${g.total}개 중)</span></div>
      <div class="bar exp"><div class="bar-fill" style="width:${Math.min(100, g.have / g.need * 100)}%"></div></div>
      <div class="star-summary">아직 카드가 없는 단어</div>
      <div class="star-list">${chips}</div>
      <div class="actions">
        <button class="btn" data-close="practice">📖 복습하러 가기</button>
        <button class="btn ghost" data-close="lobby">나중에</button>
      </div>`,
      { onClose: v => { if (v === "practice") this.startPractice(tower, g.missing); else this.toLobby(); } });
    return false;
  },

  // 복습 배틀: 허수아비라 맞아도 아프지 않다. 카드가 없는 단어만 나온다.
  startPractice(tower, words) {
    this.run = null;
    state.player.hp = playerMaxHp();
    UI.toast("📖 복습 배틀! 허수아비는 때리지 않아요", "good");
    Battle.start({
      monster: { id: "slime", name: "연습 허수아비", emoji: "👾", hp: playerAtk() * 10, atk: 0 },
      words: shuffle(words).slice(0, 12), pool: allWords(tower), towerId: tower.id, floor: 1, practice: true,
      onWin: () => this.afterPractice(tower),
      onLose: () => this.afterPractice(tower),
    });
  },
  afterPractice(tower) {
    Sfx.win();
    this.flushCardTests(tower.id, () => this.flushLevelUps(() => this.toLobby()));
  },

  // 각인 시험: 층이 끝난 뒤 최대 2장까지 바로, 나머지는 도감에서
  flushCardTests(towerId, cb) {
    const pend = Cards.pendingFor(towerId).slice(0, 2);
    if (!pend.length) { cb && cb(); return; }
    Cards.runTests(pend, () => { Lobby.render(); cb && cb(); });
  },

  floorClear() {
    const r = this.run;
    if (!r) { this.toLobby(); return; } // 관문에 막혀 층이 시작되지 않은 경우
    const boss = r.plan.type === 'boss';
    const gold = Math.round((boss ? 60 + r.floor * 8 : 20 + r.floor * 3) * r.tier * r.mul);
    const exp = Math.round((boss ? 50 + r.floor * 6 : 20 + r.floor * 3) * r.tier);
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
      } else { const b = Math.round(80 * r.tier * r.mul); addGold(b); drop = `<div class="reward-row">🎁 보너스 +${b}G</div>`; }
      if (r.mul < 1) drop += '<div class="star-summary">이미 깬 층이라 골드는 줄었어요 (경험치는 그대로!)</div>';
    }
    saveState();
    const done = r.floor >= r.total;
    const pendN = Cards.pendingFor(r.towerId).length;
    const MAX_CHIPS = 12;
    const byStars = r.words.slice().sort((a, b) => statFor(r.towerId, a).stars - statFor(r.towerId, b).stars);
    const shown = byStars.slice(0, MAX_CHIPS);
    const mastered = r.words.filter(w => statFor(r.towerId, w).stars >= 3).length;
    const stars =
      `<div class="star-summary">⭐ 이 층 단어 ${r.words.length}개 중 마스터 ${mastered}개` +
      (r.words.length > MAX_CHIPS ? ' · 더 연습할 단어부터 표시' : '') + '</div>' +
      '<div class="star-list">' +
      shown.map(w => `<span class="star-chip"><span class="en">${esc(w.w)}</span> ${esc(w.m)} <span class="stars">${starsText(statFor(r.towerId, w).stars)}</span></span>`).join('') +
      (r.words.length > MAX_CHIPS ? `<span class="star-chip more">외 ${r.words.length - MAX_CHIPS}개</span>` : '') +
      '</div>';
    const party = done
      ? { count: 220, life: 4, colors: ['#ffc83d', '#fff3c4', '#ffffff', '#ffe08a'] }
      : boss ? { count: 140, life: 3.2, colors: ['#ffc83d', '#ff6b7a', '#ffffff', '#8f7bff'] }
        : { count: 70, life: 2.4 };
    if (boss || done) Sfx.fanfare();
    UI.confetti(party);
    UI.modal(`
      <div class="modal-title">${done ? '🏆 타워 정복!' : boss ? '👑 보스 격파!' : `🎉 ${r.floor}층 클리어!`}</div>
      <div class="reward-row">💰 +${gold} &nbsp; ✨ +${exp} EXP</div>
      ${pendN ? `<div class="unlock"><span class="big">🃏</span><div><div>각인 시험 <b>${pendN}장</b> 준비됨!</div><div class="toggle-desc">스펠링을 맞히면 카드를 받아요</div></div></div>` : ''}
      ${drop}
      ${stars}
      <div class="actions">
        ${done ? '' : '<button class="btn" data-close="next">다음 층 ➡️</button>'}
        <button class="btn ghost" data-close="lobby">로비로</button>
      </div>
    `, { cls: 'celebrate', onClose: v => this.flushCardTests(r.towerId, () => this.flushLevelUps(() => {
      if (v === 'next') this.startFloor(r.towerId, r.floor + 1); else this.toLobby();
    })) });
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
    this.run = null;
    state.player.hp = playerMaxHp();
    const spawn = () => {
      const lv = state.player.lv;
      const m = Object.assign({}, pick(MONSTERS));
      Battle.start({
        monster: {
          id: m.id, name: `${kills + 1}번째 ${m.name}`, emoji: m.emoji,
          hp: Math.round(baseAtk(lv) * (2 + kills * 0.35)),
          atk: Math.max(3, Math.round(playerMaxHp() * (0.05 + kills * 0.012))),
        },
        words, pool: words, towerId: 'arena', floor: lv, arena: true,
        onWin: () => { kills++; addGold(3); saveState(); spawn(); },
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
