'use strict';
// 화면 전환, 토스트, 모달, 캐릭터/바 렌더 등 공용 UI
const UI = (() => {
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    window.scrollTo(0, 0);
  }
  function current() { const s = document.querySelector('.screen.active'); return s ? s.id.replace('screen-', '') : ''; }

  function toast(msg, cls = '') {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + cls; el.textContent = msg;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 1700);
  }

  // data-close="값" 버튼을 누르면 닫히고 onClose(값) 호출
  function modal(html, opts = {}) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${opts.cls || ''}">${html}</div>`;
    root.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); };
    const bind = () => wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { close(); if (opts.onClose) opts.onClose(b.dataset.close); });
    bind();
    const api = { close, el: wrap, body: wrap.querySelector('.modal'), rebind: bind };
    if (opts.onOpen) opts.onOpen(api);
    return api;
  }

  function charEmoji() { const lv = state.player.lv; return lv >= 20 ? '🧙' : lv >= 10 ? '🦸' : lv >= 5 ? '🧑' : '🧒'; }
  function charHtml(size) {
    const hat = HATS[state.player.hat] ? HATS[state.player.hat].emoji : '';
    const pet = state.player.pet && PETS[state.player.pet] ? PETS[state.player.pet].emoji : '';
    return `<span class="char" style="font-size:${size}px"><span class="char-hat">${hat}</span><span class="char-body">${charEmoji()}</span>${pet ? `<span class="char-pet">${pet}</span>` : ''}</span>`;
  }
  function hpBar(cur, max, cls = '') {
    const pct = Math.max(0, Math.min(100, cur / max * 100));
    return `<div class="bar ${cls}"><div class="bar-fill" style="width:${pct}%"></div><span class="bar-text">${Math.max(0, Math.round(cur))} / ${max}</span></div>`;
  }
  function floatText(container, text, cls = '') {
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'float ' + cls; el.textContent = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), 950);
  }
  function shake(el) {
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  }

  // 레벨업 모달: 전/후 능력치 + 새 스킬/구역
  function levelUpModal(ups, cb) {
    const lv0 = ups[0] - 1, lv1 = ups[ups.length - 1];
    const newSkills = SKILLS.filter(s => s.lv > lv0 && s.lv <= lv1);
    const newZones = ZONES.filter(z => z.lv > lv0 && z.lv <= lv1);
    const stat = (label, a, b) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-val">${b} <small>▲${b - a}</small></div></div>`;
    modal(`
      <div class="modal-title">⬆️ 레벨 업!</div>
      <div style="text-align:center">${charHtml(64)}</div>
      <div class="modal-sub" style="margin-top:10px">Lv.${lv0} → <b style="font-family:var(--font-en);font-size:24px;color:var(--violet)">Lv.${lv1}</b></div>
      <div class="levelup-stats">
        ${stat('⚔️ 공격력', atkAt(lv0), atkAt(lv1))}
        ${stat('❤️ HP', hpAt(lv0), hpAt(lv1))}
        <div class="stat"><div class="stat-label">✨ 스킬</div><div class="stat-val">${SKILLS.filter(s => s.lv <= lv1).length}</div></div>
      </div>
      ${newSkills.map(s => `<div class="unlock"><span class="big">${s.emoji}</span><div><div>새 스킬: <b>${s.name}</b></div><div class="toggle-desc">${s.desc}</div></div></div>`).join('')}
      ${newZones.map(z => `<div class="unlock"><span class="big">${z.emoji}</span><div><div>새 구역: <b>${z.name}</b></div><div class="toggle-desc">${z.ready ? '로비에서 들어갈 수 있어요!' : '곧 열려요'}</div></div></div>`).join('')}
      <div class="actions"><button class="btn" data-close="ok">멋지다!</button></div>
    `, { onClose: () => cb && cb() });
  }

  return { show, current, toast, modal, charEmoji, charHtml, hpBar, floatText, shake, levelUpModal };
})();
