'use strict';
// 저장 데이터 + 성장 수치. 서버 없이 localStorage에 저장한다.
// (2단계에서 클라우드로 옮길 땐 loadState/saveState만 바꾸면 됨)

const SAVE_KEY = 'wordtower_save_v1';

const WEAPONS = {
  stick:  { name: '나무막대', emoji: '🪵', atk: 0,  price: 0 },
  bronze: { name: '청동검',   emoji: '🗡️', atk: 8,  price: 150 },
  silver: { name: '은검',     emoji: '⚔️', atk: 18, price: 400 },
  flame:  { name: '불꽃검',   emoji: '🔥', atk: 35, price: 1000 },
};
const HATS = {
  none:   { name: '모자 없음',   emoji: '',   price: 0 },
  straw:  { name: '밀짚모자',    emoji: '👒', price: 100 },
  wizard: { name: '마법사 모자', emoji: '🎩', price: 300 },
  crown:  { name: '왕관',        emoji: '👑', price: 800 },
};
const PETS = {
  cat:    { name: '고양이',  emoji: '🐱' },
  owl:    { name: '부엉이',  emoji: '🦉' },
  dragon: { name: '아기 용', emoji: '🐲' },
};
const BOSS_DROPS = ['cat', 'owl', 'dragon'];
const ITEMS = {
  hint:   { name: '힌트',   emoji: '💡', price: 20, desc: '정답의 첫 글자를 보여줘요 (★은 안 올라요)' },
  erase:  { name: '지우개', emoji: '🧽', price: 30, desc: '틀린 답 2개를 지워요 (★은 안 올라요)' },
  potion: { name: '물약',   emoji: '🧪', price: 50, desc: 'HP를 50 회복해요' },
};
const SKILLS = [
  { lv: 3,  id: 'double', name: '더블 어택', emoji: '🔥', desc: '2연속 정답마다 한 번 더 공격해요' },
  { lv: 5,  id: 'sight',  name: '투시',      emoji: '👁️', desc: '미로에서 열쇠가 어디 있는지 항상 보여요' },
  { lv: 8,  id: 'shield', name: '실드',      emoji: '🛡️', desc: '하루에 한 번, 틀려도 데미지를 안 받아요' },
  { lv: 12, id: 'dash',   name: '대시',      emoji: '⚡', desc: '달리기에서 처음 한 번은 부딪혀도 괜찮아요' },
  { lv: 20, id: 'ulti',   name: '필살기',    emoji: '💫', desc: '보스전에서 한 번, 보스 HP를 30% 깎아요' },
];
const ZONES = [
  { lv: 5,  id: 'arena',   name: '투기장',    emoji: '🏟️', desc: '몬스터를 몇 마리나 잡을까?', ready: true },
  { lv: 10, id: 'dungeon', name: '지하 던전', emoji: '🕳️', desc: '깊고 어두운 곳 (준비 중)', ready: false },
  { lv: 20, id: 'sky',     name: '하늘섬',    emoji: '⛰️', desc: '구름 위의 세계 (준비 중)', ready: false },
];
const MONSTERS = [
  { name: '슬라임', emoji: '👾' }, { name: '박쥐', emoji: '🦇' }, { name: '유령', emoji: '👻' },
  { name: '멧돼지', emoji: '🐗' }, { name: '뱀', emoji: '🐍' }, { name: '좀비', emoji: '🧟' },
  { name: '전갈', emoji: '🦂' }, { name: '늑대', emoji: '🐺' }, { name: '거미', emoji: '🕷️' },
];
const BOSSES = [
  { name: '드래곤 킹', emoji: '🐉' }, { name: '오니', emoji: '👹' }, { name: '티라노', emoji: '🦖' },
  { name: '크라켄', emoji: '🐙' }, { name: '해골 마왕', emoji: '💀' },
];

function defaultState() {
  return {
    version: 1,
    player: {
      name: '용사', lv: 1, exp: 0, gold: 0, hp: 100,
      weapon: 'stick', hat: 'none', pet: null,
      avatar: null, outfit: 'tunic',
      owned: { weapons: ['stick'], hats: ['none'], pets: [], outfits: ['tunic', 'dress'] },
      items: { hint: 1, erase: 0, potion: 1 },
      shieldDate: '', arenaBest: 0,
    },
    towers: {},
    settings: { listen: false, sound: true },
    createdAt: Date.now(),
  };
}

let state = null;

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) { state = JSON.parse(raw); migrate(); return; }
  } catch (e) { /* 손상된 저장 → 새로 시작 */ }
  state = defaultState();
}
function migrate() {
  const d = defaultState();
  state.player = Object.assign(d.player, state.player || {});
  state.player.owned = Object.assign(d.player.owned, state.player.owned || {});
  state.player.items = Object.assign(d.player.items, state.player.items || {});
  state.settings = Object.assign(d.settings, state.settings || {});
  state.towers = state.towers || {};
}
function saveState() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 불가(시크릿 모드 등) */ }
}
function resetState() { state = defaultState(); saveState(); }

function towerProg(id) {
  if (!state.towers[id]) state.towers[id] = { floor: 1, cleared: 0, words: {} };
  return state.towers[id];
}
function wordStat(towerId, w) {
  const t = towerProg(towerId);
  if (!t.words[w]) t.words[w] = { stars: 0, wrong: 0, seen: 0 };
  return t.words[w];
}

function expToNext(lv) { return Math.floor(40 * Math.pow(lv, 1.4)) + 20; }
function atkAt(lv, weapon) { return 10 + lv * 3 + WEAPONS[weapon || state.player.weapon].atk; }
function hpAt(lv) { return 100 + (lv - 1) * 12; }
function playerAtk() { return atkAt(state.player.lv); }
function playerMaxHp() { return hpAt(state.player.lv); }
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
  state = obj; migrate(); saveState();
}
