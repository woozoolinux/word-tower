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
    touchTower(towerId);
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
      monster: this.monsterFor(r.floor, true, base, r.tower), words: r.words, pool: r.pool, towerId: r.towerId, floor: r.floor, tower: r.tower, boss: true,
      onWin: () => this.floorClear(), onLose: () => this.playerDown(),
    });
  },

  // 등급이 높은 타워는 레벨이 닿거나 이전 등급 왕을 잡아야 들어갈 수 있다.
  // 낮은 등급은 권장 하한이 낮아 항상 열려 있다(고레벨이 복습하러 올 수 있게).
  // 잠긴 탑의 문 앞. 막는 화면이 아니라 "여기가 어떤 곳인지" 보여주는 화면이다.
  // 못 들어간다고만 하면 아이는 갈 데를 잃는다 — 지금 갈 수 있는 탑을 같이 준다.
  checkTowerLock(tower) {
    const lock = towerLock(tower);
    if (!lock) return true;
    Sfx.bad();
    const L = levelOf(tower.level);
    const prevK = lock.hasPrevTowers ? Game.kingInfo(lock.prevLevel) : null;
    const need = Math.max(0, lock.needLv - state.player.lv);
    const pct = Math.min(100, state.player.lv / lock.needLv * 100);
    const open = this.bestOpenTower();
    UI.modal(`
      <div class="gate-art">${Art.tower(0, floorList(tower).length, tower.roof)}<span class="gate-lock">🔒</span></div>
      <div class="modal-title">🚧 문지기가 앞을 막았다</div>
      <div class="gate-flavor">
        여기는 ${L ? `<b>${levelCode(L) || esc(L.name)}</b> — ${L.emoji} <b>${esc(L.name)}</b>가 사는 탑` : '높은 곳'}.<br>
        ${esc(tower.name)}의 단어 <b>${allWords(tower).length}개</b>가 있다.
      </div>
      <div class="king-taunt">${prevK
        ? `"실력을 증명하든지, 더 강해지든지.<br>둘 중 하나다."`
        : `"레벨도 안 되면서 건방지구나.<br>${L ? `${levelCode(L) ? `${levelCode(L)} ` : ''}${esc(L.name)}` : '이곳'}에게 덤빌 생각을 하다니…"`}</div>
      <div class="lock-ways">
        <div class="lock-way"><span class="big">⭐</span><div><b>Lv.${lock.needLv} 이상</b>
          <div class="bar exp"><div class="bar-fill" style="width:${pct}%"></div>
            <span class="bar-text">Lv.${state.player.lv} / ${lock.needLv}</span></div>
          <div class="toggle-desc">${need ? `<b class="warn">${need}레벨만 더!</b> 아래 탑에서 금방 오른다` : '조건을 채웠어요'}</div></div></div>
        ${prevK ? `<div class="lock-or">또는</div>
        <div class="lock-way"><span class="big">${lock.prevEmoji}</span><div><b>${esc(lock.prevName)} 왕 격파</b>
          <div class="toggle-desc">카드 ${prevK.have} / ${prevK.need}장${prevK.ok ? ' · <b class="warn">지금 도전할 수 있다!</b>' : ''}</div></div></div>` : ''}
      </div>
      <div class="actions">
        ${prevK && prevK.ok ? `<button class="btn" data-close="king">👑 ${esc(lock.prevName)} 왕에게 도전</button>` : ''}
        ${open ? `<button class="btn mint" data-close="go">${esc(open.name)}에서 힘을 키우자</button>` : ''}
        <button class="btn coral" data-close="force">💪 난 이미 ${L && levelCode(L) ? levelCode(L) + '다!' : '준비됐어!'}</button>
        <button class="btn ghost" data-close="x">돌아갈래</button>
      </div>
      <div class="gate-note">이미 ${L && levelCode(L) ? `<b>${levelCode(L)}</b>를` : '이 등급을'} 배우고 있다면 문지기도 못 막는다<br>
        <span class="dim">(탑을 전부 열어 두려면 ⚙️ 설정 → 🔓 타워 잠금 끄기)</span></div>`,
      { onClose: v => {
        if (v === 'king') Game.startKing(lock.prevLevel);
        else if (v === 'go' && open) Game.startFloor(open.id, Math.min(towerProg(open.id).floor, floorList(open).length));
        else if (v === 'force') this.confirmForce(tower, lock);
      } });
    return false;
  },

  // "나는 더 강하다"를 고르는 자리. 말리지는 않되 무슨 일이 벌어지는지는 정확히 말해 준다.
  // 학원이 앞선 책을 내준 경우가 실제로 있으므로, 이 길은 반드시 있어야 한다.
  confirmForce(tower, lock) {
    const L = levelOf(tower.level);
    const gap = Math.max(0, lock.needLv - state.player.lv);
    const code = L ? (levelCode(L) || L.name) : '이 등급';
    UI.modal(`
      <div class="modal-title">💪 자격이 있다는 거지?</div>
      <div class="king-taunt">"이미 <b>${code}</b>를 하고 있다고?<br>…그렇다면 막지 않겠다. 증명해 봐라."</div>
      <div class="lock-ways">
        <div class="lock-way warn-way"><span class="big">🔥</span><div><b>봐주는 건 없다</b>
          <div class="toggle-desc">여긴 ${code}, Lv.${lock.needLv} 이상을 위한 곳<br>지금 Lv.${state.player.lv}${gap ? ` · ${gap}레벨 부족` : ''} — 몬스터가 아주 세게 느껴진다</div></div></div>
        <div class="lock-way"><span class="big">🃏</span><div><b>얻는 건 전부 네 것</b>
          <div class="toggle-desc">카드·경험치·골드 그대로 · 언제든 로비로 나올 수 있어요</div></div></div>
      </div>
      <div class="actions">
        <button class="btn coral" data-close="go">💪 증명하러 간다!</button>
        <button class="btn ghost" data-close="x">역시 그만둘래</button>
      </div>`,
      { onClose: v => {
        if (v !== 'go') return;
        forceOpen(tower.id);
        Sfx.levelup();
        UI.toast(`💪 문지기가 비켜섰다 — ${tower.name}`, 'good');
        Lobby.render();
        this.startFloor(tower.id, Math.min(towerProg(tower.id).floor, floorList(tower).length));
      } });
  },

  // 지금 들어갈 수 있는 탑 중 가장 센 곳 = 경험치가 가장 잘 오르는 곳
  bestOpenTower() {
    const open = (window.TOWERS || []).filter(t => !towerLock(t));
    if (!open.length) return null;
    return open.sort((a, b) => towerTier(a) - towerTier(b))[open.length - 1];
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
    const cd = kingCooldown(levelId);
    if (cd > 0) { this.kingCooldownModal(k, cd); return; }
    if (!k.ok) {
      Sfx.bad();
      UI.modal(`
        <div class="king-hero locked-hero">${Art.king(k.level.animal)}</div>
        <div class="modal-title">${k.level.emoji} ${esc(k.level.name)} 왕은 아직 널 안 본다</div>
        <div class="gate-flavor"><b>${levelCode(k.level) || esc(k.level.name)}</b>를 지배하는 자</div>
        <div class="king-taunt">"카드도 없이 내 앞에 섰나?<br>${esc(k.level.name)}의 단어를 더 모아 오너라."</div>
        <div class="modal-sub"><b style="font-size:24px">${k.have} / ${k.need}장</b>
          <span class="dim">(${esc(k.level.name)} 단어 ${k.words.length}개 중)</span></div>
        <div class="bar exp"><div class="bar-fill" style="width:${Math.min(100, k.have / k.need * 100)}%"></div></div>
        <div class="star-summary">앞으로 <b>${Math.max(0, k.need - k.have)}장</b> 더 모으면 왕이 널 마주 본다</div>
        <div class="actions"><button class="btn" data-close="x">모아 올게!</button></div>`);
      return;
    }
    this.kingIntro(k);
  },

  // 진 직후에는 왕이 다시 상대해 주지 않는다.
  // 연타로 운을 시험하는 대신 그 사이 단어를 보게 만드는 게 목적이라,
  // 이 화면의 주 버튼은 "다시 도전"이 아니라 도감이다.
  kingCooldownModal(k, cd) {
    Sfx.bad();
    const last = k.towers[k.towers.length - 1];
    UI.modal(`
      <div class="king-hero locked-hero">${Art.king(k.level.animal)}</div>
      <div class="modal-title">${k.level.emoji} ${esc(k.level.name)} 왕이 등을 돌렸다</div>
      <div class="gate-flavor"><b>${levelCode(k.level) || esc(k.level.name)}</b>를 지배하는 자</div>
      <div class="king-taunt">"방금 붙어보지 않았나.<br>숨 좀 고르고 오너라."</div>
      <div class="cd-box"><span class="cd-face">⏳</span>
        <div><b data-kingcd="${k.level.id}">${mmss(cd)}</b> 뒤에 다시 마주 본다
        <div class="toggle-desc">게임을 꺼도 시간은 흘러요</div></div></div>
      <div class="star-summary">그 사이에 단어를 한 번 보고 오면 결과가 달라진다</div>
      <div class="actions">
        <button class="btn" data-close="book">📖 단어 보러 가기</button>
        <button class="btn ghost" data-close="x">기다릴게</button>
      </div>`,
      { onClose: v => { if (v === 'book') Cards.book(last.id); } });
  },

  // 👑 왕 앞에 서는 순간 — 바로 싸우지 않고 한 번 숨을 고른다.
  // 아이가 "지금 뭘 거는지" 알고 스스로 도전을 누르게 만드는 화면.
  kingIntro(k) {
    const L = k.level, tower = k.towers[k.towers.length - 1];
    const kAtk = Math.round(monsterAtk(BAL.king.floor, true, tower, true) * BAL.king.atkMul);
    const mistakes = Math.max(1, Math.floor(playerMaxHp() / kAtk));
    UI.modal(`
      <div class="king-hero">${Art.king(L.animal)}</div>
      <div class="modal-title">${L.emoji} ${esc(L.name)} 왕이 길을 막았다</div>
      <div class="gate-flavor"><b>${levelCode(L)}</b> — ${L.emoji} ${esc(L.name)}가 사는 곳의 주인</div>
      <div class="king-taunt">"${esc(L.taunt || '덤벼라.').replace(/\n/g, '<br>')}"</div>
      <div class="king-terms">
        <div><span class="big">⚔️</span><div><b>단어 ${k.words.length}개</b>가 전부 나온다
          <div class="toggle-desc">${esc(L.name)} 탑 ${k.towers.length}권 어디서든</div></div></div>
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
        hp: Math.round(monsterHp(f, true, tower, true) * BAL.king.hpMul),
        atk: Math.round(monsterAtk(f, true, tower, true) * BAL.king.atkMul),
      },
      words: k.words, pool: k.words, towerId: tower.id, floor: f, boss: true, king: true,
      onWin: missed => { this.kingCtx = null; this.kingWin(k.level.id, missed); },
      onLose: missed => this.playerDown(missed),
    });
  },

  kingWin(levelId, missed) {
    const k = this.kingInfo(levelId);
    const first = !kingBeaten(levelId);
    state.player.kings[levelId] = true;
    if (state.player.kingCd) delete state.player.kingCd[levelId];   // 이겼으니 대기도 푼다
    const gold = Math.round(byFloor(BAL.gold.bossClear, BAL.king.floor)
      * (k.towers[k.towers.length - 1].tier || 1) * BAL.king.goldMul);
    addGold(gold);
    const title = `${k.level.name} 왕을 이긴 자`;
    if (state.player.titles.indexOf(title) < 0) state.player.titles.push(title);
    if (!state.player.title) state.player.title = title;
    // 열린 등급의 권장 하한까지 끌어올린다 — 문만 열어 주고 몹은 안 죽으면 허탈하다
    const lv0 = state.player.lv;
    let lvUps = [];
    if (first && k.opens) {
      const ts = levelTowers(k.opens.id);
      const minLv = ts.length ? Math.min(...ts.map(t => towerRange(t)[0])) : 0;
      if (lv0 < minLv) { lvUps = raiseToLv(minLv); this.pendingUps.push(...lvUps); }
    }
    saveState();
    // 새 등급이 "처음" 열리는 순간은 모달로 넘기기 아깝다 — 화면 전체를 쓴다
    if (first && k.opens) {
      Fx.unlock({
        king: k.level, next: k.opens, gold, title,
        missCount: (missed || []).length, words: k.words.length,
        towers: levelTowers(k.opens.id), lv0, lv1: state.player.lv,
      }, () => this.flushLevelUps(() => this.toLobby()));
      return;
    }
    Sfx.fanfare(); UI.confetti({ count: 240, life: 4, colors: ['#ffc83d', '#fff3c4', '#ffffff', '#ffe08a'] });
    UI.modal(`
      <div class="modal-title">👑 ${k.level.emoji} ${esc(k.level.name)} 왕을 ${first ? '꺾었다' : '다시 꺾었다'}!</div>
      <div class="king-reveal">${Art.king(k.level.animal)}</div>
      <div class="king-taunt yield">"${esc(k.level.yield || '내가 졌다.')}"</div>
      <div class="reward-row">💰 +${gold}</div>
      <div class="unlock"><span class="big">🎖️</span><div><div>칭호: <b>${esc(title)}</b></div>
        <div class="toggle-desc">${esc(k.level.name)} 등급을 완전히 지배했어요</div></div></div>
      ${first && k.opens ? `<div class="unlock"><span class="big">${k.opens.emoji}</span><div><div><b>${levelCode(k.opens) || esc(k.opens.name)}</b> 등급 ${esc(k.opens.name)}의 땅이 열렸다!</div>
        <div class="toggle-desc">레벨이 낮아도 ${esc(k.opens.name)} 탑에 들어갈 수 있어요</div></div></div>` : ''}
      <div class="actions"><button class="btn" data-close="ok">최고!</button></div>`,
      { cls: 'celebrate', onClose: () => this.flushLevelUps(() => this.toLobby()) });
  },

  floorClear() {

    const r = this.run;
    if (!r) { this.toLobby(); return; } // 관문에 막혀 층이 시작되지 않은 경우
    const boss = r.plan.type === 'boss';
    const nf = normFloor(r.floor, r.tower);
    const gold = Math.round(byFloor(boss ? BAL.gold.bossClear : BAL.gold.floorClear, nf) * r.tier * r.mul);
    const exp = Math.round(byFloor(boss ? BAL.exp.bossClear : BAL.exp.floorClear, nf) * r.tier);
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

  playerDown(missed) {
    Runner.stop(); Sfx.down();
    state.player.hp = playerMaxHp(); saveState();
    const k = this.kingCtx; this.kingCtx = null;
    if (k) {                       // 왕에게 졌다 — 분하게, 그러나 다시 오고 싶게
      startKingCooldown(k.level.id);
      const wrong = (missed || []).slice(0, 8);
      const mins = Math.round(BAL.king.retryCooldownSec / 60);
      const last = k.towers[k.towers.length - 1];
      UI.modal(`
        <div class="king-hero">${Art.king(k.level.animal)}</div>
        <div class="modal-title">${k.level.emoji} ${esc(k.level.name)} 왕이 코웃음을 쳤다</div>
        <div class="king-taunt">"이 정도였나?<br>${mins}분 줄 테니 익히고 오너라."</div>
        ${wrong.length ? `<div class="star-summary">여기서 무너졌다 — 이것부터 다시 보자</div>
        <div class="miss-list">${wrong.map(w => `<span class="miss-w"><b>${esc(w.w)}</b> ${esc(w.m)}</span>`).join('')}</div>`
          : '<div class="star-summary">진 게 아니야. <b>아직</b> 못 이긴 거야.</div>'}
        <div class="cd-box"><span class="cd-face">⏳</span>
          <div>재도전까지 <b data-kingcd="${k.level.id}">${mmss(kingCooldown(k.level.id))}</b>
          <div class="toggle-desc">게임을 꺼도 시간은 흘러요</div></div></div>
        <div class="actions">
          <button class="btn" data-close="book">📖 이 단어들 보러 가기</button>
          <button class="btn ghost" data-close="lobby">로비로</button>
        </div>`,
        { onClose: v => this.flushLevelUps(() => { this.toLobby(); if (v === 'book') Cards.book(last.id); }) });
      return;
    }
    UI.modal(`
      <div class="modal-title">😵 쓰러졌다…</div>
      <div class="modal-sub">로비에서 쉬면 HP가 다시 가득 차요.<br>힌트나 물약을 사서 다시 도전해 봐요!</div>
      <div class="actions"><button class="btn" data-close="ok">로비로</button></div>
    `, { onClose: () => this.flushLevelUps(() => this.toLobby()) });
  },

  home: 'town',           // 미니게임이 끝나면 돌아갈 곳
  toLobby() {
    Runner.stop();
    if (typeof Dungeon !== 'undefined') Dungeon.stop();
    state.player.hp = playerMaxHp(); saveState();
    this.run = null;
    if (this.home === 'town' && typeof Town !== 'undefined') { Town.resume(); return; }
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
  // 한 단계가 실패해도 나머지는 돌아야 한다. 특히 클릭 연결이 빠지면
  // 화면은 멀쩡한데 아무것도 안 눌리는, 원인을 알 수 없는 상태가 된다.
  const step = (name, fn) => {
    try { fn(); } catch (e) {
      if (window.__errs) window.__errs.push(name + ': ' + e.message);
      window.dispatchEvent(new ErrorEvent('error', { message: name + ' 실패 — ' + e.message }));
    }
  };
  step('저장 불러오기', loadState);
  step('로비 연결', () => Lobby.init());     // 클릭 연결이 제일 먼저
  step('배경', buildSky);
  step('미로', () => Maze.init());
  step('배틀', () => Battle.init());
  step('금고', () => Vault.init());
  step('달리기', () => Runner.init());
  step('로비 그리기', () => Lobby.render());
  step('마을', () => { if (state.player.avatar) Town.start(); });
  if (typeof Avatar === 'undefined') {
    // 오래된 캐시로 새 파일이 안 실린 경우
    UI.toast('새 버전이 있어요! 새로고침해 주세요 (Ctrl+Shift+R)', 'bad');
  } else if (!state.player.avatar) {
    Lobby.charCreator(true);
  }
  // 왕 재도전 카운트다운. 화면 어디에 있든 data-kingcd 를 단 곳을 갱신한다.
  // 0이 되면 로비를 다시 그려 "지금 도전할 수 있다"로 스스로 바뀌게 한다.
  setInterval(() => {
    const els = document.querySelectorAll('[data-kingcd]');
    if (!els.length) return;
    let ended = false;
    els.forEach(el => {
      const s = kingCooldown(el.dataset.kingcd);
      if (s > 0) { el.textContent = mmss(s); return; }
      ended = true;
      el.removeAttribute('data-kingcd');
      const box = el.closest('.cd-box');
      if (box) { box.classList.add('done'); box.innerHTML = '<span class="cd-face">⚔️</span><div><b>이제 다시 도전할 수 있다!</b></div>'; }
      else el.textContent = '도전!';
    });
    if (ended && UI.current() === 'lobby') Lobby.render();
  }, 1000);

  window.addEventListener('keydown', e => {
    if (document.querySelector('.modal-wrap') || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const cur = UI.current();
    if (cur === 'maze') Maze.key(e); else if (cur === 'runner') Runner.key(e);
  });
});
