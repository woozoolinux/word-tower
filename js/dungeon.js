'use strict';
// 🕳️ 지하 던전 — 무너지는 다리 위의 추격
//
// 왜 또 만드나: 지금 게임에 "내가 자꾸 틀리는 단어만 집중해서 잡는 곳"이 없다.
// 타워는 진도, 투기장은 기록. 던전은 **오답노트**다 — ★이 낮은 단어부터 나온다.
//
// 왜 끝없는 던전이 아닌가: "몇 층까지 갔나"는 순위표를 보는 어른의 동기다.
// 아이에게는 이겼다/도망쳤다가 필요하다. 한 판 2~3분, 8칸 건너면 끝.
//
// 규칙이 그림 하나로 설명된다:
//   뜻에 맞는 발판만 밟는다 → 틀리면 발판이 부서지고 몬스터가 한 칸 다가온다 → 3번이면 잡힌다
const Dungeon = (() => {
  const D = () => BAL.dungeon;

  // ---------- 그림 ----------
  function torch() {
    return `<svg viewBox="0 0 40 76" class="dg-torch-svg">
      <rect x="17" y="26" width="6" height="48" rx="3" fill="#7a5a3a"/>
      <rect x="14" y="24" width="12" height="8" rx="3" fill="#5d4429"/>
      <g class="fl">
        <path d="M20 2 C27 12 31 17 31 23 a11 11 0 0 1-22 0 C9 17 13 12 20 2z" fill="#ff9a2e"/>
        <path d="M20 9 C24 16 26 19 26 23 a6 6 0 0 1-12 0 C14 19 16 16 20 9z" fill="#ffe066"/>
      </g>
    </svg>`;
  }
  // 그림자 짐승 — 형체는 어둡고 눈만 빛난다. 정체를 다 보여주면 안 무섭다.
  function beast() {
    return `<svg viewBox="0 0 160 130" class="dg-beast-svg">
      <path d="M18 40 L34 6 L48 34z M142 40 L126 6 L112 34z" fill="#241a3a"/>
      <ellipse cx="80" cy="78" rx="62" ry="46" fill="#2b2050"/>
      <ellipse cx="80" cy="70" rx="54" ry="38" fill="#1d1636"/>
      <g class="eyes">
        <ellipse cx="58" cy="62" rx="12" ry="9" fill="#ff3b52"/>
        <ellipse cx="102" cy="62" rx="12" ry="9" fill="#ff3b52"/>
        <ellipse cx="58" cy="62" rx="4" ry="6" fill="#fff0a8"/>
        <ellipse cx="102" cy="62" rx="4" ry="6" fill="#fff0a8"/>
      </g>
      <path d="M52 92 h56 l-6 12 -8-8 -8 10 -8-10 -8 8z" fill="#fff6e0"/>
    </svg>`;
  }

  // ---------- 프롤로그 ----------
  // 컷: 추락 → 어둠 → 횃불 → 발견 → 도망.
  // 두 번째부터는 발견 컷부터 짧게 — 다 본 아이를 매번 기다리게 하면 안 된다.
  const FULL = { fall: 0, dust: .85, c1: 1.3, torch: 2.3, light: 2.5, c2: 2.7, eyes: 3.9, c3: 4.2, shout: 4.5, flash: 4.9, beast: 5.0, c4: 5.7, go: 6.2 };
  const SHORT = { fall: -9, dust: -9, c1: -9, torch: 0, light: 0, c2: -9, eyes: .5, c3: .7, shout: .9, flash: 1.2, beast: 1.3, c4: 1.8, go: 2.2 };

  function prologue(done) {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const seen = !!state.player.dungeonSeen;
    const T = seen ? SHORT : FULL;
    state.player.dungeonSeen = true; saveState();

    const root = document.createElement('div');
    root.className = 'dg-scene' + (reduce ? ' rush' : '');
    root.innerHTML = `
      <div class="dg-light"></div>
      <div class="dg-flash"></div>
      <div class="dg-stage2">
        <div class="dg-ground"></div>
        <div class="dg-fall">${UI.charHtml(84)}<span class="dg-shout">!</span></div>
        <div class="dg-dust"></div>
        <div class="dg-torch">${torch()}</div>
        <div class="dg-eyes"><i></i><i></i></div>
        <div class="dg-beast">${beast()}</div>
      </div>
      <div class="dg-caps">
        <div class="dg-cap c1">…여긴 어디지?</div>
        <div class="dg-cap c2">횃불을 들어 앞을 비췄다</div>
        <div class="dg-cap c3">저건… 뭐야?</div>
        <div class="dg-cap c4 big">뛰어!!</div>
      </div>
      <button class="btn coral dg-go">🏃 도망친다!</button>`;
    document.getElementById('modal-root').appendChild(root);

    // 지연은 CSS가 아니라 여기서 준다 — 전체판/짧은판 두 표만 갈아 끼우면 된다
    const put = (sel, t) => root.querySelectorAll(sel).forEach(el => {
      if (t < 0) { el.style.display = 'none'; return; }
      el.style.animationDelay = t + 's';
    });
    put('.dg-fall', T.fall); put('.dg-dust', T.dust); put('.dg-cap.c1', T.c1);
    put('.dg-torch', T.torch); put('.dg-light', T.light); put('.dg-cap.c2', T.c2);
    put('.dg-eyes', T.eyes); put('.dg-cap.c3', T.c3); put('.dg-shout', T.shout);
    put('.dg-flash', T.flash); put('.dg-beast', T.beast); put('.dg-cap.c4', T.c4); put('.dg-go', T.go);
    if (seen) root.querySelector('.dg-stage2').classList.add('lit');

    const timers = [];
    const at = (t, fn) => { if (!reduce && t >= 0) timers.push(setTimeout(fn, t * 1000)); };
    at(T.dust, () => { Sfx.hit(); UI.shake(root.querySelector('.dg-stage2')); });
    at(T.torch, () => Sfx.door());
    at(T.eyes, () => Sfx.bad());
    at(T.shout, () => { const f = root.querySelector('.dg-fall'); if (f) f.classList.add('scared'); });
    at(T.beast, () => { Sfx.down(); UI.shake(root.querySelector('.dg-stage2')); });

    const finish = () => {
      timers.splice(0).forEach(clearTimeout);
      root.classList.add('out');
      setTimeout(() => { root.remove(); done(); }, 300);
    };
    root.addEventListener('click', e => {
      if (e.target.closest('.dg-go')) { finish(); return; }
      if (root.classList.contains('rush')) return;
      root.classList.add('rush');
      timers.splice(0).forEach(clearTimeout);
    });
  }

  // ---------- 후보 단어: ★이 낮은 것부터 ----------
  // 던전이 오답노트가 되는 지점. 만난 적 있는 단어만 쓴다(처음 보는 단어로 쫓기면 학습이 아니라 운이다).
  function candidates() {
    const all = [];
    (window.TOWERS || []).forEach(t => allWords(t).forEach(w => {
      const s = statFor(t.id, w);
      if (s.seen > 0) all.push({ w, score: s.stars * 10 - Math.min(9, s.wrong) });
    }));
    all.sort((a, b) => a.score - b.score);
    const pool = all.slice(0, D().words).map(x => x.w);
    return pool.length >= 4 ? pool : all.map(x => x.w);
  }

  // ---------- 다리 ----------
  let pool, plank, gap, used, q, timer, tick, lock, onEnd;

  function start() {
    pool = candidates();
    if (pool.length < 4) { UI.toast(`타워에서 단어를 조금 더 만난 뒤에 올 수 있어요`, 'bad'); return; }
    prologue(() => run());
  }

  function run() {
    plank = 0; gap = D().gap; used = []; lock = false;
    UI.show('dungeon');
    next();
  }

  function el(id) { return document.getElementById(id); }

  function render() {
    const total = D().planks;
    const dots = Array.from({ length: D().gap }, (_, i) =>
      `<i class="${i < gap ? '' : 'gone'}"></i>`).join('');
    el('screen-dungeon').innerHTML = `
      <div class="dg-hud panel">
        <div class="dg-ask"><span class="dg-ask-label">이 뜻을 밟아라</span>
          <b class="dg-ask-word">${esc(q.prompt)}</b></div>
        <div class="dg-bar"><div class="dg-bar-fill" id="dg-time"></div></div>
      </div>
      <div class="dg-field">
        <div class="dg-chase">
          <span class="dg-mon">${beast()}</span>
          <span class="dg-dots">${dots}</span>
          <span class="dg-me" id="dg-me">${UI.charHtml(50)}</span>
        </div>
        <div class="dg-track">${Array.from({ length: total }, (_, i) =>
          `<span class="dg-tick ${i < plank ? 'done' : i === plank ? 'now' : ''}"></span>`).join('')}
          <span class="dg-exit">🚪</span></div>
        <div class="dg-count">${plank} / ${total}칸</div>
      </div>
      <div class="dg-planks" id="dg-planks">
        ${q.choices.map(c => `<button class="dg-plank" data-pick="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <div class="dg-msg" id="dg-msg"></div>`;
    el('dg-planks').onclick = e => {
      const b = e.target.closest('[data-pick]');
      if (b) pick(b, b.dataset.pick);
    };
    startTimer();
  }

  function startTimer() {
    clearTimer();
    const bar = el('dg-time'), limit = D().timeLimit * 1000;
    const t0 = performance.now();
    tick = setInterval(() => {
      const left = Math.max(0, 1 - (performance.now() - t0) / limit);
      if (bar) { bar.style.width = (left * 100) + '%'; bar.classList.toggle('warn', left < .34); }
      if (left <= 0) { clearTimer(); timeUp(); }
    }, 80);
  }
  function clearTimer() { if (tick) clearInterval(tick); tick = null; if (timer) clearTimeout(timer); timer = null; }

  function next() {
    if (plank >= D().planks) { escape(); return; }
    const left = pool.filter(w => used.indexOf(wkey(w)) < 0);
    const src = left.length >= 4 ? left : pool;
    const word = src[(Math.random() * src.length) | 0];
    used.push(wkey(word));
    q = makeQuestion(word, pool, 'm2w');
    lock = false;
    render();
  }

  function pick(btn, val) {
    if (lock) return;
    lock = true; clearTimer();
    const ok = val === q.answer;
    recordResult(q.word.towerId, q.word, ok, false);
    if (ok) {
      btn.classList.add('safe');
      Sfx.ok(); plank++;
      addGold(D().gold.perPlank);
      const me = el('dg-me'); if (me) me.classList.add('hop');
      say(`좋아! ${plank}칸째`, 'good');
    } else {
      btn.classList.add('broken');
      Sfx.bad(); gap--;
      const p = el('dg-planks'); if (p) UI.shake(p);
      say(`부서졌다! 정답은 "${q.answer}"`, 'bad');
    }
    // 정답 발판은 항상 보여준다 — 틀린 채로 넘어가면 배우는 게 없다
    document.querySelectorAll('[data-pick]').forEach(b => {
      if (b.dataset.pick === q.answer) b.classList.add('safe');
      b.disabled = true;
    });
    timer = setTimeout(() => { if (gap <= 0) caught(); else next(); }, ok ? 620 : 1350);
  }
  function timeUp() {
    if (lock) return;
    lock = true; gap--;
    Sfx.bad();
    say(`너무 느려! 정답은 "${q.answer}"`, 'bad');
    recordResult(q.word.towerId, q.word, false, false);
    document.querySelectorAll('[data-pick]').forEach(b => {
      if (b.dataset.pick === q.answer) b.classList.add('safe');
      b.disabled = true;
    });
    timer = setTimeout(() => { if (gap <= 0) caught(); else next(); }, 1350);
  }
  function say(t, cls) { const m = el('dg-msg'); if (m) { m.className = 'dg-msg ' + cls; m.textContent = t; } }

  // ---------- 끝 ----------
  function caught() {
    clearTimer(); saveState();
    Sfx.down();
    UI.modal(`
      <div class="dg-end-art">${beast()}</div>
      <div class="modal-title">😱 잡혔다!</div>
      <div class="king-taunt">"어둠에서 도망칠 수 있을 것 같았나?"</div>
      <div class="star-summary">${plank}칸까지 갔다 · 다음엔 더 멀리</div>
      <div class="modal-sub">여기 나오는 단어는 <b>네가 자주 틀리는 것들</b>이야.<br>도감에서 한 번 보고 오면 훨씬 쉬워져!</div>
      <div class="actions">
        <button class="btn" data-close="again">🏃 한 번 더!</button>
        <button class="btn ghost" data-close="book">📖 단어 보기</button>
        <button class="btn ghost" data-close="x">로비로</button>
      </div>`,
      { onClose: v => {
        if (v === 'again') { run(); return; }
        Game.toLobby();
        if (v === 'book') Cards.book();
      } });
  }

  function escape() {
    clearTimer();
    const miss = D().gap - gap;
    const bonus = miss === 0 ? D().gold.perfect : 0;
    const gold = D().gold.escape + bonus, exp = D().exp.escape;
    addGold(gold);
    state.player.dungeonClears = (state.player.dungeonClears || 0) + 1;
    const prev = state.player.dungeonBest;
    if (prev === null || prev === undefined || miss < prev) state.player.dungeonBest = miss;
    addExp(exp).forEach(lv => Game.pendingUps.push(lv));
    saveState();
    Sfx.fanfare(); UI.confetti({ count: 150, colors: ['#ffc83d', '#3ee0c4', '#ffffff'] });
    UI.modal(`
      <div class="modal-title">🚪 도망쳤다!</div>
      <div class="dg-end-art escaped">${UI.charHtml(80)}</div>
      <div class="king-taunt yield">"문이 닫혔다. 짐승의 울음이 멀어진다."</div>
      <div class="reward-row">💰 +${gold}${bonus ? ' <b class="warn">(무실수 +' + bonus + ')</b>' : ''} · ⭐ +${exp}</div>
      <div class="star-summary">${D().planks}칸을 전부 건넜다 · 틀린 횟수 <b>${miss}번</b>${miss === 0 ? ' — 완벽!' : ''}</div>
      <div class="actions">
        <button class="btn" data-close="chest">🎁 보물 상자 열기</button>
        <button class="btn ghost" data-close="x">로비로</button>
      </div>`,
      { cls: 'celebrate', onClose: v => {
        const home = () => Game.flushLevelUps(() => Game.toLobby());
        if (v !== 'chest') { home(); return; }
        chest(home);
      } });
  }

  // 보물 상자 = 밀린 각인 시험. 새 카드를 뿌리지 않으니 왕 조건·오라 밸런스를 안 건드린다.
  function chest(done) {
    const pend = [];
    (window.TOWERS || []).forEach(t => Cards.pendingFor(t.id).forEach(w => pend.push(w)));
    if (!pend.length) {
      // 각인할 게 없다고 빈손으로 돌려보내면 완벽하게 건넌 보람이 없다
      const coins = Math.round(D().gold.escape / 2);
      addGold(coins); saveState(); Sfx.coin();
      UI.modal(`
        <div class="modal-title">🎁 낡은 금화 주머니</div>
        <div class="reward-row">💰 +${coins}</div>
        <div class="modal-sub">각인할 단어가 아직 없어서 금화가 들어 있었어요.<br>
          타워에서 ★★★을 만들면 다음엔 <b>카드</b>가 들어 있어요!</div>
        <div class="actions"><button class="btn" data-close="x">좋아!</button></div>`,
        { onClose: done });
      return;
    }
    Cards.runTests(shuffle(pend).slice(0, D().chestTests), () => {
      (window.TOWERS || []).forEach(t => Cards.claimRewards(t.id, () => {}));
      done();
    });
  }

  return { start, prologue };
})();
