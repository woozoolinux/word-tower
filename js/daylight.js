// ☀️ 시간대 — 마을은 **진짜 시각**을 따라간다.
// 저녁에 켜면 마을도 저녁이고, 그때 가로등과 창과 화톳불이 진짜로 켜진다.
// 2D 마을과 3D 마을이 같은 값을 읽는다. 두 마을의 저녁이 다르면 그때부터 관리가 안 된다.
//
// 밤이라고 캄캄하게 만들지 않는다. 아이가 밤 9시에 켜서 단어를 봐야 한다 —
// 달빛 든 파란 마을이지 어두운 마을이 아니다.
const Daylight = (() => {
  'use strict';

  // 시각(0~24)마다의 기준값. 사이는 이어서 섞는다.
  //   sky   : 하늘 그라데이션 세 칸 (3D 마을 배경)
  //   sun   : 햇빛 색과 세기 · amb 는 사방에서 오는 빛
  //   tint  : 화면 전체에 덮는 색 (2D 마을)
  //   lamp  : 가로등·창·화톳불이 켜진 정도 0~1
  //   fog   : 3D 먼 곳이 잠기는 색
  //   mul   : 2D 마을을 곱하기로 내리는 색 (흰색이면 그대로)
  const KEY = [
    { h: 0,    name: '밤',   sky: ['#0f1636', '#1e2a58', '#33427a'], sun: '#9fb4e8', sunI: .26, ambI: .26,
      tint: 'rgba(38,50,120,.30)', lamp: 1, fog: '#33427a', mul: '#5d6cb4' },
    { h: 4.5,  name: '새벽', sky: ['#2a3a6e', '#6d6bab', '#e8a98a'], sun: '#ffd0a8', sunI: .42, ambI: .34,
      tint: 'rgba(120,110,180,.18)', lamp: .85, fog: '#8f8fc0', mul: '#a49ccf' },
    { h: 7,    name: '아침', sky: ['#5fa8e0', '#9fd4f2', '#ffeccf'], sun: '#fff0d0', sunI: .72, ambI: .44,
      tint: 'rgba(255,226,182,.13)', lamp: .25, fog: '#d8ecfb', mul: '#ffeed6' },
    { h: 10,   name: '낮',   sky: ['#4f9fe0', '#8fcdf2', '#dff2ff'], sun: '#fff0d0', sunI: .80, ambI: .46,
      tint: 'rgba(255,240,190,.10)', lamp: 0, fog: '#cfe9fb', mul: '#ffffff' },
    { h: 16.5, name: '낮',   sky: ['#4f9fe0', '#8fcdf2', '#dff2ff'], sun: '#fff0d0', sunI: .78, ambI: .46,
      tint: 'rgba(255,240,190,.10)', lamp: 0, fog: '#cfe9fb', mul: '#ffffff' },
    { h: 18.5, name: '저녁', sky: ['#3f6fb8', '#e0865a', '#ffc98a'], sun: '#ffb070', sunI: .58, ambI: .38,
      tint: 'rgba(255,150,90,.17)', lamp: .55, fog: '#e5a887', mul: '#f6bd93' },
    { h: 20.5, name: '노을', sky: ['#20295c', '#5b4a8e', '#c2705f'], sun: '#c898b0', sunI: .34, ambI: .30,
      tint: 'rgba(110,70,140,.24)', lamp: .95, fog: '#7a6398', mul: '#9c7cae' },
    { h: 22,   name: '밤',   sky: ['#0f1636', '#1e2a58', '#33427a'], sun: '#9fb4e8', sunI: .26, ambI: .26,
      tint: 'rgba(38,50,120,.30)', lamp: 1, fog: '#33427a', mul: '#5d6cb4' },
    { h: 24,   name: '밤',   sky: ['#0f1636', '#1e2a58', '#33427a'], sun: '#9fb4e8', sunI: .26, ambI: .26,
      tint: 'rgba(38,50,120,.30)', lamp: 1, fog: '#33427a', mul: '#5d6cb4' },
  ];

  const hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const str = a => '#' + a.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const mixC = (a, b, k) => { const x = hex(a), y = hex(b); return str([0, 1, 2].map(i => x[i] + (y[i] - x[i]) * k)); };
  const mixN = (a, b, k) => a + (b - a) * k;
  // rgba(r,g,b,a) 두 개를 섞는다 — 2D 색조는 알파까지 이어져야 계단이 안 생긴다
  const rgba = s => s.slice(s.indexOf('(') + 1, -1).split(',').map(Number);
  const mixA = (a, b, k) => {
    const x = rgba(a), y = rgba(b);
    return 'rgba(' + [0, 1, 2].map(i => Math.round(mixN(x[i], y[i], k))).join(',') + ',' + mixN(x[3], y[3], k).toFixed(3) + ')';
  };

  let forced = null;

  function hourNow() {
    if (forced !== null) return forced;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  // 두 기준 사이를 섞어 지금의 값을 만든다
  function at(hour) {
    const h = ((hour % 24) + 24) % 24;
    let i = 0;
    while (i < KEY.length - 2 && KEY[i + 1].h <= h) i++;
    const a = KEY[i], b = KEY[i + 1];
    const k = b.h === a.h ? 0 : (h - a.h) / (b.h - a.h);
    return {
      hour: h,
      name: k < .5 ? a.name : b.name,
      sky: [0, 1, 2].map(j => mixC(a.sky[j], b.sky[j], k)),
      sun: mixC(a.sun, b.sun, k),
      sunI: mixN(a.sunI, b.sunI, k),
      ambI: mixN(a.ambI, b.ambI, k),
      tint: mixA(a.tint, b.tint, k),
      lamp: mixN(a.lamp, b.lamp, k),
      fog: mixC(a.fog, b.fog, k),
      mul: mixC(a.mul, b.mul, k),
      night: mixN(a.lamp, b.lamp, k) > .5,
    };
  }

  const now = () => at(hourNow());
  // 테스트와 화면 확인용. 아이가 쓰는 화면에서는 부르지 않는다
  function force(h) { forced = h === null || h === undefined ? null : h; }

  return { KEY, at, now, force, hourNow };
})();
