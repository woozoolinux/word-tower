// 🐻 곰 탑 1 — 이번 달 학습 단어 (Vocabulary 1~8)
// past: 과거형(지금은 표시 안 함, 나중에 과거형 퀴즈 모드용)
// def : 영영 설명. 실제 학원 시험이 **이 설명을 보고 단어를 쓰는** 방식이라
//       게임에도 그대로 문제로 나온다 (배틀의 'd2w' 모드).
//       교재 문장을 그대로 옮기지 않고 같은 뜻의 쉬운 영어로 적는다 —
//       단어·뜻은 사실이지만 설명문은 남의 글이다.
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
  desc: '숲의 왕 · 단어 96개 · 8단원',
  emoji: '🐻',
  roof: '#8d6a4f',
  level: 'DS-D', book: 1,   // 등급과 권 — 왕·입장조건 계산의 기준
  tier: 1.5,
  lvRange: [7, 26],
  clearBonus: { type: 'hp', pct: 0.15, title: '숲의 파수꾼' },
  units: [
    { unit: 1, words: [
      { w: 'raindrop', m: '빗방울', pos: 'n', def: 'a single drop of rain' },
      { w: 'buy', m: '사다, 구입하다', pos: 'v', past: 'bought', def: 'to get something by paying money' },
      { w: 'surprised', m: '놀란', pos: 'adj', def: 'feeling surprise' },
      { w: 'parent', m: '부모', pos: 'n', def: 'a mother or a father' },
      { w: 'Londoner', m: '런던 사람', pos: 'n', def: 'a person who lives in London' },
      { w: 'famous', m: '유명한', pos: 'adj', def: 'known by many people' },
      { w: 'palace', m: '궁전', pos: 'n', def: 'the official home of a king or queen' },
      // reply 와 answer 는 교재에서 둘 다 "대답하다"라 서로 오답 보기가 못 됐다.
      // reply 쪽을 "답장하다"로 갈라 놓는다 — 실제 쓰임에도 더 맞다.
      { w: 'reply', m: '답장하다, 회신하다', pos: 'v', past: 'replied', def: 'to say or write something back' },
      { w: 'royal', m: '왕실의', pos: 'adj', def: 'relating to a king or queen' },
      { w: 'fish and chips', m: '피시 앤 칩스', pos: 'n', def: 'a meal of fried fish and potatoes' },
      { w: 'fancy', m: '화려한, 장식이 많은', pos: 'adj', def: 'special and beautiful' },
      { w: 'decide', m: '결심하다', pos: 'v', past: 'decided', def: 'to make a choice' },
    ] },
    { unit: 2, words: [
      { w: 'tour', m: '여행, 관광', pos: 'n', def: 'a trip' },
      { w: 'double-decker', m: '2층 버스', pos: 'n', def: 'a bus with two levels' },
      { w: 'climb', m: '오르다, 올라가다', pos: 'v', past: 'climbed', def: 'to go up' },
      { w: 'drive', m: '(차량을) 운전하다', pos: 'v', past: 'drove', def: 'to move a car in a direction' },
      { w: 'different', m: '다른', pos: 'adj', def: 'not the same' },
      { w: 'confused', m: '혼란스러운', pos: 'adj', def: 'unable to understand' },
      { w: 'crowded', m: '붐비는, 북적한', pos: 'adj', def: 'having lots of people' },
      { w: 'lost', m: '길을 잃은', pos: 'adj', def: 'not knowing where you are' },
      { w: 'station', m: '역', pos: 'n', def: 'a place where buses or trains stop' },
      { w: 'get off', m: '~에서 내리다', pos: 'phr', past: 'got off', def: 'to leave a bus, plane, or train' },
      { w: 'look for', m: '~를 찾다', pos: 'phr', past: 'looked for', def: 'to try to find something' },
      { w: 'beat', m: '(심장이) 뛰다', pos: 'v', past: 'beat', def: 'to make a regular movement' },
    ] },
    { unit: 3, words: [
      { w: 'alone', m: '혼자', pos: 'adj', def: 'without anyone' },
      { w: 'polite', m: '공손한, 예의 바른', pos: 'adj', def: 'having good manners, not rude' },
      { w: 'stranger', m: '낯선 사람', pos: 'n', def: 'someone you do not know' },
      { w: 'answer', m: '대답하다', pos: 'v', past: 'answered', def: 'to say something as a reply' },
      { w: 'remember', m: '기억하다', pos: 'v', past: 'remembered', def: 'to think of something from the past again' },
      { w: 'uniform', m: '제복, 유니폼', pos: 'n', def: 'a special set of clothes' },
      { w: 'sell', m: '팔다', pos: 'v', past: 'sold', def: 'to exchange something for money' },
      { w: 'walk', m: '걷다, 걸어가다', pos: 'v', past: 'walked', def: 'to move at a speed slower than running' },
      { w: 'hotel', m: '호텔', pos: 'n', def: 'a place people can stay when traveling' },
      { w: 'quietly', m: '조용히', pos: 'adv', def: 'making very little noise' },
      { w: 'worry', m: '걱정하다', pos: 'v', past: 'worried', def: 'to think about problems or fears' },
      { w: 'take', m: '데리고 가다', pos: 'v', past: 'took', def: 'to carry or move something to a place' },
    ] },
    { unit: 4, words: [
      { w: 'sure', m: '확신하는', pos: 'adj', def: 'not having any doubt' },
      { w: 'change', m: '변하다, 달라지다', pos: 'v', past: 'changed', def: 'to become different' },
      { w: 'point', m: '가리키다', pos: 'v', past: 'pointed', def: 'to show someone where to look' },
      { w: 'perhaps', m: '아마, 어쩌면', pos: 'adv', def: 'maybe' },
      { w: 'finally', m: '마침내', pos: 'adv', def: 'after a long time' },
      { w: 'in fact', m: '사실은', pos: 'phr', def: 'in truth; actually' },
      { w: 'receive', m: '받다, 수신하다', pos: 'v', past: 'received', def: 'to get something' },
      { w: 'let', m: '허락하다', pos: 'v', past: 'let', def: 'to allow someone to do something' },
      { w: 'try on', m: '(옷을) 입어보다', pos: 'phr', past: 'tried on', def: 'to put on something to see how it looks' },
      { w: 'cover', m: '덮다, 가리다', pos: 'v', past: 'covered', def: 'to put something over or on top of' },
      { w: 'gate', m: '문, 정문', pos: 'n', def: 'an entrance door in a wall or fence' },
      { w: 'wave', m: '(손을) 흔들다', pos: 'v', past: 'waved', def: 'to move your hand from side to side' },
    ] },
    { unit: 5, words: [
      { w: 'invisible', m: '보이지 않는', pos: 'adj', def: 'impossible to see' },
      { w: 'odd', m: '이상한', pos: 'adj', def: 'strange or unusual' },
      { w: 'comb', m: '빗질하다', pos: 'v', past: 'combed', def: 'to make your hair neat with a small toothed tool' },
      { w: 'shrug', m: '(어깨를) 으쓱하다', pos: 'v', past: 'shrugged', def: 'to raise and lower your shoulders' },
      { w: 'face', m: '~을 향하다', pos: 'v', past: 'faced', def: 'to stand looking toward something' },
      { w: 'wake up', m: '잠에서 깨다', pos: 'phr', past: 'woke up', def: 'to stop sleeping' },
      { w: 'carton', m: '(음료를 담는) 갑, 통', pos: 'n', def: 'a container made of thick paper' },
      { w: 'float', m: '(공중에서) 떠가다', pos: 'v', past: 'floated', def: 'to move slowly and lightly in the air' },
      { w: 'pour', m: '음료를 따르다', pos: 'v', past: 'poured', def: 'to fill a cup or glass with a drink' },
      { w: 'pout', m: '(입술이) 뿌루퉁하다', pos: 'v', past: 'pouted', def: 'to push out your lips because you are annoyed' },
      { w: 'hand', m: '건네 주다', pos: 'v', past: 'handed', def: 'to give something to someone with your fingers' },
      { w: 'stare', m: '빤히 쳐다보다', pos: 'v', past: 'stared', def: 'to look at something for a long time' },
    ] },
    { unit: 6, words: [
      { w: 'annoyed', m: '짜증이 난', pos: 'adj', def: 'slightly angry' },
      { w: 'push', m: '밀다', pos: 'v', past: 'pushed', def: 'to use force to move someone away from you' },
      { w: 'seat', m: '좌석', pos: 'n', def: 'something that you sit on' },
      { w: 'classroom', m: '교실', pos: 'n', def: 'a room where classes are taught' },
      { w: 'head', m: '(특정 방향으로) 향하다', pos: 'v', past: 'headed', def: 'to go in a certain direction' },
      { w: 'flutter', m: '가볍게 흔들다', pos: 'v', past: 'fluttered', def: 'to move something with quick, light movements' },
      { w: 'go around', m: '(소문이) 퍼지다', pos: 'phr', past: 'went around', def: 'to pass from one person to another person' },
      { w: 'ring', m: '(종이) 울리다', pos: 'v', past: 'rang', def: 'to make a sound as a signal' },
      { w: 'attendance', m: '출석', pos: 'n', def: 'a record of how often a person goes to classes' },
      { w: 'absent', m: '결석한', pos: 'adj', def: 'not present at an expected place' },
      { w: 'trick', m: '장난', pos: 'n', def: 'something done to surprise or confuse others' },
      { w: 'seem', m: '(~인 것처럼) 보이다', pos: 'v', past: 'seemed', def: 'to appear to be something' },
    ] },
    { unit: 7, words: [
      { w: 'history', m: '역사', pos: 'n', def: 'the study of past events' },
      { w: 'subject', m: '과목', pos: 'n', def: 'an area of knowledge studied in school' },
      { w: 'roll', m: '굴리다', pos: 'v', past: 'rolled', def: 'to turn over one or more times' },
      { w: 'raise', m: '들어올리다', pos: 'v', past: 'raised', def: 'to lift something to a higher position' },
      { w: 'call on', m: '시키다', pos: 'phr', past: 'called on', def: 'to ask someone to do something' },
      { w: 'duty', m: '업무, 직무', pos: 'n', def: 'something that is done as part of a job' },
      { w: 'playground', m: '운동장', pos: 'n', def: 'an outdoor area where children can play' },
      { w: 'explain', m: '설명하다', pos: 'v', past: 'explained', def: 'to make something easy to understand' },
      { w: 'strict', m: '엄격한', pos: 'adj', def: 'demanding that people obey rules' },
      { w: 'hate', m: '몹시 싫어하다', pos: 'v', past: 'hated', def: 'to dislike something very strongly' },
      { w: 'catch up', m: '(앞선 사람을) 따라잡다', pos: 'phr', past: 'caught up', def: 'to move fast enough to join someone ahead' },
      { w: 'bench', m: '벤치, 긴 의자', pos: 'n', def: 'a long seat for two or more people' },
    ] },
    { unit: 8, words: [
      { w: 'try', m: '시도하다, 해보다', pos: 'v', past: 'tried', def: 'to do something in order to see if it works' },
      { w: 'take off', m: '(옷을) 벗다', pos: 'phr', past: 'took off', def: 'to remove clothing' },
      { w: 'work', m: '효과가 있다', pos: 'v', past: 'worked', def: 'to have the intended effect or result' },
      { w: 'disappear', m: '사라지다', pos: 'v', past: 'disappeared', def: 'to stop being visible' },
      { w: 'put on', m: '(옷을) 입다, 착용하다', pos: 'phr', past: 'put on', def: 'to dress yourself in clothing' },
      { w: 'shout', m: '외치다', pos: 'v', past: 'shouted', def: 'to say something very loudly' },
      { w: 'nod', m: '(고개를) 끄덕이다', pos: 'v', past: 'nodded', def: 'to move your head up and down' },
      { w: 'normal', m: '보통, 정상', pos: 'n', def: 'the usual or expected state' },
      { w: 'think', m: '생각하다', pos: 'v', past: 'thought', def: 'to have an opinion about something' },
      { w: 'wonder', m: '궁금해하다', pos: 'v', past: 'wondered', def: 'to think about something with curiosity' },
      { w: 'invisibility', m: '눈에 보이지 않는 상태', pos: 'n', def: 'the state of being impossible to see' },
      { w: 'grab', m: '꽉 붙잡다, 움켜잡다', pos: 'v', past: 'grabbed', def: 'to quickly take and hold something' },
    ] },
  ],
});
