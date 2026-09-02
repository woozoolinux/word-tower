// 🐻 곰 탑 1 — 이번 달 학습 단어 (Vocabulary 1~4)
// past: 과거형(지금은 표시 안 함, 나중에 과거형 퀴즈 모드용)
//
// ── 동물 월드: 등급 → 동물, 권수 → 숫자 ──────────────────────────
// 등급이 오를수록 센 동물. 숲(DS) → 야생(LS) → 전설(MS)로 세계가 바뀐다.
// 새 타워를 만들 땐 아래 표에서 tier / lvRange를 그대로 가져다 쓰면 된다.
//
//   #   반     이름            세계        tier   lvRange
//   1   IS     🐣 병아리 탑    새싹 들판   1.0    [1, 10]
//   2   DS-A   🐰 토끼 탑      숲          1.15   [2, 13]
//   3   DS-B   🦊 여우 탑      숲          1.3    [3, 17]
//   4   DS-C   🐺 늑대 탑      숲          1.4    [4, 20]
//   5   DS-D   🐻 곰 탑        숲의 왕     1.5    [5, 24]   ← 이 파일
//   6   LS-A   🦅 독수리 탑    야생        1.7    [8, 28]
//   7   LS-B   🐆 표범 탑      야생        1.9    [11, 32]
//   8   LS-C   🦁 사자 탑      야생        2.1    [14, 36]
//   9   LS-D   🐅 호랑이 탑    야생의 왕   2.3    [17, 40]
//  10   MS-A   🐉 드래곤 탑    전설        2.6    [21, 46]
//  11   MS-B   🔥 불사조 탑    전설의 정점 3.0    [25, 52]
//
// 같은 등급의 2·3권은 이름 뒤 숫자만 바꾼다 (예: 🐻 곰 탑 2).
// tier는 "반(班)"에 매긴다 — 같은 동물이면 🔥 개수가 같아야 한다.
// 권수는 난이도가 아니라 단어 양의 차이다. 다음 동물과 겹치지 않게
// 같은 동물 안에서는 +0.05씩만 올린다 (곰 1.5 / 1.55 / 1.6 < 독수리 1.7).
// ───────────────────────────────────────────────────────────────
window.TOWERS = window.TOWERS || [];
window.TOWERS.push({
  id: 'jeongsang1',              // 저장 키 — 이름이 바뀌어도 진행이 유지되도록 그대로 둔다
  name: '🐻 곰 탑 1',
  desc: '숲의 왕 · 단어 48개 · 4단원',
  emoji: '🐻',
  roof: '#8d6a4f',
  level: 'DS-D', book: 1,   // 등급과 권 — 왕·입장조건 계산의 기준
  tier: 1.5,
  lvRange: [7, 26],
  clearBonus: { type: 'hp', pct: 0.15, title: '숲의 파수꾼' },
  units: [
    { unit: 1, words: [
      { w: 'raindrop', m: '빗방울', pos: 'n' },
      { w: 'buy', m: '사다, 구입하다', pos: 'v', past: 'bought' },
      { w: 'surprised', m: '놀란', pos: 'adj' },
      { w: 'parent', m: '부모', pos: 'n' },
      { w: 'Londoner', m: '런던 사람', pos: 'n' },
      { w: 'famous', m: '유명한', pos: 'adj' },
      { w: 'palace', m: '궁전', pos: 'n' },
      { w: 'reply', m: '대답하다', pos: 'v', past: 'replied' },
      { w: 'royal', m: '왕실의', pos: 'adj' },
      { w: 'fish and chips', m: '피시 앤 칩스', pos: 'n' },
      { w: 'fancy', m: '화려한, 장식이 많은', pos: 'adj' },
      { w: 'decide', m: '결심하다', pos: 'v', past: 'decided' },
    ]},
    { unit: 2, words: [
      { w: 'tour', m: '여행, 관광', pos: 'n' },
      { w: 'double-decker', m: '2층 버스', pos: 'n' },
      { w: 'climb', m: '오르다, 올라가다', pos: 'v', past: 'climbed' },
      { w: 'drive', m: '(차량을) 운전하다', pos: 'v', past: 'drove' },
      { w: 'different', m: '다른', pos: 'adj' },
      { w: 'confused', m: '혼란스러운', pos: 'adj' },
      { w: 'crowded', m: '붐비는, 복잡한', pos: 'adj' },
      { w: 'lost', m: '길을 잃은', pos: 'adj' },
      { w: 'station', m: '역', pos: 'n' },
      { w: 'get off', m: '~에서 내리다', pos: 'phr', past: 'got off' },
      { w: 'look for', m: '~를 찾다', pos: 'phr', past: 'looked for' },
      { w: 'beat', m: '(심장이) 뛰다', pos: 'v', past: 'beat' },
    ]},
    { unit: 3, words: [
      { w: 'alone', m: '혼자', pos: 'adj' },
      { w: 'polite', m: '공손한, 예의 바른', pos: 'adj' },
      { w: 'stranger', m: '낯선 사람', pos: 'n' },
      { w: 'answer', m: '대답하다', pos: 'v', past: 'answered' },
      { w: 'remember', m: '기억하다', pos: 'v', past: 'remembered' },
      { w: 'uniform', m: '제복, 유니폼', pos: 'n' },
      { w: 'sell', m: '팔다', pos: 'v', past: 'sold' },
      { w: 'walk', m: '걷다, 걸어가다', pos: 'v', past: 'walked' },
      { w: 'hotel', m: '호텔', pos: 'n' },
      { w: 'quietly', m: '조용히', pos: 'adv' },
      { w: 'worry', m: '걱정하다', pos: 'v', past: 'worried' },
      { w: 'take', m: '데리고 가다', pos: 'v', past: 'took' },
    ]},
    { unit: 4, words: [
      { w: 'sure', m: '확신하는', pos: 'adj' },
      { w: 'change', m: '변하다, 달라지다', pos: 'v', past: 'changed' },
      { w: 'point', m: '가리키다', pos: 'v', past: 'pointed' },
      { w: 'perhaps', m: '아마, 어쩌면', pos: 'adv' },
      { w: 'finally', m: '마침내', pos: 'adv' },
      { w: 'in fact', m: '사실은', pos: 'phr' },
      { w: 'receive', m: '받다, 수신하다', pos: 'v', past: 'received' },
      { w: 'let', m: '허락하다', pos: 'v', past: 'let' },
      { w: 'try on', m: '(옷을) 입어보다', pos: 'phr', past: 'tried on' },
      { w: 'cover', m: '덮다, 가리다', pos: 'v', past: 'covered' },
      { w: 'gate', m: '문, 정문', pos: 'n' },
      { w: 'wave', m: '(손을) 흔들다', pos: 'v', past: 'waved' },
    ]},
  ],
});
