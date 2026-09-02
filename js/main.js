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

  // ---------- 스테이지 파이프라인 ----------
  // 층은 스테이지를 이어 붙인 것이다. 어떤 조합이 나올지는 층마다 달라진다.
  // (예전엔 미로가 러너를 직접 불렀다. 화면이 화면을 부르면 조합을 바꿀 수 없다)
  // 미니게임을 추가하려면 여기 등록 + BAL.stages 목록에 id 추가.
  STAGES: {
    maze:   { name: '미로',    go: (r, done) => Maze.start(r, done) },
    vault:  { name: '금고 방', go: (r, done) => Vault.start(r, done) },
    runner: { name: '러너',    go: (r, done) => Runner.start(r, done) },
  },
  lastExplore: null,
  pickStages() {
    const s = BAL.stages;
    let pool = s.explore;
    // 같은 탐험 파트가 연달아 나오면 조합을 나눈 의미가 없다
    if (s.avoidRepeat && pool.length > 1) {
      const other = pool.filter(x => x !== this.lastExplore);
      if (other.length) pool = other;
    }
    const explore = pick(pool);
    this.lastExplore = explore;
    return [explore, pick(s.finish)];
  },
  // 다음 스테이지로. 남은 게 없으면 층 클리어.
  nextStage() {
    const r = this.run;
    if (!r) { this.toLobby(); return; }
    const id = r.stages[r.stageIdx++];
    if (!id) { this.floorClear(); return; }
    const st = this.STAGES[id];
    if (!st) { this.nextStage(); return; }   // 없는 id는 건너뛴다 (데이터 오타 방어)
    st.go(r, () => this.nextStage());
  },

  startFloor(towerId, n) {
    const tower = towerById(towerId), floors = floorList(tower);
    if (!this.checkTowerLock(tower)) return;
    if (n < 1 || n > floors.length) n = 1;
    const plan = floors[n - 1], pool = allWords(tower);
    const words = plan.type === 'boss' ? floorWords(tower, n) : withReview(towerId, floorWords(tower, n), pool);
    if (plan.type === 'boss' && !this.bossGate(tower, plan, n)) return;
    const prog0 = towerProg(towerId);
    this.run = {
      towerId, tower, floor: n, plan, words, pool, total: floors.length,
      tier: towerTier(tower), mul: n <= prog0.cleared ? BAL.gold.replayMul : 1,
      stages: plan.type === 'boss' ? [] : this.pickStages(), stageIdx: 0,
    };
    state.player.hp = playerMaxHp(); saveState();
    if (plan.type === 'boss') this.startBoss();
    else Preview.maybeShow(this.run, () => this.nextStage());
  },
  startBoss() {
    const r = this.run, base = BOSSES[r.plan.bossIdx % BOSSES.length];
    UI.toast(`👑 ${r.floor}층 보스 등장!`, 'bad');
    Battle.start({
      monster: this.monsterFor(r.floor, true, base, r.tower), words: r.words, pool: r.pool, towerId: r.towerId, floor: r.floor, boss: true,
      onWin: () => this.floorClear(), onLose: () => this.playerDown(),
    });
  },

  // 등급이 높은 타워는 레벨이 닿거나 이전 등급 왕을 잡아야 들어갈 수 있다.
  // 낮은 등급은 권장 하한이 낮아 항상 열려 있다(고레벨이 복습하러 올 수 있게).
  checkTowerLock(tower) {
    const lock = towerLock(tower);
    if (!lock) return true;
    Sfx.bad();
    const prevK = lock.hasPrevTowers ? Game.kingInfo(lock.prevLevel) : null;
    UI.modal(`
      <div class="modal-title">🚧 이 탑은 아직 널 안 들여보낸다</div>
      <div class="modal-sub">${esc(tower.name)}의 문지기가 막아섰다<br>${prevK ? '둘 중 하나면 길이 열린다' : '조금만 더 강해지면 열린다'}</div>
      <div class="lock-ways">
        <div class="lock-way"><span class="big">⭐</span><div><b>Lv.${lock.needLv} 이상</b>
          <div class="toggle-desc">지금 Lv.${state.player.lv} · ${Math.max(0, lock.needLv - state.player.lv)}레벨 더</div></div></div>
        ${prevK ? `<div class="lock-or">또는</div>
        <div class="lock-way"><span class="big">${lock.prevEmoji}</span><div><b>${esc(lock.prevName)} 왕 격파</b>
          <div class="toggle-desc">카드 ${prevK.have} / ${prevK.need}장</div></div></div>` : ''}
      </div>
      <div class="actions">
        ${prevK && prevK.ok ? `<button class="btn" data-close="king">👑 ${esc(lock.prevName)} 왕에게 도전</button>` : ''}
        <button class="btn ghost" data-close="x">알겠어</button>
      </div>`,
      { onClose: v => { if (v === 'king') Game.startKing(lock.prevLevel); } });
    return false;
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
      <div class="modal-title">🔒 보스가 앞을 막아섰다!</div>
      <div class="modal-sub">Unit ${plan.upTo}까지의 단어 카드가 더 필요해요<br>
        <b style="font-size:22px">${g.have} / ${g.need}장</b> <span class="dim">(전체 ${g.total}개 중)</span></div>
      <div class="bar exp"><div class="bar-fill" style="width:${Math.min(100, g.have / g.need * 100)}%"></div></div>
      <div class="star-summary">이 단어들을 아직 못 외웠다 — 이것만 잡으면 문이 열린다</div>
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
      monster: { id: "slime", name: "연습 허수아비", emoji: "👾", hp: playerAtk() * BAL.cards.practiceHpMul, atk: 0 },
      words: shuffle(words).slice(0, BAL.cards.practiceWords), pool: allWords(tower), towerId: tower.id, floor: 1, practice: true,
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
    const done = () => Cards.claimRewards(towerId, () => { Lobby.render(); cb && cb(); });
    const pend = Cards.pendingFor(towerId).slice(0, BAL.cards.testsPerFloor);
    if (!pend.length) { done(); return; }
    Cards.runTests(pend, done);
  },

  // ---------- 👑 등급 왕 ----------
  // 그 등급 6권 전체 단어로 싸우는 별도 도전. 타워 층에 묻혀 있지 않아
  // 6권을 아직 안 산 아이도 카드만 모으면 도전할 수 있다.
  kingInfo(levelId) {
    const L = levelOf(levelId), towers = levelTowers(levelId);
    if (!L || !towers.length) return null;
    const words = towers.flatMap(t => allWords(t));
    const have = words.filter(w => Cards.has(w.towerId, wkey(w))).length;
    const need = Math.ceil(words.length * BAL.cards.kingGate);
    const nextIdx = LEVELS.findIndex(x => x.id === levelId) + 1;
    return {
      level: L, towers, words, have, need,
      ok: have >= need,
      beaten: kingBeaten(levelId),
      opens: LEVELS[nextIdx] || null,
    };
  },

  startKing(levelId) {
    const k = this.kingInfo(levelId);
    if (!k) return;
    if (!k.ok) {
      Sfx.bad();
      UI.modal(`
        <div class="king-hero locked-hero">${Art.king(k.level.animal)}</div>
        <div class="modal-title">${k.level.emoji} ${esc(k.level.name)} 왕은 아직 널 안 본다</div>
        <div class="king-taunt">"카드도 없이 내 앞에 섰나?<br>${esc(k.level.name)}의 단어를 더 모아 오너라."</div>
        <div class="modal-sub"><b style="font-size:24px">${k.have} / ${k.need}장</b>
          <span class="dim">(${esc(k.level.name)} 등급 ${k.words.length}개 중)</span></div>
        <div class="bar exp"><div class="bar-fill" style="width:${Math.min(100, k.have / k.need * 100)}%"></div></div>
        <div class="star-summary">앞으로 <b>${Math.max(0, k.need - k.have)}장</b> 더 모으면 왕이 널 마주 본다</div>
        <div class="actions"><button class="btn" data-close="x">모아 올게!</button></div>`);
      return;
    }
    this.kingIntro(k);
  },

  // 👑 왕 앞에 서는 순간 — 바로 싸우지 않고 한 번 숨을 고른다.
  // 아이가 "지금 뭘 거는지" 알고 스스로 도전을 누르게 만드는 화면.
  kingIntro(k) {
    const L = k.level, tower = k.towers[k.towers.length - 1];
    const kAtk = Math.round(monsterAtk(BAL.king.floor, true, tower) * BAL.king.atkMul);
    const mistakes = Math.max(1, Math.floor(playerMaxHp() / kAtk));
    UI.modal(`
      <div class="king-hero">${Art.king(L.animal)}</div>
      <div class="modal-title">${L.emoji} ${esc(L.name)} 왕이 길을 막았다</div>
      <div class="king-taunt">"${esc(L.taunt || '덤벼라.').replace(/\n/g, '<br>')}"</div>
      <div class="king-terms">
        <div><span class="big">⚔️</span><div><b>단어 ${k.words.length}개</b>가 전부 나온다
          <div class="toggle-desc">${esc(L.name)} 등급 ${k.towers.length}권 어디서든</div></div></div>
        <div><span class="big">💥</span><div><b>${mistakes}번 틀리면 끝</b>
          <div class="toggle-desc">왕의 한 방은 보스보다 아프다</div></div></div>
        <div><span class="big">👑</span><div><b>${k.opens ? `이기면 ${k.opens.emoji} ${esc(k.opens.name)}의 땅이 열린다` : '이기면 정점에 선다'}</b>
          <div class="toggle-desc">${k.beaten ? '이미 한 번 꺾은 상대다' : '아직 넘어본 적 없는 상대다'}</div></div></div>
      </div>
      <div class="actions">
        <button class="btn king-go" data-close="go">⚔️ 도전한다!</button>
        <button class="btn ghost" data-close="x">조금 더 준비할게</button>
      </div>`,
      { cls: 'celebrate', onClose: v => { if (v === 'go') this.kingFight(k); } });
  },

  kingFight(k) {
    const tower = k.towers[k.towers.length - 1];   // 수치 기준은 그 등급 마지막 권
    const f = BAL.king.floor;
    this.run = null;
    this.kingCtx = k;
    state.player.hp = playerMaxHp(); saveState();
    UI.toast(`👑 ${k.level.name} 왕이 포효한다!`, 'bad');
    Battle.start({
      monster: {
        id: k.level.animal, name: `${k.level.name} 왕`, emoji: k.level.emoji, king: true,
        hp: Math.round(monsterHp(f, true, tower) * BAL.king.hpMul),
        atk: Math.round(monsterAtk(f, true, tower) * BAL.king.atkMul),
      },
      words: k.words, pool: k.words, towerId: tower.id, floor: f, boss: true, king: true,
      onWin: () => { this.kingCtx = null; this.kingWin(k.level.id); },
      onLose: () => this.playerDown(),
    });
  },

  kingWin(levelId) {
    const k = this.kingInfo(levelId);
    const first = !kingBeaten(levelId);
    state.player.kings[levelId] = true;
    const gold = Math.round(byFloor(BAL.gold.bossClear, BAL.king.floor)
      * (k.towers[k.towers.length - 1].tier || 1) * BAL.king.goldMul);
    addGold(gold);
    const title = `${k.level.name} 왕을 이긴 자`;
    if (state.player.titles.indexOf(title) < 0) state.player.titles.push(title);
    if (!state.player.title) state.player.title = title;
    saveState();
    Sfx.fanfare(); UI.confetti({ count: 240, life: 4, colors: ['#ffc83d', '#fff3c4', '#ffffff', '#ffe08a'] });
    UI.modal(`
      <div class="modal-title">👑 ${k.level.emoji} ${esc(k.level.name)} 왕을 꺾었다!</div>
      <div class="king-reveal">${Art.king(k.level.animal)}</div>
      <div class="king-taunt yield">"${esc(k.level.yield || '내가 졌다.')}"</div>
      <div class="reward-row">💰 +${gold}</div>
      <div class="unlock"><span class="big">🎖️</span><div><div>칭호: <b>${esc(title)}</b></div>
        <div class="toggle-desc">${esc(k.level.name)} 등급을 완전히 지배했어요</div></div></div>
      ${first && k.opens ? `<div class="unlock"><span class="big">${k.opens.emoji}</span><div><div><b>${esc(k.opens.name)}</b> 등급이 열렸다!</div>
        <div class="toggle-desc">레벨이 낮아도 ${esc(k.opens.name)} 탑에 들어갈 수 있어요</div></div></div>` : ''}
      <div class="actions"><button class="btn" data-close="ok">최고!</button></div>`,
      { cls: 'celebrate', onClose: () => this.flushLevelUps(() => this.toLobby()) });
  },

  floorClear() {

    const r = this.run;
    if (!r) { this.toLobby(); return; } // 관문에 막혀 층이 시작되지 않은 경우
    const boss = r.plan.type === 'boss';
    const gold = Math.round(byFloor(boss ? BAL.gold.bossClear : BAL.gold.floorClear, r.floor) * r.tier * r.mul);
    const exp = Math.round(byFloor(boss ? BAL.exp.bossClear : BAL.exp.floorClear, r.floor) * r.tier);
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
      } else { const b = Math.round(BAL.gold.petDupBonus * r.tier * r.mul); addGold(b); drop = `<div class="reward-row">🎁 보너스 +${b}G</div>`; }
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
    const k = this.kingCtx; this.kingCtx = null;
    if (k) {                       // 왕에게 졌다 — 분하게, 그러나 다시 오고 싶게
      UI.modal(`
        <div class="king-hero">${Art.king(k.level.animal)}</div>
        <div class="modal-title">${k.level.emoji} ${esc(k.level.name)} 왕이 코웃음을 쳤다</div>
        <div class="king-taunt">"이 정도였나?<br>단어를 더 익히고 다시 와라. 기다려 주지."</div>
        <div class="modal-sub">진 게 아니야. <b>아직</b> 못 이긴 거야.<br>도감에서 ★이 적은 단어부터 다시 보자!</div>
        <div class="actions">
          <button class="btn" data-close="again">⚔️ 한 번 더!</button>
          <button class="btn ghost" data-close="lobby">로비로</button>
        </div>`,
        { onClose: v => this.flushLevelUps(() => { if (v === 'again') this.startKing(k.level.id); else this.toLobby(); }) });
      return;
    }
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
    window.TOWERS.forEach(t => allWords(t).forEach(w => { if (statFor(t.id, w).seen > 0) words.push(w); }));
    if (words.length < BAL.arena.minWords) { UI.toast(`타워에서 단어를 ${BAL.arena.minWords}개 이상 만난 뒤에 도전할 수 있어요!`); return; }
    let kills = 0;
    const A = BAL.arena;
    this.run = null;
    state.player.hp = playerMaxHp();
    const spawn = () => {
      const lv = state.player.lv;
      const m = Object.assign({}, pick(MONSTERS));
      Battle.start({
        monster: {
          id: m.id, name: `${kills + 1}번째 ${m.name}`, emoji: m.emoji,
          hp: Math.round(baseAtk(lv) * (A.hp.base + kills * A.hp.perKill)),
          // 기본HP 기준 — 최대HP 기준이면 HP를 올려주는 보상이 스스로 상쇄된다 (타워와 동일)
          atk: Math.max(A.minAtk, Math.round(hpAt(lv) * (A.atk.base + kills * A.atk.perKill))),
        },
        words, pool: words, towerId: 'arena', floor: lv, arena: true,
        timeLimit: Math.max(A.time.min, A.time.base - kills * A.time.perKill),
        onWin: () => { kills++; addGold(BAL.gold.arenaKill); saveState(); spawn(); },
        onLose: () => end(false),
        onRetire: () => end(true),
      });
    };
    // retired = 스스로 그만둠. 어느 쪽이든 기록과 보상은 남는다.
    const end = (retired) => {
      const best = Math.max(state.player.arenaBest, kills), isNew = kills > state.player.arenaBest;
      state.player.arenaBest = best; state.player.hp = playerMaxHp(); saveState();
      if (isNew && kills > 0) { Sfx.fanfare(); UI.confetti({ count: 90 }); }
      else if (retired) Sfx.win(); else Sfx.down();
      UI.modal(`
        <div class="modal-title">${retired ? '🏳️ 여기까지!' : '🏟️ 투기장 결과'}</div>
        <div class="reward-row">${kills}마리 격파!</div>
        <div class="modal-sub">${isNew && kills > 0 ? '🎊 최고 기록 갱신!' : `최고 기록: ${best}마리`}<br>
          ${retired ? '받은 골드와 경험치는 그대로예요' : '레벨을 올리면 더 많이 잡을 수 있어요'}</div>
        <div class="actions"><button class="btn" data-close="ok">로비로</button></div>
      `, { cls: isNew && kills > 0 ? 'celebrate' : '', onClose: () => this.flushLevelUps(() => this.toLobby()) });
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
  Lobby.init(); Maze.init(); Battle.init(); Vault.init(); Runner.init();
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
