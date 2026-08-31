'use strict';
// 배틀: 문제를 맞추면 공격, 빨리 맞추면 크리티컬, 틀리면 맞는다.
const Battle = (() => {
  const TIME_LIMIT = 10, WARN_AT = 3, CRIT_UNDER = 2.5; // 초
  let o, mon, q, qStart, combo, helped, ultiUsed, lock, timer, warnTimer;
  const $ = id => document.getElementById(id);

  function start(opts) {
    clearTimer();
    o = opts; mon = Object.assign({}, opts.monster, { maxHp: opts.monster.hp });
    combo = 0; ultiUsed = false; lock = false; q = null;
    UI.show('battle');
    $('battle-title').textContent = o.boss ? '👑 보스전' : o.arena ? '🏟️ 투기장' : '⚔️ 배틀';
    $('battle-monster').innerHTML = `<div class="mon-emoji ${o.boss ? 'boss' : ''}">${mon.emoji}</div><div class="mon-name">${esc(mon.name)}<span class="atk">ATK ${mon.atk}</span></div>`;
    renderBars(); renderItems();
    setTimeout(next, 400);
  }
  function renderBars() {
    $('battle-mon-hp').innerHTML = UI.hpBar(mon.hp, mon.maxHp, 'mon');
    $('battle-player').innerHTML = `${UI.charHtml(40)}<div class="pstats"><div>${esc(state.player.name)} Lv.${state.player.lv} · ⚔️ ${playerAtk()}${combo >= 2 ? ` · 🔥 ${combo}콤보` : ''}</div>${UI.hpBar(state.player.hp, playerMaxHp(), 'hp')}</div>`;
  }
  function renderItems() {
    const it = state.player.items;
    $('battle-items').innerHTML =
      ['hint', 'erase', 'potion'].map(k => `<button class="item-btn" data-item="${k}" ${it[k] > 0 ? '' : 'disabled'}>${ITEMS[k].emoji} ${ITEMS[k].name} <b>${it[k]}</b></button>`).join('') +
      (o.boss && hasSkill('ulti') ? `<button class="item-btn ulti" data-item="ulti" ${ultiUsed ? 'disabled' : ''}>💫 필살기</button>` : '') +
      (shieldReady() ? '<span class="shield-badge">🛡️ 실드 준비됨</span>' : '');
  }

  function next() {
    if (UI.current() !== 'battle') return;
    helped = false; lock = false;
    const word = pickWord(o.towerId, o.words, q && q.word.w);
    const modes = ['m2w', 'w2m']; if (state.settings.listen) modes.push('listen');
    const mode = pick(modes);
    q = makeQuestion(word, o.pool, mode);
    if (mode === 'listen') {
      $('battle-prompt').innerHTML = `<button class="speak-btn" id="speak-btn">🔊 들어보기</button><div class="prompt-sub">듣고 뜻을 골라요</div>`;
    } else {
      $('battle-prompt').innerHTML = `<div class="prompt-main ${mode === 'm2w' ? 'ko' : 'en'}">${esc(q.prompt)}</div><div class="prompt-sub">${mode === 'm2w' ? '영어로는?' : '뜻은?'}</div>` +
        (mode === 'w2m' && state.settings.listen ? '<button class="speak-mini" id="speak-btn">🔊</button>' : '');
    }
    $('battle-choices').innerHTML = q.choices.map(c => `<button class="choice ${mode === 'm2w' ? 'en' : 'ko'}">${esc(c)}</button>`).join('');
    $('battle-hint').textContent = '';
    const sb = $('speak-btn'); if (sb) sb.onclick = () => speak(word.w);
    if (mode === 'listen') setTimeout(() => speak(word.w), 300);
    const tb = $('battle-timer');
    tb.classList.remove('run', 'warn'); void tb.offsetWidth;
    tb.style.setProperty('--t', TIME_LIMIT + 's');
    tb.classList.add('run');
    qStart = performance.now();
    clearTimer();
    warnTimer = setTimeout(() => tb.classList.add('warn'), (TIME_LIMIT - WARN_AT) * 1000);
    timer = setTimeout(timeUp, TIME_LIMIT * 1000);
  }

  function clearTimer() { clearTimeout(timer); clearTimeout(warnTimer); timer = warnTimer = null; }

  // 시간 초과: 오답과 같은 처리 + 정답 보여주기
  function timeUp() {
    if (lock || UI.current() !== 'battle') return;
    lock = true; clearTimer();
    document.querySelectorAll('#battle-choices .choice').forEach(b => {
      if (b.textContent === q.answer) b.classList.add('right');
      b.disabled = true;
    });
    recordResult(o.towerId, q.word, false, helped);
    UI.toast(`⏰ 시간 초과! 정답은 "${q.answer}"`, 'bad');
    penalty();
  }

  // 오답/시간초과 공통: 몬스터 반격
  function penalty() {
    combo = 0; Sfx.bad();
    if (shieldReady()) { useShield(); UI.toast('🛡️ 실드가 막았다!', 'good'); }
    else {
      state.player.hp -= mon.atk;
      UI.shake($('battle-player')); UI.floatText($('battle-player'), `-${mon.atk}`, 'dmg-p');
    }
    renderBars(); renderItems(); saveState();
    if (state.player.hp <= 0) { setTimeout(() => o.onLose(), 700); return; }
    setTimeout(next, 1600);
  }

  function choose(btn) {
    if (lock) return; lock = true; clearTimer();
    const correct = btn.textContent === q.answer;
    const elapsed = (performance.now() - qStart) / 1000;
    document.querySelectorAll('#battle-choices .choice').forEach(b => {
      if (b.textContent === q.answer) b.classList.add('right'); else if (b === btn) b.classList.add('wrong');
      b.disabled = true;
    });
    recordResult(o.towerId, q.word, correct, helped);
    if (correct) {
      combo++;
      const crit = elapsed < CRIT_UNDER;
      hit(Math.round(playerAtk() * (crit ? 1.5 : 1)), crit ? 'CRITICAL!' : '', crit);
      if (crit) Sfx.crit(); else Sfx.ok();
      Game.gainExpQuiet(3 + (o.floor || 1)); addGold(2);
      if (hasSkill('double') && combo >= 2 && combo % 2 === 0 && mon.hp > 0) {
        setTimeout(() => { hit(Math.round(playerAtk() * 0.5), '🔥 더블!'); check(); }, 450);
      } else check();
    } else {
      penalty();
    }
  }
  function hit(dmg, label, crit) {
    mon.hp = Math.max(0, mon.hp - dmg);
    Sfx.hit();
    UI.floatText($('battle-monster'), label ? `${dmg} ${label}` : `${dmg}`, 'dmg-m' + (crit ? ' crit' : ''));
    UI.shake($('battle-monster'));
    renderBars(); saveState();
  }
  function check() {
    if (mon.hp <= 0) { clearTimer(); Sfx.win(); setTimeout(() => o.onWin(), 700); }
    else setTimeout(next, 800);
  }

  function useItem(kind) {
    const it = state.player.items;
    if (kind === 'potion') {
      if (it.potion <= 0) return; it.potion--;
      state.player.hp = Math.min(playerMaxHp(), state.player.hp + 50); UI.toast('🧪 HP +50', 'good'); Sfx.coin();
    } else if (kind === 'ulti') {
      if (ultiUsed || lock) return; ultiUsed = true;
      hit(Math.round(mon.maxHp * 0.3), '💫 필살기!', true);
      if (mon.hp <= 0) { lock = true; check(); }
    } else if (lock) { return; }
    else if (kind === 'hint') {
      if (it.hint <= 0) return; it.hint--; helped = true;
      $('battle-hint').textContent = `💡 첫 글자: ${q.hint}`;
    } else if (kind === 'erase') {
      if (it.erase <= 0) return; it.erase--; helped = true;
      const wrongs = [...document.querySelectorAll('#battle-choices .choice')].filter(b => b.textContent !== q.answer && !b.classList.contains('erased'));
      shuffle(wrongs).slice(0, 2).forEach(b => { b.classList.add('erased'); b.disabled = true; });
    }
    saveState(); renderItems(); renderBars();
  }

  function init() {
    $('battle-choices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (b && !b.disabled) choose(b); });
    $('battle-items').addEventListener('click', e => { const b = e.target.closest('[data-item]'); if (b && !b.disabled) useItem(b.dataset.item); });
  }
  return { start, init };
})();
