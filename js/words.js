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
function floorList(tower) {
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
  const half = Math.ceil(uw.length / 2);
  return f.half === 0 ? uw.slice(0, half) : uw.slice(half);
}
// 이 타워에서 틀렸던 단어(★<3)를 최대 2개 섞어 넣는다 — 복습
function withReview(towerId, words, pool) {
  const have = new Set(words.map(w => w.w));
  const review = shuffle(pool.filter(w => !have.has(w.w) && wordStat(towerId, w.w).wrong > 0 && wordStat(towerId, w.w).stars < 3)).slice(0, 2);
  return words.concat(review);
}

function statFor(towerId, word) { return wordStat(word.towerId || towerId, word.w); }

// ★이 낮은 단어가 더 자주 나오게 가중치 선택
function pickWord(towerId, words, excludeW) {
  let pool = words.filter(w => w.w !== excludeW);
  if (!pool.length) pool = words;
  const weights = pool.map(w => 4 - Math.min(3, statFor(towerId, w).stars));
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
    const ds = distractors(word, pool, 3, 'w');
    return { mode, word, prompt: word.m, answer: word.w, choices: shuffle([word.w, ...ds.map(d => d.w)]), hint: word.w[0] };
  }
  const ds = distractors(word, pool, 3, 'm');
  return { mode, word, prompt: word.w, answer: word.m, choices: shuffle([word.m, ...ds.map(d => d.m)]), hint: word.m[0] };
}

function recordResult(towerId, word, correct, helped) {
  const s = statFor(towerId, word); s.seen++;
  if (correct) { if (!helped) s.stars = Math.min(3, s.stars + 1); }
  else { s.stars = Math.max(0, s.stars - 1); s.wrong++; }
}
function starsText(n) { return '★'.repeat(n) + '☆'.repeat(3 - n); }

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85;
    speechSynthesis.speak(u);
  } catch (e) { /* TTS 미지원 */ }
}
