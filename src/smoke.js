import * as THREE from 'three';
import { psxMaterial } from './psx.js';

// Fumée d'échappement : un pool de sprites recyclés (aucune création en cours de jeu)
const COUNT = 24; // sprites du pool
const EMIT_RATE = 20; // particules par seconde
const LIFE = 1.0; // durée de vie moyenne (s)
const START_SIZE = 0.12;
const END_SIZE = 0.7;
const MAX_OPACITY = 0.5;
// La route défile à SPEED : une fumée collée au sol viendrait traverser la caméra.
// Elle ne recule donc qu'à une fraction de cette vitesse, ce qui forme une traînée derrière la moto.
const DRIFT = 0.4;

export function createSmoke(scene) {
  const texture = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}smoketxt.png`);
  texture.colorSpace = THREE.SRGBColorSpace;

  const particles = [];
  for (let i = 0; i < COUNT; i++) {
    // Un matériau par sprite : l'opacité change d'une particule à l'autre
    const material = psxMaterial(new THREE.SpriteMaterial({
      map: texture,
      color: 0xcccccc,
      transparent: true,
      opacity: 0,
      depthWrite: false, // les volutes ne se masquent pas entre elles
    }));
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    particles.push({ sprite, active: false, age: 0, life: 0, vx: 0, vy: 0, spin: 0 });
  }

  let toEmit = 0;

  function spawn(origin) {
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      if (p.active) continue;

      p.active = true;
      p.age = 0;
      p.life = LIFE * (0.8 + Math.random() * 0.4);
      p.vx = (Math.random() - 0.5) * 0.3;
      p.vy = 0.35 + Math.random() * 0.25;
      p.spin = (Math.random() - 0.5) * 1.5;
      p.sprite.position.set(
        origin.x + (Math.random() - 0.5) * 0.04,
        origin.y + (Math.random() - 0.5) * 0.04,
        origin.z
      );
      p.sprite.material.rotation = Math.random() * Math.PI * 2;
      p.sprite.visible = true;
      return;
    }
  }

  // origin : position monde de la sortie du pot, speed : vitesse de défilement de la route
  function update(delta, speed, origin) {
    toEmit += EMIT_RATE * delta;
    while (toEmit >= 1) {
      toEmit -= 1;
      spawn(origin);
    }

    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      if (!p.active) continue;

      p.age += delta;
      const t = p.age / p.life;
      if (t >= 1) {
        p.active = false;
        p.sprite.visible = false;
        continue;
      }

      p.sprite.position.x += p.vx * delta;
      p.sprite.position.y += p.vy * delta;
      p.sprite.position.z += speed * DRIFT * delta;
      p.sprite.material.rotation += p.spin * delta;

      // Grossit vite puis ralentit ; apparaît en fondu puis se dissipe
      const grow = 1 - (1 - t) * (1 - t);
      p.sprite.scale.setScalar(START_SIZE + (END_SIZE - START_SIZE) * grow);
      p.sprite.material.opacity = MAX_OPACITY * Math.min(t / 0.1, 1) * (1 - t);
    }
  }

  return { update };
}
