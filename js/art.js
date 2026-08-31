'use strict';
// 몬스터 · 보스 · 펫 그림 (SVG). viewBox는 모두 0 0 120 120.
const Art = (() => {
  const shadow = '<ellipse cx="60" cy="110" rx="34" ry="6" fill="#000" opacity=".22"/>';
  // 흰자 + 눈동자
  function eyes(x1, x2, y, r, pr, pupil = '#241f3d') {
    return `<circle cx="${x1}" cy="${y}" r="${r}" fill="#fff"/><circle cx="${x2}" cy="${y}" r="${r}" fill="#fff"/>
      <circle cx="${x1 + 1}" cy="${y + 1}" r="${pr}" fill="${pupil}"/><circle cx="${x2 + 1}" cy="${y + 1}" r="${pr}" fill="${pupil}"/>`;
  }
  const angry = (x1, x2, y, c = '#3a2f5e') =>
    `<path d="M${x1 - 8},${y - 9} L${x1 + 7},${y - 4}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>
     <path d="M${x2 + 8},${y - 9} L${x2 - 7},${y - 4}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/>`;

  const MON = {
    slime: () => `${shadow}
      <path d="M16,98 Q10,54 38,34 Q60,20 82,34 Q110,54 104,98 Q60,106 16,98 Z" fill="#5fd47f"/>
      <path d="M16,98 Q60,106 104,98 Q60,104 16,98 Z" fill="#3fae5f"/>
      <ellipse cx="40" cy="50" rx="10" ry="6" fill="#fff" opacity=".45" transform="rotate(-25 40 50)"/>
      ${eyes(46, 74, 66, 9, 4.5)}
      <path d="M52,86 Q60,93 68,86" fill="none" stroke="#2b7a45" stroke-width="3" stroke-linecap="round"/>`,

    bat: () => `${shadow}
      <path d="M58,62 L10,40 Q20,58 6,68 Q28,70 30,86 Z" fill="#6b5aa8"/>
      <path d="M62,62 L110,40 Q100,58 114,68 Q92,70 90,86 Z" fill="#6b5aa8"/>
      <path d="M44,40 L46,20 L58,34 Z" fill="#3f3266"/><path d="M76,40 L74,20 L62,34 Z" fill="#3f3266"/>
      <ellipse cx="60" cy="62" rx="24" ry="26" fill="#4c3d80"/>
      ${eyes(50, 70, 56, 8, 4, '#ffc83d')}
      <path d="M53,74 L57,80 L60,74 L63,80 L67,74" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>`,

    ghost: () => `<ellipse cx="60" cy="112" rx="26" ry="5" fill="#000" opacity=".15"/>
      <path d="M26,62 A34,34 0 0 1 94,62 L94,100 L84,90 L73,100 L60,90 L47,100 L36,90 L26,100 Z" fill="#eae7f7"/>
      ${eyes(47, 73, 58, 9, 5)}
      <ellipse cx="60" cy="76" rx="7" ry="9" fill="#4a4270"/>
      <ellipse cx="38" cy="70" rx="6" ry="4" fill="#c9b6e8" opacity=".8"/><ellipse cx="82" cy="70" rx="6" ry="4" fill="#c9b6e8" opacity=".8"/>`,

    boar: () => `${shadow}
      <ellipse cx="60" cy="72" rx="40" ry="32" fill="#8d6a4f"/>
      <path d="M28,50 L34,30 L46,44 Z" fill="#6d5039"/><path d="M92,50 L86,30 L74,44 Z" fill="#6d5039"/>
      <path d="M40,50 Q60,42 80,50" fill="none" stroke="#5f452f" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="60" cy="84" rx="18" ry="13" fill="#c99a7a"/>
      <ellipse cx="53" cy="84" rx="3.5" ry="5" fill="#6d5039"/><ellipse cx="67" cy="84" rx="3.5" ry="5" fill="#6d5039"/>
      <path d="M40,88 Q34,76 40,70" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      <path d="M80,88 Q86,76 80,70" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>
      ${eyes(46, 74, 64, 7, 3.5)}${angry(46, 74, 64, '#5f452f')}`,

    snake: () => `${shadow}
      <path d="M22,96 Q60,116 98,96 Q104,80 86,78 Q60,74 42,80" fill="none" stroke="#5cb85c" stroke-width="16" stroke-linecap="round"/>
      <path d="M42,80 Q28,66 42,54" fill="none" stroke="#5cb85c" stroke-width="15" stroke-linecap="round"/>
      <ellipse cx="56" cy="46" rx="24" ry="19" fill="#6ec96e"/>
      <path d="M56,64 L52,76 L60,72 Z" fill="#e0455a"/>
      <path d="M56,72 L50,84 M56,72 L62,84" stroke="#e0455a" stroke-width="2.5" stroke-linecap="round"/>
      ${eyes(48, 66, 42, 7, 3.5, '#1f1a33')}${angry(48, 66, 42, '#3d8b3d')}`,

    zombie: () => `${shadow}
      <rect x="30" y="40" width="60" height="58" rx="14" fill="#8fbf6a"/>
      <path d="M30,58 L14,66 M90,58 L106,66" stroke="#8fbf6a" stroke-width="12" stroke-linecap="round"/>
      <path d="M36,40 Q60,26 84,40 L84,48 Q60,40 36,48 Z" fill="#5d7a44"/>
      <circle cx="47" cy="64" r="10" fill="#fff"/><circle cx="49" cy="65" r="4.5" fill="#241f3d"/>
      <path d="M66,58 L80,68 M80,58 L66,68" stroke="#4f6b3a" stroke-width="4" stroke-linecap="round"/>
      <path d="M42,84 L78,84" stroke="#4f6b3a" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M50,80 L50,88 M60,80 L60,88 M70,80 L70,88" stroke="#4f6b3a" stroke-width="2.5"/>`,

    scorpion: () => `${shadow}
      <g stroke="#a75f26" stroke-width="4.5" stroke-linecap="round" fill="none">
        <path d="M46,94 Q38,104 26,106"/><path d="M58,96 Q56,106 46,110"/>
        <path d="M70,94 Q76,104 88,106"/>
      </g>
      <path d="M62,84 Q92,86 96,64 Q98,44 82,34" fill="none" stroke="#c97b3a" stroke-width="12" stroke-linecap="round"/>
      <circle cx="96" cy="64" r="7" fill="#d98b45"/>
      <path d="M82,34 L74,20 L92,26 Z" fill="#7d4318"/>
      <ellipse cx="50" cy="84" rx="26" ry="17" fill="#d98b45"/>
      <path d="M36,76 L64,76 M34,86 L64,86" stroke="#a75f26" stroke-width="3"/>
      <path d="M28,62 Q8,56 8,42 Q18,50 26,46 Q34,52 30,62 Z" fill="#c97b3a" stroke="#a75f26" stroke-width="2"/>
      <path d="M12,44 L22,48" stroke="#a75f26" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M52,60 Q22,52 20,50" fill="none" stroke="#c97b3a" stroke-width="7" stroke-linecap="round"/>
      <ellipse cx="52" cy="64" rx="17" ry="13" fill="#e39a55"/>
      ${eyes(45, 59, 62, 6, 3)}${angry(45, 59, 62, '#a75f26')}`,

    wolf: () => `${shadow}
      <path d="M26,52 L22,20 L46,36 Z" fill="#6f7a8a"/><path d="M94,52 L98,20 L74,36 Z" fill="#6f7a8a"/>
      <path d="M28,50 L30,30 L46,42 Z" fill="#3f4855"/><path d="M92,50 L90,30 L74,42 Z" fill="#3f4855"/>
      <ellipse cx="60" cy="66" rx="35" ry="30" fill="#8b95a5"/>
      <ellipse cx="60" cy="82" rx="20" ry="16" fill="#c3cbd6"/>
      <ellipse cx="60" cy="76" rx="6" ry="4.5" fill="#2c3340"/>
      <path d="M52,90 L56,96 L60,90 L64,96 L68,90" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
      ${eyes(46, 74, 62, 8, 4, '#ffc83d')}${angry(46, 74, 62, '#4a545f')}`,

    spider: () => `${shadow}
      <g stroke="#4a3f6b" stroke-width="5" stroke-linecap="round" fill="none">
        <path d="M40,70 Q18,58 8,66"/><path d="M40,78 Q16,76 6,88"/>
        <path d="M42,86 Q22,94 16,106"/><path d="M46,60 Q34,42 22,38"/>
        <path d="M80,70 Q102,58 112,66"/><path d="M80,78 Q104,76 114,88"/>
        <path d="M78,86 Q98,94 104,106"/><path d="M74,60 Q86,42 98,38"/>
      </g>
      <ellipse cx="60" cy="82" rx="26" ry="22" fill="#5a4d85"/>
      <ellipse cx="60" cy="58" rx="19" ry="16" fill="#6f60a3"/>
      ${eyes(52, 68, 54, 6.5, 3.2, '#e0455a')}
      <circle cx="46" cy="64" r="3.5" fill="#fff"/><circle cx="74" cy="64" r="3.5" fill="#fff"/>
      <path d="M52,68 L56,74 M68,68 L64,74" stroke="#3a3159" stroke-width="2.5" stroke-linecap="round"/>`,
  };

  const BOSS = {
    dragon: () => `<ellipse cx="60" cy="112" rx="40" ry="7" fill="#000" opacity=".25"/>
      <path d="M22,74 Q0,44 16,26 Q22,50 40,54 Z" fill="#2f8f5b"/>
      <path d="M98,74 Q120,44 104,26 Q98,50 80,54 Z" fill="#2f8f5b"/>
      <path d="M34,44 L28,16 L48,34 Z" fill="#f5c33b"/><path d="M86,44 L92,16 L72,34 Z" fill="#f5c33b"/>
      <ellipse cx="60" cy="66" rx="40" ry="35" fill="#43b877"/>
      <ellipse cx="60" cy="86" rx="26" ry="19" fill="#7ad6a2"/>
      <ellipse cx="50" cy="80" rx="3.5" ry="5" fill="#1f6b45"/><ellipse cx="70" cy="80" rx="3.5" ry="5" fill="#1f6b45"/>
      <path d="M40,94 L46,102 L52,94 L58,102 L64,94 L70,102 L76,94" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>
      ${eyes(44, 76, 60, 10, 5, '#e0455a')}${angry(44, 76, 60, '#1f6b45')}`,

    oni: () => `<ellipse cx="60" cy="112" rx="38" ry="7" fill="#000" opacity=".25"/>
      <path d="M32,36 L24,8 L48,28 Z" fill="#f5e3c0"/><path d="M88,36 L96,8 L72,28 Z" fill="#f5e3c0"/>
      <path d="M24,44 Q34,14 60,20 Q86,14 96,44 Q80,32 60,34 Q40,32 24,44 Z" fill="#2f2740"/>
      <ellipse cx="60" cy="68" rx="38" ry="34" fill="#e05a4a"/>
      <path d="M36,96 Q60,110 84,96 Q60,102 36,96 Z" fill="#7d2a22"/>
      <path d="M44,94 L48,104 L52,94 Z" fill="#fff"/><path d="M68,94 L72,104 L76,94 Z" fill="#fff"/>
      <ellipse cx="60" cy="78" rx="7" ry="5" fill="#a83a2e"/>
      ${eyes(44, 76, 62, 11, 5.5, '#f5c33b')}${angry(44, 76, 62, '#8f3025')}`,

    trex: () => `${shadow}
      <path d="M4,104 Q6,66 30,54 L58,58 L58,104 Z" fill="#3f7d33"/>
      <path d="M58,60 Q54,86 86,92 Q114,94 118,74 L110,62 Z" fill="#6e1f2a"/>
      <path d="M18,58 Q22,28 56,24 Q94,24 114,50 L116,64 L56,72 Q26,74 18,58 Z" fill="#5fa84f"/>
      <path d="M56,74 Q58,92 90,96 Q114,96 116,80 L58,68 Z" fill="#4f9a42"/>
      <path d="M62,68 L66,80 L72,69 M78,68 L82,80 L88,70 M94,69 L97,80 L103,71" fill="none" stroke="#fff" stroke-width="3.4" stroke-linejoin="round"/>
      <path d="M66,84 L70,75 M82,86 L86,77 M98,86 L101,78" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M22,52 Q34,36 50,40" fill="none" stroke="#3f7d33" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="108" cy="44" rx="4" ry="3" fill="#2f6b28"/>
      <circle cx="76" cy="44" r="10" fill="#fff"/><circle cx="79" cy="45" r="5" fill="#241f3d"/>
      <path d="M64,34 L88,38" stroke="#2f6b28" stroke-width="4.5" stroke-linecap="round"/>`,

    kraken: () => `<ellipse cx="60" cy="112" rx="42" ry="7" fill="#000" opacity=".22"/>
      <g stroke="#8f5ac9" stroke-width="10" stroke-linecap="round" fill="none">
        <path d="M34,86 Q14,96 10,112"/><path d="M46,92 Q36,108 24,116"/>
        <path d="M74,92 Q84,108 96,116"/><path d="M86,86 Q106,96 110,112"/>
        <path d="M60,94 Q58,110 62,118"/>
      </g>
      <ellipse cx="60" cy="60" rx="40" ry="40" fill="#a06fd8"/>
      <ellipse cx="46" cy="40" rx="12" ry="8" fill="#fff" opacity=".3" transform="rotate(-25 46 40)"/>
      <circle cx="34" cy="76" r="5" fill="#7a48b0"/><circle cx="86" cy="76" r="5" fill="#7a48b0"/>
      ${eyes(44, 76, 58, 12, 6, '#241f3d')}
      <path d="M50,84 Q60,92 70,84" fill="none" stroke="#6b3d9e" stroke-width="4" stroke-linecap="round"/>`,

    skull: () => `<ellipse cx="60" cy="112" rx="36" ry="7" fill="#000" opacity=".25"/>
      <path d="M36,32 L40,12 L50,24 L60,6 L70,24 L80,12 L84,32 Z" fill="#f5c33b" stroke="#c9971c" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="60" cy="24" r="3.5" fill="#e0455a"/>
      <path d="M24,62 Q24,34 60,34 Q96,34 96,62 Q96,82 84,88 L36,88 Q24,82 24,62 Z" fill="#eee9dd"/>
      <path d="M40,88 L40,100 L52,100 L52,88 M56,88 L56,102 L64,102 L64,88 M68,88 L68,100 L80,100 L80,88" fill="#eee9dd"/>
      <ellipse cx="44" cy="60" rx="12" ry="13" fill="#2a2338"/><ellipse cx="76" cy="60" rx="12" ry="13" fill="#2a2338"/>
      <circle cx="44" cy="60" r="5" fill="#7ee0ff"/><circle cx="76" cy="60" r="5" fill="#7ee0ff"/>
      <path d="M56,74 L60,80 L64,74 Z" fill="#2a2338"/>`,
  };

  const PETS_ART = {
    cat: () => `<path d="M30,44 L26,18 L48,34 Z" fill="#e8a34a"/><path d="M90,44 L94,18 L72,34 Z" fill="#e8a34a"/>
      <ellipse cx="60" cy="64" rx="36" ry="32" fill="#f2b95e"/>
      <path d="M34,40 L32,26 L44,36 Z" fill="#f7d9a8"/><path d="M86,40 L88,26 L76,36 Z" fill="#f7d9a8"/>
      <ellipse cx="60" cy="76" rx="8" ry="6" fill="#fff3e0"/>
      <path d="M56,74 L60,78 L64,74 Z" fill="#e0728a"/>
      <path d="M52,82 Q60,88 68,82" fill="none" stroke="#b5762c" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M18,68 L40,72 M18,80 L40,78 M102,68 L80,72 M102,80 L80,78" stroke="#e8c79a" stroke-width="2"/>
      ${eyes(46, 74, 62, 9, 4.5, '#3f7d33')}`,

    owl: () => `<ellipse cx="60" cy="70" rx="36" ry="38" fill="#a5794f"/>
      <path d="M28,42 L34,20 L48,36 Z" fill="#a5794f"/><path d="M92,42 L86,20 L72,36 Z" fill="#a5794f"/>
      <ellipse cx="60" cy="88" rx="24" ry="18" fill="#d8b98c"/>
      <circle cx="45" cy="60" r="16" fill="#f5e6cd"/><circle cx="75" cy="60" r="16" fill="#f5e6cd"/>
      <circle cx="45" cy="60" r="9" fill="#241f3d"/><circle cx="75" cy="60" r="9" fill="#241f3d"/>
      <circle cx="48" cy="57" r="3" fill="#fff"/><circle cx="78" cy="57" r="3" fill="#fff"/>
      <path d="M60,68 L54,78 L66,78 Z" fill="#f5c33b"/>
      <path d="M50,104 L46,112 M70,104 L74,112" stroke="#f5c33b" stroke-width="4" stroke-linecap="round"/>`,

    dragon: () => `<path d="M26,64 Q6,40 20,26 Q26,48 42,52 Z" fill="#3f9e6e"/>
      <path d="M94,64 Q114,40 100,26 Q94,48 78,52 Z" fill="#3f9e6e"/>
      <path d="M38,40 L32,18 L50,34 Z" fill="#f5c33b"/><path d="M82,40 L88,18 L70,34 Z" fill="#f5c33b"/>
      <ellipse cx="60" cy="68" rx="34" ry="31" fill="#57c98e"/>
      <ellipse cx="60" cy="84" rx="21" ry="15" fill="#9fe6c0"/>
      <ellipse cx="52" cy="80" rx="3" ry="4" fill="#2f7d55"/><ellipse cx="68" cy="80" rx="3" ry="4" fill="#2f7d55"/>
      <path d="M48,92 L52,98 L56,92 L60,98 L64,92 L68,98 L72,92" fill="none" stroke="#fff" stroke-width="2.8" stroke-linejoin="round"/>
      ${eyes(46, 74, 64, 9, 4.5)}`,
  };

  function wrap(inner, cls) {
    return `<svg class="${cls || ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">${inner}</svg>`;
  }
  function monster(id, boss) {
    const f = (boss ? BOSS[id] : MON[id]) || MON.slime;
    return wrap(f());
  }
  function pet(id) {
    const f = PETS_ART[id] || PETS_ART.cat;
    return wrap(f());
  }
  return { monster, pet };
})();
