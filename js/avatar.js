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
  function hatSvg(hat) {
    if (hat === 'straw') return `
      <ellipse cx="60" cy="28" rx="30" ry="8" fill="#eac169"/>
      <path d="M38,28 Q60,2 82,28 Z" fill="#eac169"/>
      <path d="M42,22 Q60,13 78,22 L78,28 L42,28 Z" fill="#c96f4a"/>`;
    if (hat === 'wizard') return `
      <path d="M42,26 Q56,-12 64,-4 Q74,4 78,26 Z" fill="#6c5ce7"/>
      <ellipse cx="60" cy="26" rx="27" ry="7" fill="#5b48c9"/>
      <circle cx="62" cy="1" r="3.5" fill="#ffc83d"/>`;
    if (hat === 'crown') return `
      <path d="M40,28 L44,10 L53,20 L60,6 L67,20 L76,10 L80,28 Z" fill="#f5c33b" stroke="#c9971c" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="60" cy="22" r="3" fill="#ff6b7a"/><circle cx="49" cy="24" r="2.5" fill="#4a6cd4"/><circle cx="71" cy="24" r="2.5" fill="#4a6cd4"/>`;
    return '';
  }
  // 무기 여섯 단계. 예전엔 전부 같은 사각형 날에 색만 달랐다 —
  // 2000골드짜리 강철검과 200골드짜리 청동검이 구분이 안 됐다.
  // 이제 **모양이 달라진다**: 날 폭, 코등이(guard), 손잡이 끝(pommel), 장식.
  // 손은 (85,115) 쯤에 있고, 무기는 그 손에서 위로 뻗는다.
  function weaponSvg(weapon) {
    if (!weapon || weapon === 'none') return '';
    // 나무막대 — 옹이와 껍질까지 있어야 '주워 온 막대기'로 보인다
    if (weapon === 'stick') return `
      <path d="M83,120 L97,84" stroke="#6b4423" stroke-width="7.5" stroke-linecap="round"/>
      <path d="M83,120 L97,84" stroke="#8a5a2b" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M92,96 l4,1.5" stroke="#6b4423" stroke-width="2" stroke-linecap="round"/>
      <path d="M87,108 l3.5,1.2" stroke="#6b4423" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M96,86 q5,-4 3,-8" fill="none" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>`;

    const K = {
      bronze: { blade: '#d08a45', edge: '#f0bd82', dark: '#8a5624', guard: '#8a5624', grip: '#6b4423', gem: '', w: 5.5, len: 34 },
      silver: { blade: '#d4dbe4', edge: '#ffffff', dark: '#8e99a6', guard: '#8e99a6', grip: '#5d3a1a', gem: '', w: 6, len: 38 },
      steel:  { blade: '#aab6c4', edge: '#eef3f8', dark: '#6b7684', guard: '#4a5361', grip: '#3a2d1c', gem: '#3ee0c4', w: 7.5, len: 42 },
      flame:  { blade: '#ffb066', edge: '#fff0c8', dark: '#c9601c', guard: '#8a3a12', grip: '#5d2a10', gem: '#ff6b3d', w: 7.5, len: 44 },
      dragon: { blade: '#ffd76b', edge: '#fff8d8', dark: '#c9971c', guard: '#7b3fd6', grip: '#4a2a7a', gem: '#c04ad6', w: 9, len: 48 },
    }[weapon] || { blade: '#cdd6e0', edge: '#fff', dark: '#8e99a6', guard: '#8e99a6', grip: '#5d3a1a', gem: '', w: 6, len: 36 };

    // 손잡이 밑 → 코등이 → 날끝. 기울기는 예전과 같게 두어 손에서 안 벗어난다.
    const hx = 82, hy = 121;                       // 손잡이 끝(아래)
    const gx = 90, gy = 103;                       // 코등이
    const tipX = gx + (gx - hx) * (K.len / 20), tipY = gy - K.len;   // 날끝
    const nx = 2.1, ny = 0.95;                     // 날 폭 방향(기울기에 수직)
    const w = K.w / 2;
    const blade = `M${gx - nx * w},${gy - ny * w} L${gx + nx * w},${gy + ny * w} `
      + `L${tipX + nx * w * 0.15},${tipY + ny * w * 0.15} L${tipX - nx * w * 0.6},${tipY - ny * w * 0.6} Z`;

    // 불꽃검·용의검은 날에 불이 붙는다
    const hot = weapon === 'dragon';
    const fire = (weapon === 'flame' || hot) ? `
      <path d="M${tipX},${tipY - 17} C${tipX + 10},${tipY - 6} ${tipX + 9},${tipY + 7} ${tipX},${tipY + 9}
        C${tipX - 9},${tipY + 7} ${tipX - 10},${tipY - 6} ${tipX},${tipY - 17} Z"
        fill="${hot ? '#7b3fd6' : '#ff6b2e'}" opacity=".92"/>
      <path d="M${tipX},${tipY - 10} C${tipX + 6},${tipY - 3} ${tipX + 5},${tipY + 4} ${tipX},${tipY + 6}
        C${tipX - 5},${tipY + 4} ${tipX - 6},${tipY - 3} ${tipX},${tipY - 10} Z"
        fill="${hot ? '#ff6bd6' : '#ffb03d'}"/>
      <ellipse cx="${tipX}" cy="${tipY + 1}" rx="2.4" ry="3.6" fill="${hot ? '#ffd8f6' : '#fff0c8'}"/>` : '';

    return `${fire}
      <path d="${blade}" fill="${K.dark}" transform="translate(1.6,1)"/>
      <path d="${blade}" fill="${K.blade}"/>
      <path d="M${gx - nx * w * 0.45},${gy - ny * w * 0.45} L${tipX - nx * w * 0.3},${tipY - ny * w * 0.3}"
        stroke="${K.edge}" stroke-width="${(K.w * 0.28).toFixed(1)}" stroke-linecap="round" opacity=".85"/>
      <path d="M${gx - 9},${gy - 4.5} L${gx + 9},${gy + 4.5}" stroke="${K.guard}" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M${gx - 9},${gy - 6} L${gx + 9},${gy + 3}" stroke="${K.edge}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
      <path d="M${hx},${hy} L${gx - 1},${gy + 2}" stroke="${K.grip}" stroke-width="6" stroke-linecap="round"/>
      <path d="M${hx + 1},${hy - 2} L${gx - 2},${gy + 1}" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" opacity=".22"/>
      <circle cx="${hx}" cy="${hy}" r="3.4" fill="${K.guard}"/>
      ${K.gem ? `<circle cx="${gx}" cy="${gy}" r="3" fill="${K.gem}"/>
      <circle cx="${gx - 0.8}" cy="${gy - 0.9}" r="1.1" fill="#fff" opacity=".7"/>` : ''}`;
  }
  // 코스튬 다섯 벌. 예전엔 전부 같은 사다리꼴에 색만 달랐고, 기사 갑옷도 천처럼 보였다.
  // 이제 옷마다 **실루엣이 다르다** — 어깨 보호대, 치마 주름, 로브 밑단, 망토.
  // 음영은 캐릭터와 같은 규칙: 빛은 왼쪽 위, 그늘은 오른쪽 아래.
  function outfitSvg(outfit, skin) {
    // 팔은 몸통 **바깥**으로 나와야 보인다. 안쪽에 붙이면 옷에 묻혀 손만 남는다.
    const arms = (sleeve) => `
      <path d="M45,88 Q32,99 34,113" fill="none" stroke="${sleeve}" stroke-width="11.5" stroke-linecap="round"/>
      <path d="M75,88 Q88,99 86,113" fill="none" stroke="${sleeve}" stroke-width="11.5" stroke-linecap="round"/>
      <path d="M75,90 Q88,100 86,113" fill="none" stroke="${SHADE}" stroke-width="11.5" stroke-linecap="round"/>
      <circle cx="34.5" cy="115" r="6.2" fill="${skin}"/><circle cx="85.5" cy="115" r="6.2" fill="${skin}"/>
      <circle cx="36" cy="116.5" r="6.2" fill="${SHADE}"/>`;
    // 몸통 한 벌: 뒤에 그림자를 깔고, 위쪽에 빛을 얹는다
    const torso = (d, fill) => `
      <path d="${d}" fill="${SHADE}" transform="translate(2.5,2)"/>
      <path d="${d}" fill="${fill}"/>
      <path d="M46,86 Q60,80 74,86 L72,96 Q60,91 48,96 Z" fill="${GLOSS}"/>`;
    const BODY = 'M44,84 Q60,78 76,84 L82,122 Q60,130 38,122 Z';

    if (outfit === 'dress') return `
      ${torso('M44,84 Q60,78 76,84 L88,124 Q60,133 32,124 Z', '#ff8fab')}
      <path d="M39,112 L43,127 M50,116 L51,130 M62,116 L61,130 M75,112 L71,127"
        stroke="#e0708f" stroke-width="2" stroke-linecap="round" opacity=".7"/>
      <path d="M50,84 Q60,92 70,84 Q66,96 60,98 Q54,96 50,84 Z" fill="#fff"/>
      <path d="M42,108 Q60,114 78,108 L78,113 Q60,119 42,113 Z" fill="#e0708f"/>
      <circle cx="60" cy="111" r="4.2" fill="#fff"/><circle cx="60" cy="111" r="2" fill="#ff6b8a"/>
      ${arms('#ff8fab')}`;

    if (outfit === 'knight') return `
      ${torso('M44,84 Q60,78 76,84 L83,120 Q60,128 37,120 Z', '#9aa5b1')}
      <path d="M48,90 L72,90 L70,110 Q60,114 50,110 Z" fill="#c3cdd8"/>
      <path d="M60,90 L60,112" stroke="#7e8996" stroke-width="1.6"/>
      <path d="M48,90 L72,90 L71,95 L49,95 Z" fill="#e4ebf1"/>
      <circle cx="52" cy="99" r="1.7" fill="#7e8996"/><circle cx="68" cy="99" r="1.7" fill="#7e8996"/>
      <rect x="38" y="112" width="44" height="8" rx="3" fill="#5f6a78"/>
      <rect x="38" y="112" width="44" height="2.6" rx="1.3" fill="#8c97a5"/>
      <circle cx="60" cy="116" r="4.4" fill="#f5c33b"/><circle cx="60" cy="116" r="2" fill="#c9971c"/>
      ${arms('#8f9aa8')}
      <path d="M36,90 Q46,78 56,86 L54,99 Q44,95 36,99 Z" fill="#b8c2cc"/>
      <path d="M84,90 Q74,78 64,86 L66,99 Q76,95 84,99 Z" fill="#8794a3"/>
      <path d="M36,90 Q46,78 56,86 L55,90 Q45,83 37,93 Z" fill="#eef3f8"/>
      <path d="M36,97 Q45,93 54,97 L54,99 Q45,95 36,99 Z" fill="#6b7684"/>
      <path d="M84,97 Q75,93 66,97 L66,99 Q75,95 84,99 Z" fill="#5f6a78"/>`;

    if (outfit === 'wizard') return `
      ${torso('M44,84 Q60,78 76,84 L87,126 Q60,135 33,126 Z', '#7b5cd6')}
      <path d="M33,120 Q60,129 87,120 L88,127 Q60,136 32,127 Z" fill="#ffc83d"/>
      <path d="M50,84 Q60,90 70,84 L67,100 Q60,104 53,100 Z" fill="#6a4ec4"/>
      <path d="M40,110 L44,128 M60,112 L60,132 M80,110 L76,128"
        stroke="#6a4ec4" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <path d="M52,96 l1.6,4 4,1.6 -4,1.6 -1.6,4 -1.6,-4 -4,-1.6 4,-1.6 Z" fill="#ffe08a"/>
      <path d="M70,110 l1.2,3 3,1.2 -3,1.2 -1.2,3 -1.2,-3 -3,-1.2 3,-1.2 Z" fill="#ffe08a"/>
      <circle cx="60" cy="90" r="3" fill="#ffc83d"/>
      ${arms('#6a4ec4')}`;

    if (outfit === 'hero') return `
      <path d="M46,84 L18,134 Q42,127 60,132 Q78,127 102,134 L74,84 Z" fill="#8e2f24"/>
      <path d="M46,84 L20,133 Q42,126 60,131 Q78,126 100,133 L74,84 Z" fill="#c0392b"/>
      <path d="M46,84 L30,118 Q40,114 48,116 L52,86 Z" fill="#d4574a" opacity=".65"/>
      ${torso(BODY, '#e2574c')}
      <path d="M50,84 Q60,90 70,84 L68,96 Q60,100 52,96 Z" fill="#b8402f"/>
      <rect x="38" y="110" width="44" height="8" rx="3" fill="#8e2f24"/>
      <circle cx="60" cy="114" r="4.4" fill="#f5c33b"/><circle cx="60" cy="114" r="2" fill="#c9971c"/>
      ${arms('#e2574c')}
      <circle cx="45" cy="87" r="4.2" fill="#f5c33b"/><circle cx="45" cy="87" r="1.8" fill="#c9971c"/>
      <circle cx="75" cy="87" r="4.2" fill="#e0a92c"/><circle cx="75" cy="87" r="1.8" fill="#a87c10"/>`;

    return `
      ${torso(BODY, '#3fae6a')}
      <path d="M50,84 Q60,90 70,84 L68,94 Q60,98 52,94 Z" fill="#2f8b53"/>
      <rect x="38" y="108" width="44" height="8" rx="3" fill="#2f8b53"/>
      <rect x="38" y="108" width="44" height="2.4" rx="1.2" fill="#66c98d"/>
      <circle cx="60" cy="112" r="3.6" fill="#c98a2f"/>
      ${arms('#3fae6a')}`;
  }

  // o: { headOnly, av, hat, weapon:false로 숨김 }
  //
  // 디자인 규칙 (2026-09-06 개편) — "너무 장난감 같다"를 고치면서 정한 것:
  //   ① 비율. 머리가 키의 절반이면 인형이다. 머리를 줄이고 다리를 늘려 2.3등신쯤으로.
  //      단 **SVG 상자(120×155)는 안 건드린다** — 마을·던전·러너·3D 가 이 크기를
  //      기준으로 그리고 있어서, 상자를 바꾸면 여섯 군데를 같이 고쳐야 한다.
  //      대신 상자 안에서 머리를 축소하고 다리를 늘린다.
  //   ② 음영. 빛은 **왼쪽 위**에서 온다 (마을·배틀과 같은 방향).
  //      같은 도형을 조금 밀어 뒤에 깔면 테두리 그림자가 되고, 위쪽에 흰 타원을
  //      얹으면 광택이 된다. 그라데이션(<defs>)은 안 쓴다 —
  //      한 화면에 아바타가 여럿일 때 id 가 충돌한다.
  const SHADE = 'rgba(26,18,56,.13)';     // 그늘진 쪽
  const GLOSS = 'rgba(255,255,255,.17)';  // 빛 받는 쪽

  function svg(av, o = {}) {
    const skin = SKINS[av.skin] || SKINS[0];
    const hairC = HAIRCOLORS[av.hairColor] || HAIRCOLORS[1];
    const hat = o.hat !== undefined ? o.hat : state.player.hat;
    // 머리를 통째로 줄여 위로 올린다. 안쪽 좌표(머리카락·모자 path)는 그대로 둘 수 있다.
    const head = `
      <g transform="translate(60,48.5) scale(.85) translate(-60,-52)">
        ${backHairSvg(av.hairStyle, hairC)}
        <circle cx="27" cy="54" r="6" fill="${skin}"/><circle cx="93" cy="54" r="6" fill="${skin}"/>
        <circle cx="62.5" cy="54.5" r="32" fill="${SHADE}"/>
        <circle cx="60" cy="52" r="32" fill="${skin}"/>
        <ellipse cx="47" cy="34" rx="15" ry="7.5" fill="${GLOSS}" transform="rotate(-24 47 34)"/>
        <path d="M43,52 Q48,48 53,52" fill="none" stroke="#2a2450" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>
        <path d="M67,52 Q72,48 77,52" fill="none" stroke="#2a2450" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>
        <circle cx="48" cy="59" r="4.2" fill="#2a2450"/>
        <circle cx="49.8" cy="57.2" r="1.7" fill="#fff"/><circle cx="46.6" cy="60.6" r=".9" fill="#fff" opacity=".6"/>
        <circle cx="72" cy="59" r="4.2" fill="#2a2450"/>
        <circle cx="73.8" cy="57.2" r="1.7" fill="#fff"/><circle cx="70.6" cy="60.6" r=".9" fill="#fff" opacity=".6"/>
        <ellipse cx="41" cy="68" rx="5" ry="3" fill="#ff9aa8" opacity=".5"/><ellipse cx="79" cy="68" rx="5" ry="3" fill="#ff9aa8" opacity=".5"/>
        <path d="M54,70 Q60,76.5 66,70" fill="none" stroke="#b3563f" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M56,72.5 Q60,75 64,72.5" fill="#e8859a" opacity=".7"/>
        ${bangsSvg(hairC)}
        ${hatSvg(hat)}
      </g>`;
    if (o.headOnly) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="20 4 80 80">${head}</svg>`;
    }
    const outfit = (o.av && o.avOutfit) || state.player.outfit || 'tunic';
    // walk: 걷기 주기 0~1. **한 발씩 번갈아 든다.**
    // 두 다리를 좌우로 벌렸다 모으면, 모으는 자세에서 다리가 겹쳐 이상해진다.
    // 정면을 보는 캐릭터는 '한 발이 들리고 한 발은 딛는다'로 그려야 걷는 것처럼 보인다.
    const ph = o.walk ? Math.sin(o.walk * Math.PI * 2) : 0;
    const lN = Math.max(0, ph), rN = Math.max(0, -ph);  // 0~1 들린 정도
    const lUp = lN * 4.5, rUp = rN * 4.5;               // 든 발은 위로
    const lOut = lN * 2.5, rOut = rN * 2.5;             // 그리고 살짝 바깥으로 내딛는다
    const N = v => v.toFixed(1);
    // 다리는 길어졌다 (머리를 줄인 만큼 키가 늘어야 인형이 아니다)
    const leg = (x, up, out, sign) => `
      <rect x="${N(x + 1.2 * sign - out)}" y="112" width="9" height="${N(26 - up)}" rx="4.5" fill="${SHADE}"/>
      <rect x="${N(x - out)}" y="112" width="9" height="${N(26 - up)}" rx="4.5" fill="${skin}"/>`;
    const shoe = (x, up, out) => `
      <rect x="${N(x - out + 1)}" y="${N(135 - up)}" width="14" height="9" rx="4.5" fill="#332e5c"/>
      <rect x="${N(x - out)}" y="${N(134 - up)}" width="14" height="9" rx="4.5" fill="#4a4380"/>
      <rect x="${N(x - out + 2)}" y="${N(135.5 - up)}" width="9" height="2.4" rx="1.2" fill="#fff" opacity=".22"/>`;
    const body = `
      ${leg(49, lUp, lOut, 1)}${leg(62, rUp, -rOut, 1)}
      ${shoe(46, lUp, lOut)}${shoe(60, rUp, -rOut)}
      <g transform="translate(0,-7) translate(60,84) scale(1.16,1.07) translate(-60,-84)">${outfitSvg(o.outfit || outfit, skin)}</g>`;
    const wid = o.weaponId || state.player.weapon;
    const weapon = o.weapon === false || !wid || wid === 'none' ? ''
      : `<g transform="translate(3.5,-5)">${weaponSvg(wid)}</g>`
        // 무기를 그린 뒤 손을 다시 얹는다. 안 그러면 손이 칼자루에 덮여 '쥔' 것으로 안 보인다.
        + `<circle cx="91" cy="112" r="6.6" fill="${SHADE}"/><circle cx="89.6" cy="110.5" r="6.6" fill="${skin}"/>`;
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
    const av = state.player.avatar || defaults();
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

  return { SKINS, HAIRCOLORS, HAIRSTYLES, defaults, svg, html, image, walkFrames };
})();
