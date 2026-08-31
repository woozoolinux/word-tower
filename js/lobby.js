'use strict';
// 로비: 캐릭터, 타워 선택, 구역, 상점/설정/저장
const Lobby = (() => {
  const root = () => document.getElementById('screen-lobby');

  function render() {
    const p = state.player, need = expToNext(p.lv);
    root().innerHTML = `
      <header class="lobby-head panel">
        <div class="char-box">${UI.charHtml(56)}</div>
        <div class="char-info">
          <div class="char-name">${esc(p.name)} <span class="lv-badge">Lv.${p.lv}</span></div>
          ${UI.hpBar(p.exp, need, 'exp')}
          <div class="stat-row"><span>⚔️ ${playerAtk()}</span><span>❤️ ${playerMaxHp()}</span><span>💰 ${p.gold}</span></div>
        </div>
      </header>
      <h2 class="sec-title">🏰 타워</h2>
      <div class="tower-list">${window.TOWERS.map(towerCard).join('')}</div>
      <h2 class="sec-title">🗺️ 모험</h2>
      <div class="zone-list">${ZONES.map(zoneCard).join('')}</div>
      <div class="lobby-actions">
        <button class="btn small" data-act="shop">🛒 상점</button>
        <button class="btn small ghost" data-act="dress">🎨 꾸미기</button>
        <button class="btn small ghost" data-act="skills">📜 스킬</button>
        <button class="btn small ghost" data-act="settings">⚙️ 설정</button>
        <button class="btn small ghost" data-act="save">💾 저장코드</button>
      </div>
      <p class="footer-note">진행 상황은 이 브라우저에 자동 저장돼요.</p>`;
  }

  function towerCard(t) {
    const prog = towerProg(t.id), total = floorList(t).length, done = prog.cleared >= total;
    const rg = towerRange(t), lv = state.player.lv;
    const lvTag = `권장 Lv.${rg[0]}~${rg[1]} · ` +
      (lv < rg[0] ? '<b class="warn">⚠️ 아직 어려워요</b>' : lv > rg[1] ? '<b class="easy">😎 여유로워요</b>' : '<b class="fit">👍 딱 맞아요</b>');
    const words = allWords(t);
    const stars = words.reduce((a, w) => a + wordStat(t.id, w.w).stars, 0);
    const pct = Math.round(prog.cleared / total * 100);
    const next = Math.min(prog.floor, total);
    return `<div class="tower-card panel" data-tower="${t.id}">
      <div class="tower-art">${typeof Art !== 'undefined' ? Art.tower(prog.cleared, total, t.roof) : (t.emoji || '🏰')}</div>
      <div class="tower-body">
        <div class="tower-name">${esc(t.name)}</div>
        <div class="tower-desc">${esc(t.desc || '')}</div>
        <div class="bar exp"><div class="bar-fill" style="width:${pct}%"></div><span class="bar-text">${prog.cleared} / ${total}층</span></div>
        <div class="tower-meta">⭐ ${stars} / ${words.length * 3} · 단어 ${words.length}개${done ? ' · 🏆 정복!' : ''}</div>
        <div class="tower-meta">${lvTag}</div>
      </div>
      <button class="btn mint small" data-go="${t.id}">${done ? '다시' : next + '층'}<br>도전!</button>
    </div>`;
  }
  function zoneCard(z) {
    const locked = state.player.lv < z.lv;
    const best = z.id === 'arena' && state.player.arenaBest ? `<div class="best">최고 ${state.player.arenaBest}마리</div>` : '';
    return `<div class="zone ${locked ? 'locked' : 'panel'}" data-zone="${z.id}">
      ${locked ? `<span class="lock-badge">🔒 Lv.${z.lv}</span>` : ''}
      <div class="zone-emoji">${z.emoji}</div><div class="zone-name">${z.name}</div><div class="zone-desc">${z.desc}</div>${locked ? '' : best}
    </div>`;
  }

  function onClick(e) {
    const go = e.target.closest('[data-go]');
    if (go) { const t = towerById(go.dataset.go), prog = towerProg(t.id), total = floorList(t).length; Game.startFloor(t.id, prog.cleared >= total ? 1 : Math.min(prog.floor, total)); return; }
    const card = e.target.closest('[data-tower]');
    if (card) { floorSelect(card.dataset.tower); return; }
    const zone = e.target.closest('[data-zone]');
    if (zone) { enterZone(zone.dataset.zone); return; }
    const act = e.target.closest('[data-act]');
    if (act) ({ shop, skills, settings, save: saveCode, dress: () => charCreator(false) })[act.dataset.act]();
  }

  function floorSelect(id) {
    const t = towerById(id), prog = towerProg(id), floors = floorList(t);
    UI.modal(`
      <div class="modal-title">${esc(t.name)}</div>
      <div class="modal-sub">가고 싶은 층을 골라요 · 👑 = 보스</div>
      <div class="floor-grid">${floors.map((f, i) => {
        const n = i + 1, locked = n > prog.floor, done = n <= prog.cleared;
        return `<button class="floor-btn ${f.type === 'boss' ? 'boss' : ''} ${done ? 'done' : ''} ${locked ? 'locked' : ''}" data-floor="${n}" ${locked ? 'disabled' : ''}>${f.type === 'boss' ? '👑' : n}</button>`;
      }).join('')}</div>
      <div class="actions"><button class="btn ghost small" data-close="x">닫기</button></div>
    `, { onOpen: m => m.body.querySelectorAll('[data-floor]').forEach(b => b.onclick = () => { m.close(); Game.startFloor(id, +b.dataset.floor); }) });
  }

  function enterZone(id) {
    const z = ZONES.find(x => x.id === id);
    if (state.player.lv < z.lv) { UI.toast(`🔒 ${z.name}은(는) Lv.${z.lv}부터 들어갈 수 있어요`); Sfx.bad(); return; }
    if (!z.ready) { UI.toast(`${z.emoji} ${z.name}은(는) 준비 중이에요!`); return; }
    if (id === 'arena') Game.startArena();
  }

  // ---------- 상점 ----------
  function shopHtml() {
    const p = state.player;
    const row = (emoji, name, desc, right) => `<div class="shop-row"><div class="shop-emoji">${emoji}</div><div><div class="shop-name">${name}</div><div class="shop-desc">${desc}</div></div><div>${right}</div></div>`;
    const buy = (kind, id, price) => `<button class="btn small ${p.gold >= price ? '' : 'ghost'}" data-buy="${kind}:${id}" ${p.gold >= price ? '' : 'disabled'}>${price}G</button>`;
    const items = Object.entries(ITEMS).map(([id, it]) => row(it.emoji, `${it.name} <span class="tag off">보유 ${p.items[id]}</span>`, it.desc, buy('item', id, it.price))).join('');
    const weapons = Object.entries(WEAPONS).map(([id, w]) => {
      const owned = p.owned.weapons.includes(id), eq = p.weapon === id;
      const right = eq ? '<span class="tag">장착중</span>' : owned ? `<button class="btn small mint" data-equip="weapon:${id}">장착</button>` : buy('weapon', id, w.price);
      return row(w.emoji, w.name, `공격력 +${Math.round(w.pct * 100)}%`, right);
    }).join('');
    const hats = Object.entries(HATS).map(([id, h]) => {
      const owned = p.owned.hats.includes(id), eq = p.hat === id;
      const right = eq ? '<span class="tag">장착중</span>' : owned ? `<button class="btn small mint" data-equip="hat:${id}">장착</button>` : buy('hat', id, h.price);
      return row(h.emoji || '🚫', h.name, '멋 부리기용', right);
    }).join('');
    const pets = Object.entries(PETS).map(([id, pt]) => {
      const owned = p.owned.pets.includes(id), eq = p.pet === id;
      const right = eq ? '<span class="tag">함께</span>' : owned ? `<button class="btn small mint" data-equip="pet:${id}">데려가기</button>` : '<span class="tag off">보스 드랍</span>';
      return row(owned ? pt.emoji : '❔', owned ? pt.name : '???', owned ? '보스를 이기고 얻었어요' : '보스 층을 깨면 얻어요', right);
    }).join('');
    const outfits = Object.entries(OUTFITS).map(([id, o]) => {
      const owned = p.owned.outfits.includes(id), eq = p.outfit === id;
      const right = eq ? '<span class="tag">입는 중</span>' : owned ? `<button class="btn small mint" data-equip="outfit:${id}">입기</button>` : buy('outfit', id, o.price);
      return row(o.emoji, o.name, o.desc, right);
    }).join('');
    return `<div class="modal-title">🛒 상점 <span class="gold-pill">💰 ${p.gold}</span></div>
      <div class="creator-preview">${UI.charHtml(72)}</div>
      <h4>소모품</h4>${items}<h4>코스튬</h4>${outfits}<h4>무기</h4>${weapons}<h4>모자</h4>${hats}<h4>펫</h4>${pets}
      <div class="actions"><button class="btn ghost small" data-close="x">닫기</button></div>`;
  }
  function shop() {
    const m = UI.modal(shopHtml(), { onClose: render });
    m.body.addEventListener('click', e => {
      const b = e.target.closest('[data-buy],[data-equip]'); if (!b) return;
      const p = state.player;
      if (b.dataset.buy) {
        const [kind, id] = b.dataset.buy.split(':');
        const price = kind === 'item' ? ITEMS[id].price : kind === 'weapon' ? WEAPONS[id].price : kind === 'outfit' ? OUTFITS[id].price : HATS[id].price;
        if (p.gold < price) { UI.toast('골드가 부족해요'); return; }
        addGold(-price); Sfx.coin();
        if (kind === 'item') p.items[id]++;
        else if (kind === 'weapon') { p.owned.weapons.push(id); p.weapon = id; }
        else if (kind === 'outfit') { p.owned.outfits.push(id); p.outfit = id; }
        else { p.owned.hats.push(id); p.hat = id; }
        UI.toast('구매 완료!', 'good');
      } else {
        const [kind, id] = b.dataset.equip.split(':');
        if (kind === 'weapon') p.weapon = id; else if (kind === 'hat') p.hat = id; else if (kind === 'outfit') p.outfit = id; else p.pet = id;
        Sfx.ok();
      }
      saveState();
      m.body.innerHTML = shopHtml(); m.rebind();
    });
  }

  // ---------- 스킬 ----------
  function skills() {
    UI.modal(`<div class="modal-title">📜 스킬</div><div class="modal-sub">레벨이 오르면 저절로 배워요. 골드로는 못 사요!</div>
      ${SKILLS.map(s => `<div class="skill-row ${hasSkill(s.id) ? '' : 'locked'}"><div class="skill-emoji">${s.emoji}</div><div><div class="skill-name">${s.name}</div><div class="skill-desc">${s.desc}</div></div><div>${hasSkill(s.id) ? '<span class="tag">배움</span>' : `<span class="tag off">Lv.${s.lv}</span>`}</div></div>`).join('')}
      <div class="actions"><button class="btn ghost small" data-close="x">닫기</button></div>`);
  }

  // ---------- 설정 ----------
  function settings() {
    const s = state.settings;
    const html = () => `<div class="modal-title">⚙️ 설정</div>
      <div class="toggle-row"><div><div>🔊 듣기 문제</div><div class="toggle-desc">켜면 배틀에서 소리 듣고 뜻 고르기가 나와요</div></div><button class="toggle ${s.listen ? 'on' : ''}" data-t="listen" aria-label="듣기 문제"></button></div>
      <div class="toggle-row"><div><div>🎵 효과음</div></div><button class="toggle ${s.sound ? 'on' : ''}" data-t="sound" aria-label="효과음"></button></div>
      <div class="toggle-row"><div style="flex:1"><div>✏️ 이름</div><input class="name-input" id="name-input" value="${esc(state.player.name)}" maxlength="10"></div></div>
      <div class="actions"><button class="btn small" data-close="ok">확인</button><button class="btn small ghost" id="test-tts">🔊 소리 테스트</button><button class="btn small coral" id="reset-btn">처음부터</button></div>`;
    const m = UI.modal(html(), { onClose: () => { const v = m.body.querySelector('#name-input').value.trim(); if (v) state.player.name = v; saveState(); render(); } });
    m.body.addEventListener('click', e => {
      const t = e.target.closest('[data-t]');
      if (t) { s[t.dataset.t] = !s[t.dataset.t]; t.classList.toggle('on', s[t.dataset.t]); saveState(); if (t.dataset.t === 'sound') Sfx.ok(); return; }
      if (e.target.id === 'test-tts') { speak('apple'); return; }
      if (e.target.id === 'reset-btn') {
        if (confirm('정말 처음부터 시작할까요? 모든 진행과 골드가 사라져요.')) { resetState(); m.close(); render(); UI.toast('새로 시작!'); }
      }
    });
  }

  // ---------- 저장 코드 ----------
  function saveCode() {
    const m = UI.modal(`<div class="modal-title">💾 저장 코드</div>
      <div class="modal-sub">이 코드를 복사해 두면 다른 기기에서 이어할 수 있어요</div>
      <textarea class="code" id="export-code" readonly>${exportCode()}</textarea>
      <div class="actions"><button class="btn small" id="copy-btn">복사</button></div>
      <h4>불러오기</h4>
      <textarea class="code" id="import-code" placeholder="여기에 코드를 붙여넣어요"></textarea>
      <div class="actions"><button class="btn small mint" id="import-btn">불러오기</button><button class="btn small ghost" data-close="x">닫기</button></div>`);
    m.body.addEventListener('click', e => {
      if (e.target.id === 'copy-btn') {
        const ta = m.body.querySelector('#export-code'); ta.select();
        (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).then(() => UI.toast('복사했어요!', 'good')).catch(() => { document.execCommand('copy'); UI.toast('복사했어요!', 'good'); });
      }
      if (e.target.id === 'import-btn') {
        try { importCode(m.body.querySelector('#import-code').value); m.close(); render(); UI.toast('불러왔어요!', 'good'); }
        catch (err) { UI.toast('코드가 올바르지 않아요', 'bad'); }
      }
    });
  }

  // ---------- 캐릭터 만들기 / 꾸미기 ----------
  function charCreator(force) {
    const p = state.player;
    const temp = Object.assign(Avatar.defaults(), p.avatar || {});
    let outfit = p.owned.outfits.includes(p.outfit) ? p.outfit : 'tunic';
    let name = p.name;
    const html = () => `
      <div class="modal-title">🎨 ${force ? '캐릭터 만들기' : '캐릭터 꾸미기'}</div>
      <div class="creator-preview">${Avatar.html(120, { av: temp, outfit, pet: '', weapon: false })}</div>
      <div class="opt-row" style="justify-content:center">
        <button class="opt-btn" data-preset="boy">👦 소년 프리셋</button>
        <button class="opt-btn" data-preset="girl">👧 소녀 프리셋</button>
      </div>
      <h4>머리 모양</h4>
      <div class="opt-row">${Avatar.HAIRSTYLES.map(h => `<button class="opt-btn ${temp.hairStyle === h.id ? 'sel' : ''}" data-style="${h.id}">${h.name}</button>`).join('')}</div>
      <h4>머리 색</h4>
      <div class="opt-row">${Avatar.HAIRCOLORS.map((c, i) => `<button class="opt-dot ${temp.hairColor === i ? 'sel' : ''}" data-hair="${i}" style="background:${c}" aria-label="머리 색 ${i + 1}"></button>`).join('')}</div>
      <h4>피부</h4>
      <div class="opt-row">${Avatar.SKINS.map((c, i) => `<button class="opt-dot ${temp.skin === i ? 'sel' : ''}" data-skin="${i}" style="background:${c}" aria-label="피부 ${i + 1}"></button>`).join('')}</div>
      <h4>옷</h4>
      <div class="opt-row">${p.owned.outfits.map(id => `<button class="opt-btn ${outfit === id ? 'sel' : ''}" data-outfit="${id}">${OUTFITS[id].emoji} ${OUTFITS[id].name}</button>`).join('')}
        <span class="toggle-desc">새 코스튬은 🛒 상점에!</span></div>
      <h4>이름</h4>
      <input class="name-input" id="cr-name" value="${esc(name)}" maxlength="10">
      <div class="actions"><button class="btn" id="cr-ok">${force ? '모험 시작!' : '저장'}</button>${force ? '' : '<button class="btn ghost small" data-close="x">취소</button>'}</div>`;
    const m = UI.modal(html());
    const rerender = () => { m.body.innerHTML = html(); m.rebind(); };
    m.body.addEventListener('click', e => {
      const b = e.target.closest('[data-style],[data-hair],[data-skin],[data-outfit],[data-preset],#cr-ok');
      if (!b) return;
      const inp = m.body.querySelector('#cr-name'); if (inp) name = inp.value;
      if (b.dataset.style) temp.hairStyle = b.dataset.style;
      else if (b.dataset.hair !== undefined) temp.hairColor = +b.dataset.hair;
      else if (b.dataset.skin !== undefined) temp.skin = +b.dataset.skin;
      else if (b.dataset.outfit) outfit = b.dataset.outfit;
      else if (b.dataset.preset === 'boy') { temp.hairStyle = 'short'; outfit = 'tunic'; }
      else if (b.dataset.preset === 'girl') { temp.hairStyle = 'twin'; outfit = 'dress'; }
      else if (b.id === 'cr-ok') {
        p.avatar = temp; p.outfit = outfit;
        if (name.trim()) p.name = name.trim().slice(0, 10);
        saveState(); m.close(); render();
        Sfx.win(); UI.toast('멋진 캐릭터 완성!', 'good');
        return;
      }
      rerender();
    });
  }

  function init() { root().addEventListener('click', onClick); }
  return { render, init, charCreator };
})();
