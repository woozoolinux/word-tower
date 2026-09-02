'use strict';
// 🎆 등급 해금 연출
//
// 왕을 "처음" 꺾어 새 등급이 열리는 순간에만 뜬다. 이 게임에서 아이가 가장
// 오래 준비해서 얻어내는 결과인데(카드 60% + 그 등급 단어 전부), 모달 한 장으로
// 끝내면 그 무게가 안 산다. 그래서 화면 전체를 쓴다.
//
// 연출보다 중요한 건 마지막 두 줄이다. "잘했어"는 아이도 빈말인 걸 안다.
// 그래서 그 판에서 실제로 몇 개를 놓쳤는지, 단어를 몇 개 상대했는지로 말한다.
const Fx = (() => {

  // 칭찬은 구체적이어야 한다 — 아이가 방금 한 일을 그대로 되돌려 준다.
  function praiseFor(missCount, name) {
    if (missCount === 0) return {
      big: 'PERFECT',
      sub: `${name}, 한 번도 틀리지 않았어.\n왕은 손 쓸 틈조차 없었다.`,
    };
    if (missCount <= 2) return {
      big: 'SPLENDID',
      sub: `${missCount}개를 놓치고도 끝까지 밀어붙였어.\n흔들리고 나서 이기는 게 더 어려운 거야.`,
    };
    return {
      big: 'BRAVE',
      sub: `쓰러지기 직전까지 가고도 넘어섰어.\n${name}, 포기 안 하는 게 제일 어려운 거야.`,
    };
  }

  // o = { king, next, yield, gold, title, missCount, words, towers }
  function unlock(o, done) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const p = praiseFor(o.missCount, state.player.name || '용사');
    const land = (o.towers || []).slice(0, 3)
      .map(t => `<span class="fx-t">${Art.tower(0, 1, t.roof)}</span>`).join('');
    const hero = state.player.avatar ? Avatar.html(104, { pet: '' })
      : `<span style="font-size:80px">${UI.charEmoji()}</span>`;

    const root = document.createElement('div');
    root.className = 'fx-scene' + (reduce ? ' rush' : '');
    root.innerHTML = `
      <div class="fx-rays"></div>
      <div class="fx-beam"></div>
      <div class="fx-stage">
        <div class="fx-art">
          <div class="fx-old">${Art.king(o.king.animal)}</div>
          <div class="fx-ring"></div>
          <div class="fx-new">
            <div class="fx-land">${land}</div>
            <div class="fx-hero">${hero}<span class="fx-crown">👑</span></div>
          </div>
        </div>
        <div class="fx-yield">"${esc(o.king.yield || '내가 졌다.')}"</div>
        <div class="fx-title">${o.next.emoji} ${esc(o.next.name)}의 땅이 열렸다</div>
        <div class="fx-big">${p.big}</div>
        <div class="fx-praise">${esc(p.sub).replace(/\n/g, '<br>')}</div>
        <div class="fx-stat">${esc(o.king.name)} 등급 단어 <b>${o.words}개</b>를 전부 상대했다</div>
        <div class="fx-chips">
          <span class="fx-chip">💰 +${o.gold}</span>
          <span class="fx-chip">🎖️ ${esc(o.title)}</span>
          <span class="fx-chip">${o.next.emoji} 탑 ${(o.towers || []).length}개 열림</span>
        </div>
        <button class="btn fx-go">계속!</button>
      </div>`;
    document.getElementById('modal-root').appendChild(root);

    const timers = [];
    const at = (ms, fn) => { if (!reduce) timers.push(setTimeout(fn, ms)); };
    at(600, () => Sfx.crit());
    at(1050, () => { UI.flash(); Sfx.hit(); });
    at(2050, () => cheer());
    at(3250, () => Sfx.coin());
    if (reduce) cheer();

    function cheer() {
      Sfx.fanfare();
      UI.confetti({ count: 280, life: 5, colors: ['#ffc83d', '#fff3c4', '#ffffff', '#3ee0c4', '#8f7bff'] });
    }
    // 아이가 이미 다 봤으면 기다리게 하지 않는다 — 아무 데나 누르면 끝까지 감는다
    function rush() {
      if (root.classList.contains('rush')) return;
      root.classList.add('rush');
      timers.splice(0).forEach(clearTimeout);
      cheer();
    }
    function finish() {
      timers.splice(0).forEach(clearTimeout);
      root.classList.add('out');
      setTimeout(() => { root.remove(); done && done(); }, 320);
    }
    root.addEventListener('click', e => { if (e.target.closest('.fx-go')) finish(); else rush(); });
  }

  return { unlock, praiseFor };
})();
