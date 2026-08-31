'use strict';
// 단어 카드: ★★★를 달성하면 "각인 시험"(스펠링) 자격이 생기고, 통과해야 카드를 받는다.
// 4지선다는 알아보는 능력만 검증하므로, 카드는 직접 써내는 능력으로만 얻게 한다.

const RARITY = {
  common: { name: '일반', pt: 1, color: '#9aa5b1', pre: 0 },
  rare:   { name: '희귀', pt: 2, color: '#1fa08a', pre: 1 },
  epic:   { name: '영웅', pt: 3, color: '#8f7bff', pre: 3 },
  legend: { name: '전설', pt: 5, color: '#c9971c', pre: 0.4 },
};
const BOSS_GATE = 0.6; // 보스 층에 필요한 해당 단원 카드 비율

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
    const need = Math.ceil(ws.length * BOSS_GATE);
    return { have: have.length, need, total: ws.length, ok: have.length >= need, missing: ws.filter(w => !has(tower.id, w.w)) };
  }

  // ---------- 각인 시험 (스펠링) ----------
  function buildTest(word) {
    const r = rarityOf(word), chars = word.w.split('');
    const letterIdx = chars.map((c, i) => i).filter(i => /[A-Za-z]/.test(chars[i]));
    const preSpec = RARITY[r].pre;
    let preN = preSpec < 1 ? Math.ceil(letterIdx.length * preSpec) : Math.min(preSpec, letterIdx.length - 2);
    preN = Math.max(0, Math.min(preN, letterIdx.length - 2));
    const pre = new Set();
    if (preN > 0) { pre.add(letterIdx[0]); shuffle(letterIdx.slice(1)).slice(0, preN - 1).forEach(i => pre.add(i)); }
    const slots = chars.map((c, i) => ({
      ch: c,
      fixed: !/[A-Za-z]/.test(c) || pre.has(i), // 공백·하이픈과 미리 준 글자는 고정
      filled: null,
    }));
    let tiles = slots.filter(s => !s.fixed).map(s => s.ch);
    if (r === 'epic' || r === 'legend') { // 함정 글자 몇 개
      const extra = 'abcdefghilmnoprstu'.split('');
      tiles = tiles.concat(shuffle(extra).slice(0, r === 'legend' ? 3 : 2));
    }
    return { word, r, slots, tiles: shuffle(tiles) };
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
    const t = buildTest(word), r = RARITY[t.r];
    const used = [];   // 사용한 타일 인덱스 (슬롯 순서대로)
    let finished = false;
    const openSlots = () => t.slots.map((s, i) => i).filter(i => !t.slots[i].fixed);

    const render = () => `
      <div class="modal-title">🃏 카드 각인 시험</div>
      <div class="modal-sub">글자를 순서대로 눌러 단어를 완성해요<br><b style="color:${r.color}">${r.name}</b> 카드 · <b>${esc(word.m)}</b></div>
      <div class="spell-slots">${t.slots.map((s, i) => {
        const v = s.fixed ? s.ch : (used[openSlots().indexOf(i)] !== undefined ? t.tiles[used[openSlots().indexOf(i)]] : '');
        const sep = /[\s-]/.test(s.ch);
        return `<span class="slot ${s.fixed ? 'fixed' : ''} ${sep ? 'sep' : ''} ${v ? 'on' : ''}">${sep ? (s.ch === ' ' ? '&nbsp;' : s.ch) : esc(v || '')}</span>`;
      }).join('')}</div>
      <div class="spell-tiles">${t.tiles.map((c, i) =>
        `<button class="tile ${used.indexOf(i) >= 0 ? 'used' : ''}" data-tile="${i}" ${used.indexOf(i) >= 0 ? 'disabled' : ''}>${esc(c)}</button>`).join('')}</div>
      <div class="actions">
        <button class="btn ghost small" data-act="back">⌫ 하나 지우기</button>
        <button class="btn ghost small" data-act="skip">나중에</button>
      </div>`;

    const m = UI.modal(render(), { cls: 'spell' });
    const rerender = () => { m.body.innerHTML = render(); };

    function judge() {
      const slots = openSlots();
      const answer = t.slots.map((s, i) => s.fixed ? s.ch : t.tiles[used[slots.indexOf(i)]]).join('');
      finished = true;
      if (answer.toLowerCase() === word.w.toLowerCase()) {
        grant(word.towerId, word);
        Sfx.fanfare(); UI.confetti({ count: t.r === 'legend' ? 140 : 70, colors: [r.color, '#ffffff', '#ffc83d'] });
        m.body.innerHTML = `
          <div class="modal-title">✨ 각인 성공!</div>
          <div class="card-reveal">${cardHtml(word.towerId, word, true)}</div>
          <div class="modal-sub">카드를 얻었어요! 도감에서 볼 수 있어요</div>
          <div class="actions"><button class="btn" data-close="ok">좋아!</button></div>`;
        m.rebind();
        m.el.querySelector('[data-close]').onclick = () => { m.close(); done(word); };
      } else {
        Sfx.bad();
        m.body.innerHTML = `
          <div class="modal-title">🤔 아직이야!</div>
          <div class="modal-sub">쓴 것: <b class="spell-wrong">${esc(answer)}</b><br>정답: <b class="spell-right">${esc(word.w)}</b><br><br>★★★는 그대로예요. 도감에서 다시 도전할 수 있어요!</div>
          <div class="actions"><button class="btn" data-close="ok">다시 해볼게</button></div>`;
        m.rebind();
        m.el.querySelector('[data-close]').onclick = () => { m.close(); done(null); };
      }
    }

    m.body.addEventListener('click', e => {
      if (finished) return;
      const tile = e.target.closest('[data-tile]');
      if (tile) {
        if (used.length >= openSlots().length) return;
        used.push(+tile.dataset.tile); Sfx.step(); rerender();
        if (used.length === openSlots().length) setTimeout(judge, 260);
        return;
      }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'back') { used.pop(); rerender(); }
      else { finished = true; m.close(); done(null); }
    });
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
        return `<h4>Unit ${u.unit} <span class="unit-prog">${s.have} / ${s.total}${doneU ? ' · 🎉 완성!' : ''}</span></h4>
          <div class="bar exp"><div class="bar-fill" style="width:${s.have / s.total * 100}%"></div></div>
          <div class="card-grid">${u.words.map(w => cardHtml(cur, w, has(cur, w.w))).join('')}</div>`;
      }).join('');
      return `<div class="modal-title">🃏 단어 도감</div>
        <div class="modal-sub">전체 ${count()}장 · ${points()}포인트 &nbsp;|&nbsp; 이 타워 ${owned} / ${ws.length}장</div>
        <div class="opt-row" style="justify-content:center;margin-bottom:6px">${tabs}</div>
        <div class="toggle-desc" style="text-align:center">★★★ 단어에 <b>시험!</b>이 뜨면 눌러서 각인하세요</div>
        ${units}
        <div class="actions"><button class="btn ghost small" data-close="x">닫기</button></div>`;
    };
    const m = UI.modal(html());
    const refresh = () => { m.body.innerHTML = html(); m.rebind(); };
    m.body.addEventListener('click', e => {
      const tab = e.target.closest('[data-tab]');
      if (tab) { cur = tab.dataset.tab; refresh(); return; }
      const card = e.target.closest('[data-test]');
      if (card) {
        const k = card.dataset.test, w = findWord(k);
        if (w) { m.close(); runTests([w], () => { book(cur); Lobby.render(); }); }
      }
    });
  }

  return { RARITY, rarityOf, key, has, isPending, onMastered, grant, count, points, findWord, pendingFor, unitStat, gateInfo, runTests, cardHtml, book };
})();
