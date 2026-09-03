'use strict';
// 🔐 금고 방 — 자물쇠(한글 뜻) 여러 개에 단어 카드(영어)를 꽂는다.
//
// 미로 문과 뭐가 다른가: 미로는 "이 뜻에 맞는 열쇠 하나"를 고른다.
// 금고는 여러 개를 **동시에 놓고 배치**한다. 그래서 다른 능력이 필요하다 —
// 확실한 것부터 꽂고, 애매한 건 남겨서 소거법으로 좁힌다.
// 틀린 카드는 부서져 영영 못 쓰므로, 꽂는 순서 자체가 게임이 된다.
const Vault = (() => {
  let run, onDone, locks, cards, sel, busy, guarded;
  const $ = id => document.getElementById(id);

  // 남은 카드로 남은 자물쇠를 다 열 수 있나
  const liveCards = () => cards.filter(c => !c.used && !c.broken).length;
  const openLocks = () => locks.filter(l => l.open).length;
  const restLocks = () => locks.length - openLocks();

  function start(r, done) {
    run = r; onDone = done; sel = null; busy = false; guarded = false;

    const v = BAL.vault;
    const n = Math.min(v.maxLocks, Math.round(v.locks + run.floor * v.perFloor));
    // 자물쇠에 쓸 단어는 뜻이 겹치지 않게 (뜻이 같으면 정답이 둘이 된다)
    const seenM = new Set();
    const picked = [];
    for (const w of shuffle(run.words)) {
      if (seenM.has(w.m)) continue;
      seenM.add(w.m); picked.push(w);
      if (picked.length >= n) break;
    }
    locks = picked.map(w => ({ word: w, open: false }));

    // 오답 카드: 자물쇠 단어와 뜻·철자가 겹치지 않는 것만
    const taken = new Set(picked.map(w => w.w));
    const decoys = shuffle(run.pool)
      .filter(w => !taken.has(w.w) && !seenM.has(w.m))
      .slice(0, v.extraCards);

    cards = shuffle([...picked, ...decoys].map(w => ({ w: w.w, used: false, broken: false })));

    UI.show('vault');
    render();
    UI.toast(`🔐 ${run.floor}층 금고 방 · 자물쇠 ${locks.length}개!`);
  }

  function render() {
    $('vault-floor').textContent = `${run.floor}층`;
    $('vault-hp').innerHTML = UI.hpBar(state.player.hp, playerMaxHp(), 'hp');
    $('vault-msg').innerHTML = sel === null
      ? `자물쇠 <b>${restLocks()}</b>개 남음 · 카드를 먼저 골라요`
      : `🔑 <b class="en">${esc(cards[sel].w)}</b> — 어느 자물쇠에 꽂을까?`;

    $('vault-locks').innerHTML = locks.map((l, i) => `
      <button class="lock ${l.open ? 'open' : ''}" data-lock="${i}" ${l.open ? 'disabled' : ''}>
        <span class="lk-icon">${l.open ? '🔓' : '🔒'}</span>
        <span class="lk-ko">${esc(l.word.m)}</span>
        <span class="lk-en">${l.open ? esc(l.word.w) : ''}</span>
      </button>`).join('');

    $('vault-cards').innerHTML = cards.map((c, i) => {
      if (c.used) return '';
      return `<button class="vcard ${c.broken ? 'broken' : ''} ${sel === i ? 'sel' : ''}"
        data-card="${i}" ${c.broken ? 'disabled' : ''}>${esc(c.w)}</button>`;
    }).join('');
  }

  function tapCard(i) {
    if (busy || cards[i].broken || cards[i].used) return;
    sel = sel === i ? null : i;
    Sfx.step(); render();
  }

  function tapLock(i) {
    if (busy || locks[i].open) return;
    if (sel === null) { UI.toast('먼저 카드를 골라요!'); return; }
    const card = cards[sel], lock = locks[i];

    if (card.w === lock.word.w) {
      card.used = true; lock.open = true; sel = null;
      Sfx.door();
      recordResult(run.towerId, lock.word, true, false);
      Game.gainExpQuiet(Math.round(byFloor(BAL.exp.vaultLock, normFloor(run.floor, run.tower))));
      Game.gainGold(BAL.gold.vaultLock);
      UI.toast(`🔓 열렸다! "${lock.word.m}"`, 'good');
      render(); saveState();
      // 중간쯤 열면 금고지기가 깨어난다
      if (!guarded && BAL.vault.guardAt && openLocks() >= BAL.vault.guardAt && restLocks() > 0) {
        guarded = true; busy = true;
        setTimeout(guardian, 500);
        return;
      }
    } else {
      card.broken = true; sel = null;
      Sfx.bad();
      recordResult(run.towerId, lock.word, false, false);
      const dmg = hazardDmg(BAL.hazard.vaultWrongCard, run.tower);
      state.player.hp -= dmg;
      UI.shake($('vault-locks'));
      UI.toast(`💥 "${card.w}" 카드가 부서졌다! -${dmg}`, 'bad');
      render(); saveState();
      if (state.player.hp <= 0) { busy = true; setTimeout(() => Game.playerDown(), 500); return; }
    }
    checkEnd();
  }

  // 금고를 지키던 몬스터
  function guardian() {
    UI.toast('👀 금고지기가 깨어났다!', 'bad');
    Battle.start({
      monster: Game.monsterFor(run.floor, false, null, run.tower),
      words: run.words, pool: run.pool, towerId: run.towerId, floor: run.floor, tower: run.tower,
      onWin: () => { busy = false; UI.show('vault'); render(); UI.toast('금고지기를 물리쳤다!', 'good'); },
      onLose: () => Game.playerDown(),
    });
  }

  function checkEnd() {
    if (restLocks() === 0) { finish(true); return; }
    // 남은 카드로 남은 자물쇠를 못 채우면 더 진행할 수 없다
    if (liveCards() < restLocks()) finish(false);
  }

  function finish(all) {
    busy = true;
    const bonus = all ? Math.round(BAL.gold.vaultClear * run.tier) : 0;
    if (bonus) Game.gainGold(bonus);
    saveState();
    if (all) { Sfx.win(); UI.confetti({ count: 60, life: 2 }); } else Sfx.down();

    // 못 연 자물쇠는 정답을 보여주고 넘어간다 (진행을 막지 않는다)
    const missed = locks.filter(l => !l.open);
    const chips = missed.map(l =>
      `<span class="star-chip"><span class="en">${esc(l.word.w)}</span> ${esc(l.word.m)}</span>`).join('');

    UI.modal(`
      <div class="modal-title">${all ? '🎉 금고를 다 열었다!' : '🔒 여기까지…'}</div>
      <div class="modal-sub">자물쇠 <b>${openLocks()} / ${locks.length}</b>개를 열었어요</div>
      ${bonus ? `<div class="reward-row">💰 +${bonus}</div>` : ''}
      ${missed.length ? `<div class="star-summary">못 연 자물쇠의 답</div><div class="star-list">${chips}</div>` : ''}
      <div class="actions"><button class="btn" data-close="ok">다음 구간으로 ▶</button></div>
    `, { cls: all ? 'celebrate' : '', onClose: () => onDone() });
  }

  function init() {
    $('vault-locks').addEventListener('click', e => {
      const b = e.target.closest('[data-lock]'); if (b && !b.disabled) tapLock(+b.dataset.lock);
    });
    $('vault-cards').addEventListener('click', e => {
      const b = e.target.closest('[data-card]'); if (b && !b.disabled) tapCard(+b.dataset.card);
    });
    $('vault-quit').addEventListener('click', () => {
      if (confirm('로비로 돌아갈까요? 이 층은 처음부터 다시 해요.')) Game.toLobby();
    });
  }

  // 검증/디버그용
  function debug() { return { locks, cards, live: liveCards(), rest: restLocks() }; }

  return { start, init, debug };
})();
