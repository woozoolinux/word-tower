'use strict';
// 💾 저장 파일 — 진행을 폰 안에 파일 하나로 떨궈 둔다
//
// 왜 필요한가: 진행이 `localStorage` 한 곳에만 있다. 백업(keepBackup)조차 같은 곳이라,
// 브라우저에서 "사이트 데이터 삭제"를 한 번 누르면 몇 달치가 통째로 사라진다.
//
// 왜 파일인가: **다운로드 폴더는 브라우저가 관리하는 곳이 아니다.** 캐시를 지우든
// 사이트 데이터를 지우든, 크롬을 지웠다 깔아도 그 파일은 남는다. 사진과 같은 취급이다.
//
// 왜 저장 코드로는 안 되나: 다 정복한 저장은 base64 로 **63,000자**다.
// 아이가 복사해서 어디 붙여넣을 수 있는 길이가 아니다.
//
// 언제 누르나: **레벨업 축하 화면.** 뭔가 쌓여서 아까워지는 바로 그 순간이라
// 아이가 누른다. 막지 않는 버튼이라 무시해도 게임은 그대로 진행된다.
const Backup = (() => {
  const B = () => (BAL.backup || { remindDays: 14 });

  function stamp(d) {
    const p = n => String(n).padStart(2, '0');
    return p(d.getMonth() + 1) + p(d.getDate());
  }
  function safe(s) { return String(s || '용사').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 12); }
  function fileName() {
    return `word-tower-${safe(state.player.name)}-Lv${state.player.lv}-${stamp(new Date())}.json`;
  }

  // 파일 안에는 사람이 봐도 뭔지 아는 겉면 + 실제 저장 코드를 같이 넣는다.
  // 나중에 파일이 여러 개 쌓였을 때 열어보지 않고도 고를 수 있어야 한다.
  function payload() {
    const p = state.player;
    return JSON.stringify({
      app: 'word-tower', v: 1, at: Date.now(),
      name: p.name, lv: p.lv, cards: Cards.count(),
      kings: Object.keys(p.kings || {}).length,
      code: exportCode(),
    });
  }

  // 파일 → { at, name, lv, cards, code }. 손으로 만든 날것의 저장(JSON)도 받아 준다.
  function read(text) {
    const o = JSON.parse(String(text).trim());
    if (o && o.code) return o;
    if (o && o.player) {                       // 저장 그 자체가 들어 있는 경우
      return {
        at: o.createdAt || 0, name: o.player.name, lv: o.player.lv,
        cards: Object.keys(o.player.cards || {}).length,
        code: btoa(unescape(encodeURIComponent(JSON.stringify(o)))),
      };
    }
    throw new Error('저장 파일이 아니에요');
  }

  function daysSince() {
    const at = state.player.savedAt;
    if (!at) return null;
    return Math.floor((Date.now() - at) / 86400000);
  }
  function isStale() {
    const d = daysSince();
    return d === null ? false : d >= B().remindDays;
  }
  function lastText() {
    const at = state.player.savedAt;
    if (!at) return '아직 저장한 적이 없어요';
    const d = daysSince();
    const when = new Date(at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    return `${when} · ${d === 0 ? '오늘' : d + '일 전'}`;
  }

  // ---------- 내려받기 ----------
  function save() {
    try {
      const blob = new Blob([payload()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      state.player.savedAt = Date.now(); saveState();
      UI.toast('💾 저장 파일을 받았어요 (다운로드 폴더)', 'good');
      return true;
    } catch (e) {
      UI.toast('저장 파일을 만들지 못했어요', 'bad');
      return false;
    }
  }

  // ---------- 불러오기 ----------
  // 일 년에 한 번 쓸까 말까 한 기능인데 잘못 누르면 진행이 되돌아간다.
  // 그래서 **무엇을 되돌리는지 먼저 보여주고** 확인을 받는다.
  function pick(done) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json,application/json';
    inp.style.display = 'none';
    inp.onchange = () => {
      const f = inp.files && inp.files[0];
      inp.remove();
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        let info;
        try { info = read(r.result); }
        catch (e) { UI.toast('저장 파일이 아니에요', 'bad'); return; }
        confirmLoad(info, done);
      };
      r.onerror = () => UI.toast('파일을 읽지 못했어요', 'bad');
      r.readAsText(f);
    };
    document.body.appendChild(inp);
    inp.click();
  }
  function confirmLoad(info, done) {
    const p = state.player;
    const when = info.at ? new Date(info.at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) : '날짜 모름';
    UI.modal(`
      <div class="modal-title">📂 이 상태로 되돌릴까요?</div>
      <div class="bk-cmp">
        <div class="bk-side"><div class="bk-when">${esc(when)} 파일</div>
          <b>${esc(info.name || '?')}</b> Lv.${info.lv || '?'}<br>🃏 ${info.cards || 0}장</div>
        <div class="bk-arrow">→</div>
        <div class="bk-side now"><div class="bk-when">지금</div>
          <b>${esc(p.name)}</b> Lv.${p.lv}<br>🃏 ${Cards.count()}장</div>
      </div>
      <div class="modal-sub">되돌리면 그 사이 진행이 사라져요.<br>
        지금 상태는 <b>백업에 하나 남겨</b> 두니까 다시 되돌릴 수 있어요.</div>
      <div class="actions">
        <button class="btn coral" data-close="go">되돌린다</button>
        <button class="btn ghost" data-close="x">그만두기</button>
      </div>`,
      { onClose: v => {
        if (v !== 'go') return;
        try {
          importCode(info.code);
          UI.toast('불러왔어요!', 'good');
          if (done) done();
        } catch (e) { UI.toast('불러오지 못했어요', 'bad'); }
      } });
  }

  return { save, pick, read, fileName, lastText, daysSince, isStale };
})();
