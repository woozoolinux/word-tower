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
      cards: {}, pendingCards: [], setBonus: {},
    },
    towers: {},
    // say = 발음 자동 재생(학습 도움, 기본 ON) · listen = 듣기 문제(난이도, 기본 OFF)
    // 둘은 다른 것이다. 발음을 들으려고 난이도를 올려야 하면 안 된다.
    settings: { listen: false, sound: true, preview: true, say: true },
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
