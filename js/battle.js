'use strict';
// 배틀: 문제를 맞추면 공격, 빨리 맞추면 크리티컬, 틀리면 맞는다.
const Battle = (() => {
  const B = BAL.battle;    // 수치는 전부 js/balance.js
  const WARN_AT = B.warnAt, CRIT_UNDER = B.critUnder; // 초
  const CHARGE_NEED = B.chargeNeed;   // 이만큼 연속 정답이면 필살기 준비
  // 제한시간은 판마다 다르다 (투기장은 오래 버틸수록 짧아진다)
  let o, mon, q, qStart, combo, helped, charge, lock, timer, warnTimer, timeLimit;
  const $ = id => document.getElementById(id);

  function start(opts) {
    clearTimer();
    o = opts; mon = Object.assign({}, opts.monster, { maxHp: opts.monster.hp });
    combo = 0; charge = 0; lock = false; q = null;
    timeLimit = Math.max(1, opts.timeLimit || B.timeLimit);
    UI.show('battle');
    $('battle-title').textContent = o.boss ? '👑 보스전' : o.arena ? '🏟️ 투기장' : '⚔️ 배틀';
    // 언제든 그만두고 지금까지의 보상을 챙겨 나갈 수 있는 판에서만 뜬다
    $('battle-left').innerHTML = o.onRetire ? '<button class="btn ghost small" id="battle-retire">🏳️ 여기까지</button>' : '';
    const rb = $('battle-retire'); if (rb) rb.onclick = retire;
    $('battle-hero').innerHTML = state.player.avatar ? Avatar.html(52, { pet: '' }) : `<span style="font-size:44px">${UI.charEmoji()}</span>`;
    $('battle-monster').innerHTML =
      `<div class="mon-art ${o.boss ? 'boss' : ''}" id="mon-art">${Art.monster(mon.id || 'slime', !!o.boss)}<span class="slash" id="mon-slash"></span></div>` +
      `<div class="mon-name">${esc(mon.name)}<span class="atk">ATK ${mon.atk}</span></div>`;
    renderBars(); renderItems();
    setTimeout(next, 400);
  }
  function renderBars() {
    $('battle-mon-hp').innerHTML = UI.hpBar(mon.hp, mon.maxHp, 'mon');
    $('battle-player').innerHTML = `${UI.charHtml(40)}<div class="pstats"><div>${esc(state.player.name)} Lv.${state.player.lv} · ⚔️ ${playerAtk()}${combo >= 2 ? ` · 🔥 ${combo}콤보` : ''}</div>${UI.hpBar(state.player.hp, playerMaxHp(), 'hp')}</div>`;
  }
  function renderItems() {
    const it = state.player.items;
    const ready = charge >= CHARGE_NEED;
    const pips = Array.from({ length: CHARGE_NEED }, (_, i) => `<i class="${i < charge ? 'on' : ''}"></i>`).join('');
    $('battle-items').innerHTML =
      `<button class="ulti-btn ${ready ? 'ready' : ''}" data-item="super" ${ready ? '' : 'disabled'}>
         <span class="ulti-label">${ready ? '💥 필살기!' : '🔥 필살기'}</span><span class="charge-pips">${pips}</span></button>` +
      ['hint', 'erase', 'potion'].map(k => `<button class="item-btn" data-item="${k}" ${it[k] > 0 ? '' : 'disabled'}>${ITEMS[k].emoji} ${ITEMS[k].name} <b>${it[k]}</b></button>`).join('') +
      (shieldReady() ? '<span class="shield-badge">🛡️ 실드 준비됨</span>' : '');
  }
  function ultDamage() {
    // 카드가 아무리 많아도 ultMax에서 멈춘다 (보스를 한 방에 지우지 않게)
    const byCards = Math.min(B.ultMax, B.ultBase + Cards.points() * B.ultPerCardPt);
    return Math.round(playerAtk() * byCards * (hasSkill('ulti') ? B.ultSkillMul : 1));
  }
  function heroAttack(cls) {
    const h = $('battle-hero');
    if (!h) return;
    h.classList.remove('attack', 'attack-crit', 'attack-ult'); void h.offsetWidth; h.classList.add(cls);
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
        // 영어가 이미 화면에 있는 문제(w2m)에서는 들려줘도 답이 새지 않는다 → 항상 제공
        (mode === 'w2m' && canSpeak() ? '<button class="speak-mini" id="speak-btn">🔊</button>' : '');
    }
    $('battle-choices').innerHTML = q.choices.map(c => `<button class="choice ${mode === 'm2w' ? 'en' : 'ko'}">${esc(c)}</button>`).join('');
    $('battle-hint').textContent = '';
    const sb = $('speak-btn'); if (sb) sb.onclick = () => speak(word.w);
    if (mode === 'listen') setTimeout(() => speak(word.w), 300);
    const tb = $('battle-timer');
    tb.classList.remove('run', 'warn'); void tb.offsetWidth;
    tb.style.setProperty('--t', timeLimit + 's');
    tb.classList.add('run');
    qStart = performance.now();
    clearTimer();
    warnTimer = setTimeout(() => tb.classList.add('warn'), Math.max(300, (timeLimit - WARN_AT) * 1000));
    timer = setTimeout(timeUp, timeLimit * 1000);
  }

  function clearTimer() { clearTimeout(timer); clearTimeout(warnTimer); timer = warnTimer = null; }

  // 🏳️ 여기까지 — 죽을 때까지 기다리지 않고 나간다. 보상은 이미 받아 둔 상태다.
  function retire() {
    if (lock || !o.onRetire) return;
    lock = true; clearTimer();
    UI.modal(`
      <div class="modal-title">🏳️ 여기까지 할까?</div>
      <div class="modal-sub">지금까지 받은 골드와 경험치는 그대로예요.<br>기록도 남아요!</div>
      <div class="actions">
        <button class="btn" data-close="yes">나갈래</button>
        <button class="btn ghost" data-close="no">더 할래</button>
      </div>`,
      { onClose: v => { if (v === 'yes') o.onRetire(); else { lock = false; next(); } } });
  }

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
    combo = 0; charge = 0; Sfx.bad();
    const art = $('mon-art');
    if (art) { art.classList.remove('lunge', 'hurt'); void art.offsetWidth; art.classList.add('lunge'); }
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
      charge = Math.min(CHARGE_NEED, charge + 1);
      const crit = elapsed < CRIT_UNDER;
      heroAttack(crit ? 'attack-crit' : 'attack');
      renderItems();
      if (crit) Sfx.crit(); else Sfx.ok();
      Game.gainExpQuiet(Math.round(byFloor(BAL.exp.battleCorrect, o.floor || 1))); Game.gainGold(BAL.gold.battleCorrect);
      setTimeout(() => {                       // 캐릭터가 닿는 순간에 데미지
        hit(Math.round(playerAtk() * (crit ? B.critMul : 1)), crit ? 'CRITICAL!' : '', crit);
        if (hasSkill('double') && combo >= 2 && combo % 2 === 0 && mon.hp > 0) {
          setTimeout(() => { hit(Math.round(playerAtk() * B.doubleMul), '🔥 더블!'); check(); }, 450);
        } else check();
      }, 200);
    } else {
      penalty();
    }
  }
  function hit(dmg, label, crit) {
    mon.hp = Math.max(0, mon.hp - dmg);
    Sfx.hit();
    UI.floatText($('battle-monster'), label ? `${dmg} ${label}` : `${dmg}`, 'dmg-m' + (crit ? ' crit' : ''));
    const art = $('mon-art');
    if (art) {
      art.classList.remove('hurt', 'lunge'); void art.offsetWidth; art.classList.add('hurt');
      const sl = $('mon-slash');
      if (sl) { sl.classList.remove('go'); void sl.offsetWidth; sl.classList.add('go'); }
    }
    if (crit) UI.flash();
    renderBars(); saveState();
  }
  function check() {
    if (mon.hp <= 0) {
      clearTimer(); Sfx.win();
      const art = $('mon-art'); if (art) art.classList.add('die');
      setTimeout(() => o.onWin(), 950);
    }
    else setTimeout(next, 800);
  }

  // 필살기: 스펠링을 맞히면 대미지 폭발. 틀려도 피해는 없다 (게이지만 소모)
  // 시험 위젯은 각인 시험과 같은 것을 쓴다 (Cards.spellTest)
  function superAttack() {
    if (charge < CHARGE_NEED || lock) return;
    lock = true; clearTimer();
    const word = pickWord(o.towerId, o.words, q && q.word.w);
    Cards.spellTest(word, {
      title: '💥 필살기!',
      sub: `스펠링을 맞히면 <b>${ultDamage()}</b> 데미지!<br>뜻: <b>${esc(word.m)}</b> <span class="dim">(틀려도 아프지 않아요)</span>`,
    }, ok => {
      charge = 0;
      if (ok) {
        recordResult(o.towerId, word, true, false);
        UI.flash(); Sfx.crit(); heroAttack('attack-ult');
        setTimeout(() => { hit(ultDamage(), '💥 필살기!', true); renderItems(); check(); }, 260);
      } else {
        Sfx.bad();
        UI.toast(`아쉬워! 정답은 "${word.w}"`, 'bad');
        renderItems();
        setTimeout(next, 900);
      }
    });
  }

  function useItem(kind) {
    const it = state.player.items;
    if (kind === 'super') { superAttack(); return; }
    if (kind === 'potion') {
      if (it.potion <= 0) return; it.potion--;
      const heal = Math.round(playerMaxHp() * BAL.items.potionHeal);
      state.player.hp = Math.min(playerMaxHp(), state.player.hp + heal); UI.toast(`🧪 HP +${heal}`, 'good'); Sfx.coin();
    } else if (lock) { return; }
    else if (kind === 'hint') {
      if (it.hint <= 0) return; it.hint--; helped = true;
      $('battle-hint').textContent = `💡 첫 글자: ${q.hint}`;
    } else if (kind === 'erase') {
      if (it.erase <= 0) return; it.erase--; helped = true;
      const wrongs = [...document.querySelectorAll('#battle-choices .choice')].filter(b => b.textContent !== q.answer && !b.classList.contains('erased'));
      shuffle(wrongs).slice(0, BAL.items.eraseCount).forEach(b => { b.classList.add('erased'); b.disabled = true; });
    }
    saveState(); renderItems(); renderBars();
  }

  function init() {
    $('battle-choices').addEventListener('click', e => { const b = e.target.closest('.choice'); if (b && !b.disabled) choose(b); });
    $('battle-items').addEventListener('click', e => { const b = e.target.closest('[data-item]'); if (b && !b.disabled) useItem(b.dataset.item); });
  }
  return { start, init };
})();
