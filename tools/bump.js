#!/usr/bin/env node
'use strict';
// index.html의 캐시 번호(?v=N)를 한 번에 올린다.
//   node tools/bump.js        → 지금 번호 +1
//   node tools/bump.js 25     → 25번으로 지정
//
// 왜 필요한가: 태그 15개에 손으로 번호를 박아두면 하나를 빠뜨리기 쉽고,
// 그러면 아이 폰에 새 파일과 낡은 파일이 섞여 로드돼 게임이 반쯤 깨진다.
// 파일을 고쳤으면 커밋 전에 이걸 한 번 돌린다.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

let html = fs.readFileSync(INDEX, 'utf8');

const found = [...html.matchAll(/\?v=(\d+)/g)].map(m => +m[1]);
const cur = found.length ? Math.max(...found) : 0;

const arg = process.argv[2];
let next;
if (arg === undefined) next = cur + 1;
else if (/^\d+$/.test(arg)) next = +arg;
else { console.error(`숫자를 주세요. 예: node tools/bump.js 25\n(지금 번호: v${cur})`); process.exit(1); }

if (next <= cur && arg !== undefined) {
  console.error(`⚠️  v${next}은 지금(v${cur})보다 낮거나 같아요. 브라우저가 낡은 파일을 계속 쓸 수 있어요.`);
}

// ① 이미 있는 번호를 전부 새 번호로
let bumped = 0;
html = html.replace(/\?v=\d+/g, () => { bumped++; return `?v=${next}`; });

// ② 번호가 빠진 로컬 스크립트/스타일에 붙이기 (외부 CDN·폰트는 건드리지 않는다)
let added = 0;
const addTo = (attr, tag) => {
  const re = new RegExp(`(<${tag}\\b[^>]*\\b${attr}=")((?:js|data|css)/[^"?]+)(")`, 'g');
  html = html.replace(re, (all, a, file, b) => { added++; return `${a}${file}?v=${next}${b}`; });
};
addTo('src', 'script');
addTo('href', 'link');

fs.writeFileSync(INDEX, html);

console.log(`\n🔖 캐시 번호 v${cur} → v${next}`);
console.log(`   갱신 ${bumped}개${added ? ` · 새로 붙임 ${added}개` : ''}\n`);

// 올린 김에 검사까지
try {
  console.log(execFileSync(process.execPath, [path.join(__dirname, 'validate.js')], { encoding: 'utf8' }));
} catch (e) {
  console.log(e.stdout || '');
  console.error('❌ 검사에서 문제가 나왔어요. 위 내용을 고치고 다시 확인하세요.');
  process.exit(1);
}
