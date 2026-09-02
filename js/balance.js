'use strict';
// ===================================================================
//  밸런스 시트 — 게임의 "느낌"을 정하는 숫자는 전부 여기 있다.
// ===================================================================
// 규칙 하나: 난이도·보상·속도를 바꾸고 싶으면 이 파일만 연다.
//            다른 파일에 새 숫자를 박지 않는다.
//
// 여기 없는 것:
//   화면 배치(픽셀)·색·애니메이션 시간 → css/style.css와 각 화면 파일
//   상점 가격·스킬 레벨·구역 해금 조건 → js/state.js의 WEAPONS/ITEMS/HATS/SKILLS/ZONES 테이블
//     (이름·이모지와 한 몸이라 쪼개면 오히려 관리가 어려워진다)
//
// 층 비례 값은 { base, perFloor } 꼴이고 byFloor()로 읽는다.
//   byFloor({ base: 20, perFloor: 3 }, 5)  →  20 + 5×3 = 35

function byFloor(x, floor) { return x.base + floor * x.perFloor; }

const BAL = {

  // ---------- 캐릭터 성장 ----------
  // 레벨은 골드로 살 수 없는 유일한 축이다. 여기를 키우면 성장이 빨라진다.
  player: {
    hpBase: 100, hpPerLv: 12,      // 기본 HP = hpBase + (Lv−1) × hpPerLv
    atkBase: 10, atkPerLv: 3,      // 기본 공격력 = atkBase + Lv × atkPerLv (무기 제외)
    // 다음 레벨까지 = ⌊expBase × Lv^expPow⌋ + expFlat
    // 곡선이 가파르면 고레벨에서 같은 층을 수십 번 반복해야 한다.
    // 기준: 지금 콘텐츠(55층)를 한 번씩 깨면 Lv25, 타워가 11개까지 늘면 Lv52.
    expBase: 22, expPow: 1.15, expFlat: 15,
    // 타워를 정복할 때마다 붙는 영구 보너스(clearBonus)의 총합 상한.
    // 상한이 없으면 등급 11개 × 6권 = 66개를 다 깼을 때 +500%가 되어,
    // 가장 어려운 MS-B가 2방에 죽는 역전이 생긴다. +100%면 최상위 타워도 5방을 유지한다.
    // 상한에 닿은 뒤에도 칭호는 계속 모인다(수집물은 그대로).
    clearBonusCap: 1.0,
  },

  // ---------- 몬스터 ----------
  // 몬스터는 내 절대 레벨이 아니라 "그 타워의 기준 레벨"로 만들어진다.
  // 그래서 바벨에서 키운 캐릭이 새 타워 1층에서 한 방에 죽는 일이 없다.
  //   기준레벨 = lvRange[0] + (clamp(내Lv, lvRange) − lvRange[0]) × growth
  monster: {
    growth: 0.7,                   // 내 성장의 70%만 따라온다 → 같은 타워에서 레벨업이 체감됨
    defaultRange: [1, 12],         // 타워에 lvRange가 없을 때
    defaultTier: 1,                // 타워에 tier가 없을 때
    hp:     { base: 3.5, perFloor: 0.2 },   // × 기준레벨 공격력 × 티어
    bossHp: { base: 10,  perFloor: 0.5 },
    // × 기본HP(내Lv) × 티어. 몇 번 틀리면 죽는지가 이 숫자로 정해진다.
    // 0.06일 땐 바벨 1층에서 17번을 틀려야 죽어서 긴장감이 없었다 → 10번으로.
    atk:    { base: 0.09, perFloor: 0.005 },
    bossAtkMul: 1.25,
    minAtk: 3,
  },

  // ---------- 실수 벌칙 ----------
  // 기본HP(내Lv) 대비 비율 × 타워 티어.
  // 최대HP가 아니라 기본HP 기준인 이유: 최대HP를 올려주는 보상이 스스로 상쇄되면 안 된다.
  hazard: { mazeWrongKey: 0.07, runnerBump: 0.08, vaultWrongCard: 0.07, min: 2 },

  // ---------- 배틀 ----------
  battle: {
    timeLimit: 10,        // 문제당 제한시간(초). 아이가 쫓긴다고 하면 여기를 올린다
    warnAt: 3,            // 남은 시간이 이보다 적으면 타이머가 빨개짐
    critUnder: 2.5,       // 이 시간 안에 맞히면 크리티컬
    critMul: 1.5,
    doubleMul: 0.5,       // 더블 어택(Lv3)의 추가 타격 배율
    chargeNeed: 3,        // 연속 정답 몇 번이면 필살기 준비
    // 필살기 위력 = 공격력 × min(ultMax, ultBase + 카드포인트 × ultPerCardPt) × (필살강화)
    // 1/25이던 시절엔 카드를 다 모으면 20.6배라 최종 보스까지 한 방에 지워졌다.
    // 공부를 열심히 할수록 게임이 사라지는 구조여서, 완만하게 + 상한을 뒀다.
    ultBase: 2,
    ultPerCardPt: 1 / 120,//   0장 2.0배 · 절반 3.9배 · 지금 콘텐츠 전부 5.9배
    ultMax: 6,            //   타워가 계속 늘어도 여기서 멈춘다
    ultSkillMul: 1.5,     // Lv20 '필살 강화' (상한 적용 후에 곱한다)
  },

  // ---------- 층 구성 ----------
  // 한 층 = 탐험 파트 하나 + 마무리 파트 하나. 층마다 여기서 뽑는다.
  // 미니게임을 늘리려면 이 목록에 id를 넣기만 하면 된다 (Game.STAGES에 등록된 것).
  // 매 층이 똑같은 순서면 45층을 버티기 어렵다 — 개수보다 조합이 다양성을 만든다.
  stages: {
    explore: ['maze', 'vault'],   // 저강도. 시간 압박 없이 판단하는 구간
    finish:  ['runner'],          // 고강도. 반사신경으로 마무리하는 구간
    avoidRepeat: true,            // 직전 층과 같은 탐험 파트가 연달아 나오지 않게
  },

  // ---------- 미로 ----------
  maze: {
    cols: 6, rows: 5,     // 방 개수 (실제 격자는 cols×2+1 × rows×2+1)
    extraLoops: 3,        // 벽을 더 뚫어 만드는 갈림길 수. 0이면 외길 미로
    sight: 2,             // 안개가 걷히는 반경(맨해튼 거리)
    keys: 4,              // 바닥에 뿌리는 열쇠 수 (정답 1 + 오답 3)
    minKeyDist: 4,        // 시작점에서 이만큼 떨어진 곳에만 열쇠를 둔다
  },

  // ---------- 금고 방 ----------
  // 자물쇠(뜻)에 카드(영어)를 꽂는다. 틀리면 그 카드가 부서져 영영 못 쓴다.
  // 미로 문이 "하나를 고르는" 것이라면, 금고는 "여럿을 동시에 놓고 배치하는" 것이다.
  vault: {
    locks: 4,             // 자물쇠 수
    extraCards: 2,        // 섞어 넣는 오답 카드 (이만큼은 틀려도 된다)
    guardAt: 2,           // 이 개수째 자물쇠를 열면 금고지기가 깨어난다 (0이면 없음)
    perFloor: 0.06,       // 층이 오를수록 자물쇠가 늘어난다 (locks + floor×perFloor, 최대 maxLocks)
    maxLocks: 6,
  },

  // ---------- 러너 ----------
  runner: {
    lanes: 3,
    missions: 4,          // 한 층에서 잡아야 할 단어 수
    speed: { base: 115, perFloor: 5 },  // px/초. 아이 반응속도 고려해 여유있게
  },

  // ---------- 정찰(예습) ----------
  preview: {
    minLook: 800,         // ms. 이만큼 지나야 '다음'이 켜진다 (마구 넘기기 방지)
    sayDelay: 250,        // ms. 카드가 뜨고 이만큼 뒤에 읽어준다
  },

  // ---------- 발음 읽어주기 ----------
  speech: {
    rate: 0.85,           // 1.0이 보통 속도. 아이가 따라 말할 수 있게 조금 느리게
  },

  // ---------- 골드 ----------
  // 층 클리어·보스·상자는 타워 티어를 곱한다. 한 층 대략 130G.
  gold: {
    battleCorrect: 1, mazeDoor: 2, runnerMission: 3, coin: 3, arenaKill: 3,
    vaultLock: 3,         // 자물쇠 하나 열 때마다
    vaultClear: 25,       // 전부 열면 보너스 (× 티어)
    chest:      { base: 15, perFloor: 3 },
    floorClear: { base: 20, perFloor: 3 },
    bossClear:  { base: 60, perFloor: 8 },
    petDupBonus: 80,      // 이미 가진 펫이 또 드랍될 때
    unitComplete: 150,    // 단원의 카드를 전부 모았을 때 (× 타워 티어). 오라는 따로 마일스톤
    replayMul: 0.3,       // 이미 깬 층 재도전 시 골드 (경험치는 그대로 — 다시 푸는 건 공부니까)
  },

  // ---------- 경험치 ----------
  exp: {
    battleCorrect:  { base: 2,  perFloor: 0.6 },
    mazeDoor:       { base: 3,  perFloor: 0.6 },
    runnerMission:  { base: 2,  perFloor: 0.6 },
    vaultLock:      { base: 3,  perFloor: 0.6 },
    floorClear:     { base: 20, perFloor: 3 },
    bossClear:      { base: 50, perFloor: 6 },
  },

  // ---------- 단어 카드 ----------
  cards: {
    bossGate: 0.6,        // 보스 층에 필요한 해당 단원 카드 비율 (일반 층은 자유)
    testsPerFloor: 2,     // 층 클리어 직후 바로 보는 각인 시험 수. 나머지는 도감에서
    decoyHard: { common: 2, rare: 3, epic: 4, legend: 5 },  // '이건 알아!' 함정 글자
    decoyNormal: { common: 0, rare: 0, epic: 2, legend: 3 },// 정규 각인 시험
    practiceHpMul: 10,    // 복습 배틀 허수아비 HP = 내 공격력 × 이 값
    practiceWords: 12,    // 복습 배틀에서 내는 문제 수
  },

  // ---------- 아이템 ----------
  items: { potionHeal: 0.4, eraseCount: 2 },   // 물약은 최대HP의 40% 회복

  // ---------- 출제 ----------
  quiz: {
    choices: 4,           // 4지선다
    reviewPerFloor: 2,    // 틀렸던 단어를 층마다 최대 몇 개 섞어 넣나
    starWeight: 4,        // ★이 낮을수록 자주 나온다 (가중치 = starWeight − ★)
  },

  // ---------- 투기장 ----------
  // 오래 버틸수록 조여든다 — 시간은 줄고, 몬스터는 세진다.
  // 언제든 🏳️ 여기까지로 나올 수 있으니 (보상은 잡을 때마다 이미 받았다)
  // 마음 놓고 어렵게 만들어도 된다.
  arena: {
    minWords: 8,
    hp:  { base: 2,    perKill: 0.35 },   // × 기준 공격력
    // × 기본HP(내Lv). 0.05일 땐 처음에 20번을 틀려야 죽어서 긴장감이 없었다.
    atk: { base: 0.08, perKill: 0.018 },  // 처음 13번 → 10마리째 4번 → 20마리째 3번
    minAtk: 3,
    // 제한시간도 마리 수만큼 줄어든다 (일반 배틀은 10초)
    time: { base: 8, perKill: 0.15, min: 5 },
  },
};
