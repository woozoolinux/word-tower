#!/usr/bin/env node
'use strict';
// 브라우저 없이 도는 회귀 테스트.
//   node tools/test.js
//
// 왜 있나: 밸런스 수식이나 층 구성을 손댈 때 "어디가 어떻게 무너졌는지"를
// 아이가 플레이하다 발견하는 게 아니라 여기서 먼저 알기 위해서다.
// 특히 밸런스 표는 PLAN.md의 검증 수치를 그대로 코드로 옮긴 것이라,
// 여기가 깨지면 기획 문서와 게임이 어긋났다는 뜻이다.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let pass = 0;
const fails = [];
let group = '';

function section(name) { group = name; console.log(`\n${name}`); }
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fails.push(`${group} → ${name}${detail ? `\n       ${detail}` : ''}`); console.log(`  ❌ ${name}${detail ? `  (${detail})` : ''}`); }
}
function eq(name, got, want) { ok(name, got === want, `받음 ${got} · 기대 ${want}`); }

// ---------- 게임 코드를 브라우저 없이 올린다 ----------
const store = {};
const sandbox = {
  window: { TOWERS: [] }, console, Math, Date, JSON,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  },
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  unescape, escape,
  document: {}, speechSynthesis: undefined,
};
const ctx = vm.createContext(sandbox);
const load = (f, tail = '') =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8') + tail, ctx, { filename: f });

load('js/balance.js', '\n;globalThis.BALX = BAL; globalThis.byFloorX = byFloor;');
fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.js')).sort()
  .forEach(f => load('data/' + f));
load('js/state.js', `\n;globalThis.S = {
  loadState, saveState, resetState, importCode, exportCode, backupInfo, restoreBackup,
  expToNext, baseAtk, atkAt, hpAt, playerAtk, playerMaxHp, monsterHp, monsterAtk, hazardDmg,
  refLv, towerTier, towerRange, towerProg, wordStat, addExp, WEAPONS, SAVE_VERSION, tierFire, clearPct, BAL,
  get state() { return state; }, set state(v) { state = v; },
};`);
load('js/words.js', `\n;globalThis.W = { floorList, floorWords, allWords, towerById, distractors, makeQuestion, pickWord, shuffle, recordResult, withReview, speak, canSpeak, wkey, statFor };`);
load('js/avatar.js', '\n;globalThis.AV = { AURAS, OUTFITS };');
// cards.js는 UI/Sfx를 호출 시점에만 쓰므로 정의만으로는 안전하다
sandbox.UI = { toast() {}, modal(h, o) { sandbox.lastModal = { h, o }; return { body: {}, close() {} }; },
  confetti() {}, show() {}, levelUpModal(u, cb) { cb && cb(); }, current: () => '' };
sandbox.Sfx = new Proxy({}, { get: () => () => {} });
load('js/cards.js', '\n;globalThis.C = Cards;');
// 화면 모듈은 DOM을 쓰지만, 정의만으로는 안전하다 (start를 안 부르면 됨)
sandbox.Maze = { start() {}, init() {} };
sandbox.Vault = { start() {}, init() {} };
sandbox.Runner = { start() {}, init() {}, stop() {} };
sandbox.Battle = { start(o) { sandbox.lastBattle = o; }, init() {} };
sandbox.Preview = { maybeShow(r, cb) { cb(); } };
sandbox.Lobby = { render() {}, init() {} };
sandbox.Art = { monster: () => '', pet: () => '', tower: () => '' };
sandbox.Avatar = { html: () => '', image: () => null };
sandbox.performance = { now: () => 0 };
sandbox.requestAnimationFrame = () => 0;
sandbox.window.addEventListener = () => {};
sandbox.document.createElement = () => ({ style: {}, classList: { add() {}, remove() {} }, setAttribute() {}, appendChild() {} });
sandbox.document.querySelector = () => null;
sandbox.document.querySelectorAll = () => [];
sandbox.document.getElementById = () => null;
sandbox.document.body = { insertBefore() {}, firstChild: null };
load('js/main.js', '\n;globalThis.G = Game;');

const { BALX: BAL, byFloorX: byFloor, S, W, C, AV } = sandbox;
S.loadState();
const main = W.towerById('main');
const dsd1 = W.towerById('jeongsang1');

// ===================================================================
section('밸런스 회귀 — PLAN.md 「밸런스 규칙」 검증표');
// 이 표가 깨지면 수식을 바꾼 것이다. 의도한 변경이면 PLAN.md도 같이 고칠 것.
// ===================================================================
const hits = (atk, hp) => Math.ceil(hp / atk);

S.state.player.lv = 8;
S.state.player.weapon = 'flame';   // +75%
eq('Lv8 + 불꽃검 공격력', S.playerAtk(), 60);

eq('바벨 5층 몬스터를 3방에', hits(S.playerAtk(), S.monsterHp(5, false, main)), 3);
eq('DSD1 5층 몬스터를 4방에', hits(S.playerAtk(), S.monsterHp(5, false, dsd1)), 4);
eq('DSD1 5층 보스를 11방에', hits(S.playerAtk(), S.monsterHp(5, true, dsd1)), 11);

S.state.player.lv = 50;
eq('Lv50이 바벨 5층 몬스터를 1방에 (의도된 통쾌함)', hits(S.playerAtk(), S.monsterHp(5, false, main)), 1);

S.state.player.lv = 8;
ok('티어가 높은 타워가 더 아프다',
  S.monsterAtk(5, false, dsd1) > S.monsterAtk(5, false, main),
  `DSD1 ${S.monsterAtk(5, false, dsd1)} vs 바벨 ${S.monsterAtk(5, false, main)}`);
ok('보스가 일반 몬스터보다 세게 때린다', S.monsterAtk(5, true, main) > S.monsterAtk(5, false, main));

// 몬스터는 내 성장의 70%만 따라온다 → 레벨을 올릴수록 같은 층이 계속 쉬워져야 한다.
// (정수 타격수는 너무 거칠어서, 설계 의도 그대로 "필요 타격 비율"로 본다)
const ratio = (lv, t) => { S.state.player.lv = lv; return S.monsterHp(5, false, t) / S.playerAtk(); };
let worse = null;
for (let lv = 5; lv < 24; lv++) if (ratio(lv + 1, dsd1) >= ratio(lv, dsd1)) worse = `Lv${lv} → Lv${lv + 1}`;
ok('레벨을 올리면 같은 층이 반드시 쉬워진다 (몬스터가 앞지르지 않는다)', !worse, worse);
ok('설계 구간 전체에서 체감할 만큼 쉬워진다',
  ratio(5, dsd1) / ratio(24, dsd1) >= 1.2,
  `Lv5 ${ratio(5, dsd1).toFixed(2)}방 → Lv24 ${ratio(24, dsd1).toFixed(2)}방 (${(ratio(5, dsd1) / ratio(24, dsd1)).toFixed(2)}배)`);

// 구간을 넘어선 레벨은 초과 화력이 그대로 나와야 한다 (PLAN: clamp)
ok('설계 구간을 넘기면 갑자기 쉬워진다 (clamp의 통쾌함)',
  ratio(24, dsd1) / ratio(48, dsd1) > 1.7,
  `Lv24 ${ratio(24, dsd1).toFixed(2)}방 → Lv48 ${ratio(48, dsd1).toFixed(2)}방`);

// 최대HP를 올려주는 보상이 스스로 상쇄되면 안 된다 (적 피해는 기본HP 기준)
S.state.player.lv = 10;
const dmgBefore = S.monsterAtk(5, false, main);
S.state.player.towerClear = { jeongsang1: true };   // 최대HP +15%
ok('HP 보너스를 받아도 적 피해는 그대로 (보상이 상쇄되지 않음)',
  S.monsterAtk(5, false, main) === dmgBefore && S.playerMaxHp() > S.hpAt(10));
S.state.player.towerClear = {};

ok('레벨이 오르면 다음 레벨까지 필요한 경험치가 늘어난다', S.expToNext(10) > S.expToNext(3));

// ===================================================================
section('층 구성');
// ===================================================================
const floors = W.floorList(main);
eq('바벨 6단원 → 15층 (단원당 2층 + 2단원마다 보스)', floors.length, 15);
eq('5층은 보스 (2단원 = 일반 4층 뒤)', floors[4].type, 'boss');
ok('마지막 층은 반드시 보스', floors[floors.length - 1].type === 'boss');
ok('보스 층은 그때까지의 단원을 전부 출제',
  W.floorWords(main, 5).every(w => w.unit <= floors[4].upTo) && W.floorWords(main, 5).length > W.floorWords(main, 1).length);

const u1 = W.allWords(main).filter(w => w.unit === 1);
const h0 = W.floorWords(main, 1), h1 = W.floorWords(main, 2);
ok('일반 층 두 개가 단원을 빠짐없이 나눠 갖는다',
  h0.length + h1.length === u1.length && new Set([...h0, ...h1].map(w => w.w)).size === u1.length);

let emptyFloor = null;
sandbox.window.TOWERS.forEach(t =>
  W.floorList(t).forEach((f, i) => { if (!W.floorWords(t, i + 1).length) emptyFloor = `${t.id} ${i + 1}층`; }));
ok('어느 타워에도 단어가 빈 층이 없다', !emptyFloor, emptyFloor);

// ===================================================================
section('출제');
// ===================================================================
const pool = W.allWords(main);
let badChoices = 0, dupChoices = 0;
for (let i = 0; i < 300; i++) {
  const q = W.makeQuestion(pool[i % pool.length], pool, i % 2 ? 'm2w' : 'w2m');
  if (q.choices.length !== BAL.quiz.choices) badChoices++;
  if (new Set(q.choices).size !== q.choices.length) dupChoices++;
  if (!q.choices.includes(q.answer)) badChoices++;
}
eq('보기는 항상 4개이고 정답이 들어 있다', badChoices, 0);
eq('같은 보기가 두 번 나오지 않는다', dupChoices, 0);

// 뜻이 같은 단어(동의어)가 서로 오답으로 나오면 정답이 두 개가 된다
const syn = pool.find(w => pool.some(x => x !== w && x.m === w.m));
if (syn) {
  const bad = [];
  for (let i = 0; i < 200; i++) {
    const q = W.makeQuestion(syn, pool, 'm2w');
    if (q.choices.filter(c => pool.find(x => x.w === c && x.m === syn.m)).length > 1) bad.push(q.choices);
  }
  eq(`동의어("${syn.m}")가 서로 오답 보기로 나오지 않는다`, bad.length, 0);
} else {
  ok('바벨에 동의어 없음 — 검사 생략', true);
}

// ★이 낮은 단어가 더 자주 나와야 한다
S.state.towers = {};
const wA = pool[0], wB = pool[1];
S.wordStat('main', wA.w).stars = 0;
S.wordStat('main', wB.w).stars = 3;
let cntA = 0;
for (let i = 0; i < 4000; i++) if (W.pickWord('main', [wA, wB]).w === wA.w) cntA++;
ok('★이 낮은 단어가 더 자주 출제된다', cntA > 2400, `★0 단어가 ${(cntA / 40).toFixed(0)}% 등장`);

// ===================================================================
section('단어 카드');
// ===================================================================
eq('4글자 이하 → 일반', C.rarityOf({ w: 'buy' }), 'common');
eq('5~7글자 → 희귀', C.rarityOf({ w: 'palace' }), 'rare');
eq('8~10글자 → 영웅', C.rarityOf({ w: 'raindrop' }), 'epic');
eq('띄어 쓴 구 → 영웅', C.rarityOf({ w: 'in fact' }), 'epic');
eq('11글자 이상 → 전설', C.rarityOf({ w: 'double-decker' }), 'legend');

// 각인 시험: 타일을 정답 순서대로 놓으면 반드시 원래 단어가 나와야 한다
let broken = null, noBlank = null;
sandbox.window.TOWERS.flatMap(t => W.allWords(t)).forEach(word => {
  [false, true].forEach(hard => {
    const t = C.buildTest(word, hard);
    const openIdx = t.slots.map((s, i) => i).filter(i => !t.slots[i].fixed);
    if (openIdx.length < 2) noBlank = `${word.w}(빈칸 ${openIdx.length}개)`;
    // 빈칸마다 알맞은 타일을 하나씩 꺼내 맞춰 본다
    const left = t.tiles.slice();
    const built = t.slots.map(s => {
      if (s.fixed) return s.ch;
      const i = left.indexOf(s.ch);
      if (i < 0) return ' ';
      left.splice(i, 1); return s.ch;
    }).join('');
    if (built !== word.w) broken = `${word.w}${hard ? ' (이건 알아!)' : ''}`;
  });
});
ok('모든 단어의 각인 시험이 정답으로 완성될 수 있다', !broken, broken);
ok('빈칸이 2개 미만인 시험은 없다 (너무 쉬운 문제 방지)', !noBlank, noBlank);

const hardT = C.buildTest({ w: 'palace', m: '궁전' }, true);
const softT = C.buildTest({ w: 'palace', m: '궁전' }, false);
ok('"이건 알아!"는 도움 글자를 주지 않는다', hardT.slots.every(s => !s.fixed));
ok('"이건 알아!"가 정규 시험보다 타일이 많다 (더 어렵다)',
  hardT.tiles.length > softT.tiles.length, `${hardT.tiles.length} vs ${softT.tiles.length}`);

// 보스 관문
S.state.player.cards = {};
eq('카드가 없으면 보스 관문이 막힌다', C.gateInfo(main, 2).ok, false);
const need2 = C.gateInfo(main, 2);
W.allWords(main).filter(w => w.unit <= 2).slice(0, need2.need).forEach(w => C.grant('main', w));
eq(`카드 ${need2.need}장(60%)을 모으면 열린다`, C.gateInfo(main, 2).ok, true);
S.state.player.cards = {};

// ===================================================================
section('타워 데이터와 오라');
// ===================================================================
sandbox.window.TOWERS.forEach(t => {
  ok(`${t.id}: clearBonus type이 atk/hp`, !t.clearBonus || ['atk', 'hp'].includes(t.clearBonus.type));
  ok(`${t.id}: 낡은 auras 필드가 없다`, t.auras === undefined);
});
// 카드·★의 신원은 철자가 아니라 wkey(key가 있으면 key). 같은 철자를 품사별로 나눌 수 있다.
const allW = sandbox.window.TOWERS.flatMap(t => W.allWords(t).map(w => `${t.id}:${W.wkey(w)}`));
eq('타워 안에서 단어 키가 겹치지 않는다', new Set(allW).size, allW.length);
{
  // 정복 보너스가 무한히 쌓이면 가장 어려운 타워가 가장 쉬워진다 → 상한이 있어야 한다
  const cap = S.BAL.player.clearBonusCap;
  ok('정복 보너스에 상한이 있다', typeof cap === 'number' && cap > 0);
  const saved = S.state.player.towerClear;
  S.state.player.towerClear = {};
  sandbox.window.TOWERS.forEach(t => { S.state.player.towerClear[t.id] = true; });
  ok('전부 정복해도 상한을 넘지 않는다', S.clearPct('atk') <= cap && S.clearPct('hp') <= cap);
  S.state.player.towerClear = saved;
}
{
  // 같은 등급 안에서도, 등급이 바뀔 때도 난이도가 뒤집히면 안 된다
  const sorted = sandbox.window.TOWERS.slice().sort((a, b) => (a.tier || 1) - (b.tier || 1));
  let mono = true;
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    if ((a.lvRange || [0, 0])[0] > (b.lvRange || [0, 0])[0]) mono = false;
  }
  ok('티어가 높은 타워일수록 권장 레벨도 낮지 않다', mono);
}
{
  const dup = sandbox.window.TOWERS.flatMap(t => {
    const seen = new Map(), out = [];
    W.allWords(t).forEach(w => {
      if (seen.has(w.w) && !w.key && !seen.get(w.w).key) out.push(`${t.id}:${w.w}`);
      seen.set(w.w, w);
    });
    return out;
  });
  eq('같은 철자를 두 번 쓸 땐 한쪽에 key가 있다', dup.length, 0);
}

// ===================================================================
section('성장 곡선 — 게임 전체가 말이 되는가');
// 개별 수치가 아니라 "다 합쳤을 때 놀 만한가"를 본다.
// 이 셋은 각각 실제로 게임을 망가뜨린 적이 있는 항목이다.
// ===================================================================
{
  const towers = sandbox.window.TOWERS.slice().sort((a, b) => (a.tier || 1) - (b.tier || 1));
  const allPt = towers.reduce((a, t) => a + W.allWords(t).reduce((x, w) => x + C.RARITY[C.rarityOf(w)].pt, 0), 0);

  // ① 필살기가 보스를 한 방에 지우면 배틀이 사라진다.
  //    카드를 다 모을수록 게임이 없어지면 안 된다 (공부한 보상이 게임을 파괴).
  const ultMul = Math.min(BAL.battle.ultMax, BAL.battle.ultBase + allPt * BAL.battle.ultPerCardPt);
  let oneShot = null, tooWeak = null;
  towers.forEach(t => {
    const r = S.towerRange(t), F = W.floorList(t).length;
    S.state.player.lv = r[1]; S.state.player.weapon = 'dragon';
    const ult = S.playerAtk() * ultMul;
    if (ult >= S.monsterHp(F, true, t)) oneShot = t.name;
    if (ult < S.monsterHp(F, false, t)) tooWeak = t.name;   // 일반 몬스터는 한 방이어야 통쾌하다
  });
  ok('카드를 다 모아도 필살기가 보스를 한 방에 지우지 못한다', !oneShot, oneShot);
  ok('필살기가 일반 몬스터는 한 방에 지운다 (통쾌함)', !tooWeak, tooWeak);
  ok('카드가 아무리 늘어도 필살기에 상한이 있다',
    BAL.battle.ultBase + 99999 * BAL.battle.ultPerCardPt > BAL.battle.ultMax);

  // ② 콘텐츠를 다 깨도 권장 레벨에 못 닿으면 뒤쪽 타워가 벽이 된다.
  const bf = sandbox.byFloorX;
  let totalExp = 0;
  towers.forEach(t => W.floorList(t).forEach((pl, i) => {
    const f = i + 1, tier = S.towerTier(t);
    totalExp += pl.type === 'boss'
      ? Math.round(bf(BAL.exp.bossClear, f) * tier) + Math.round(bf(BAL.exp.battleCorrect, f)) * 14
      : Math.round(bf(BAL.exp.battleCorrect, f)) * 10 + Math.round(bf(BAL.exp.mazeDoor, f))
        + Math.round(bf(BAL.exp.runnerMission, f)) * BAL.runner.missions
        + Math.round(bf(BAL.exp.floorClear, f) * tier);
  }));
  let lv = 1, acc = 0;
  while (acc + S.expToNext(lv) <= totalExp) { acc += S.expToNext(lv); lv++; }
  const topRange = Math.max(...towers.map(t => S.towerRange(t)[1]));
  ok('콘텐츠를 한 번씩 깨면 가장 높은 권장 레벨 근처까지 간다',
    lv >= topRange - 3, `Lv${lv} · 최고 권장 Lv${topRange}`);
  ok('그렇다고 전부 훌쩍 넘기지도 않는다 (남는 목표가 있다)', lv <= topRange + 6, `Lv${lv}`);

  // ③ 몇 번 틀리면 죽는가. 너무 많으면 긴장이 없고, 너무 적으면 좌절한다.
  let loose = null, harsh = null;
  towers.forEach(t => {
    const r = S.towerRange(t), F = W.floorList(t).length;
    [[1, r[0]], [F, r[0]]].forEach(([f, atLv]) => {
      S.state.player.lv = atLv;
      const hits = Math.ceil(S.playerMaxHp() / S.monsterAtk(f, false, t));
      if (hits > 12) loose = `${t.name} ${f}층 ${hits}번`;
      if (hits < 3) harsh = `${t.name} ${f}층 ${hits}번`;
    });
  });
  ok('몬스터에게 12번 넘게 맞아도 안 죽는 층은 없다 (긴장감)', !loose, loose);
  ok('3번 만에 죽는 층도 없다 (좌절 방지)', !harsh, harsh);
}
S.loadState();

// ===================================================================
section('층 스테이지 조합');
// 매 층이 같은 순서면 45층을 버티기 어렵다. 층마다 조합이 달라져야 한다.
// ===================================================================
const G = sandbox.G;
ok('탐험 파트가 2개 이상 등록돼 있다', BAL.stages.explore.length >= 2, BAL.stages.explore.join(', '));
ok('마무리 파트가 1개 이상 등록돼 있다', BAL.stages.finish.length >= 1);

const unknown = [...BAL.stages.explore, ...BAL.stages.finish].filter(id => !G.STAGES[id]);
ok('BAL.stages의 id가 전부 Game.STAGES에 등록돼 있다', !unknown.length, unknown.join(', '));
ok('등록된 스테이지에 전부 go()가 있다',
  Object.values(G.STAGES).every(s => typeof s.go === 'function' && s.name));

const seen = {};
let badLen = null, sameTwice = 0, prev = null;
for (let i = 0; i < 400; i++) {
  const st = G.pickStages();
  if (st.length !== 2) badLen = st.join(',');
  if (!BAL.stages.explore.includes(st[0])) badLen = '탐험 아님: ' + st[0];
  if (!BAL.stages.finish.includes(st[1])) badLen = '마무리 아님: ' + st[1];
  if (prev && st[0] === prev) sameTwice++;
  prev = st[0];
  seen[st.join(' → ')] = (seen[st.join(' → ')] || 0) + 1;
}
ok('조합은 항상 [탐험, 마무리] 두 개', !badLen, badLen);
eq('같은 탐험 파트가 연달아 나오지 않는다', sameTwice, 0);
ok('모든 조합이 실제로 나온다',
  Object.keys(seen).length === BAL.stages.explore.length * BAL.stages.finish.length,
  Object.keys(seen).join(' · '));

// 보스 층은 스테이지 없이 곧장 배틀
S.loadState();
G.startFloor('main', 5);
eq('보스 층은 스테이지를 뽑지 않는다', G.run.stages.length, 0);

// 파이프라인이 등록된 스테이지를 순서대로 전부 지나 층 클리어까지 가는가.
// (예전엔 미로가 러너를 직접 불렀다 — 그러면 조합을 바꿀 수 없다)
const visited = [];
const realGo = {}, realClear = G.floorClear;
Object.keys(G.STAGES).forEach(id => {
  realGo[id] = G.STAGES[id].go;
  G.STAGES[id].go = (r, done) => { visited.push(id); done(); };   // 바로 끝내고 다음으로
});
let cleared = 0;
G.floorClear = () => { cleared++; };
G.startFloor('main', 1);
const plan = G.run ? G.run.stages : [];
Object.keys(G.STAGES).forEach(id => { G.STAGES[id].go = realGo[id]; });
G.floorClear = realClear;

eq('일반 층은 스테이지 2개', plan.length, 2);
eq('뽑은 스테이지를 순서대로 전부 지난다', visited.join(','), plan.join(','));
eq('마지막 스테이지가 끝나면 층 클리어로 간다', cleared, 1);

// ===================================================================
section('투기장');
// "그만두고 싶은데 죽으려니 한참 걸린다"가 문제였다.
// 오래 버틸수록 조여들고, 언제든 보상을 챙겨 나올 수 있어야 한다.
// ===================================================================
{
  const A = BAL.arena;
  const t = k => Math.max(A.time.min, A.time.base - k * A.time.perKill);
  const atk = k => A.atk.base + k * A.atk.perKill;

  ok('투기장 제한시간이 일반 배틀보다 짧다', A.time.base < BAL.battle.timeLimit,
    A.time.base + '초 vs ' + BAL.battle.timeLimit + '초');
  ok('오래 버틸수록 제한시간이 줄어든다', t(20) < t(0), t(0) + '초 → ' + t(20) + '초');
  eq('제한시간에 하한이 있다 (무한정 짧아지지 않는다)', t(9999), A.time.min);
  ok('하한도 경고 시간보다는 길다 (경고가 문제 전체를 덮지 않게)',
    A.time.min > BAL.battle.warnAt, A.time.min + '초 > 경고 ' + BAL.battle.warnAt + '초');
  ok('오래 버틸수록 몬스터가 세진다', atk(20) > atk(0));

  // 몇 번 맞으면 죽나: 처음엔 여유, 뒤로 갈수록 조임
  S.loadState(); S.state.player.lv = 12;
  const hits = k => Math.ceil(S.playerMaxHp() / Math.max(A.minAtk, Math.round(S.hpAt(12) * atk(k))));
  ok('처음 몇 마리는 여유가 있다 (8~15번)', hits(0) >= 8 && hits(0) <= 15, hits(0) + '번');
  ok('20마리쯤에서는 조여든다 (4번 이하)', hits(20) <= 4, hits(20) + '번');

  // 투기장 판이 실제로 시간·포기 버튼을 넘겨주는가
  sandbox.window.TOWERS.forEach(tw => W.allWords(tw).slice(0, 3).forEach(w => { S.wordStat(tw.id, w.w).seen = 1; }));
  sandbox.lastBattle = null;
  G.startArena();
  const b = sandbox.lastBattle;
  ok('투기장이 시작된다', !!b);
  ok('투기장 판에 제한시간이 실려 있다', b && b.timeLimit === t(0), b && String(b.timeLimit));
  ok('투기장 판에 포기 콜백이 있다', b && typeof b.onRetire === 'function');
  ok('일반 층 배틀에는 포기가 없다 (도중에 나가면 안 되니까)',
    (() => { sandbox.lastBattle = null; G.startFloor('main', 5); return !sandbox.lastBattle.onRetire; })());

  // 포기해도 기록이 남아야 한다
  S.loadState(); S.state.player.arenaBest = 0;
  sandbox.window.TOWERS.forEach(tw => W.allWords(tw).slice(0, 3).forEach(w => { S.wordStat(tw.id, w.w).seen = 1; }));
  G.startArena();
  sandbox.lastBattle.onWin(); sandbox.lastBattle.onWin();   // 2마리 잡고
  sandbox.lastBattle.onRetire();                            // 그만두기
  eq('포기해도 잡은 수가 기록에 남는다', S.state.player.arenaBest, 2);
  ok('포기 결과창이 "여기까지"로 뜬다', /여기까지/.test(sandbox.lastModal.h));
  eq('나가면 HP가 회복된다', S.state.player.hp, S.playerMaxHp());
}
S.loadState();

// ===================================================================
section('오라 마일스톤');
// 오라는 타워에 매여 있지 않다. 전체 카드 수 + 티어 조건으로 열린다.
// 이래야 스테이지를 늘려도 오라를 그만큼 새로 그릴 필요가 없다.
// ===================================================================
Object.keys(store).forEach(k => delete store[k]);
S.loadState();
const P = () => S.state.player;
const everyWord = sandbox.window.TOWERS.flatMap(t => W.allWords(t));
const unitTotal = sandbox.window.TOWERS.reduce((a, t) => a + t.units.length, 0);
const maxTier = Math.max(...sandbox.window.TOWERS.map(t => t.tier || 1));
const grantAll = k => { P().cards = {}; everyWord.slice(0, k).forEach(w => C.grant(w.towerId, w)); };
const reachedN = () => C.auraGoals().filter(g => g.reached).length;

const goals0 = C.auraGoals();
eq('오라 목표가 카드 수 오름차순', goals0.map(g => g.need.cards).join(),
  goals0.map(g => g.need.cards).slice().sort((a, b) => a - b).join());
eq('카드 0장이면 아무 오라도 안 열린다', reachedN(), 0);

// 카드를 전부 모았지만 아직 아무 타워도 끝까지 못 깬 상태
grantAll(everyWord.length);
eq('클리어한 타워가 없으면 티어 0', C.clearedTier(), 0);
ok('카드를 다 모으면 티어 조건 없는 오라는 전부 열린다',
  C.auraGoals().filter(g => !g.need.tier).every(g => g.reached));
ok('티어 조건이 붙은 오라는 타워를 깨기 전엔 안 열린다',
  C.auraGoals().filter(g => g.need.tier).every(g => !g.reached));

// 타워를 끝까지 깬 뒤
sandbox.window.TOWERS.forEach(t => { S.towerProg(t.id).cleared = W.floorList(t).length; });
eq('타워를 다 깬 뒤의 최고 티어', C.clearedTier(), maxTier);
const total = C.auraGoals().length, reachable = reachedN();
ok('지금 콘텐츠로 열 수 있는 오라가 있다', reachable > 0, `${reachable}종`);
ok('한 번에 다 주지는 않는다 (다음 타워의 목표가 남는다)', reachable < total, `${reachable} / ${total}종`);
ok('열리는 오라가 단원 수보다 훨씬 적다 (남발 방지)',
  reachable * 2 <= unitTotal, `오라 ${reachable}종 · 단원 ${unitTotal}개`);

// 난이도 표시(🔥)는 티어를 아이가 읽을 수 있게 바꾼 것이다.
// 오라 조건과 타워 카드가 같은 표시를 써야 "어느 타워를 깨야 하는지" 알 수 있다.
eq('티어 1.0 → 🔥', S.tierFire(1), '🔥');
eq('티어 1.5 → 🔥🔥', S.tierFire(1.5), '🔥🔥');
eq('티어 2.0 → 🔥🔥🔥', S.tierFire(2), '🔥🔥🔥');
let notUp = null;
for (let t = 1; t < 4; t += 0.5) if (S.tierFire(t + 0.5).length < S.tierFire(t).length) notUp = 'tier ' + t;
ok('티어가 높을수록 🔥이 늘어난다', !notUp, notUp);

// 난이도 조건은 (a) 지금 깰 수 있거나 (b) 다음 타워를 만들 이유이거나 둘 중 하나다.
// 어느 쪽이든 "어느 타워를 깨야 하는지" 또는 "아직 그런 타워가 없다"를 말해줘야 한다.
const tierNeeds = [...new Set(C.auraGoals().filter(g => g.need.tier).map(g => g.need.tier))].sort((a, b) => a - b);

const nowOk = tierNeeds.filter(t => t <= maxTier);
ok('지금 타워로 채울 수 있는 난이도 조건이 있다', nowOk.length > 0,
  tierNeeds.map(t => S.tierFire(t) + '(' + t + ')').join(' · '));
const tierGoals = C.auraGoals().filter(g => g.need.tier);
ok('난이도 조건이 붙은 오라의 절반 이상은 지금 열 수 있다',
  tierGoals.filter(g => g.need.tier <= maxTier).length * 2 >= tierGoals.length,
  tierGoals.filter(g => g.need.tier <= maxTier).length + ' / ' + tierGoals.length + '종');
tierNeeds.forEach(t => {
  const msg = C.tierList(t);
  ok(`난이도 ${S.tierFire(t)}(tier ${t}) 조건을 안내한다`,
    t <= maxTier ? /꼭대기까지/.test(msg) : /아직/.test(msg), msg);
});

// 카드가 늘어난다고 열린 오라가 줄어들면 안 된다
let prevN = -1, notMono = null;
[0, 20, 50, 100, 150, everyWord.length].forEach(k => {
  grantAll(k);
  const cur = reachedN();
  if (cur < prevN) notMono = `카드 ${k}장에서 줄어듦`;
  prevN = cur;
});
ok('카드를 모을수록 열리는 오라가 늘기만 한다', !notMono, notMono);

// 보상 큐: 단원 완성은 골드, 오라는 마일스톤
P().cards = {}; P().owned.auras = ['none']; P().setBonus = {};
W.allWords(main).filter(w => w.unit === 1).forEach(w => C.grant('main', w));
const rw = C.pendingRewards('main');
ok('단원을 다 모으면 골드 보상이 대기한다', rw.some(r => r.kind === 'unit' && r.unit === 1));
ok('단원 완성만으로는 오라가 나오지 않는다 (마일스톤에 못 미치면)',
  C.count() >= AV.AURAS.sparkle.need.cards || !rw.some(r => r.kind === 'aura'));
ok('같은 단원 보상을 두 번 주지 않는다',
  (() => { C.pendingRewards('main').forEach(r => { if (r.kind === 'unit') P().setBonus[r.key] = true; });
    return !C.pendingRewards('main').some(r => r.kind === 'unit' && r.unit === 1); })());

// ===================================================================
section('발음 읽어주기 설정');
// 발음(학습 도움)과 듣기 문제(난이도)는 다른 것이다.
// 예전엔 하나로 묶여 있어서, 발음을 들으려면 난이도를 올려야 했다.
// ===================================================================
Object.keys(store).forEach(k => delete store[k]);
S.loadState();
eq('새 게임은 발음 읽어주기가 켜져 있다', S.state.settings.say, true);
eq('새 게임은 듣기 문제가 꺼져 있다', S.state.settings.listen, false);

// 발음 설정이 없던 옛 저장을 읽으면 켜진 채로 채워져야 한다 (안 그러면 조용해진다)
store['wordtower_save_v1'] = JSON.stringify({
  version: 1, player: { name: '옛날', lv: 4, cards: {} }, towers: {},
  settings: { listen: false, sound: true, preview: true },
});
S.loadState();
eq('발음 설정이 없던 옛 저장도 켜진 채로 채워진다', S.state.settings.say, true);
eq('옛 저장의 다른 설정은 그대로', S.state.settings.listen, false);
eq('옛 저장의 진행은 유지된다', S.state.player.lv, 4);

// 둘은 서로 영향을 주지 않아야 한다
S.state.settings.say = false;
eq('발음을 꺼도 듣기 문제는 그대로', S.state.settings.listen, false);
S.state.settings.listen = true;
eq('듣기 문제를 켜도 발음 설정은 그대로', S.state.settings.say, false);

// TTS가 없는 환경(노드)에서도 죽지 않아야 한다
eq('TTS 없는 기기에서는 canSpeak()가 false', W.canSpeak(), false);
ok('TTS 없는 기기에서 speak()가 예외를 던지지 않는다',
  (() => { try { W.speak('apple'); return true; } catch (e) { return false; } })());

ok('발음 속도가 1.0보다 느리다 (아이가 따라 말할 수 있게)', BAL.speech.rate < 1, String(BAL.speech.rate));

// ===================================================================
section('저장 / 백업');
// ===================================================================
Object.keys(store).forEach(k => delete store[k]);   // 앞 테스트가 남긴 저장 비우기
S.loadState();
eq('빈 저장 → 새 게임', S.state.player.lv, 1);
eq('새 게임의 세이브 버전', S.state.version, S.SAVE_VERSION);

S.state.player.lv = 7; S.state.player.gold = 999; S.saveState();
S.loadState();
ok('저장한 뒤 다시 읽으면 그대로', S.state.player.lv === 7 && S.state.player.gold === 999);
const code = S.exportCode();

store['wordtower_save_v1'] = '{망가진 json';
S.loadState();
eq('손상된 저장 → 새 게임으로 복구', S.state.player.lv, 1);
ok('손상 직전 원본을 백업에 보관', !!store['wordtower_backup']);

S.state.player.lv = 3; S.state.player.name = '우주'; S.saveState();
S.importCode(code);
ok('저장 코드 불러오기', S.state.player.lv === 7 && S.state.player.gold === 999);
ok('덮어쓰기 직전 상태가 백업에 남는다', S.backupInfo().lv === 3);
S.restoreBackup();
ok('백업 되돌리기', S.state.player.lv === 3 && S.state.player.name === '우주');
ok('되돌리기도 되돌릴 수 있다', S.backupInfo().lv === 7);
S.resetState();
ok('초기화 직전 상태도 백업된다', S.state.player.lv === 1 && S.backupInfo().lv === 3);

store['wordtower_save_v1'] = JSON.stringify({ version: 999, player: { name: '미래', lv: 50, cards: {} }, towers: {}, settings: {} });
S.loadState();
ok('더 새 버전에서 만든 세이브를 망가뜨리지 않는다', S.state.version === 999 && S.state.player.lv === 50);

// 레벨업하면 HP가 가득 차야 한다
S.loadState();
S.state.player.lv = 1; S.state.player.exp = 0; S.state.player.hp = 1;
const ups = S.addExp(99999);
ok('경험치를 크게 얻으면 여러 레벨이 한 번에 오른다', ups.length > 1, `${ups.length}레벨`);
eq('레벨업하면 HP가 가득 찬다', S.state.player.hp, S.playerMaxHp());

// ===================================================================
console.log(`\n${'─'.repeat(50)}`);
if (fails.length) {
  console.log(`\n❌ ${fails.length}개 실패 / ${pass + fails.length}개 중\n`);
  fails.forEach(f => console.log(`   ${f}`));
  console.log('');
  process.exit(1);
}
console.log(`\n✅ ${pass}개 전부 통과\n`);
