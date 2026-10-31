import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer, EffectPass, RenderPass, BloomEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { createMaterials } from './world/materials';
import { buildSpecimen } from './world/specimen';

const canvas = document.querySelector<HTMLCanvasElement>('#gl')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0c0e);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.4, 6.2);
camera.lookAt(0, 0, 0);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.3;

const key = new THREE.DirectionalLight(0xfff0dd, 1.35);
key.position.set(3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9fc4ff, 0.85);
rim.position.set(-4, 1.5, -5);
scene.add(rim);
const fill = new THREE.HemisphereLight(0x223044, 0x08090a, 0.22);
scene.add(fill);

const M = createMaterials();
const spec = buildSpecimen(M, scene.environment!);
spec.group.scale.setScalar(1.55);
scene.add(spec.group);

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera,
  new BloomEffect({ intensity: 0.38, luminanceThreshold: 1.15, mipmapBlur: true }),
  new SMAAEffect(),
  new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }),
));

const clock = new THREE.Clock();
let n = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  spec.group.rotation.y = Math.sin(t * 0.12) * 0.6 + 0.5;
  spec.rings.forEach((r, i) => {
    r.holder.rotateOnAxis(r.axis, 0.004 + i * 0.001);
  });
  spec.core.scale.setScalar(1 + Math.sin(t * 2.4) * 0.04);
  composer.render();
  if (++n === 3) (window as any).__READY__ = true;
});
(window as any).__THREE_SCENE__ = scene;