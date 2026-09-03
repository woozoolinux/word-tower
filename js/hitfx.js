'use strict';
// 💥 타격감
//
// 때리는 맛은 그림이 아니라 **반응**에서 나온다. 에셋을 아무리 좋은 걸 써도
// 맞는 순간 아무 일도 안 일어나면 허공을 치는 느낌이다. 그래서 코드로 만든다.
//
//   히트스톱  맞는 순간 화면이 아주 잠깐 멈춘다 (가장 큰 요소)
//   넉백      맞은 쪽이 뒤로 밀렸다 돌아온다
//   화면 펀치 무대가 순간 커졌다 작아진다
//   파편      부딪힌 자리에서 조각이 튄다
//   숫자      대미지가 튀어오르며 커졌다 작아진다
//
// 셋 다 아주 짧아야 한다(0.05~0.2초). 길면 답답해진다.
const HitFx = (() => {
  const reduce = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // 히트스톱: 그 순간의 자세를 붙잡아 둔다. CSS 애니메이션을 잠깐 멈추면 된다.
  let freezeT = null;
  function freeze(el, ms) {
    if (!el || reduce()) return;
    el.classList.add('fx-freeze');
    clearTimeout(freezeT);
    freezeT = setTimeout(() => el.classList.remove('fx-freeze'), ms);
  }
  function replay(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }
  // 넉백: 맞은 방향으로 밀렸다가 되돌아온다
  function knock(el, dx, dy) {
    if (!el || reduce()) return;
    el.style.setProperty('--kx', dx + 'px');
    el.style.setProperty('--ky', dy + 'px');
    replay(el, 'fx-knock');
  }
  // 파편: 부딪힌 자리에서 조각이 튄다
  function burst(host, opts) {
    if (!host || reduce()) return;
    const o = opts || {};
    const n = o.count || 10, colors = o.colors || ['#ffe08a', '#fff6e0', '#ffc83d'];
    const layer = document.createElement('div');
    layer.className = 'fx-burst';
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i');
      const a = (o.spread ? (Math.random() - .5) * o.spread : Math.random() * Math.PI * 2);
      const d = 26 + Math.random() * (o.dist || 46);
      p.style.setProperty('--dx', (Math.cos(a) * d).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a) * d - 10).toFixed(1) + 'px');
      p.style.background = colors[(Math.random() * colors.length) | 0];
      p.style.width = p.style.height = (3 + Math.random() * 5).toFixed(1) + 'px';
      p.style.animationDelay = (Math.random() * .05).toFixed(3) + 's';
      layer.appendChild(p);
    }
    host.appendChild(layer);
    setTimeout(() => layer.remove(), 700);
  }

  // 한 방에 다 건다. power 1 = 보통, 1.6 = 크리티컬
  //   who: 'mon' 몬스터가 맞음 | 'me' 내가 맞음
  function impact(o) {
    const power = o.power || 1;
    const stage = document.querySelector('.battle-arena');
    freeze(stage, Math.round((o.who === 'me' ? 90 : 60) * power));
    if (stage && !reduce()) replay(stage, power > 1.3 ? 'fx-punch-hard' : 'fx-punch');
    if (o.target) knock(o.target, (o.dx || 0) * power, (o.dy || 0) * power);
    if (o.host) burst(o.host, {
      count: Math.round((o.who === 'me' ? 8 : 11) * power),
      colors: o.colors, dist: 40 * power, spread: o.spread,
    });
  }

  return { impact, freeze, knock, burst, replay };
})();
