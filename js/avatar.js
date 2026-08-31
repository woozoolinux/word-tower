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
// 단원 세트를 완성해야만 얻는다 (골드로 못 삼).
const AURAS = {
  none:    { name: '없음',        emoji: '⬜' },
  sparkle: { name: '반짝이 오라', emoji: '✨' },
  fairy:   { name: '요정 날개',   emoji: '🦋' },
  comet:   { name: '유성 자국',   emoji: '💫' },
  flame:   { name: '불꽃 오라',   emoji: '🔥' },
  aqua:    { name: '물결 오라',   emoji: '🌊' },
  rainbow: { name: '무지개 오라', emoji: '🌈' },
  angel:   { name: '천사 날개',   emoji: '🪽' },
  thunder: { name: '번개 오라',   emoji: '⚡' },
  moon:    { name: '달빛 오라',   emoji: '🌙' },
  dragon:  { name: '용의 오라',   emoji: '🐉' },
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
  return { svgFor };
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
  function weaponSvg(weapon) {
    if (!weapon || weapon === 'none') return '';
    if (weapon === 'stick') return `<line x1="84" y1="118" x2="98" y2="86" stroke="#8a5a2b" stroke-width="6" stroke-linecap="round"/>`;
    const blade = weapon === 'bronze' ? '#c9803a' : weapon === 'dragon' ? '#ffd76b' : '#cdd6e0';
    const flame = (weapon === 'flame' || weapon === 'dragon') ? `
      <path d="M100,72 Q108,62 104,52 Q112,60 110,70 Q116,68 114,78 Q108,88 98,84 Q94,78 100,72 Z" fill="#ff8a3d"/>
      <circle cx="104" cy="72" r="5" fill="#ffc83d"/>` : '';
    return `${flame}
      <path d="M87,106 L99,74 L105,78 L93,110 Z" fill="${blade}" stroke="#5d6570" stroke-width="1"/>
      <line x1="84" y1="103" x2="97" y2="99" stroke="#8a5a2b" stroke-width="5" stroke-linecap="round"/>
      <line x1="82" y1="114" x2="87" y2="106" stroke="#5d3a1a" stroke-width="5" stroke-linecap="round"/>`;
  }
  function outfitSvg(outfit, skin) {
    const arms = (sleeve) => `
      <path d="M46,90 Q36,100 38,112" fill="none" stroke="${sleeve}" stroke-width="9" stroke-linecap="round"/>
      <path d="M74,90 Q84,100 82,112" fill="none" stroke="${sleeve}" stroke-width="9" stroke-linecap="round"/>
      <circle cx="38" cy="113" r="5.5" fill="${skin}"/><circle cx="82" cy="113" r="5.5" fill="${skin}"/>`;
    if (outfit === 'dress') return `
      <path d="M44,84 Q60,78 76,84 L88,128 Q60,138 32,128 Z" fill="#ff8fab"/>
      <path d="M50,86 Q60,92 70,86 L68,94 Q60,98 52,94 Z" fill="#fff"/>
      ${arms('#ff8fab')}`;
    if (outfit === 'knight') return `
      <path d="M44,84 Q60,78 76,84 L82,122 Q60,130 38,122 Z" fill="#9aa5b1"/>
      <path d="M48,88 L72,88 L70,104 L50,104 Z" fill="#b8c2cc"/>
      <rect x="40" y="106" width="40" height="7" rx="3" fill="#6b7684"/>
      <circle cx="60" cy="109" r="4" fill="#f5c33b"/>
      ${arms('#8f9aa8')}`;
    if (outfit === 'wizard') return `
      <path d="M44,84 Q60,78 76,84 L86,128 Q60,136 34,128 Z" fill="#7b5cd6"/>
      <circle cx="52" cy="102" r="2.5" fill="#ffc83d"/><circle cx="68" cy="112" r="2" fill="#ffc83d"/><circle cx="60" cy="94" r="1.8" fill="#ffc83d"/>
      ${arms('#6a4ec4')}`;
    if (outfit === 'hero') return `
      <path d="M46,84 L22,132 Q42,127 60,131 Q78,127 98,132 L74,84 Z" fill="#c0392b"/>
      <path d="M44,84 Q60,78 76,84 L82,122 Q60,130 38,122 Z" fill="#e2574c"/>
      <rect x="40" y="106" width="40" height="7" rx="3" fill="#8e2f24"/>
      ${arms('#e2574c')}`;
    return `
      <path d="M44,84 Q60,78 76,84 L82,122 Q60,130 38,122 Z" fill="#3fae6a"/>
      <rect x="40" y="106" width="40" height="7" rx="3" fill="#2f8b53"/>
      ${arms('#3fae6a')}`;
  }

  // o: { headOnly, av, hat, weapon:false로 숨김 }
  function svg(av, o = {}) {
    const skin = SKINS[av.skin] || SKINS[0];
    const hairC = HAIRCOLORS[av.hairColor] || HAIRCOLORS[1];
    const hat = o.hat !== undefined ? o.hat : state.player.hat;
    const head = `
      ${backHairSvg(av.hairStyle, hairC)}
      <circle cx="27" cy="54" r="6" fill="${skin}"/><circle cx="93" cy="54" r="6" fill="${skin}"/>
      <circle cx="60" cy="52" r="32" fill="${skin}"/>
      <circle cx="48" cy="58" r="3.6" fill="#2a2450"/><circle cx="49.5" cy="56.5" r="1.3" fill="#fff"/>
      <circle cx="72" cy="58" r="3.6" fill="#2a2450"/><circle cx="73.5" cy="56.5" r="1.3" fill="#fff"/>
      <ellipse cx="42" cy="67" rx="4.5" ry="2.8" fill="#ff9aa8" opacity=".55"/><ellipse cx="78" cy="67" rx="4.5" ry="2.8" fill="#ff9aa8" opacity=".55"/>
      <path d="M54,69 Q60,75 66,69" fill="none" stroke="#b3563f" stroke-width="2.5" stroke-linecap="round"/>
      ${bangsSvg(hairC)}
      ${hatSvg(hat)}`;
    if (o.headOnly) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="12 -8 96 96">${head}</svg>`;
    }
    const outfit = (o.av && o.avOutfit) || state.player.outfit || 'tunic';
    const body = `
      <rect x="49" y="116" width="9" height="20" rx="4" fill="${skin}"/><rect x="62" y="116" width="9" height="20" rx="4" fill="${skin}"/>
      <rect x="46" y="132" width="14" height="9" rx="4.5" fill="#4a4380"/><rect x="60" y="132" width="14" height="9" rx="4.5" fill="#4a4380"/>
      ${outfitSvg(o.outfit || outfit, skin)}`;
    const weapon = o.weapon === false ? '' : weaponSvg(o.weaponId || state.player.weapon);
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
  function image() {
    const av = state.player.avatar || defaults();
    const img = new Image();
    const box = { img, ready: false };
    img.onload = () => { box.ready = true; };
    img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(av, {}).replace('<svg ', '<svg width="120" height="165" '));
    return box;
  }

  return { SKINS, HAIRCOLORS, HAIRSTYLES, defaults, svg, html, image };
})();
