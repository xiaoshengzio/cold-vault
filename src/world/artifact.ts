import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { VaultMaterials } from './materials';

export interface Artifact {
  group: THREE.Group;
  crystal: THREE.Mesh[];
  rings: THREE.Object3D[];
  core: THREE.Object3D | null;
  radius: number;
}

export async function loadArtifact(url: string, M: VaultMaterials): Promise<Artifact> {
  const gltf = await new GLTFLoader().loadAsync(url);
  const group = new THREE.Group();
  group.name = 'artifact';

  const brassDark = (M.brass.clone() as THREE.MeshPhysicalMaterial);
  brassDark.color = new THREE.Color(0.20, 0.135, 0.055);
  brassDark.roughness = 0.44;

  const moved: THREE.Mesh[] = [];
  const crystal: THREE.Mesh[] = [];
  const rings: THREE.Object3D[] = [];
  let core: THREE.Object3D | null = null;

  gltf.scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const n = mesh.name.toLowerCase();
    if (n.startsWith('crystal')) {
      mesh.material = M.glass;
      crystal.push(mesh);
    } else if (n.startsWith('core')) {
      mesh.material = M.core;
      core = mesh;
    } else if (n.startsWith('ringblk')) {
      mesh.material = brassDark;
      mesh.scale.setScalar(1.3);
    } else {
      mesh.material = M.brass;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    moved.push(mesh);
  });
  for (const m of moved) group.add(m);

  group.children.filter((c) => /^ring_/.test(c.name)).forEach((r) => rings.push(r));

  const bbox = new THREE.Box3().setFromObject(group);
  const size = bbox.getSize(new THREE.Vector3());
  const center = bbox.getCenter(new THREE.Vector3());
  group.position.sub(center);

  const wrapper = new THREE.Group();
  wrapper.add(group);

  return { group: wrapper, crystal, rings, core, radius: size.length() * 0.5 };
}
