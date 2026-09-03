'use strict';
// 단어 데이터 접근, 층 구성, 문제 생성

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rnd(n) { return Math.floor(Math.random() * n); }
function pick(a) { return a[rnd(a.length)]; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function towerById(id) { return window.TOWERS.find(t => t.id === id); }
function allWords(tower) {
  const out = [];
  tower.units.forEach(u => u.words.forEach(w => out.push(Object.assign({ unit: u.unit, towerId: tower.id }, w))));
  return out;
}

// 단원 1개 → 일반 층 2개, 단원 2개마다 보스 층 (마지막 단원 뒤엔 무조건 보스)
// 단원 하나를 PARTS 개 층으로 쪼갠다.
// 2등분이던 시절엔 한 층이 단어 12개를 맡았는데, 한 층의 실제 접촉은 13~15회라
// 단어당 1.1회밖에 안 됐다. ★★★(카드)에는 힌트 없이 3번 정답이 필요하니
// 카드 하나에 같은 층을 세 번 돌아야 했다 — 반복이 아니라 노동이다.
const UNIT_PARTS = 4;
function floorList(tower) {
  const floors = []; let bossIdx = 0;
  tower.units.forEach((u, i) => {
    for (let p = 0; p < UNIT_PARTS; p++) floors.push({ type: 'normal', unit: u.unit, part: p, half: p < UNIT_PARTS / 2 ? 0 : 1 });
    if (i % 2 === 1 || i === tower.units.length - 1) floors.push({ type: 'boss', upTo: u.unit, bossIdx: bossIdx++ });
  });
  return floors;
}
// 옛 세이브의 층 번호를 새 번호로 옮기기 위한, 2등분 시절의 층 목록
function floorListLegacy(tower) {
  const floors = []; let bossIdx = 0;
  tower.units.forEach((u, i) => {
    floors.push({ type: 'normal', unit: u.unit, half: 0 });
    floors.push({ type: 'normal', unit: u.unit, half: 1 });
    if (i % 2 === 1 || i === tower.units.length - 1) floors.push({ type: 'boss', upTo: u.unit, bossIdx: bossIdx++ });
  });
  return floors;
}
function floorWords(tower, n) {
  const f = floorList(tower)[n - 1];
  const all = allWords(tower);
  if (f.type === 'boss') return all.filter(w => w.unit <= f.upTo);
  const uw = all.filter(w => w.unit === f.unit);
  if (uw.length <= 6) return uw;
  const per = Math.ceil(uw.length / UNIT_PARTS);
  const p = f.part === undefined ? (f.half === 0 ? 0 : UNIT_PARTS / 2) : f.part;
  return uw.slice(p * per, (p + 1) * per);
}
// 이 타워에서 틀렸던 단어(★<3)를 최대 2개 섞어 넣는다 — 복습
function withReview(towerId, words, pool) {
  const have = new Set(words.map(wkey));
  const review = shuffle(pool.filter(w => !have.has(wkey(w)) && statFor(towerId, w).wrong > 0 && statFor(towerId, w).stars < 3)).slice(0, BAL.quiz.reviewPerFloor);
  return words.concat(review);
}

// 단어의 신원. 같은 철자가 품사만 다르게 두 번 나올 수 있어(crash 명사/동사)
// 그럴 때만 데이터에 key를 따로 준다. key가 없으면 철자가 곧 신원.
function wkey(w) { return w.key || w.w; }
function statFor(towerId, word) { return wordStat(word.towerId || towerId, wkey(word)); }

// ★이 낮은 단어가 더 자주 나오게 가중치 선택
function pickWord(towerId, words, excludeW) {
  let pool = words.filter(w => w.w !== excludeW);
  if (!pool.length) pool = words;
  const weights = pool.map(w => BAL.quiz.starWeight - Math.min(3, statFor(towerId, w).stars));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}
// field 기준으로 겹치지 않는 오답 n개
function distractors(word, pool, n, field) {
  const out = [], seen = new Set([word[field]]);
  for (const w of shuffle(pool)) {
    if (w.w === word.w || w.m === word.m || seen.has(w[field])) continue; // 뜻이 같은 단어(동의어)는 오답 금지
    seen.add(w[field]); out.push(w);
    if (out.length >= n) break;
  }
  return out;
}
// mode: 'm2w' 뜻→영어 | 'w2m' 영어→뜻 | 'listen' 듣기→뜻
function makeQuestion(word, pool, mode) {
  if (mode === 'm2w') {
    const ds = distractors(word, pool, BAL.quiz.choices - 1, 'w');
    return { mode, word, prompt: word.m, answer: word.w, choices: shuffle([word.w, ...ds.map(d => d.w)]), hint: word.w[0] };
  }
  const ds = distractors(word, pool, BAL.quiz.choices - 1, 'm');
  return { mode, word, prompt: word.w, answer: word.m, choices: shuffle([word.m, ...ds.map(d => d.m)]), hint: word.m[0] };
}

function recordResult(towerId, word, correct, helped) {
  const s = statFor(towerId, word); s.seen++;
  const before = s.stars;
  if (correct) { if (!helped) s.stars = Math.min(3, s.stars + 1); }
  else { s.stars = Math.max(0, s.stars - 1); s.wrong++; }
  if (s.stars >= 3 && before < 3 && typeof Cards !== 'undefined' && word.towerId) {
    Cards.onMastered(word.towerId, word);
    UI.toast(`🃏 "${word.w}" 각인 시험 준비 완료!`, 'gold');
  }
}
function starsText(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

// ---------- 발음 읽어주기 (브라우저 내장 TTS, 외부 API 없음) ----------
// 한국어 기기에서는 lang만 지정하면 한국어 목소리가 영어를 읽어버리는 일이 있다
// ("apple"을 "아플레"처럼). 그래서 영어 목소리를 직접 골라 준다.
let _voices = [];
function loadVoices() {
  try { _voices = speechSynthesis.getVoices() || []; } catch (e) { _voices = []; }
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;   // 크롬은 목록이 늦게 채워진다
}
function englishVoice() {
  if (!_voices.length) loadVoices();
  const en = _voices.filter(v => /^en[-_]/i.test(v.lang));
  if (!en.length) return null;
  return en.find(v => /^en[-_]US/i.test(v.lang)) || en[0];
}

function speak(text) {
  if (typeof speechSynthesis === 'undefined') return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = englishVoice();
    if (v) u.voice = v;
    u.lang = 'en-US';
    u.rate = BAL.speech.rate;
    speechSynthesis.speak(u);
  } catch (e) { /* TTS 미지원 */ }
}
// 목소리가 아예 없으면 발음 기능을 조용히 접는다 (설정에서 안내용)
function canSpeak() { return typeof speechSynthesis !== 'undefined'; }
