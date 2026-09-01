// 🐻 곰 탑 3 — 이번 달 학습 단어 (Vocabulary 1~4)
// 동물 월드 작명 규칙과 tier/lvRange 표는 data/jeongsang.js 주석 참고.
// past: 과거형(지금은 표시 안 함, 나중에 과거형 퀴즈 모드용)
//
// 책과 다르게 넣은 것 (이유는 README의 규칙 참고):
//  · crash — 책에는 Voca 1에 명사(굉음), Voca 2에 동사(충돌하다)로 두 번 나온다.
//    게임은 영어 철자를 카드 키로 쓰기 때문에 같은 단어가 두 개면 카드가 하나로 합쳐진다.
//    → Unit 1에 두 뜻을 합쳐서 한 번만 넣었다 (Unit 2는 11단어).
//  · pass out — 책 뜻이 "의식을 잃다, 기절하다"인데 같은 단원의 faint(기절하다)와
//    겹쳐서 4지선다에 정답이 둘 생긴다. → "의식을 잃다"로 좁혔다.
window.TOWERS = window.TOWERS || [];
window.TOWERS.push({
  id: 'jeongsang3',            // 저장 키 — 이름이 바뀌어도 진행이 유지되도록 그대로 둔다
  name: '🐻 곰 탑 3',
  desc: '숲의 왕 · 단어 47개 · 4단원',
  emoji: '🐻',
  roof: '#55402c',
  tier: 1.6,                   // 곰(DS-D) 반 3권
  lvRange: [7, 26],
  clearBonus: { type: 'hp', pct: 0.25, title: '숲의 지배자' },
  units: [
    { unit: 1, words: [
      { w: 'lie', m: '누워있다, 눕다', pos: 'v', past: 'lay' },
      { w: 'rob', m: '빼앗다, 약탈하다', pos: 'v', past: 'robbed' },
      { w: 'bomb', m: '폭탄', pos: 'n' },
      { w: 'crash', m: '요란한 소리, 굉음 / 충돌하다', pos: 'n', past: 'crashed' },
      { w: 'mistake', m: '실수', pos: 'n' },
      { w: 'warn', m: '경고하다', pos: 'v', past: 'warned' },
      { w: 'fail', m: '실패하다', pos: 'v', past: 'failed' },
      { w: 'lift up', m: '들어올리다', pos: 'phr', past: 'lifted up' },
      { w: 'cheer', m: '환호하다', pos: 'v', past: 'cheered' },
      { w: 'save', m: '구하다', pos: 'v', past: 'saved' },
      { w: 'win', m: '이기다', pos: 'v', past: 'won' },
      { w: 'twin', m: '쌍둥이의', pos: 'adj' },
    ]},
    { unit: 2, words: [
      { w: 'good-looking', m: '잘 생긴', pos: 'adj' },
      { w: 'usually', m: '보통, 대개', pos: 'adv' },
      { w: 'hurt', m: '다치게 하다', pos: 'v', past: 'hurt' },
      { w: 'giant', m: '거대한', pos: 'adj' },
      { w: 'ahead', m: '앞선', pos: 'adv' },
      { w: 'fly', m: '날다', pos: 'v', past: 'flew' },
      { w: 'lesson', m: '수업, 교육', pos: 'n' },
      { w: 'turn', m: '차례, 순번', pos: 'n' },
      { w: 'straight', m: '곧장, 곧바로', pos: 'adv' },
      { w: 'opposite', m: '반대 (되는 사람, 것)', pos: 'n' },
      { w: 'whole', m: '전체의, 모든', pos: 'adj' },
    ]},
    { unit: 3, words: [
      { w: 'evil', m: '사악한', pos: 'adj' },
      { w: 'reporter', m: '기자, 리포터', pos: 'n' },
      { w: 'second', m: '(시간의 단위) 초, 짧은 시간', pos: 'n' },
      { w: 'continue', m: '(쉬지 않고) 계속하다', pos: 'v', past: 'continued' },
      { w: 'towards', m: '~쪽으로, ~를 향하여', pos: 'prep' },
      { w: 'vault', m: '금고', pos: 'n' },
      { w: 'danger', m: '위험', pos: 'n' },
      { w: 'success', m: '성공', pos: 'n' },
      { w: 'lock', m: '(자물쇠로) 잠그다', pos: 'v', past: 'locked' },
      { w: 'enemy', m: '적', pos: 'n' },
      { w: 'bother', m: '괴롭히다', pos: 'v', past: 'bothered' },
      { w: 'worker', m: '일 하는 사람, 근로자', pos: 'n' },
    ]},
    { unit: 4, words: [
      { w: 'trap', m: '~를 함정에 빠뜨리다', pos: 'v', past: 'trapped' },
      { w: 'slip', m: '미끄러지다', pos: 'v', past: 'slipped' },
      { w: 'free', m: '풀어주다, 석방하다', pos: 'v', past: 'freed' },
      { w: 'jail', m: '감옥', pos: 'n' },
      { w: 'right', m: '옳은, 맞는', pos: 'adj' },
      { w: 'bend', m: '굽히다', pos: 'v', past: 'bent' },
      { w: 'disgusting', m: '역겨운, 혐오스러운', pos: 'adj' },
      { w: 'faint', m: '기절하다', pos: 'v', past: 'fainted' },
      { w: 'pass out', m: '의식을 잃다', pos: 'phr', past: 'passed out' },
      { w: 'water', m: '눈물이 나다', pos: 'v', past: 'watered' },
      { w: 'scientist', m: '과학자', pos: 'n' },
      { w: 'smelly', m: '냄새 나는', pos: 'adj' },
    ]},
  ],
});
