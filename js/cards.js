'use strict';
// 단어 카드: ★★★를 달성하면 "각인 시험"(스펠링) 자격이 생기고, 통과해야 카드를 받는다.
// 4지선다는 알아보는 능력만 검증하므로, 카드는 직접 써내는 능력으로만 얻게 한다.

const RARITY = {
  common: { name: '일반', pt: 1, color: '#9aa5b1', pre: 0 },
  rare:   { name: '희귀', pt: 2, color: '#1fa08a', pre: 1 },
  epic:   { name: '영웅', pt: 3, color: '#8f7bff', pre: 3 },
  legend: { name: '전설', pt: 5, color: '#c9971c', pre: 0.4 },
};


const Cards = (() => {
  function rarityOf(word) {
    const letters = word.w.replace(/[^A-Za-z]/g, '').length;
    const phrase = /[\s-]/.test(word.w);
    if (letters >= 11) return 'legend';
    if (letters >= 8 || phrase) return 'epic';
    if (letters >= 5) return 'rare';
    return 'common';
  }
  const key = (towerId, w) => towerId + ':' + w;
  const has = (towerId, w) => !!state.player.cards[key(towerId, w)];
  const isPending = (towerId, w) => state.player.pendingCards.indexOf(key(towerId, w)) >= 0;

  // ★★★ 달성 → 시험 대기열에 올린다 (카드는 시험을 통과해야 받는다)
  function onMastered(towerId, word) {
    const k = key(towerId, word.w);
    if (state.player.cards[k] || state.player.pendingCards.indexOf(k) >= 0) return;
    state.player.pendingCards.push(k);
    saveState();
  }
  function grant(towerId, word) {
    const k = key(towerId, word.w);
    state.player.cards[k] = RARITY[rarityOf(word)].pt;
    const i = state.player.pendingCards.indexOf(k);
    if (i >= 0) state.player.pendingCards.splice(i, 1);
    saveState();
  }
  const count = () => Object.keys(state.player.cards).length;
  const points = () => Object.values(state.player.cards).reduce((a, b) => a + b, 0);

  function findWord(k) {
    const i = k.indexOf(':'), tid = k.slice(0, i), w = k.slice(i + 1);
    const t = towerById(tid);
    if (!t) return null;
    return allWords(t).find(x => x.w === w) || null;
  }
  function pendingFor(towerId) {
    return state.player.pendingCards.filter(k => k.slice(0, k.indexOf(':')) === towerId).map(findWord).filter(Boolean);
  }
  function unitStat(tower, unit) {
    const ws = tower.units.find(u => u.unit === unit).words;
    return { have: ws.filter(w => has(tower.id, w.w)).length, total: ws.length };
  }
  // 보스 층: 그 보스가 다루는 단원들의 카드를 일정 비율 이상 모아야 한다
  function gateInfo(tower, upTo) {
    const ws = allWords(tower).filter(w => w.unit <= upTo);
    const have = ws.filter(w => has(tower.id, w.w));
    const need = Math.ceil(ws.length * BAL.cards.bossGate);
    return { have: have.length, need, total: ws.length, ok: have.length >= need, missing: ws.filter(w => !has(tower.id, w.w)) };
  }

  // ---------- 각인 시험 (스펠링) ----------
  // hard = 정찰 "이건 알아!" 도전용. 도움 글자가 없고 함정 글자가 더 많다.
  function buildTest(word, hard) {
    const r = rarityOf(word), chars = word.w.split('');
    const letterIdx = chars.map((c, i) => i).filter(i => /[A-Za-z]/.test(chars[i]));
    const preSpec = RARITY[r].pre;
    let preN = hard ? 0 : (preSpec < 1 ? Math.ceil(letterIdx.length * preSpec) : Math.min(preSpec, letterIdx.length - 2));
    preN = Math.max(0, Math.min(preN, letterIdx.length - 2));
    const pre = new Set();
    if (preN > 0) { pre.add(letterIdx[0]); shuffle(letterIdx.slice(1)).slice(0, preN - 1).forEach(i => pre.add(i)); }
    const slots = chars.map((c, i) => ({
      ch: c,
      fixed: !/[A-Za-z]/.test(c) || pre.has(i), // 공백·하이픈과 미리 준 글자는 고정
      filled: null,
    }));
    let tiles = slots.filter(s => !s.fixed).map(s => s.ch);
    const decoy = (hard ? BAL.cards.decoyHard : BAL.cards.decoyNormal)[r];
    if (decoy) {
      const used = new Set(word.w.toLowerCase().split(''));
      const extra = 'abcdefghiklmnoprstuwy'.split('').filter(c => !used.has(c));
      tiles = tiles.concat(shuffle(extra).slice(0, decoy));
    }
    return { word, r, slots, tiles: shuffle(tiles) };
  }

  // 어디서든 쓰는 스펠링 시험 위젯. done(true/false)로 결과만 돌려준다.
  function spellTest(word, opts, done) {
    const t = buildTest(word, opts.hard);
    const used = [];
    let settled = false;
    const open = () => t.slots.map((s, i) => i).filter(i => !t.slots[i].fixed);
    const render = () => `
      <div class="modal-title">${opts.title || '🃏 카드 각인 시험'}</div>
      <div class="modal-sub">${opts.sub || '글자를 순서대로 눌러 단어를 완성해요'}</div>
      <div class="spell-slots">${t.slots.map((s, i) => {
        const v = s.fixed ? s.ch : (used[open().indexOf(i)] !== undefined ? t.tiles[used[open().indexOf(i)]] : '');
        const sep = /[\s-]/.test(s.ch);
        return `<span class="slot ${s.fixed ? 'fixed' : ''} ${sep ? 'sep' : ''} ${v ? 'on' : ''}">${sep ? (s.ch === ' ' ? '&nbsp;' : s.ch) : esc(v || '')}</span>`;
      }).join('')}</div>
      <div class="spell-tiles">${t.tiles.map((c, i) =>
        `<button class="tile ${used.indexOf(i) >= 0 ? 'used' : ''}" data-tile="${i}" ${used.indexOf(i) >= 0 ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>
      <div class="actions"><button class="btn ghost small" data-act="back">⌫ 하나 지우기</button>
        ${opts.allowSkip ? '<button class="btn ghost small" data-act="skip">나중에</button>' : ''}</div>`;
    const m = UI.modal(render(), { cls: 'spell' });
    m.body.addEventListener('click', e => {
      if (settled) return;
      const tile = e.target.closest('[data-tile]');
      if (tile) {
        if (used.length >= open().length) return;
        used.push(+tile.dataset.tile); Sfx.step();
        m.body.innerHTML = render();
        if (used.length === open().length) {
          const slots = open();
          const answer = t.slots.map((s, i) => s.fixed ? s.ch : t.tiles[used[slots.indexOf(i)]]).join('');
          setTimeout(() => {
            settled = true; m.close();
            done(answer.toLowerCase() === word.w.toLowerCase(), answer);
          }, 260);
        }
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'back') { used.pop(); m.body.innerHTML = render(); }
      else { settled = true; m.close(); done(null); }
    });
  }

  // 정찰 도전 통과 → ★★★까지 채우고 카드 즉시 지급
  function grantDirect(towerId, word) {
    const st = wordStat(towerId, word.w);
    st.stars = 3;
    grant(towerId, word);
  }

  // 시험 목록을 하나씩 진행. 통과하면 카드 지급.
  function runTests(words, cb) {
    const queue = words.slice();
    const earned = [];
    (function next() {
      if (!queue.length) { cb && cb(earned); return; }
      showTest(queue.shift(), ok => { if (ok) earned.push(ok); next(); });
    })();
  }

  function showTest(word, done) {
    const r = RARITY[rarityOf(word)];
    spellTest(word, {
      title: '🃏 카드 각인 시험',
      sub: `글자를 순서대로 눌러 단어를 완성해요<br><b style="color:${r.color}">${r.name}</b> 카드 · <b>${esc(word.m)}</b>`,
      allowSkip: true,
    }, (ok, answer) => {
      if (ok === null) { done(null); return; }
      if (ok) {
        grant(word.towerId, word);
        Sfx.fanfare(); UI.confetti({ count: rarityOf(word) === 'legend' ? 140 : 70, colors: [r.color, '#ffffff', '#ffc83d'] });
        UI.modal(`
          <div class="modal-title">✨ 각인 성공!</div>
          <div class="card-reveal">${cardHtml(word.towerId, word, true)}</div>
          <div class="modal-sub">카드를 얻었어요! 도감에서 볼 수 있어요</div>
          <div class="actions"><button class="btn" data-close="ok">좋아!</button></div>`,
          { onClose: () => done(word) });
      } else {
        Sfx.bad();
        UI.modal(`
          <div class="modal-title">🤔 아직이야!</div>
          <div class="modal-sub">쓴 것: <b class="spell-wrong">${esc(answer)}</b><br>정답: <b class="spell-right">${esc(word.w)}</b><br><br>★★★는 그대로예요. 도감에서 다시 도전할 수 있어요!</div>
          <div class="actions"><button class="btn" data-close="ok">다시 해볼게</button></div>`,
          { onClose: () => done(null) });
      }
    });
  }
  // 잠긴 오라도 미리 보여준다 — 목표가 눈에 보여야 모으고 싶어진다
  function previewAura(id) {
    const owned = state.player.owned.auras.indexOf(id) >= 0;
    UI.modal(`
      <div class="modal-title">${AURAS[id].emoji} ${AURAS[id].name}</div>
      <div class="modal-sub">${owned ? '이미 가지고 있어요! 🎨 꾸미기에서 바꿀 수 있어요' : '이 단원의 단어 카드를 전부 모으면 열려요'}</div>
      <div class="creator-preview">${Avatar.html(150, { aura: id, pet: '', weapon: false })}</div>
      <div class="actions">
        ${owned ? '<button class="btn" data-close="wear">지금 착용</button>' : ''}
        <button class="btn ghost small" data-close="x">닫기</button>
      </div>`,
      { onClose: v => { if (v === 'wear') { state.player.aura = id; saveState(); Lobby.render(); UI.toast('오라를 착용했어요!', 'good'); } } });
  }

  // ---------- 도감 ----------
  function cardHtml(towerId, word, owned) {
    const r = rarityOf(word), R = RARITY[r];
    const st = wordStat(towerId, word.w);
    const pending = isPending(towerId, word.w);
    return `<div class="wcard r-${r} ${owned ? 'owned' : 'locked'} ${pending ? 'pending' : ''}" ${pending ? `data-test="${esc(towerId)}:${esc(word.w)}"` : ''}>
      <div class="wc-en">${owned ? esc(word.w) : (pending ? '시험!' : '?')}</div>
      <div class="wc-ko">${esc(word.m)}</div>
      <div class="wc-foot"><span class="wc-r" style="color:${R.color}">${R.name}</span><span class="stars">${starsText(st.stars)}</span></div>
    </div>`;
  }

  function book(towerId) {
    let cur = towerId || window.TOWERS[0].id;
    const html = () => {
      const t = towerById(cur), ws = allWords(t);
      const owned = ws.filter(w => has(cur, w.w)).length;
      const tabs = window.TOWERS.map(x =>
        `<button class="btn small ${x.id === cur ? '' : 'ghost'}" data-tab="${x.id}">${esc(x.name)}</button>`).join('');
      const units = t.units.map(u => {
        const s = unitStat(t, u.unit), doneU = s.have >= s.total;
        const aid = auraFor(t, u.unit);
        const rw = aid ? `<button class="unit-reward ${doneU ? 'got' : ''}" data-aurapv="${aid}">${AURAS[aid].emoji} ${AURAS[aid].name}${doneU ? ' 획득!' : ' 👁'}</button>` : '';
        return `<h4>Unit ${u.unit} <span class="unit-prog">${s.have} / ${s.total}</span> ${rw}</h4>
          <div class="bar exp"><div class="bar-fill" style="width:${s.have / s.total * 100}%"></div></div>
          <div class="card-grid">${u.words.map(w => cardHtml(cur, w, has(cur, w.w))).join('')}</div>`;
      }).join('');
      return `<div class="modal-title">🃏 단어 도감</div>
        <div class="modal-sub">전체 ${count()}장 · ${points()}포인트 &nbsp;|&nbsp; 이 타워 ${owned} / ${ws.length}장</div>
        <div class="opt-row" style="justify-content:center;margin-bottom:6px">${tabs}</div>
        <div class="toggle-desc" style="text-align:center">★★★ 단어에 <b>시험!</b>이 뜨면 눌러서 각인하세요<br>단원 제목 옆 <b>오라 배지</b>를 누르면 미리 볼 수 있어요 👁</div>
        ${units}
        <div class="actions"><button class="btn ghost small" data-close="x">닫기</button></div>`;
    };
    const m = UI.modal(html());
    const refresh = () => { m.body.innerHTML = html(); m.rebind(); };
    m.body.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { cur = tab.dataset.tab; refresh(); return; }
      const pv = e.target.closest('[data-aurapv]');
      if (pv) { previewAura(pv.dataset.aurapv); return; }
      const card = e.target.closest('[data-test]');
      if (card) {
        const k = card.dataset.test, w = findWord(k);
        if (w) { m.close(); runTests([w], () => { book(cur); Lobby.render(); }); }
      }
    });
  }

  // 단원을 완성하면 오라가 열리고, 타워를 전부 모으면 칭호 + 영구 보너스가 붙는다
  function auraFor(tower, unit) {
    const i = tower.units.findIndex(u => u.unit === unit);
    return (tower.auras && tower.auras[i]) || null;
  }
  function pendingRewards(towerId) {
    const t = towerById(towerId), out = [];
    if (!t) return out;
    t.units.forEach(u => {
      const s = unitStat(t, u.unit);
      const k = t.id + ':' + u.unit;
      if (s.have >= s.total && !state.player.setBonus[k]) {
        const a = auraFor(t, u.unit);
        if (a) out.push({ kind: 'aura', key: k, aura: a, unit: u.unit, tower: t });
      }
    });
    const all = allWords(t);
    if (all.every(w => has(t.id, w.w)) && t.clearBonus && !state.player.towerClear[t.id]) {
      out.push({ kind: 'tower', tower: t });
    }
    return out;
  }
  // 보상을 하나씩 모달로 보여준다
  function claimRewards(towerId, cb) {
    const list = pendingRewards(towerId);
    (function next() {
      if (!list.length) { cb && cb(); return; }
      const r = list.shift();
      if (r.kind === 'aura') {
        state.player.setBonus[r.key] = r.aura;
        if (state.player.owned.auras.indexOf(r.aura) < 0) state.player.owned.auras.push(r.aura);
        const wasNone = !state.player.aura || state.player.aura === 'none';
        if (wasNone) state.player.aura = r.aura;
        saveState();
        Sfx.fanfare(); UI.confetti({ count: 120, colors: ['#ffc83d', '#8f7bff', '#ffffff'] });
        UI.modal(`
          <div class="modal-title">🎉 Unit ${r.unit} 완성!</div>
          <div class="modal-sub">${esc(r.tower.name)}의 Unit ${r.unit} 단어를 전부 모았어요</div>
          <div class="creator-preview">${Avatar.html(120, { aura: r.aura, pet: '', weapon: false })}</div>
          <div class="unlock"><span class="big">${AURAS[r.aura].emoji}</span><div><div>새 오라: <b>${AURAS[r.aura].name}</b></div>
            <div class="toggle-desc">골드로는 살 수 없어요! 🎨 꾸미기에서 바꿀 수 있어요</div></div></div>
          <div class="actions"><button class="btn" data-close="ok">멋지다!</button></div>`,
          { cls: 'celebrate', onClose: () => { Lobby.render(); next(); } });
      } else {
        state.player.towerClear[r.tower.id] = true;
        const cb2 = r.tower.clearBonus;
        if (state.player.titles.indexOf(cb2.title) < 0) state.player.titles.push(cb2.title);
        if (!state.player.title) state.player.title = cb2.title;
        saveState();
        Sfx.fanfare(); UI.confetti({ count: 220, life: 4, colors: ['#ffc83d', '#fff3c4', '#ffffff'] });
        UI.modal(`
          <div class="modal-title">🏆 ${esc(r.tower.name)} 완전 정복!</div>
          <div class="modal-sub">이 타워의 단어 카드를 전부 모았어요</div>
          <div class="unlock"><span class="big">🎖️</span><div><div>칭호: <b>${esc(cb2.title)}</b></div>
            <div class="toggle-desc">${cb2.type === 'atk' ? '공격력' : '최대 HP'} +${Math.round(cb2.pct * 100)}% (영구)</div></div></div>
          <div class="actions"><button class="btn" data-close="ok">최고!</button></div>`,
          { cls: 'celebrate', onClose: () => { Lobby.render(); next(); } });
      }
    })();
  }

  return { RARITY, rarityOf, key, has, isPending, buildTest, spellTest, grantDirect, auraFor, pendingRewards, claimRewards, previewAura, onMastered, grant, count, points, findWord, pendingFor, unitStat, gateInfo, runTests, cardHtml, book };
})();
