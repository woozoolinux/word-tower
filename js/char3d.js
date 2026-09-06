'use strict';
// 🧍 3D 캐릭터 — 입체 마을에서만 쓴다.
//
// 왜 만드나: 평면 그림을 판때기에 붙여 세우면 아무리 잘 그려도 **정면 고정**이다.
// 북쪽으로 걸어도 이쪽을 보고, 팔다리가 안 움직인다.
//
// 무엇을 지키나: **꾸미기 시스템을 다시 만들지 않는다.**
// 피부·머리색·머리모양·옷·모자·무기를 `state.player` 에서 그대로 읽는다.
// 옷과 무기 색은 2D 와 **같은 표**(`Avatar.OUTFIT_LOOK` / `WEAPON_LOOK`)를 쓴다 —
// 두 마을의 같은 옷이 다른 색이면 그때부터 관리가 안 된다.
//
// ⚠️ 이 파일은 three.js 보다 먼저 로드된다. 불러오는 시점에 THREE 를 만지면 안 된다.
const Char3D = (() => {
  const A = () => Avatar;

  // 상자 하나. 가운데가 아니라 **아래 끝**을 기준으로 놓는 게 편하다(발·다리·몸통).
  function box(w, h, d, color, parent, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color }));
    m.position.set(x || 0, (y || 0) + h / 2, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }
  function ball(r, color, parent, x, y, z, sx, sy, sz, glow) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 11),
      new THREE.MeshLambertMaterial(glow
        ? { color, emissive: color, emissiveIntensity: 0.22 } : { color }));
    m.position.set(x || 0, y || 0, z || 0);
    m.scale.set(sx || 1, sy || 1, sz || 1);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); return m;
  }

  // 눈·입은 빛을 안 받아야 또렷하다 (Lambert 로 그리면 그늘에서 뭉개진다)
  function flat(geo, color, parent, x, y, z) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z); parent.add(m); return m;
  }

  // 얼굴은 +z 를 본다. 걸어가는 쪽으로 몸이 돌아간다.
  function build(opt) {
    const o = opt || {};
    const av = o.av || state.player.avatar || A().defaults();
    const skin = A().SKINS[av.skin] || A().SKINS[0];
    const hair = A().HAIRCOLORS[av.hairColor] || A().HAIRCOLORS[1];
    const style = (A().HAIRSTYLES[av.hairStyle] || A().HAIRSTYLES[0]).id;
    const look = A().OUTFIT_LOOK[o.outfit || state.player.outfit] || A().OUTFIT_LOOK.tunic;
    const tone = A().tone;
    const dim = tone(look.base, -.1), lit = tone(look.base, .12);

    const g = new THREE.Group();
    const parts = {};

    // ── 다리와 부츠 (엉덩이에서 돌아간다) ──
    const HIP = 0.62;
    [-1, 1].forEach((sx, i) => {
      const hipG = new THREE.Group();
      hipG.position.set(sx * 0.105, HIP, 0);
      g.add(hipG);
      const legG = new THREE.Group(); hipG.add(legG);   // 이 그룹을 돌리면 다리가 흔들린다
      box(0.15, 0.40, 0.15, '#6b6494', legG, 0, -0.40, 0);
      box(0.175, 0.13, 0.22, '#c9a06a', legG, 0, -0.53, 0.02);  // 부츠 목 (가죽)
      box(0.185, 0.15, 0.26, '#332e5c', legG, 0, -0.62, 0.03);  // 부츠
      box(0.195, 0.045, 0.275, '#221d44', legG, 0, -0.62, 0.03); // 밑창
      parts[i ? 'legR' : 'legL'] = legG;
    });

    // ── 몸통 ──
    box(0.40, 0.50, 0.25, look.base, g, 0, HIP, 0);
    box(0.41, 0.09, 0.26, look.belt, g, 0, HIP + 0.01, 0);            // 벨트
    box(0.08, 0.08, 0.02, look.trim, g, 0, HIP + 0.015, 0.135);       // 버클
    box(0.17, 0.22, 0.012, tone(look.base, .11), g, 0, HIP + 0.18, 0.126); // 가슴판
    // 왼쪽은 빛, 오른쪽은 그늘 (마을 빛과 같은 방향)
    box(0.02, 0.48, 0.24, lit, g, -0.20, HIP + 0.01, 0);
    box(0.02, 0.48, 0.24, dim, g, 0.20, HIP + 0.01, 0);

    // 기사 갑옷이면 어깨 보호대
    if (look.kind === 'plate') {
      [-1, 1].forEach(sx => {
        const p = box(0.20, 0.11, 0.24, sx < 0 ? tone(look.base, .06) : tone(look.base, -.1), g,
          sx * 0.235, HIP + 0.44, 0);
        p.rotation.z = sx * 0.28;
        box(0.205, 0.035, 0.245, tone(look.base, -.16), g, sx * 0.235, HIP + 0.43, 0).rotation.z = sx * 0.28;
      });
    }
    // 용사 망토
    if (look.kind === 'cape') {
      const cape = box(0.40, 0.74, 0.04, '#c0392b', g, 0, HIP - 0.22, -0.145);
      cape.rotation.x = -0.07;
    }
    // 로브·원피스는 치마가 있다
    if (look.kind === 'robe' || look.kind === 'dress') {
      const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.31, 0.36, 12),
        new THREE.MeshLambertMaterial({ color: look.base }));
      sk.position.y = HIP - 0.13; sk.castShadow = true; g.add(sk);
      if (look.kind === 'robe') {
        const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.315, 0.32, 0.06, 12),
          new THREE.MeshLambertMaterial({ color: look.trim }));
        hem.position.y = HIP - 0.29; g.add(hem);
      }
    }

    // ── 팔 (어깨에서 돌아간다) ──
    const SH = HIP + 0.44;
    [-1, 1].forEach((sx, i) => {
      const shG = new THREE.Group();
      shG.position.set(sx * 0.245, SH, 0);
      g.add(shG);
      const armG = new THREE.Group(); shG.add(armG);
      box(0.125, 0.34, 0.125, sx < 0 ? look.base : dim, armG, 0, -0.34, 0);
      ball(0.078, skin, armG, 0, -0.40, 0, 1, 1, 1, true);       // 손
      parts[i ? 'armR' : 'armL'] = armG;
    });

    // ── 목과 머리 ──
    box(0.135, 0.09, 0.135, tone(skin, -.08), g, 0, HIP + 0.50, 0);
    const headG = new THREE.Group();
    headG.position.set(0, HIP + 0.585, 0);
    g.add(headG);
    parts.head = headG;
    ball(0.215, skin, headG, 0, 0.20, 0, 1, 1.03, 0.94, true);
    // 눈·눈동자·볼·입 — 얼굴은 +z 를 본다
    [-1, 1].forEach(sx => {
      flat(new THREE.CircleGeometry(0.036, 12), '#ffffff', headG, sx * 0.072, 0.222, 0.198);
      flat(new THREE.CircleGeometry(0.024, 12), '#1e2350', headG, sx * 0.072, 0.220, 0.203);
      flat(new THREE.CircleGeometry(0.0095, 8), '#ffffff', headG, sx * 0.082, 0.232, 0.206);
      flat(new THREE.CircleGeometry(0.03, 10), '#ff9aa8', headG, sx * 0.132, 0.172, 0.178);
    });
    flat(new THREE.CircleGeometry(0.023, 10), '#a84a36', headG, 0, 0.152, 0.2);
    ball(0.048, skin, headG, -0.205, 0.19, 0, 0.7, 1, 1, true);   // 귀
    ball(0.048, skin, headG, 0.205, 0.19, 0, 0.7, 1, 1, true);

    // 머리카락 — 위를 덮는 반구 + 머리 모양별 뒷머리
    // 반구를 적도까지 씌우면 얼굴까지 덮인다 — 이마 위에서 멈춘다
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.226, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.44),
      new THREE.MeshLambertMaterial({ color: hair }));
    cap.position.set(0, 0.205, -0.008); cap.scale.set(1, 1.06, 1);
    cap.castShadow = true; headG.add(cap);
    // 뒤통수는 덮어도 된다 (얼굴은 +z 쪽)
    ball(0.208, hair, headG, 0, 0.205, -0.055, 1, 1.02, 0.72);
    if (style === 'bob' || style === 'long') {
      const len = style === 'long' ? 0.40 : 0.22;
      box(0.36, len, 0.16, hair, headG, 0, 0.20 - len, -0.05);
    }
    if (style === 'twin') {
      [-1, 1].forEach(sx => ball(0.085, hair, headG, sx * 0.24, 0.12, -0.03, 1, 1.5, 1));
    }

    // 모자
    const hat = o.hat !== undefined ? o.hat : state.player.hat;
    if (hat === 'straw') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.44, 0.035, 16),
        new THREE.MeshLambertMaterial({ color: '#eac169' }));
      brim.position.y = 0.4; brim.castShadow = true; headG.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.16, 16),
        new THREE.MeshLambertMaterial({ color: '#f7d689' }));
      top.position.y = 0.48; top.castShadow = true; headG.add(top);
      box(0.5, 0.05, 0.5, '#c96f4a', headG, 0, 0.42, 0);
    } else if (hat === 'wizard') {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.04, 16),
        new THREE.MeshLambertMaterial({ color: '#5b48c9' }));
      brim.position.y = 0.4; brim.castShadow = true; headG.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 14),
        new THREE.MeshLambertMaterial({ color: '#6c5ce7' }));
      cone.position.set(0, 0.72, -0.03); cone.rotation.x = -0.12;
      cone.castShadow = true; headG.add(cone);
      ball(0.05, '#ffc83d', headG, 0, 1.0, -0.08);
    } else if (hat === 'crown') {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.09, 14),
        new THREE.MeshLambertMaterial({ color: '#f5c33b' }));
      band.position.y = 0.44; band.castShadow = true; headG.add(band);
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 4),
          new THREE.MeshLambertMaterial({ color: '#f5c33b' }));
        sp.position.set(Math.sin(a) * 0.21, 0.55, Math.cos(a) * 0.21);
        sp.castShadow = true; headG.add(sp);
      }
      ball(0.04, '#ff6b7a', headG, 0, 0.48, 0.24);
    }

    // ── 무기 (오른손에) ──
    const wid = o.weaponId || state.player.weapon;
    const W = A().WEAPON_LOOK[wid];
    if (W && wid !== 'none') {
      const hand = parts.armR;
      const wg = new THREE.Group();
      wg.position.set(0, -0.4, 0.02);
      wg.rotation.x = -0.35;
      hand.add(wg);
      const len = W.len / 100 * 1.05, wide = W.w / 100 * 0.95;
      if (wid === 'stick') {
        box(0.045, 0.5, 0.045, W.blade, wg, 0, -0.1, 0);
      } else {
        box(0.042, 0.15, 0.042, W.grip, wg, 0, -0.13, 0);                 // 손잡이
        box(0.17, 0.04, 0.055, W.guard, wg, 0, 0.02, 0);                   // 코등이
        box(wide, len, 0.03, W.blade, wg, 0, 0.05, 0);                     // 날
        box(wide * 0.32, len * 0.92, 0.04, tone(W.blade, .18), wg, 0, 0.06, 0);
        if (W.gem) ball(0.038, W.gem, wg, 0, 0.035, 0.04);
        if (wid === 'flame' || wid === 'dragon') {
          const f = ball(0.085, wid === 'dragon' ? '#c04ad6' : '#ff6b2e', wg, 0, 0.05 + len, 0, 1, 1.5, 1);
          f.material = new THREE.MeshBasicMaterial({ color: f.material.color, transparent: true, opacity: .9 });
          parts.flame = f;
        }
      }
    }

    // ── 오라 (2D 만큼 화려하진 않지만, 있으면 보인다) ──
    const auraId = o.aura !== undefined ? o.aura : state.player.aura;
    const AC = { sparkle: '#ffe08a', aqua: '#3ee0c4', comet: '#ffc83d', fairy: '#8fdcff',
      flame: '#ff8a3d', thunder: '#ffe94a', angel: '#ffffff', rainbow: '#ff6b7a',
      moon: '#cbbfff', dragon: '#c04ad6' }[auraId];
    if (AC) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 20),
        new THREE.MeshBasicMaterial({ color: AC, transparent: true, opacity: .5, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
      const orbs = new THREE.Group(); g.add(orbs);
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
          new THREE.MeshBasicMaterial({ color: AC, transparent: true, opacity: .85 }));
        s.position.set(Math.cos(i * 1.57) * 0.42, 0.5 + (i % 2) * 0.35, Math.sin(i * 1.57) * 0.42);
        orbs.add(s);
      }
      parts.aura = { ring, orbs };
    }

    parts.group = g;
    parts.HIP = HIP;
    return parts;
  }

  // 걷기 — 다리와 팔이 반대로 흔들린다. 이게 3D 로 온 진짜 이유다.
  function animate(c, t, moving, dt) {
    if (!c) return;
    const sw = moving ? Math.sin(t * 9) : 0;
    const amp = moving ? 0.62 : 0;
    if (c.legL) c.legL.rotation.x = sw * amp;
    if (c.legR) c.legR.rotation.x = -sw * amp;
    if (c.armL) c.armL.rotation.x = -sw * amp * 0.8;
    if (c.armR) c.armR.rotation.x = sw * amp * 0.55;
    // 멈추면 숨을 쉰다
    const idle = moving ? 0 : Math.sin(t * 1.8) * 0.02;
    c.group.position.y = moving ? Math.abs(Math.sin(t * 9)) * 0.045 : idle;
    if (c.head) c.head.rotation.z = moving ? sw * 0.05 : 0;
    if (c.aura) {
      c.aura.orbs.rotation.y = t * 1.2;
      c.aura.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    }
    if (c.flame) c.flame.scale.set(1, 1.5 + Math.sin(t * 8) * 0.25, 1);
  }

  return { build, animate };
})();
