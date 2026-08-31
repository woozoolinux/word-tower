'use strict';
// 🔍 정찰 — 층에 들어가기 전에 그 층 단어를 미리 본다.
// 처음 보는 단어가 배틀에서 갑자기 나오면 학습이 아니라 찍기가 되므로 먼저 보여준다.
// 자신 있으면 그 자리에서 "이건 알아!" 도전으로 카드를 바로 딸 수 있다 (정규 시험보다 어렵다).
const Preview = (() => {
  const MIN_LOOK = 800; // 이만큼 지나야 '다음'이 켜진다 (마구 넘기기 방지)

  function maybeShow(run, cb) {
    if (!state.settings.preview) return cb();
    if (run.plan.type === 'boss') return cb();  // 보스는 이미 배운 단어들
    if (run.mul < 1) return cb();               // 다시 도는 층은 생략
    const words = run.words.filter(w => !Cards.has(run.towerId, w.w));
    if (!words.length) return cb();
    show(run, words, cb);
  }

  function show(run, words, cb) {
    let i = 0, summary = false, armed = false;
    const tried = {};
    const skipped = run.words.length - words.length;

    function cardView() {
      const w = words[i], r = Cards.rarityOf(w), R = RARITY[r];
      const st = wordStat(run.towerId, w.w);
      const owned = Cards.has(run.towerId, w.w);
      const pend = Cards.isPending(run.towerId, w.w);
      const canTry = !tried[w.w] && !owned;
      return `
        <div class="modal-title">🔍 정찰</div>
        <div class="modal-sub">이 층에서 만날 단어예요${skipped ? ` <span class="dim">· 아는 단어 ${skipped}개는 건너뛰었어요</span>` : ''}</div>
        <div class="pv-card r-${r}">
          <div class="pv-rarity" style="color:${R.color}">${R.name}</div>
          <div class="pv-en">${esc(w.w)}</div>
          <div class="pv-ko">${esc(w.m)}</div>
          <div class="pv-meta">${w.pos ? esc(w.pos) + '.' : ''} <span class="stars">${starsText(st.stars)}</span>${owned ? ' 🃏' : ''}</div>
          ${state.settings.listen ? '<button class="speak-mini" data-act="say">🔊 들어보기</button>' : ''}
        </div>
        <div class="pv-dots">${words.map((_, n) => `<i class="${n < i ? 'done' : n === i ? 'now' : ''}"></i>`).join('')}</div>
        <div class="actions">
          <button class="btn" data-act="next" disabled>${i === words.length - 1 ? '정찰 끝 ▶' : '다음 ▶'}</button>
          ${owned ? ''
            : pend ? '<button class="btn mint" data-act="engrave">🃏 각인하기</button>'
              : canTry ? '<button class="btn mint" data-act="try">⚡ 이건 알아!</button>' : ''}
        </div>
        <div class="toggle-desc" style="text-align:center">
          ${owned ? '카드를 가진 단어예요!'
            : pend ? '스펠링을 맞히면 카드를 받아요'
              : canTry ? '스펠링을 맞히면 카드를 바로 받아요 · 도움 글자 없음, 한 번만!'
                : '이 단어 도전은 다 썼어요. 층에서 만나요!'}
        </div>`;
    }

    function summaryView() {
      const chips = run.words.map(w => {
        const owned = Cards.has(run.towerId, w.w);
        return `<span class="star-chip ${owned ? 'owned' : ''}"><span class="en">${esc(w.w)}</span> ${esc(w.m)} ` +
          (owned ? '🃏' : `<span class="stars">${starsText(wordStat(run.towerId, w.w).stars)}</span>`) + '</span>';
      }).join('');
      return `
        <div class="modal-title">🗺️ 정찰 완료!</div>
        <div class="modal-sub">${run.floor}층에서 만날 단어 ${run.words.length}개</div>
        <div class="star-list">${chips}</div>
        <div class="actions"><button class="btn" data-act="go">⚔️ 출발!</button></div>`;
    }

    const m = UI.modal(cardView(), { cls: 'preview' });

    function paint(quickArm) {
      m.body.innerHTML = summary ? summaryView() : cardView();
      if (summary) return;
      armed = false;
      const w = words[i];
      if (state.settings.listen) setTimeout(() => speak(w.w), 250);
      setTimeout(() => {
        armed = true;
        const b = m.body.querySelector('[data-act="next"]');
        if (b) { b.disabled = false; b.classList.add('pop-in'); }
      }, quickArm ? 250 : MIN_LOOK);
    }
    paint();

    function advance() {
      if (i < words.length - 1) i++; else summary = true;
      paint();
    }

    m.body.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const w = words[i];
      switch (act.dataset.act) {
        case 'say':
          speak(w.w); break;

        case 'next':
          if (armed) advance(); break;

        case 'go':
          m.close(); cb(); break;

        // ★★★인데 아직 카드가 없는 단어 → 정규 각인 시험
        case 'engrave':
          Cards.runTests([w], () => paint(true));
          break;

        // "이건 알아!" → 도움 없는 어려운 스펠링. 통과하면 카드 즉시 획득
        case 'try':
          tried[w.w] = true;
          Cards.spellTest(w, {
            hard: true,
            title: '⚡ 이건 알아!',
            sub: `<b>${esc(w.m)}</b><br><span class="dim">도움 글자 없음 · 한 번만 도전할 수 있어요</span>`,
          }, ok => {
            if (ok) {
              Cards.grantDirect(run.towerId, w);
              Sfx.fanfare(); UI.confetti({ count: 90, colors: ['#3ee0c4', '#ffc83d', '#ffffff'] });
              UI.modal(`
                <div class="modal-title">⚡ 정답!</div>
                <div class="card-reveal">${Cards.cardHtml(run.towerId, w, true)}</div>
                <div class="modal-sub">카드를 바로 얻었어요! ★★★도 채웠어요</div>
                <div class="actions"><button class="btn" data-close="ok">좋아!</button></div>`,
                { cls: 'celebrate', onClose: () => { Lobby.render(); advance(); } });
            } else {
              Sfx.bad();
              UI.modal(`
                <div class="modal-title">🤔 아쉬워!</div>
                <div class="modal-sub">정답은 <b class="spell-right">${esc(w.w)}</b><br>층에서 만나서 익혀보자!</div>
                <div class="actions"><button class="btn" data-close="ok">알겠어</button></div>`,
                { onClose: () => paint(true) });
            }
          });
          break;
      }
    });
  }

  return { maybeShow };
})();
