'use strict';
// 저장 데이터 + 성장 수치. 서버 없이 localStorage에 저장한다.
// (2단계에서 클라우드로 옮길 땐 loadState/saveState만 바꾸면 됨)

const SAVE_KEY = 'wordtower_save_v1';   // 저장 슬롯 이름. 바꾸면 기존 진행이 안 보이니 건드리지 않는다
const BACKUP_KEY = 'wordtower_backup';  // 되돌릴 수 없는 조작 직전의 원본 하나

// 세이브 "구조" 버전. 필드의 뜻이 바뀔 때만 +1 하고 MIGRATIONS에 함수를 추가한다.
// 필드를 더하기만 하는 변경은 fillShape()가 알아서 채우므로 올릴 필요 없다.
const SAVE_VERSION = 1;

// key n = "버전 n-1 세이브를 n으로 올리는 함수". 낮은 것부터 순서대로 전부 적용된다.
// 예) cards 값을 숫자 pt에서 객체로 바꾼다면 SAVE_VERSION을 2로 올리고:
//   2: s => Object.keys(s.player.cards).forEach(k => { s.player.cards[k] = { pt: s.player.cards[k] }; }),
const MIGRATIONS = {};

// 무기는 더하기가 아니라 곱하기(%). 레벨 성장을 건너뛰지 못하게.
const WEAPONS = {
  stick:  { name: '나무막대', emoji: '🪵', pct: 0,    price: 0 },
  bronze: { name: '청동검',   emoji: '🗡️', pct: 0.15, price: 200 },
  silver: { name: '은검',     emoji: '⚔️', pct: 0.30, price: 700 },
  steel:  { name: '강철검',   emoji: '⚒️', pct: 0.50, price: 2000 },
  flame:  { name: '불꽃검',   emoji: '🔥', pct: 0.75, price: 5000 },
  dragon: { name: '용의검',   emoji: '🐉', pct: 1.10, price: 12000 },
};
const HATS = {
  none:   { name: '모자 없음',   emoji: '',   price: 0 },
  straw:  { name: '밀짚모자',    emoji: '👒', price: 100 },
  wizard: { name: '마법사 모자', emoji: '🎩', price: 300 },
  crown:  { name: '왕관',        emoji: '👑', price: 800 },
};
const PETS = {
  cat:    { name: '고양이',  emoji: '🐱', id: 'cat' },
  owl:    { name: '부엉이',  emoji: '🦉', id: 'owl' },
  dragon: { name: '아기 용', emoji: '🐲', id: 'dragon' },
};
const BOSS_DROPS = ['cat', 'owl', 'dragon'];
const ITEMS = {
  hint:   { name: '힌트',   emoji: '💡', price: 20, desc: '정답의 첫 글자를 보여줘요 (★은 안 올라요)' },
  erase:  { name: '지우개', emoji: '🧽', price: 30, desc: '틀린 답 2개를 지워요 (★은 안 올라요)' },
  potion: { name: '물약',   emoji: '🧪', price: 60, desc: `HP를 ${Math.round(BAL.items.potionHeal * 100)}% 회복해요` },
};
const SKILLS = [
  { lv: 3,  id: 'double', name: '더블 어택', emoji: '🔥', desc: '2연속 정답마다 한 번 더 공격해요' },
  { lv: 5,  id: 'sight',  name: '투시',      emoji: '👁️', desc: '미로에서 열쇠가 어디 있는지 항상 보여요' },
  { lv: 8,  id: 'shield', name: '실드',      emoji: '🛡️', desc: '하루에 한 번, 틀려도 데미지를 안 받아요' },
  { lv: 12, id: 'dash',   name: '대시',      emoji: '⚡', desc: '달리기에서 처음 한 번은 부딪혀도 괜찮아요' },
  { lv: 20, id: 'ulti',   name: '필살 강화', emoji: '💫', desc: `필살기 위력이 ${BAL.battle.ultSkillMul}배가 돼요` },
];
// ---------- 동물 월드 등급표 ----------
// 순서가 곧 진행 순서다. 한 등급을 끝내면 그 등급의 왕이 다음 등급의 문을 연다.
// PLAN.md 3장의 표와 같은 내용 — 새 등급을 만들 땐 여기에도 한 줄 추가한다.
const LEVELS = [
  { id: 'BASIC', name: '기초',  emoji: '⭐', animal: null,     world: '시작' },
  { id: 'IS',    name: '병아리', emoji: '🐣', animal: 'chick',  world: '새싹 들판',
    taunt: '삐약! 작다고 얕보지 마! 나도 왕이라구!',
    yield: '삐… 삐약… 네가 더 세다는 거, 인정!' },
  { id: 'DS-A',  name: '토끼',  emoji: '🐰', animal: 'rabbit', world: '숲',
    taunt: '깡충! 내 귀는 다 듣고 있었어. 네 실력, 진짜야?',
    yield: '빨랐어… 나보다 빠른 아이는 처음이야.' },
  { id: 'DS-B',  name: '여우',  emoji: '🦊', animal: 'fox',    world: '숲',
    taunt: '영리한 척은 나 하나로 충분한데. 어디 해 볼까?',
    yield: '내 꾀가 안 통했어. 넌 진짜 아는구나.' },
  { id: 'DS-C',  name: '늑대',  emoji: '🐺', animal: 'wolf',   world: '숲',
    taunt: '여기까지 올라온 꼬마가 있었군.\n숲의 단어를 전부 안다고? …증명해 봐.',
    yield: '인정하마. 오늘부터 이 숲은 네 것이다.' },
  { id: 'DS-D',  name: '곰',    emoji: '🐻', animal: 'bear',   world: '숲의 왕',
    taunt: '늑대를 이겼다고 방심했나?\n숲의 진짜 왕은 나다.',
    yield: '크르릉… 훌륭하다. 왕의 자리를 물려주마.' },
  { id: 'LS-A',  name: '독수리', emoji: '🦅', animal: 'eagle',  world: '야생',
    taunt: '하늘에서 다 보고 있었다.\n네가 몇 개나 틀렸는지도.',
    yield: '내 눈이 틀렸군. 하늘로 올라와라.' },
  { id: 'LS-B',  name: '표범',  emoji: '🐆', animal: 'leopard',world: '야생',
    taunt: '느린 답은 답이 아니야. 내 속도를 따라올 수 있겠어?',
    yield: '빠르다… 야생에서 이만한 아이는 없었다.' },
  { id: 'LS-C',  name: '사자',  emoji: '🦁', animal: 'lion',   world: '야생',
    taunt: '누가 야생의 주인인지 알려주지.\n한 번만 흔들려도 끝이다.',
    yield: '내 갈기를 걸고 인정한다. 네가 강하다.' },
  { id: 'LS-D',  name: '호랑이', emoji: '🐅', animal: 'tiger',  world: '야생의 왕',
    taunt: '야생의 끝에서 기다렸다.\n여기를 넘으면… 전설이 시작된다.',
    yield: '전설의 문을 열어주마. 두려워하지 마라.' },
  { id: 'MS-A',  name: '드래곤', emoji: '🐉', animal: 'dragon', world: '전설',
    taunt: '전설의 문 앞이다. 각오는 됐나?\n여기서부턴 아는 척이 안 통한다.',
    yield: '비늘에 걸고 인정한다. 마지막까지 가 보아라.' },
  { id: 'MS-B',  name: '불사조', emoji: '🔥', animal: 'phoenix',world: '전설의 정점',
    taunt: '마지막이다.\n지금까지 배운 모든 단어를 걸어라.',
    yield: '재에서 다시 태어나도 너를 못 이기겠구나. 네가 정점이다.' },
];
function levelOf(id) { return LEVELS.find(l => l.id === id) || null; }
function prevLevelId(id) {
  const i = LEVELS.findIndex(l => l.id === id);
  return i > 0 ? LEVELS[i - 1].id : null;
}
// 그 등급에 왕이 있으려면 타워가 하나라도 있어야 한다 (아직 안 만든 등급은 왕도 없다)
function levelTowers(id) { return (window.TOWERS || []).filter(t => t.level === id); }
// 이 등급 앞쪽에서 "실제로 도전할 수 있는 왕"을 찾는다.
// 타워가 없는 등급(아직 안 만든 등급)의 왕은 없는 것이나 같으므로 건너뛴다.
// 화면에 쓰는 등급 표기. 코드(DS-C)와 동물(🐺 늑대)을 항상 같이 보여준다.
//   levelCode: 'DS-C'  (기초 탑처럼 학원 등급이 아닌 곳은 빈 문자열)
//   levelTag:  'DS-C 등급의 🐺 늑대'
function levelCode(L) { return L && L.animal ? L.id : ''; }
function levelTag(L) {
  if (!L) return '';
  return (L.animal ? `${L.id} 등급의 ` : '') + `${L.emoji} ${L.name}`;
}
function prevKingLevel(levelId) {
  const i = LEVELS.findIndex(l => l.id === levelId);
  for (let j = i - 1; j >= 0; j--) {
    if (LEVELS[j].animal && levelTowers(LEVELS[j].id).length) return LEVELS[j];
  }
  return null;
}
// 👑 왕에게 진 뒤의 재도전 대기.
// 남은 "초"를 벽시계로 재기 때문에 창을 닫아도, 게임을 꺼도 시간은 흐른다.
// (게임을 켜 둔 채 버티게 만들면 기다림이 그냥 지루한 벌이 된다)
function kingCooldown(levelId) {
  const until = (state.player.kingCd || {})[levelId];
  if (!until) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}
function startKingCooldown(levelId) {
  state.player.kingCd = state.player.kingCd || {};
  state.player.forced = state.player.forced || {};
  state.player.kingCd[levelId] = Date.now() + BAL.king.retryCooldownSec * 1000;
  saveState();
}
function mmss(sec) { return Math.floor(sec / 60) + ':' + String(Math.max(0, sec) % 60).padStart(2, '0'); }

function kingBeaten(levelId) { return !!(state.player.kings && state.player.kings[levelId]); }

// 타워 입장 조건: 레벨이 권장 하한을 넘었거나, 이전 등급의 왕을 잡았거나.
// 낮은 등급은 권장 하한이 낮아 자동으로 계속 열려 있다 (고레벨이 복습하러 올 수 있게).
// 아이가 문 앞에서 "그래도 간다"를 고른 탑. 한 번 고르면 계속 열려 있다
// (들어갈 때마다 같은 경고를 다시 보게 하면 그건 잠금이나 마찬가지다).
function forceOpen(towerId) {
  state.player.forced = state.player.forced || {};
  state.player.forced[towerId] = true;
  saveState();
}
function isForced(towerId) { return !!(state.player.forced && state.player.forced[towerId]); }
function towerLock(tower) {
  if (state.settings.noLock || isForced(tower.id)) return null;
  const lo = towerRange(tower)[0];
  if (state.player.lv >= lo) return null;
  const pl = prevKingLevel(tower.level);
  if (pl && kingBeaten(pl.id)) return null;
  return {
    needLv: lo,
    prevLevel: pl ? pl.id : null, prevName: pl ? pl.name : '', prevEmoji: pl ? pl.emoji : '👑',
    hasPrevTowers: !!pl,
  };
}

const ZONES = [
  { lv: 5,  id: 'arena',   name: '투기장',    emoji: '🏟️', desc: '몬스터를 몇 마리나 잡을까?', ready: true },
  { lv: 10, id: 'dungeon', name: '지하 던전', emoji: '🕳️', desc: '깊고 어두운 곳 (준비 중)', ready: false, cards: 25 },
  { lv: 20, id: 'sky',     name: '하늘섬',    emoji: '⛰️', desc: '구름 위의 세계 (준비 중)', ready: false, cards: 60 },
];
const MONSTERS = [
  { id: 'slime', name: '슬라임', emoji: '👾' }, { id: 'bat', name: '박쥐', emoji: '🦇' }, { id: 'ghost', name: '유령', emoji: '👻' },
  { id: 'boar', name: '멧돼지', emoji: '🐗' }, { id: 'snake', name: '뱀', emoji: '🐍' }, { id: 'zombie', name: '좀비', emoji: '🧟' },
  { id: 'scorpion', name: '전갈', emoji: '🦂' }, { id: 'wolf', name: '늑대', emoji: '🐺' }, { id: 'spider', name: '거미', emoji: '🕷️' },
];
const BOSSES = [
  { id: 'dragon', name: '드래곤 킹', emoji: '🐉' }, { id: 'oni', name: '오니', emoji: '👹' }, { id: 'trex', name: '티라노', emoji: '🦖' },
  { id: 'kraken', name: '크라켄', emoji: '🐙' }, { id: 'skull', name: '해골 마왕', emoji: '💀' },
];

function defaultState() {
  return {
    version: 1,
    player: {
      name: '용사', lv: 1, exp: 0, gold: 0, hp: 100,
      weapon: 'stick', hat: 'none', pet: null,
      avatar: null, outfit: 'tunic', aura: 'none', title: '',
      owned: { weapons: ['stick'], hats: ['none'], pets: [], outfits: ['tunic', 'dress'], auras: ['none'] },
      towerClear: {}, titles: [],
      items: { hint: 1, erase: 0, potion: 1 },
      shieldDate: '', arenaBest: 0,
      cards: {}, pendingCards: [], setBonus: {}, kings: {}, kingCd: {}, forced: {},
    },
    towers: {},
    // say = 발음 자동 재생(학습 도움, 기본 ON) · listen = 듣기 문제(난이도, 기본 OFF)
    // 둘은 다른 것이다. 발음을 들으려고 난이도를 올려야 하면 안 된다.
    settings: { listen: false, sound: true, preview: true, say: true, noLock: false },
    createdAt: Date.now(),
  };
}

let state = null;

// ---------- 백업 ----------
// 아이가 몇 달 쌓은 진행을 잃는 것이 이 게임에서 가장 치명적이다.
// 되돌릴 수 없는 조작(구조 변경·불러오기·초기화·손상) 직전에 원본을 하나 남긴다.
function readRaw() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } }
function keepBackup(raw, tag) {
  if (!raw) return;
  try { localStorage.setItem(BACKUP_KEY, JSON.stringify({ at: Date.now(), tag, raw })); } catch (e) { /* 용량 초과 등 */ }
}
function backupInfo() {
  try {
    const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
    if (!b || !b.raw) return null;
    const p = JSON.parse(b.raw).player;
    return { at: b.at, tag: b.tag, name: p.name, lv: p.lv, cards: Object.keys(p.cards || {}).length };
  } catch (e) { return null; }
}
function restoreBackup() {
  const b = JSON.parse(localStorage.getItem(BACKUP_KEY));
  const obj = b && b.raw ? JSON.parse(b.raw) : null;
  if (!obj || !obj.player) throw new Error('백업이 없거나 손상됐어요');
  keepBackup(readRaw(), 'restore');   // 되돌리기도 되돌릴 수 있게
  adopt(obj, b.raw); saveState();
}

// ---------- 불러오기 ----------
// 저장된 세이브를 현재 구조로 올린다. 낮은 버전부터 하나씩 순서대로.
function applyMigrations(raw) {
  let v = typeof state.version === 'number' ? state.version : 1;
  if (v >= SAVE_VERSION) return;   // 같거나, 더 새 버전에서 만든 세이브 → 손대지 않는다
  keepBackup(raw, 'v' + v);
  while (v < SAVE_VERSION) { const fn = MIGRATIONS[v + 1]; if (fn) fn(state); v++; }
  state.version = SAVE_VERSION;
}
// 불러온 객체를 현재 state로 삼는다 (loadState · importCode · restoreBackup 공용)
function adopt(obj, raw) {
  state = obj;
  applyMigrations(raw);
  fillShape();
  backfillCards();
}
function loadState() {
  const raw = readRaw();
  if (!raw) { state = defaultState(); return; }
  let obj = null;
  try { obj = JSON.parse(raw); } catch (e) { /* 손상 */ }
  if (!obj || !obj.player) { keepBackup(raw, 'broken'); state = defaultState(); return; }
  adopt(obj, raw);
}
// 새로 생긴 필드를 기본값으로 채운다 (구조 변경이 아니라 빈칸 메우기)
function fillShape() {
  const d = defaultState();
  state.player = Object.assign(d.player, state.player || {});
  state.player.cards = state.player.cards || {};
  state.player.pendingCards = state.player.pendingCards || [];
  state.player.setBonus = state.player.setBonus || {};
  state.player.kings = state.player.kings || {};
  state.player.kingCd = state.player.kingCd || {};
  state.player.owned = Object.assign(d.player.owned, state.player.owned || {});
  state.player.owned.auras = state.player.owned.auras || ['none'];
  state.player.towerClear = state.player.towerClear || {};
  state.player.titles = state.player.titles || [];
  state.player.items = Object.assign(d.player.items, state.player.items || {});
  state.settings = Object.assign(d.settings, state.settings || {});
  state.towers = state.towers || {};
  backfillCards();
}
// 이미 ★★★인데 카드가 없는 단어를 시험 대기열에 올린다 (기존 저장 소급)
function backfillCards() {
  if (!window.TOWERS) return;
  window.TOWERS.forEach(t => {
    const prog = state.towers[t.id];
    if (!prog || !prog.words) return;
    t.units.forEach(u => u.words.forEach(w => {
      const st = prog.words[w.w];
      if (!st || st.stars < 3) return;
      const k = t.id + ':' + w.w;
      if (!state.player.cards[k] && state.player.pendingCards.indexOf(k) < 0) state.player.pendingCards.push(k);
    }));
  });
}
function saveState() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가(시크릿 모드 등) */ }
}
function resetState() { keepBackup(readRaw(), 'reset'); state = defaultState(); saveState(); }

function towerProg(id) {
  if (!state.towers[id]) state.towers[id] = { floor: 1, cleared: 0, words: {} };
  return state.towers[id];
}
function wordStat(towerId, w) {
  const t = towerProg(towerId);
  if (!t.words[w]) t.words[w] = { stars: 0, wrong: 0, seen: 0 };
  return t.words[w];
}

function expToNext(lv) { const p = BAL.player; return Math.floor(p.expBase * Math.pow(lv, p.expPow)) + p.expFlat; }
// 무기를 뺀 순수 레벨 화력. 몬스터는 이 값을 기준으로 만들어진다.
function baseAtk(lv) { return BAL.player.atkBase + lv * BAL.player.atkPerLv; }
function atkAt(lv, weapon) { return Math.round(baseAtk(lv) * (1 + WEAPONS[weapon || state.player.weapon].pct + clearPct('atk'))); }
function hpAt(lv) { return BAL.player.hpBase + (lv - 1) * BAL.player.hpPerLv; }
// 타워를 완전히 정복(모든 카드)하면 붙는 영구 보너스. 밸런스 조절 지점은 여기 하나뿐.
function clearPct(type) {
  if (!window.TOWERS) return 0;
  let v = 0;
  window.TOWERS.forEach(t => {
    const cb = t.clearBonus;
    if (cb && cb.type === type && state.player.towerClear && state.player.towerClear[t.id]) v += cb.pct;
  });
  return Math.min(v, BAL.player.clearBonusCap);   // 상한을 넘으면 칭호만 쌓인다
}

// 타워는 저마다 "설계 기준 레벨 구간"을 갖는다.
// 몬스터는 clamp(내 레벨, 구간)으로 만들어지므로,
// 구간을 훌쩍 넘긴 레벨로 저렙 타워에 가면 그 차이가 그대로 초과 화력이 된다.
function towerTier(tower) { return (tower && tower.tier) || BAL.monster.defaultTier; }
// "티어 1.5"는 아이가 알아볼 수 없다. 화면에는 항상 이 표시를 쓴다.
//   1.0 → 🔥 · 1.5 → 🔥🔥 · 2.0 → 🔥🔥🔥
// 오라 해금 조건(AURAS[].need.tier)도 같은 표시로 보여줘야 어느 타워를 깨야 할지 알 수 있다.
function tierFire(tier) { return '🔥'.repeat(Math.max(1, Math.round((tier || 1) * 2) - 1)); }
function towerRange(tower) { return (tower && tower.lvRange) || BAL.monster.defaultRange; }
function refLv(tower) {
  const r = towerRange(tower);
  const clamped = Math.max(r[0], Math.min(r[1], state.player.lv));
  return r[0] + (clamped - r[0]) * BAL.monster.growth;
}
function monsterHp(floor, boss, tower) {
  const rb = baseAtk(refLv(tower)), t = towerTier(tower);
  return Math.round(rb * byFloor(boss ? BAL.monster.bossHp : BAL.monster.hp, floor) * t);
}
// 적의 피해량은 카드/장비 보너스를 뺀 "기본 HP" 기준.
// (최대 HP에 비례시키면 HP를 올려주는 보상이 스스로 상쇄돼 버린다)
function monsterAtk(floor, boss, tower) {
  const m = BAL.monster;
  return Math.max(m.minAtk, Math.round(hpAt(state.player.lv) * byFloor(m.atk, floor) * towerTier(tower) * (boss ? m.bossAtkMul : 1)));
}
function hazardDmg(ratio, tower) {
  return Math.max(BAL.hazard.min, Math.round(hpAt(state.player.lv) * ratio * towerTier(tower)));
}
function playerAtk() { return atkAt(state.player.lv); }
function playerMaxHp() { return Math.round(hpAt(state.player.lv) * (1 + clearPct('hp'))); }
function hasSkill(id) { const s = SKILLS.find(x => x.id === id); return !!s && state.player.lv >= s.lv; }

// 레벨업하면 올라간 레벨 목록을 돌려준다 (레벨업 시 HP 전부 회복)
function addExp(n) {
  const p = state.player; p.exp += n; const ups = [];
  while (p.exp >= expToNext(p.lv)) { p.exp -= expToNext(p.lv); p.lv++; ups.push(p.lv); }
  if (ups.length) p.hp = playerMaxHp();
  return ups;
}
// 왕을 꺾어 새 등급이 열렸는데 레벨이 그 등급의 권장 하한보다 낮으면 거기까지 올려 준다.
// 실력으로 문을 열어 놓고 들어가서는 몹이 안 죽으면, 연 보람이 없다.
function raiseToLv(target) {
  const p = state.player, ups = [];
  while (p.lv < target) { p.lv++; ups.push(p.lv); }
  if (ups.length) { p.exp = 0; p.hp = playerMaxHp(); }
  return ups;
}
function addGold(n) { state.player.gold = Math.max(0, state.player.gold + n); }

function todayStr() { return new Date().toISOString().slice(0, 10); }
function shieldReady() { return hasSkill('shield') && state.player.shieldDate !== todayStr(); }
function useShield() { state.player.shieldDate = todayStr(); }

function exportCode() { return btoa(unescape(encodeURIComponent(JSON.stringify(state)))); }
function importCode(code) {
  const obj = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
  if (!obj || !obj.player) throw new Error('잘못된 코드');
  keepBackup(readRaw(), 'import');
  adopt(obj, JSON.stringify(obj));
  saveState();
}
