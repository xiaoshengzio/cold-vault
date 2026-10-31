import * as THREE from 'three';
import { makeConcrete, makeBrushRoughness, fbm } from './textures';

export interface VaultMaterials {
  wall: THREE.MeshStandardMaterial;
  wallDark: THREE.MeshStandardMaterial;
  floor: THREE.MeshPhysicalMaterial;
  ceiling: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  plinth: THREE.MeshStandardMaterial;
  strip: THREE.MeshStandardMaterial;
  stripCool: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  brass: THREE.MeshPhysicalMaterial;
  core: THREE.MeshStandardMaterial;
}

function concreteMat(maps: ReturnType<typeof makeConcrete>, tint: THREE.ColorRepresentation, roughness = 1, normalScale = 0.6, env = 0.5) {
  const m = new THREE.MeshStandardMaterial({
    map: maps.albedo,
    roughnessMap: maps.roughness,
    normalMap: maps.normal,
    color: tint,
    roughness,
    metalness: 0.0,
    envMapIntensity: env,
  });
  m.normalScale.set(normalScale, normalScale);
  return m;
}

export function createMaterials(): VaultMaterials {
  const wallMaps = makeConcrete({ base: [0.255, 0.25, 0.245], contrast: 0.26, rough: [0.78, 0.92], repeat: 1.6 });
  const floorMaps = makeConcrete({ base: [0.105, 0.104, 0.102], contrast: 0.07, rough: [0.34, 0.5], repeat: 1.4, grain: 0.12 });
  const ceilMaps = makeConcrete({ base: [0.135, 0.133, 0.13], contrast: 0.3, rough: [0.82, 0.96], repeat: 2.4 });

  const wall = concreteMat(wallMaps, 0xffffff, 1.0, 0.3, 0.38);
  const wallDark = concreteMat(ceilMaps, 0xa8a39c, 1.0, 0.5, 0.3);
  const floor = concreteMat(floorMaps, 0xffffff, 1.0, 0.14, 1.15) as THREE.MeshPhysicalMaterial;
  floor.metalness = 0.0;
  floor.clearcoat = 0.45;
  floor.clearcoatRoughness = 0.26;
  const ceiling = concreteMat(ceilMaps, 0x8f8a84, 1.0, 0.5, 0.25);

  const steelRough = makeBrushRoughness(0.24, 0.5);
  steelRough.repeat.set(2, 2);
  const steel = new THREE.MeshStandardMaterial({
    color: 0x1c1d22,
    metalness: 1.0,
    roughness: 0.52,
    roughnessMap: steelRough,
    envMapIntensity: 0.14,
  });

  const plinthRough = makeBrushRoughness(0.3, 0.55);
  plinthRough.repeat.set(3, 3);
  const plinth = new THREE.MeshStandardMaterial({
    color: 0x121110,
    metalness: 0.05,
    roughness: 0.62,
    roughnessMap: plinthRough,
    envMapIntensity: 1.0,
  });

  const strip = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(1.0, 0.72, 0.44),
    emissiveIntensity: 5.5,
  });

  const stripCool = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(0.52, 0.66, 0.92),
    emissiveIntensity: 2.2,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.035,
    transmission: 1.0,
    thickness: 0.9,
    ior: 1.62,
    attenuationColor: new THREE.Color(0.62, 0.8, 1.0),
    attenuationDistance: 1.1,
    envMapIntensity: 2.2,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    iridescence: 0.5,
    iridescenceIOR: 1.35,
    specularIntensity: 1,
    flatShading: true,
  });

  const brass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.62, 0.43, 0.175),
    metalness: 1.0,
    roughness: 0.235,
    envMapIntensity: 1.35,
    anisotropy: 0.72,
    anisotropyRotation: Math.PI * 0.5,
    clearcoat: 0.16,
    clearcoatRoughness: 0.35,
  });

  const core = new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: new THREE.Color(1.0, 0.45, 0.16),
    emissiveIntensity: 6.5,
  });

  return { wall, wallDark, floor, ceiling, steel, plinth, strip, stripCool, glass, brass, core };
}