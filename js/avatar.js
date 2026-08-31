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
    const blade = weapon === 'bronze' ? '#c9803a' : '#cdd6e0';
    const flame = weapon === 'flame' ? `
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
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 120 155">${body}${head}${weapon}</svg>`;
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
