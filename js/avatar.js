'use strict';
// 레이어 조합형 SVG 캐릭터: 피부/머리/옷(코스튬)/모자/무기를 겹쳐 그린다.
// 코스튬을 늘리려면 OUTFITS에 항목 + outfitSvg()에 그리기 추가.

const OUTFITS = {
  tunic:  { name: '초록 옷',     emoji: '🟩', price: 0,    desc: '기본 옷' },
  dress:  { name: '원피스',      emoji: '🩷', price: 0,    desc: '기본 옷' },
  knight: { name: '기사 갑옷',   emoji: '🛡️', price: 400,  desc: '든든해 보여요' },
  wizard: { name: '마법사 로브', emoji: '🔮', price: 600,  desc: '별이 반짝여요' },
  hero:   { name: '용사 망토',   emoji: '🦸', price: 1000, desc: '바람에 휘날려요' },
};


// 오라: 옷과 다른 슬롯이라 상점 코스튬과 겹치지 않고, 캐릭터 주변에서 움직여 어디서든 보인다.
// 골드로는 못 산다. 오직 카드를 모아야 열린다.
//
// need = 해금 조건. 타워에 매여 있지 않고 **전체 카드 수**로 열린다.
//   cards: 지금까지 모은 카드 총 장수 (어느 타워에서 모았든 상관없다)
//   tier:  이 티어 이상인 타워를 끝까지 깼을 것 (상위 오라는 어려운 타워를 거쳐야 나온다)
//
// 왜 타워별 배정이 아닌가: 단원마다 하나씩 주면 타워를 추가할 때마다 오라를 그만큼
// 새로 그려야 하고, 재사용하면 "새 오라!"라며 이미 가진 걸 주게 된다.
// 전체 진행도에 걸어 두면 스테이지를 아무리 늘려도 이 목록을 안 건드려도 된다.
// 대신 드물게 나온다 — 지금 콘텐츠(239장)로 8종까지, 나머지 2종은 다음 타워의 목표다.
// tier 조건은 동물 표의 실제 등급을 가리켜야 한다 (곰 1.5 · 독수리 1.7 · 사자 2.1 …).
const AURAS = {
  none:    { name: '없음',        emoji: '⬜' },
  sparkle: { name: '반짝이 오라', emoji: '✨', need: { cards: 15 } },
  aqua:    { name: '물결 오라',   emoji: '🌊', need: { cards: 35 } },
  comet:   { name: '유성 자국',   emoji: '💫', need: { cards: 60 } },
  fairy:   { name: '요정 날개',   emoji: '🦋', need: { cards: 90 } },
  flame:   { name: '불꽃 오라',   emoji: '🔥', need: { cards: 120, tier: 1.5 } },
  thunder: { name: '번개 오라',   emoji: '⚡', need: { cards: 150, tier: 1.5 } },
  angel:   { name: '천사 날개',   emoji: '🪽', need: { cards: 180, tier: 1.5 } },
  rainbow: { name: '무지개 오라', emoji: '🌈', need: { cards: 210, tier: 1.5 } },
  moon:    { name: '달빛 오라',   emoji: '🌙', need: { cards: 250, tier: 1.7 } },  // 독수리 이상
  dragon:  { name: '용의 오라',   emoji: '🐉', need: { cards: 300, tier: 2.1 } },  // 사자 이상
};

const Aura = (() => {
  function star(x, y, r, cls) {
    let d = '';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5, b = a + Math.PI / 5;
      d += (i ? 'L' : 'M') + (x + Math.cos(a) * r).toFixed(1) + ',' + (y + Math.sin(a) * r).toFixed(1);
      d += 'L' + (x + Math.cos(b) * r * 0.45).toFixed(1) + ',' + (y + Math.sin(b) * r * 0.45).toFixed(1);
    }
    return '<path class="' + (cls || '') + '" d="' + d + 'Z"/>';
  }

  const BACK = {
    fairy: '<g class="aura a-fairy">' +
      '<path class="wl" d="M56,86 Q10,34 -2,76 Q-6,116 56,102 Z" fill="#8fdcff" opacity=".7"/>' +
      '<path class="wr" d="M64,86 Q110,34 122,76 Q126,116 64,102 Z" fill="#8fdcff" opacity=".7"/>' +
      '<path class="wl" d="M56,94 Q22,84 12,112 Q26,128 56,108 Z" fill="#d9f4ff" opacity=".6"/>' +
      '<path class="wr" d="M64,94 Q98,84 108,112 Q94,128 64,108 Z" fill="#d9f4ff" opacity=".6"/></g>',
    angel: '<g class="aura a-angel">' +
      '<path class="wl" d="M56,82 Q14,32 -4,68 Q-8,108 18,116 Q10,92 28,88 Q16,110 56,100 Z" fill="#ffffff" opacity=".95"/>' +
      '<path class="wr" d="M64,82 Q106,32 124,68 Q128,108 102,116 Q110,92 92,88 Q104,110 64,100 Z" fill="#ffffff" opacity=".95"/>' +
      '<path class="wl" d="M22,74 Q30,88 26,104 M36,66 Q42,84 38,100" stroke="#dfe6f5" stroke-width="2" fill="none"/>' +
      '<path class="wr" d="M98,74 Q90,88 94,104 M84,66 Q78,84 82,100" stroke="#dfe6f5" stroke-width="2" fill="none"/></g>',
    flame: '<g class="aura a-flame">' +
      '<path class="f1" d="M40,144 Q32,122 46,106 Q42,124 54,130 Q50,114 58,104 Q70,124 62,144 Z" fill="#ff8a3d"/>' +
      '<path class="f2" d="M62,144 Q58,126 72,112 Q70,128 80,132 Q76,120 82,114 Q90,130 84,144 Z" fill="#ffb03d" opacity=".9"/>' +
      '<path class="f1" d="M48,144 Q44,130 54,120 Q52,132 60,136 Q58,126 62,122 Q68,134 64,144 Z" fill="#ffe08a"/></g>',
    aqua: '<g class="aura a-aqua" fill="none" stroke="#3ee0c4" stroke-width="3">' +
      '<ellipse class="r1" cx="60" cy="140" rx="30" ry="8"/>' +
      '<ellipse class="r2" cx="60" cy="140" rx="30" ry="8"/>' +
      '<ellipse class="r3" cx="60" cy="140" rx="30" ry="8"/></g>',
    comet: '<g class="aura a-comet" stroke-linecap="round" fill="none">' +
      '<path class="c1" d="M48,96 Q6,100 -14,120" stroke="#ffc83d" stroke-width="13" opacity=".8"/>' +
      '<path class="c2" d="M50,116 Q10,124 -10,142" stroke="#ffe08a" stroke-width="10" opacity=".7"/>' +
      '<path class="c3" d="M46,132 Q14,142 -4,156" stroke="#ff9f3d" stroke-width="8" opacity=".6"/>' +
      '<circle class="c2" cx="18" cy="110" r="4" fill="#fff8e0" stroke="none" opacity=".9"/>' +
      '<circle class="c3" cx="6" cy="134" r="3" fill="#fff8e0" stroke="none" opacity=".8"/></g>',
    rainbow: '<g class="aura a-rainbow" fill="none" stroke-width="7" stroke-linecap="round">' +
      '<path d="M14,132 A48,48 0 0 1 106,132" stroke="#ff6b7a" opacity=".55"/>' +
      '<path d="M22,132 A40,40 0 0 1 98,132" stroke="#ffc83d" opacity=".55"/>' +
      '<path d="M30,132 A32,32 0 0 1 90,132" stroke="#3ee0c4" opacity=".55"/>' +
      '<path d="M38,132 A24,24 0 0 1 82,132" stroke="#8f7bff" opacity=".55"/></g>',
    moon: '<g class="aura a-moon">' +
      '<circle class="glow" cx="60" cy="76" r="54" fill="#cbbfff" opacity=".22"/>' +
      '<circle class="glow2" cx="60" cy="76" r="40" fill="#eae4ff" opacity=".18"/></g>',
    dragon: '<g class="aura a-dragon">' +
      '<path class="f1" d="M34,144 Q24,116 42,96 Q36,120 52,126 Q46,104 56,92 Q72,118 62,144 Z" fill="#7b3fd6" opacity=".85"/>' +
      '<path class="f2" d="M62,144 Q56,120 76,102 Q72,124 86,128 Q80,112 86,104 Q98,126 88,144 Z" fill="#c04ad6" opacity=".7"/>' +
      '<path class="f1" d="M50,144 Q46,126 58,114 Q56,130 66,134 Q62,120 68,116 Q76,132 70,144 Z" fill="#ff6bd6" opacity=".8"/></g>',
  };

  const FRONT = {
    sparkle: '<g class="aura a-sparkle" fill="#ffe08a">' +
      star(18, 44, 7, 's1') + star(102, 56, 6, 's2') + star(28, 108, 5.5, 's3') +
      star(96, 116, 6.5, 's1') + star(60, 12, 5, 's2') + star(12, 82, 4.5, 's3') + '</g>',
    thunder: '<g class="aura a-thunder" fill="#ffe94a">' +
      '<path class="t1" d="M12,42 L28,42 L18,62 L34,62 L6,98 L16,68 L2,68 Z"/>' +
      '<path class="t2" d="M108,54 L122,54 L113,72 L128,72 L100,106 L110,78 L96,78 Z"/>' +
      '<path class="t3" d="M58,-6 L72,-6 L64,10 L78,10 L52,40 L60,16 L46,16 Z"/></g>',
    angel: '<g class="aura a-angel"><ellipse class="halo" cx="60" cy="4" rx="24" ry="7" fill="none" stroke="#ffe08a" stroke-width="5"/></g>',
  };

  function svgFor(id) {
    return { back: BACK[id] || '', front: FRONT[id] || '' };
  }
  // ---------- 캔버스용 오라 ----------
  // 마을·던전에서는 캐릭터를 래스터 이미지로 그린다. 그러면 SVG 안의 CSS 애니메이션이
  // 죽어서 오라가 안 보인다. 그래서 캔버스에는 여기서 직접 그린다.
  // 좌표 원점은 캐릭터의 발밑, 몸은 위로 46 정도, 폭 34 기준.
  const TAU = Math.PI * 2;
  function glow(ctx, x, y, r, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, color.replace('ALPHA', alpha)); g.addColorStop(1, color.replace('ALPHA', 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function starPath(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * TAU / 5, b = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(b) * r * .45, y + Math.sin(b) * r * .45);
    }
    ctx.closePath(); ctx.fill();
  }
  // 발밑에서 피어오르는 불. 가운데가 높고 바깥으로 갈수록 낮아야 "발밑의 불"로 보인다.
  function flames(ctx, t, cols, spread, h) {
    for (let i = 0; i < 9; i++) {
      const f = i / 8 * 2 - 1;                          // -1 ~ 1
      const ph = t * 4.2 + i * 1.1;
      const x = f * spread + Math.sin(ph) * 1.6;
      const hh = h * (1 - Math.abs(f) * .55) * (.7 + Math.abs(Math.sin(ph * .9)) * .5);
      const w = 5.5 - Math.abs(f) * 2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(x - w, 2);
      ctx.quadraticCurveTo(x - w * .9, -hh * .5, x, -hh);
      ctx.quadraticCurveTo(x + w * .9, -hh * .5, x + w, 2);
      ctx.closePath(); ctx.fill();
    }
  }
  // 깃털이 갈라진 날개. 어깨에서 뻗어 나가 끝이 세 갈래로 나뉜다.
  function wing(ctx, side, t, fill, edge) {
    const flap = Math.sin(t * 3.2) * .2;
    ctx.save(); ctx.translate(0, -30); ctx.scale(side, 1); ctx.rotate(-flap);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.quadraticCurveTo(-20, -24, -40, -20);      // 앞선
    ctx.quadraticCurveTo(-32, -8, -36, 0);         // 깃 1
    ctx.quadraticCurveTo(-26, -3, -28, 8);         // 깃 2
    ctx.quadraticCurveTo(-18, 1, -17, 13);         // 깃 3
    ctx.quadraticCurveTo(-9, 3, 0, 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = edge;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-13, -14, -25, -12);
    ctx.quadraticCurveTo(-16, -3, -12, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  const FX_BACK = {
    aqua(ctx, t) {
      ctx.lineWidth = 2.5;
      for (let i = 0; i < 3; i++) {
        const k = ((t * .8 + i / 3) % 1);
        ctx.strokeStyle = `rgba(62,224,196,${(1 - k) * .8})`;
        ctx.beginPath(); ctx.ellipse(0, 0, 8 + k * 24, 3 + k * 9, 0, 0, TAU); ctx.stroke();
      }
      glow(ctx, 0, -6, 26, 'rgba(62,224,196,ALPHA)', .16);
    },
    flame(ctx, t) {
      glow(ctx, 0, -14, 34, 'rgba(255,138,61,ALPHA)', .3);
      flames(ctx, t, ['#ff8a3d', '#ffb03d', '#ffe08a'], 17, 24);
    },
    dragon(ctx, t) {
      glow(ctx, 0, -18, 40, 'rgba(192,74,214,ALPHA)', .34);
      flames(ctx, t, ['#7b3fd6', '#c04ad6', '#ff6bd6'], 19, 29);
      for (let i = 0; i < 5; i++) {
        const p = (t * .6 + i / 5) % 1, a = i * 2.1 + t * 1.4;
        ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ff9bec';
        ctx.beginPath(); ctx.arc(Math.cos(a) * 22, -12 - p * 44, 2.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    fairy(ctx, t) { wing(ctx, -1, t, 'rgba(143,220,255,.7)', 'rgba(217,244,255,.65)'); wing(ctx, 1, t, 'rgba(143,220,255,.7)', 'rgba(217,244,255,.65)'); },
    angel(ctx, t) {
      glow(ctx, 0, -26, 42, 'rgba(255,255,255,ALPHA)', .2);
      wing(ctx, -1, t, 'rgba(255,255,255,.95)', 'rgba(223,230,245,.9)');
      wing(ctx, 1, t, 'rgba(255,255,255,.95)', 'rgba(223,230,245,.9)');
    },
    rainbow(ctx, t) {
      const cols = ['#ff6b7a', '#ffc83d', '#3ee0c4', '#8f7bff'];
      ctx.lineWidth = 5; ctx.lineCap = 'round';
      cols.forEach((c, i) => {
        ctx.strokeStyle = c; ctx.globalAlpha = .5 + Math.sin(t * 2 + i) * .18;
        ctx.beginPath(); ctx.arc(0, -6, 34 - i * 6, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    },
    moon(ctx, t) {
      glow(ctx, 0, -24, 52, 'rgba(203,191,255,ALPHA)', .3);
      glow(ctx, 0, -24, 30, 'rgba(234,228,255,ALPHA)', .22);
      for (let i = 0; i < 7; i++) {
        const p = (t * .22 + i / 7) % 1, a = i * 1.9;
        ctx.globalAlpha = Math.sin(p * Math.PI) * .8; ctx.fillStyle = '#eae4ff';
        ctx.beginPath(); ctx.arc(Math.cos(a + t * .5) * 26, -8 - p * 46, 1.8, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    comet(ctx, t) {
      ctx.lineCap = 'round';
      [[13, '#ffc83d', .8, 0], [10, '#ffe08a', .7, 8], [8, '#ff9f3d', .6, 16]].forEach(([w, c, al, off], i) => {
        const wob = Math.sin(t * 4 + i) * 3;
        ctx.strokeStyle = c; ctx.globalAlpha = al; ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(-6, -26 + off);
        ctx.quadraticCurveTo(-26, -22 + off + wob, -44, -8 + off);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
      for (let i = 0; i < 4; i++) {
        const p = (t * 1.1 + i / 4) % 1;
        ctx.globalAlpha = 1 - p; ctx.fillStyle = '#fff8e0';
        ctx.beginPath(); ctx.arc(-10 - p * 40, -22 + Math.sin(i * 2 + t * 3) * 9, 2.4, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };

  const FX_FRONT = {
    sparkle(ctx, t) {
      for (let i = 0; i < 6; i++) {
        const a = t * 1.1 + i * TAU / 6;
        const x = Math.cos(a) * 24, y = -24 + Math.sin(a) * 20;
        const tw = .45 + Math.abs(Math.sin(t * 3 + i * 1.3)) * .55;
        ctx.globalAlpha = tw; ctx.fillStyle = '#ffe08a';
        starPath(ctx, x, y, 3 + tw * 2.6);
      }
      ctx.globalAlpha = 1;
    },
    thunder(ctx, t) {
      const flash = Math.sin(t * 5) > .55;
      ctx.strokeStyle = '#ffe94a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + i * 2.1, x = Math.cos(a) * 22, y = -26 + Math.sin(a * 1.4) * 18;
        ctx.globalAlpha = .5 + Math.sin(t * 9 + i) * .4;
        ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x - 2, y + 1); ctx.lineTo(x + 2, y + 8); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      if (flash) {
        ctx.fillStyle = '#ffe94a';
        ctx.beginPath();
        ctx.moveTo(-6, -58); ctx.lineTo(6, -58); ctx.lineTo(0, -46); ctx.lineTo(9, -46);
        ctx.lineTo(-8, -24); ctx.lineTo(-2, -42); ctx.lineTo(-11, -42);
        ctx.closePath(); ctx.fill();
        glow(ctx, 0, -42, 30, 'rgba(255,233,74,ALPHA)', .35);
      }
    },
    angel(ctx, t) {
      const bob = Math.sin(t * 2) * 1.6;
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.ellipse(0, -54 + bob, 13, 4, 0, 0, TAU); ctx.stroke();
      glow(ctx, 0, -54 + bob, 18, 'rgba(255,224,138,ALPHA)', .3);
    },
  };

  // layer: 'back'(캐릭터 뒤) | 'front'(앞)
  function paint(ctx, x, y, id, t, layer) {
    const f = (layer === 'front' ? FX_FRONT : FX_BACK)[id];
    if (!f) return;
    ctx.save(); ctx.translate(x, y); f(ctx, t); ctx.restore();
  }

  return { svgFor, paint };
})();

const Avatar = (() => {
  const SKINS = ['#ffd9b3', '#f0b98a', '#c98d5f'];
  const HAIRCOLORS = ['#2f2a2e', '#6b4226', '#d9a441', '#a5482e', '#4a6cd4', '#e06fa4'];
  const HAIRSTYLES = [
    { id: 'short', name: '짧은 머리' },
    { id: 'bob',   name: '단발' },
    { id: 'long',  name: '긴 머리' },
    { id: 'twin',  name: '양갈래' },
  ];
  function defaults() { return { skin: 0, hairStyle: 'short', hairColor: 1 }; }

  function backHairSvg(style, c) {
    if (style === 'bob') return `<path d="M25,50 A35,35 0 0 1 95,50 L95,70 Q95,80 85,80 L35,80 Q25,80 25,70 Z" fill="${c}"/>`;
    if (style === 'long') return `<path d="M25,50 A35,35 0 0 1 95,50 L97,105 Q88,112 82,104 L82,78 Q60,90 38,78 L38,104 Q32,112 23,105 Z" fill="${c}"/>`;
    if (style === 'twin') return `
      <path d="M25,50 A35,35 0 0 1 95,50 L95,60 L25,60 Z" fill="${c}"/>
      <ellipse cx="20" cy="80" rx="9" ry="20" fill="${c}" transform="rotate(10 20 80)"/>
      <ellipse cx="100" cy="80" rx="9" ry="20" fill="${c}" transform="rotate(-10 100 80)"/>
      <circle cx="23" cy="61" r="4.5" fill="#ff6b7a"/><circle cx="97" cy="61" r="4.5" fill="#ff6b7a"/>`;
    return '';
  }
  function bangsSvg(c) {
    return `<path d="M27,54 A33,33 0 0 1 93,54 Q88,42 78,45 Q72,34 60,36 Q48,34 42,45 Q32,42 27,54 Z" fill="${c}"/>`;
  }
  // ─────────────────────────────────────────────────────────────
  // 캐릭터 그리기 (2026-09-06 두 번째 개편)
  //
  // 첫 개편에서 2.4등신까지 갔지만 여전히 인형 같았다. 이유는 두 가지였다:
  //   ① 여전히 머리가 컸다. **갑옷을 그려 넣을 자리 자체가 없었다.**
  //   ② 부위가 안 나뉘어 있었다. 목도 장갑도 부츠도 없이 한 덩어리라
  //      아무리 무늬를 넣어도 무늬로만 보였다.
  //
  // 그래서 3등신으로 올리고 **부위를 층으로 나눴다**:
  //   머리 → 목 → 어깨·몸통 → 벨트 → 골반 → 다리 → 부츠
  // 층마다 빛(왼쪽 위)과 그늘(오른쪽 아래)을 주면, 같은 도형도 입체로 읽힌다.
  //
  // 좌표 약속 (viewBox 0 -10 120 155):
  //   머리 중심 (60,38) r20 · 목 54~64 · 어깨 66 · 허리 104
  //   벨트 101~110 · 골반 ~118 · 다리 114~136 · 부츠 128~143
  // SVG 상자는 그대로 두었다 — 마을·던전·러너·3D 가 이 크기를 기준으로 그린다.
  // ─────────────────────────────────────────────────────────────
  const SHADE = 'rgba(26,18,56,.13)';     // 그늘진 쪽
  const GLOSS = 'rgba(255,255,255,.17)';  // 빛 받는 쪽
  const LINE = '#443a6b';                 // 실루엣 윤곽 — 작게 그려도 형태가 남는다

  // 색 하나에서 밝은 면·그늘진 면을 뽑는다. 옷마다 세 색을 손으로 고르면
  // 언젠가 서로 안 맞는다 — 기준색 하나만 정하고 나머지는 계산한다.
  function tone(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = c => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)]
      .map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function hatSvg(hat) {
    if (hat === 'straw') return `
      <ellipse cx="60" cy="28" rx="30" ry="8" fill="#eac169"/>
      <ellipse cx="60" cy="26.5" rx="30" ry="8" fill="#f7d689"/>
      <path d="M38,28 Q60,2 82,28 Z" fill="#eac169"/>
      <path d="M40,26 Q52,6 60,4 Q54,10 48,27 Z" fill="#f7d689"/>
      <path d="M42,22 Q60,13 78,22 L78,27 L42,27 Z" fill="#c96f4a"/>
      <path d="M42,22 Q60,13 78,22 L78,24 Q60,15 42,24 Z" fill="#e08a63"/>`;
    if (hat === 'wizard') return `
      <path d="M42,26 Q56,-12 64,-4 Q74,4 78,26 Z" fill="#6c5ce7"/>
      <path d="M42,26 Q52,-4 60,-8 Q54,4 50,26 Z" fill="#8a7bf0"/>
      <ellipse cx="60" cy="26" rx="27" ry="7" fill="#5b48c9"/>
      <ellipse cx="60" cy="24.5" rx="27" ry="7" fill="#6c5ce7"/>
      <path d="M46,16 Q60,10 74,16 L74,20 Q60,14 46,20 Z" fill="#ffc83d"/>
      <circle cx="62" cy="1" r="4" fill="#ffc83d"/><circle cx="61" cy="0" r="1.6" fill="#fff8d8"/>`;
    if (hat === 'crown') return `
      <path d="M40,28 L44,10 L53,20 L60,6 L67,20 L76,10 L80,28 Z" fill="#e0a92c" transform="translate(1.5,1)"/>
      <path d="M40,28 L44,10 L53,20 L60,6 L67,20 L76,10 L80,28 Z" fill="#f5c33b" stroke="#c9971c" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M40,28 L44,10 L48,16 L46,28 Z" fill="#ffe08a"/>
      <rect x="40" y="24" width="40" height="5" rx="2.5" fill="#c9971c"/>
      <circle cx="60" cy="22" r="3.2" fill="#ff6b7a"/><circle cx="49" cy="24" r="2.6" fill="#4a6cd4"/><circle cx="71" cy="24" r="2.6" fill="#4a6cd4"/>`;
    return '';
  }

  // 무기. 손은 (84,100) 쯤에 있고, 무기는 거기서 위로 뻗는다.
  // 예전엔 여섯 단계가 전부 같은 사각형에 색만 달랐다 —
  // 이제 날 폭·길이, 코등이, 손잡이 끝, 보석이 단계마다 다르다.
  function weaponSvg(weapon) {
    if (!weapon || weapon === 'none') return '';
    if (weapon === 'stick') return `
      <path d="M86,112 L101,74" stroke="#5a3819" stroke-width="8" stroke-linecap="round"/>
      <path d="M86,112 L101,74" stroke="#8a5a2b" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M87,110 L100,76" stroke="#a3743f" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>
      <path d="M96,86 l4.5,1.6" stroke="#5a3819" stroke-width="2" stroke-linecap="round"/>
      <path d="M91,99 l4,1.4" stroke="#5a3819" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M100,76 q6,-4 4,-9" fill="none" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>`;

    const K = WEAPON_LOOK[weapon] || WEAPON_LOOK.silver;
    const edge = tone(K.blade, .14), dark = tone(K.blade, -.16);

    const hx = 85, hy = 109;                       // 손잡이 끝 (손이 여기 온다)
    const gx = 93, gy = 93;                        // 코등이
    const tipX = gx + (gx - hx) * (K.len / 19), tipY = gy - K.len;
    const nx = 2.1, ny = 0.95, w = K.w / 2;
    const blade = `M${gx - nx * w},${gy - ny * w} L${gx + nx * w},${gy + ny * w} `
      + `L${(tipX + nx * w * 0.14).toFixed(1)},${(tipY + ny * w * 0.14).toFixed(1)} `
      + `L${(tipX - nx * w * 0.6).toFixed(1)},${(tipY - ny * w * 0.6).toFixed(1)} Z`;

    const hot = weapon === 'dragon';
    const fire = (weapon === 'flame' || hot) ? `
      <path d="M${tipX},${tipY - 18} C${tipX + 11},${tipY - 6} ${tipX + 10},${tipY + 8} ${tipX},${tipY + 10}
        C${tipX - 10},${tipY + 8} ${tipX - 11},${tipY - 6} ${tipX},${tipY - 18} Z"
        fill="${hot ? '#7b3fd6' : '#ff6b2e'}" opacity=".92"/>
      <path d="M${tipX},${tipY - 10} C${tipX + 6},${tipY - 3} ${tipX + 5},${tipY + 5} ${tipX},${tipY + 7}
        C${tipX - 5},${tipY + 5} ${tipX - 6},${tipY - 3} ${tipX},${tipY - 10} Z"
        fill="${hot ? '#ff6bd6' : '#ffb03d'}"/>
      <ellipse cx="${tipX}" cy="${tipY + 1}" rx="2.4" ry="3.8" fill="${hot ? '#ffd8f6' : '#fff0c8'}"/>` : '';

    return `${fire}
      <path d="${blade}" fill="${LINE}" transform="translate(1.8,1.1)" opacity=".5"/>
      <path d="${blade}" fill="${dark}"/>
      <path d="M${gx - nx * w * .55},${gy - ny * w * .55} L${(tipX - nx * w * .35).toFixed(1)},${(tipY - ny * w * .35).toFixed(1)}"
        stroke="${K.blade}" stroke-width="${(K.w * .62).toFixed(1)}" stroke-linecap="round"/>
      <path d="M${gx - nx * w * .78},${gy - ny * w * .78} L${(tipX - nx * w * .5).toFixed(1)},${(tipY - ny * w * .5).toFixed(1)}"
        stroke="${edge}" stroke-width="${(K.w * .22).toFixed(1)}" stroke-linecap="round" opacity=".9"/>
      <path d="M${gx - 10},${gy - 5} L${gx + 10},${gy + 5}" stroke="${tone(K.guard, -.1)}" stroke-width="6" stroke-linecap="round"/>
      <path d="M${gx - 10},${gy - 6.5} L${gx + 8},${gy + 2}" stroke="${tone(K.guard, .16)}" stroke-width="2" stroke-linecap="round"/>
      <path d="M${hx},${hy} L${gx - 1},${gy + 2}" stroke="${K.grip}" stroke-width="6.5" stroke-linecap="round"/>
      <path d="M${hx + 1},${hy - 2} L${gx - 2},${gy + 1}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".2"/>
      <circle cx="${hx}" cy="${hy}" r="3.6" fill="${tone(K.guard, -.08)}"/>
      <circle cx="${hx - .8}" cy="${hy - 1}" r="1.4" fill="${tone(K.guard, .2)}"/>
      ${K.gem ? `<circle cx="${gx}" cy="${gy}" r="3.2" fill="${K.gem}"/>
      <circle cx="${gx - .9}" cy="${gy - 1}" r="1.2" fill="#fff" opacity=".75"/>` : ''}`;
  }

  // 코스튬. 기준색 하나에서 밝은 면·그늘을 뽑아 쓴다.
  // kind 로 실루엣이 갈린다: 튜닉 / 원피스 / 판금 / 로브 / 망토
  // 2D·3D 가 같은 표를 읽어야 두 마을의 옷 색이 같다
  const OUTFIT_LOOK = {
    tunic:  { base: '#3fae6a', belt: '#8a5a2b', trim: '#ffc83d', kind: 'tunic' },
    dress:  { base: '#ff8fab', belt: '#e0708f', trim: '#ffffff', kind: 'dress' },
    knight: { base: '#9aa5b1', belt: '#5f6a78', trim: '#f5c33b', kind: 'plate' },
    wizard: { base: '#7b5cd6', belt: '#5a3fa8', trim: '#ffc83d', kind: 'robe' },
    hero:   { base: '#e2574c', belt: '#8e2f24', trim: '#f5c33b', kind: 'cape' },
  };
  const WEAPON_LOOK = {
    stick:  { blade: '#8a5a2b', guard: '#5a3819', grip: '#6b4423', gem: '', w: 5,   len: 26 },
    bronze: { blade: '#d08a45', guard: '#8a5624', grip: '#6b4423', gem: '', w: 6,   len: 32 },
    silver: { blade: '#d4dbe4', guard: '#8e99a6', grip: '#5d3a1a', gem: '', w: 6.5, len: 37 },
    steel:  { blade: '#aab6c4', guard: '#4a5361', grip: '#3a2d1c', gem: '#3ee0c4', w: 8, len: 42 },
    flame:  { blade: '#ffb066', guard: '#8a3a12', grip: '#5d2a10', gem: '#ff6b3d', w: 8, len: 45 },
    dragon: { blade: '#ffd76b', guard: '#7b3fd6', grip: '#4a2a7a', gem: '#c04ad6', w: 9.5, len: 50 },
  };

  function outfitSvg(id, skin) {
    const O = OUTFIT_LOOK[id] || OUTFIT_LOOK.tunic;
    const lit = tone(O.base, .13), dim = tone(O.base, -.11), deep = tone(O.base, -.2);

    // 치마·로브 밑단 (부츠를 덮지 않는다 — 발이 안 보이면 걷는 게 안 보인다)
    const skirt = O.kind === 'dress' ? 'M40,102 L80,102 L88,124 Q60,131 32,124 Z'
      : O.kind === 'robe' ? 'M40,102 L80,102 L86,122 Q60,129 34,122 Z'
      : 'M40,102 L80,102 L82,117 Q60,122 38,117 Z';

    const cape = O.kind === 'cape' ? `
      <path d="M44,68 L18,132 Q42,124 60,129 Q78,124 102,132 L76,68 Z" fill="#7a2820"/>
      <path d="M44,68 L20,131 Q42,123 60,128 Q78,123 100,131 L76,68 Z" fill="#c0392b"/>
      <path d="M44,68 L28,116 Q38,112 46,114 L50,70 Z" fill="#d4574a"/>
      <path d="M60,70 L60,128" stroke="#9c2f22" stroke-width="1.6" opacity=".5"/>` : '';

    // 어깨 보호대는 팔 **위에** 얹어야 갑옷으로 보인다 (아래 arms 뒤에 그린다)
    const pauldron = O.kind === 'plate' ? `
      <path d="M30,80 Q39,64 51,71 L50,90 Q39,86 30,90 Z" fill="${tone(O.base, .1)}" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M90,80 Q81,64 69,71 L70,90 Q81,86 90,90 Z" fill="${tone(O.base, -.08)}" stroke="${LINE}" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M30,80 Q39,64 51,71 L50,75 Q39,69 32,84 Z" fill="${tone(O.base, .26)}"/>
      <path d="M30,87 Q39,83 50,87 L50,90 Q39,86 30,90 Z" fill="${deep}"/>
      <path d="M90,87 Q81,83 70,87 L70,90 Q81,86 90,90 Z" fill="${deep}"/>` : '';

    const arms = `
      <path d="M43,74 Q30,86 32,99" fill="none" stroke="${dim}" stroke-width="12" stroke-linecap="round"/>
      <path d="M77,74 Q90,86 88,99" fill="none" stroke="${deep}" stroke-width="12" stroke-linecap="round"/>
      <path d="M42,74 Q30,85 31,96" fill="none" stroke="${lit}" stroke-width="4" stroke-linecap="round" opacity=".55"/>
      <path d="M33,96 h1" stroke="${O.belt}" stroke-width="12" stroke-linecap="round"/>
      <path d="M87,96 h1" stroke="${O.belt}" stroke-width="12" stroke-linecap="round"/>
      <circle cx="32.5" cy="102" r="6.4" fill="${skin}"/>
      <circle cx="33.8" cy="103.4" r="6.4" fill="${SHADE}"/>
      <circle cx="87.5" cy="102" r="6.4" fill="${skin}"/>`;

    // 옷 종류별 앞면 장식
    const front =
      O.kind === 'plate' ? `
        <path d="M46,72 L74,72 L72,98 Q60,103 48,98 Z" fill="${tone(O.base, .22)}"/>
        <path d="M60,72 L60,100" stroke="${deep}" stroke-width="1.6"/>
        <path d="M46,72 L74,72 L73,78 L47,78 Z" fill="${tone(O.base, .34)}"/>
        <circle cx="50" cy="84" r="1.8" fill="${dim}"/><circle cx="70" cy="84" r="1.8" fill="${dim}"/>
        <circle cx="50" cy="93" r="1.8" fill="${dim}"/><circle cx="70" cy="93" r="1.8" fill="${dim}"/>`
      : O.kind === 'dress' ? `
        <path d="M50,66 Q60,74 70,66 Q66,80 60,83 Q54,80 50,66 Z" fill="#fff"/>
        <path d="M42,110 L45,124 M52,113 L53,127 M68,113 L67,127 M78,110 L75,124"
          stroke="${dim}" stroke-width="1.8" stroke-linecap="round" opacity=".65"/>`
      : O.kind === 'robe' ? `
        <path d="M52,66 Q60,72 68,66 L65,84 Q60,88 55,84 Z" fill="${deep}"/>
        <path d="M34,116 Q60,124 86,116 L87,122 Q60,130 33,122 Z" fill="${O.trim}"/>
        <path d="M52,86 l1.8,4.4 4.4,1.8 -4.4,1.8 -1.8,4.4 -1.8,-4.4 -4.4,-1.8 4.4,-1.8 Z" fill="#ffe08a"/>
        <path d="M70,100 l1.3,3.2 3.2,1.3 -3.2,1.3 -1.3,3.2 -1.3,-3.2 -3.2,-1.3 3.2,-1.3 Z" fill="#ffe08a"/>`
      : O.kind === 'cape' ? `
        <path d="M50,66 Q60,73 70,66 L67,80 Q60,84 53,80 Z" fill="${deep}"/>`
      : `
        <path d="M50,66 Q60,73 70,66 L67,78 Q60,82 53,78 Z" fill="${dim}"/>`;

    return `${cape}
      <path d="M41,67 Q60,60 79,67 Q82,80 79,92 Q80,99 80,105 Q60,111 40,105 Q40,99 41,92 Q38,80 41,67 Z" fill="${LINE}" transform="translate(2,1.6)" opacity=".45"/>
      <path d="M41,67 Q60,60 79,67 Q82,80 79,92 Q80,99 80,105 Q60,111 40,105 Q40,99 41,92 Q38,80 41,67 Z" fill="${O.base}"/>
      <path d="M43,68 Q60,62 60,63 L60,107 Q48,106 41,103 Q40,99 41,92 Q39,80 43,68 Z" fill="${lit}" opacity=".5"/>
      <path d="M70,66 Q80,80 79,92 Q80,99 80,105 Q72,108 67,107 L67,67 Z" fill="${deep}" opacity=".5"/>
      <path d="${skirt}" fill="${dim}"/>
      <path d="${skirt}" fill="${O.base}" transform="translate(0,-1.2)"/>
      ${front}
      <rect x="38" y="100" width="44" height="9" rx="3.5" fill="${tone(O.belt, -.08)}"/>
      <rect x="38" y="100" width="44" height="2.8" rx="1.4" fill="${tone(O.belt, .16)}"/>
      <rect x="55" y="99" width="10" height="11" rx="2.5" fill="${O.trim}"/>
      <rect x="57.4" y="101.6" width="5.2" height="5.8" rx="1.6" fill="${tone(O.trim, -.18)}"/>
      ${arms}
      ${pauldron}`;
  }

  // o: { headOnly, av, hat, weapon:false로 숨김 }
  function svg(av, o = {}) {
    const skin = SKINS[av.skin] || SKINS[0];
    const hairC = HAIRCOLORS[av.hairColor] || HAIRCOLORS[1];
    const hat = o.hat !== undefined ? o.hat : state.player.hat;
    const skinD = tone(skin, -.09), skinL = tone(skin, .07);
    // 머리는 예전 좌표(중심 60,52 · r32)로 그려 두고 통째로 줄인다 —
    // 머리카락 네 종류의 path 를 안 건드려도 된다.
    const head = `
      <g transform="translate(60,38) scale(.63) translate(-60,-52)">
        ${backHairSvg(av.hairStyle, hairC)}
        <circle cx="27" cy="54" r="6.5" fill="${skinD}"/><circle cx="93" cy="54" r="6.5" fill="${skinD}"/>
        <circle cx="27.5" cy="53" r="5" fill="${skin}"/><circle cx="92.5" cy="53" r="5" fill="${skin}"/>
        <circle cx="63" cy="55" r="32" fill="${skinD}"/>
        <circle cx="60" cy="52" r="32" fill="${skin}"/>
        <ellipse cx="46" cy="33" rx="16" ry="8" fill="${skinL}" transform="rotate(-24 46 33)"/>
        <path d="M42,51 Q48,46 54,51" fill="none" stroke="#4a3f2f" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
        <path d="M66,51 Q72,46 78,51" fill="none" stroke="#4a3f2f" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>
        <ellipse cx="48" cy="59" rx="4.8" ry="5.4" fill="#fff"/>
        <ellipse cx="72" cy="59" rx="4.8" ry="5.4" fill="#fff"/>
        <circle cx="48.6" cy="59.4" r="3.7" fill="#3a4a8f"/><circle cx="48.6" cy="59.4" r="2" fill="#1e2350"/>
        <circle cx="50.2" cy="57.4" r="1.7" fill="#fff"/>
        <circle cx="72.6" cy="59.4" r="3.7" fill="#3a4a8f"/><circle cx="72.6" cy="59.4" r="2" fill="#1e2350"/>
        <circle cx="74.2" cy="57.4" r="1.7" fill="#fff"/>
        <ellipse cx="40" cy="68" rx="5.4" ry="3.2" fill="#ff9aa8" opacity=".45"/>
        <ellipse cx="80" cy="68" rx="5.4" ry="3.2" fill="#ff9aa8" opacity=".45"/>
        <path d="M53,70 Q60,77.5 67,70" fill="none" stroke="#a84a36" stroke-width="2.8" stroke-linecap="round"/>
        <path d="M56,73 Q60,76 64,73 Q60,78 56,73 Z" fill="#d9607a"/>
        ${bangsSvg(hairC)}
        ${hatSvg(hat)}
      </g>`;
    if (o.headOnly) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="26 4 68 68">${head}</svg>`;
    }
    const outfit = (o.av && o.avOutfit) || state.player.outfit || 'tunic';
    // walk: 걷기 주기 0~1. **한 발씩 번갈아 든다.**
    const ph = o.walk ? Math.sin(o.walk * Math.PI * 2) : 0;
    const lN = Math.max(0, ph), rN = Math.max(0, -ph);
    const lUp = lN * 5, rUp = rN * 5, lOut = lN * 2.5, rOut = rN * 2.5;
    const N = v => v.toFixed(1);
    // 다리 + 부츠. 부츠는 목·밑창·광택 세 겹이라야 신발로 보인다.
    const PANTS = '#6b6494', PANTS_D = '#514a78';
    const legBoot = (x, up, out, dim) => `
      <rect x="${N(x - out)}" y="113" width="10" height="${N(21 - up)}" rx="4" fill="${dim ? PANTS_D : PANTS}"/>
      <rect x="${N(x - out + 6)}" y="113" width="4" height="${N(21 - up)}" rx="2" fill="${SHADE}"/>
      <path d="M${N(x - out - 2)},${N(128 - up)} h14 v${N(9.5)} q0,4 -4,4 h-9 q-4,0 -4,-4 Z" fill="#332e5c"/>
      <path d="M${N(x - out - 2.6)},${N(127 - up)} h15.2 v4.6 q0,1.4 -2,1.4 h-11.2 q-2,0 -2,-1.4 Z" fill="#c9a06a"/>
      <path d="M${N(x - out - 2.6)},${N(127 - up)} h15.2 v1.8 h-15.2 Z" fill="#e3bd8c"/>
      <path d="M${N(x - out - 2.6)},${N(138 - up)} h15.2 v${N(3.6)} q0,1.6 -2,1.6 h-11.2 q-2,0 -2,-1.6 Z" fill="#221d44"/>
      <path d="M${N(x - out - 0.6)},${N(133.4 - up)} h4.6 v2 h-4.6 Z" fill="#fff" opacity=".18"/>`;
    const body = `
      ${legBoot(46, lUp, lOut, false)}${legBoot(64, rUp, -rOut, true)}
      <path d="M53,48 h14 v16 q-7,5 -14,0 Z" fill="${skin}"/>
      <path d="M53,48 h14 v7 q-7,4 -14,0 Z" fill="${skinD}"/>
      ${outfitSvg(o.outfit || outfit, skin)}`;
    const wid = o.weaponId || state.player.weapon;
    const weapon = o.weapon === false || !wid || wid === 'none' ? ''
      : `${weaponSvg(wid)}`
        // 무기를 그린 뒤 손을 다시 얹는다. 안 그러면 손이 칼자루에 덮여 '쥔' 것으로 안 보인다.
        + `<circle cx="88.6" cy="103.4" r="6.4" fill="${SHADE}"/><circle cx="87.5" cy="102" r="6.4" fill="${skin}"/>`;
    const auraId = o.aura !== undefined ? o.aura : (state.player.aura || 'none');
    const au = Aura.svgFor(auraId);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 120 155">${au.back}${body}${head}${weapon}${au.front}</svg>`;
  }

  function html(size, o = {}) {
    const av = o.av || state.player.avatar || defaults();
    if (o.headOnly) return `<span class="char mini">${svg(av, o)}</span>`;
    const petId = o.pet !== undefined ? o.pet : state.player.pet;
    const h = Math.round(size * 1.3);
    const petHtml = petId && PETS[petId] && typeof Art !== 'undefined'
      ? `<span class="char-pet" style="width:${Math.round(size * .5)}px;height:${Math.round(size * .5)}px">${Art.pet(petId)}</span>` : '';
    return `<span class="char" style="width:${size}px;height:${h}px">${svg(av, o)}${petHtml}</span>`;
  }

  // 러너용: SVG를 이미지로 (로딩 전엔 ready=false)
  function image(o) {
    // av 를 넘기면 그 사람을 그린다. 안 넘기면 나. 마을 사람들이 이걸 쓴다
    const av = (o && o.av) || state.player.avatar || defaults();
    const img = new Image();
    const box = { img, ready: false };
    img.onload = () => { box.ready = true; };
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(av, o || {}).replace('<svg ', '<svg width="120" height="165" '));
    return box;
  }
  // 걷기 네 장. 두 장을 번갈아 켜면 걷는 게 아니라 깜빡인다.
  const WALK_PHASES = [0, .25, .5, .75];
  function walkFrames(o) {
    return WALK_PHASES.map(ph => image(Object.assign({ walk: ph }, o || {})));
  }

  return { SKINS, HAIRCOLORS, HAIRSTYLES, OUTFIT_LOOK, WEAPON_LOOK, tone, defaults, svg, html, image, walkFrames };
})();
