#!/usr/bin/env node
'use strict';
// 타워 데이터 + index.html 스크립트 태그 검사.
//   node tools/validate.js
// 게임을 열기 전에 "이 데이터로 게임이 정상 동작하는가"를 미리 확인한다.
// 잘못된 타워 파일은 로비가 뜨다 말거나 오답 보기가 안 만들어지는데,
// 브라우저는 그걸 조용히 넘기기 때문에 여기서 잡는다.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const errors = [];
let auraLine = '';
const warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

// ---------- 소스에서 상수 읽어오기 ----------
// vm 안에서 top-level const는 컨텍스트 객체에 안 붙으므로 끝에 한 줄 덧붙여 꺼낸다.
function grab(file, names) {
  const ctx = vm.createContext({ window: {}, document: {}, console });
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8')
    + `\n;globalThis.__out = { ${names.join(', ')} };`;
  vm.runInContext(src, ctx, { filename: file });
  return ctx.__out;
}

let AURAS;
try {
  AURAS = grab('js/avatar.js', ['AURAS']).AURAS;
} catch (e) {
  err('js/avatar.js', `읽을 수 없음 — ${e.message}`);
  AURAS = null;
}

// ---------- 타워 데이터 로드 ----------
const dataDir = path.join(ROOT, 'data');
const dataFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.js')).sort();
const ctx = vm.createContext({ window: { TOWERS: [] }, console });
const owner = new Map(); // tower -> 파일명

for (const f of dataFiles) {
  const before = ctx.window.TOWERS.length;
  try {
    vm.runInContext(fs.readFileSync(path.join(dataDir, f), 'utf8'), ctx, { filename: f });
  } catch (e) {
    err(`data/${f}`, `실행 실패 — ${e.message}`);
    continue;
  }
  const added = ctx.window.TOWERS.slice(before);
  if (!added.length) warn(`data/${f}`, 'window.TOWERS에 아무것도 추가하지 않았어요');
  added.forEach(t => owner.set(t, `data/${f}`));
}
const towers = ctx.window.TOWERS;

// ---------- 타워 검사 ----------
const seenIds = new Set();

towers.forEach((t, ti) => {
  const where = owner.get(t) || `TOWERS[${ti}]`;
  const name = t && t.name ? ` (${t.name})` : '';
  const at = `${where}${name}`;

  if (!t || typeof t !== 'object') { err(at, '타워가 객체가 아니에요'); return; }

  // id — 저장 키이자 카드 키(`towerId:word`)의 앞부분이라 ':'가 들어가면 안 된다
  if (typeof t.id !== 'string' || !t.id) err(at, 'id가 없어요');
  else if (!/^[a-z0-9_-]+$/.test(t.id)) err(at, `id "${t.id}" — 영문 소문자·숫자·_·- 만 쓸 수 있어요 (저장 키로 쓰여요)`);
  else if (seenIds.has(t.id)) err(at, `id "${t.id}"가 다른 타워와 겹쳐요 — 진행 상황이 섞여요`);
  else seenIds.add(t.id);

  if (typeof t.name !== 'string' || !t.name) err(at, 'name이 없어요');

  // 밸런스 필드
  if (t.tier !== undefined && (typeof t.tier !== 'number' || !(t.tier > 0)))
    err(at, `tier는 0보다 큰 숫자여야 해요 (지금: ${JSON.stringify(t.tier)})`);
  if (t.tier === undefined) warn(at, 'tier가 없어요 — 1.0으로 취급돼요');
  if (t.lvRange !== undefined) {
    const r = t.lvRange;
    if (!Array.isArray(r) || r.length !== 2 || typeof r[0] !== 'number' || typeof r[1] !== 'number')
      err(at, 'lvRange는 [최소, 최대] 숫자 두 개여야 해요');
    else if (r[0] > r[1]) err(at, `lvRange가 뒤집혔어요: [${r[0]}, ${r[1]}]`);
  } else warn(at, 'lvRange가 없어요 — [1, 12]로 취급돼요');

  // units
  if (!Array.isArray(t.units) || !t.units.length) { err(at, 'units가 비었어요'); return; }
  const seenUnits = new Set();
  const seenW = new Map();   // 영어 → 처음 나온 위치
  const byMeaning = new Map();
  let totalWords = 0;

  t.units.forEach((u, ui) => {
    const uat = `${at} Unit ${u && u.unit !== undefined ? u.unit : `#${ui + 1}`}`;
    if (typeof u.unit !== 'number') err(uat, 'unit은 숫자여야 해요');
    else if (seenUnits.has(u.unit)) err(uat, `unit 번호 ${u.unit}이 중복돼요 — 층 구성이 어긋나요`);
    else seenUnits.add(u.unit);

    if (!Array.isArray(u.words) || !u.words.length) { err(uat, 'words가 비었어요'); return; }

    u.words.forEach((w, wi) => {
      const wat = `${uat} #${wi + 1}`;
      if (!w || typeof w !== 'object') { err(wat, '단어가 객체가 아니에요'); return; }
      if (typeof w.w !== 'string' || !w.w.trim()) err(wat, 'w(영어)가 없어요');
      if (typeof w.m !== 'string' || !w.m.trim()) err(wat, `w="${w.w}" — m(한글 뜻)이 없어요`);
      if (typeof w.w !== 'string') return;

      totalWords++;
      if (seenW.has(w.w)) err(wat, `"${w.w}"가 ${seenW.get(w.w)}에도 있어요 — 카드가 하나로 합쳐지고 ★도 공유돼요`);
      else seenW.set(w.w, `Unit ${u.unit}`);

      if (typeof w.m === 'string') {
        if (!byMeaning.has(w.m)) byMeaning.set(w.m, []);
        byMeaning.get(w.m).push(w.w);
      }
      if (w.w !== w.w.trim()) warn(wat, `"${w.w}" 앞뒤에 공백이 있어요`);
    });
  });

  // 오답 보기는 타워 전체 단어에서 뽑는다 (words.js distractors)
  if (totalWords < 8) err(at, `단어가 ${totalWords}개 — 4지선다 보기를 만들려면 최소 8개 필요해요`);

  // 뜻이 같은 단어는 오답 후보에서 제외되므로, 너무 많으면 보기가 모자란다
  byMeaning.forEach((ws, m) => {
    if (ws.length > 1) warn(at, `뜻 "${m}"을 쓰는 단어가 ${ws.length}개 (${ws.join(', ')}) — 서로 오답 보기가 될 수 없어요`);
  });

  // 오라는 이제 타워가 아니라 전체 카드 수로 열린다 (js/avatar.js의 AURAS[].need)
  if (t.auras !== undefined)
    warn(at, 'auras 필드는 더 이상 쓰지 않아요 — 오라는 전체 카드 마일스톤으로 열려요. 지워도 됩니다');

  // clearBonus: state.js clearPct()가 type으로 찾는다
  if (t.clearBonus !== undefined) {
    const cb = t.clearBonus;
    if (!cb || typeof cb !== 'object') err(at, 'clearBonus는 객체여야 해요');
    else {
      if (cb.type !== 'atk' && cb.type !== 'hp') err(at, `clearBonus.type은 'atk' 또는 'hp' (지금: ${JSON.stringify(cb.type)})`);
      if (typeof cb.pct !== 'number') err(at, 'clearBonus.pct는 숫자여야 해요');
      if (typeof cb.title !== 'string' || !cb.title) err(at, 'clearBonus.title이 없어요');
    }
  }
});

if (!towers.length) err('data/', '타워가 하나도 없어요');

// ---------- 오라 마일스톤이 지금 콘텐츠로 닿을 수 있나 ----------
// 스테이지를 늘리면 뒤쪽 오라가 열린다. 하나도 못 닿으면 목표가 아니라 벽이다.
if (AURAS) {
  const RARITY_PT = { legend: 5, epic: 3, rare: 2, common: 1 };
  const ptOf = w => {
    const letters = w.w.replace(/[^A-Za-z]/g, '').length;
    if (letters >= 11) return RARITY_PT.legend;
    if (letters >= 8 || /[\s-]/.test(w.w)) return RARITY_PT.epic;
    return letters >= 5 ? RARITY_PT.rare : RARITY_PT.common;
  };
  let totalCards = 0, totalPt = 0, maxTier = 0;
  towers.forEach(t => {
    maxTier = Math.max(maxTier, t.tier || 1);
    (t.units || []).forEach(u => (u.words || []).forEach(w => { if (w && w.w) { totalCards++; totalPt += ptOf(w); } }));
  });
  const goals = Object.keys(AURAS).filter(id => AURAS[id].need)
    .map(id => ({ id, q: AURAS[id].need })).sort((a, b) => a.q.cards - b.q.cards);
  const reach = goals.filter(g => g.q.cards <= totalCards && (g.q.tier || 0) <= maxTier);
  auraLine = `✨ 오라 ${goals.length}종 중 ${reach.length}종이 지금 콘텐츠(카드 ${totalCards}장 ${totalPt}pt, 최고 티어 ${maxTier})로 도달 가능`;
  if (!reach.length) err('js/avatar.js', '지금 콘텐츠로 열 수 있는 오라가 하나도 없어요 — 조건이 너무 높아요');
  else if (reach.length === goals.length) warn('js/avatar.js', '오라를 전부 열 수 있어요 — 다음 타워를 위한 목표가 남아 있지 않아요');
  goals.forEach(g => { if (g.q.tier && g.q.tier > maxTier && g.q.cards <= totalCards)
    warn('js/avatar.js', `${g.id}: 카드는 닿지만 티어 ${g.q.tier} 이상 타워가 없어요`); });
}

// ---------- index.html 스크립트 태그 검사 ----------
// v 번호를 하나 빠뜨리면 낡은 파일이 섞여 로드돼 게임이 반쯤 깨진다
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tagRe = /<script\s+src="([^"?]+)(\?v=(\d+))?"/g;
const tagged = new Map();
let m;
while ((m = tagRe.exec(html))) tagged.set(m[1].replace(/\\/g, '/'), m[3] === undefined ? null : +m[3]);

const onDisk = [];
for (const dir of ['js', 'data']) {
  fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith('.js')).forEach(f => onDisk.push(`${dir}/${f}`));
}
onDisk.forEach(f => { if (!tagged.has(f)) err('index.html', `${f}가 있는데 <script> 태그가 없어요 — 로드되지 않아요`); });
tagged.forEach((v, f) => {
  if (!fs.existsSync(path.join(ROOT, f))) err('index.html', `${f}를 로드하는데 파일이 없어요`);
  if (v === null) warn('index.html', `${f}에 ?v= 캐시 번호가 없어요`);
});
const versions = [...new Set([...tagged.values()].filter(v => v !== null))];
if (versions.length > 1)
  err('index.html', `캐시 번호가 섞여 있어요: ${versions.sort((a, b) => a - b).join(', ')} — 낡은 파일이 함께 로드돼요. node tools/bump.js 로 맞추세요`);

// ---------- 결과 ----------
const towerLine = towers.map(t => {
  const n = (t.units || []).reduce((a, u) => a + ((u.words || []).length), 0);
  return `  ${t.id || '?'} — ${(t.units || []).length}단원 ${n}단어 · tier ${t.tier ?? 1}`;
}).join('\n');

console.log(`\n🏰 타워 ${towers.length}개 (${dataFiles.length}개 파일)\n${towerLine}`);
console.log(`📄 index.html 스크립트 ${tagged.size}개${versions.length === 1 ? ` · 캐시 v${versions[0]}` : ''}`);
if (auraLine) console.log(auraLine);
console.log('');

if (warns.length) { console.log(`⚠️  주의 ${warns.length}개`); warns.forEach(w => console.log('   ' + w)); console.log(''); }
if (errors.length) { console.log(`❌ 오류 ${errors.length}개`); errors.forEach(e => console.log('   ' + e)); console.log(''); process.exit(1); }

console.log('✅ 이상 없어요\n');
