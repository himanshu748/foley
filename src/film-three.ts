import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CUES } from "./film";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
export interface FilmScene {
  draw(time: number, reduced: boolean): void;
  dispose(): void;
}
type Stats = {
  frames: number;
  disposed: boolean;
  time: number;
  reduced: boolean;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  dpr: number;
  cpuMs: number[];
  intervalsMs: number[];
  monsterX: number;
  umbrella: number;
  renderer: string;
};
type FilmCanvas = HTMLCanvasElement & {
  foleyStats?: Stats;
  foleySeek?: (time: number, reduced?: boolean) => void;
};

/** A small clay-and-timber set, built once. Every pose is a pure function of film time. */
export function createFilmScene(canvas: FilmCanvas): FilmScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "low-power",
    alpha: false,
  });
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, innerWidth < 720 ? 1.5 : 1.75),
  );
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#202642");
  scene.fog = new THREE.Fog("#202642", 23, 45);
  const camera = new THREE.OrthographicCamera(-8.5, 8.5, 4.8, -4.8, 0.1, 65);
  camera.position.set(7.5, 7.6, 15);
  camera.lookAt(0.2, 1.65, 0);
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const material = (
    color: string,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.82,
      ...extra,
    });
    materials.add(m);
    return m;
  };
  const mint = material("#84cbb7"),
    darkMint = material("#62a99b"),
    ivory = material("#f4ead5");
  const ink = material("#26383c"),
    timber = material("#a77751"),
    trim = material("#dfb782");
  const roofMat = material("#a55543"),
    roofEdge = material("#cf8060");
  const earth = material("#384d50"),
    earthEdge = material("#23383e");
  const pine = material("#345952"),
    pineDark = material("#24483f");
  const glow = material("#ffd491", {
    emissive: "#ffbb63",
    emissiveIntensity: 1.4,
  });
  const ceramic = material("#de9870", { roughness: 0.55 });
  const puddleMat = material("#42626b", { roughness: 0.22, metalness: 0.3 });
  const sphere = new THREE.SphereGeometry(1, 24, 16),
    box = new THREE.BoxGeometry(1, 1, 1);
  const cone = new THREE.ConeGeometry(1, 1, 12),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 32);
  [sphere, box, cone, cylinder].forEach((g) => geometries.add(g));
  function mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D,
    pos: number[],
    scale = [1, 1, 1],
    shadow = true,
  ) {
    geometries.add(g);
    const object = new THREE.Mesh(g, m);
    object.position.set(pos[0], pos[1], pos[2]);
    object.scale.set(scale[0], scale[1], scale[2]);
    object.castShadow = shadow;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  }
  const ground = mesh(cylinder, earth, scene, [0, -0.18, 0], [7.8, 0.35, 4.7]);
  mesh(cylinder, earthEdge, scene, [0, -0.46, 0], [7.74, 0.26, 4.65]);
  ground.receiveShadow = true;
  // A trail of individual stepping stones gives the six footsteps somewhere to land.
  for (let i = 0; i < 14; i++) {
    const stone = mesh(
      cylinder,
      i % 3 ? earthEdge : puddleMat,
      scene,
      [-5.3 + i * 0.56, 0.025, 1.13 + Math.sin(i * 0.52) * 0.2],
      [0.25 + (i % 2) * 0.06, 0.06, 0.22],
    );
    stone.rotation.y = i * 0.7;
  }
  for (const [x, z, s] of [
    [-4, -1, 0.8],
    [1.2, 2.3, 0.6],
    [4.3, 2, 0.7],
    [-1, -2, 0.6],
  ]) {
    mesh(cylinder, puddleMat, scene, [x, 0.012, z], [s, 0.012, s * 0.4], false);
  }
  const key = new THREE.DirectionalLight("#d2e3ef", 3.1);
  key.position.set(-3, 9, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, {
    left: -10,
    right: 10,
    top: 8,
    bottom: -8,
    near: 0.5,
    far: 28,
  });
  key.shadow.normalBias = 0.05;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 3;
  scene.add(key, new THREE.HemisphereLight("#b9c7df", "#243d37", 2));
  const rim = new THREE.DirectionalLight("#a7c2ea", 1.7);
  rim.position.set(2, 6, -7);
  scene.add(rim);
  const cabin = new THREE.Group();
  cabin.position.set(3.35, 0, -0.75);
  cabin.rotation.y = -0.16;
  scene.add(cabin);
  mesh(box, timber, cabin, [0, 0.92, 0], [2.5, 1.75, 1.7]);
  // Log courses, corner beams, and separate roof battens read as a physical model.
  for (let i = 0; i < 7; i++)
    mesh(
      box,
      i % 2 ? timber : trim,
      cabin,
      [0, 0.2 + i * 0.24, 0.868],
      [2.5, 0.025, 0.032],
    );
  for (const x of [-1.2, 1.2])
    mesh(box, trim, cabin, [x, 0.88, 0.91], [0.11, 1.8, 0.11]);
  for (const side of [-1, 1]) {
    const roof = mesh(
      box,
      roofMat,
      cabin,
      [side * 0.76, 2.06, 0],
      [1.86, 0.16, 2.3],
    );
    roof.rotation.z = -side * 0.56;
    for (let i = 0; i < 8; i++) {
      const slat = mesh(
        box,
        roofEdge,
        cabin,
        [side * 0.76, 2.15, -0.99 + i * 0.285],
        [1.87, 0.055, 0.048],
      );
      slat.rotation.z = -side * 0.56;
    }
  }
  // Front gable closes the roof silhouette.
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-1.25, 1.75);
  gableShape.lineTo(0, 2.65);
  gableShape.lineTo(1.25, 1.75);
  gableShape.closePath();
  mesh(new THREE.ShapeGeometry(gableShape), timber, cabin, [0, 0, 0.86]);
  mesh(box, ink, cabin, [0.25, 0.62, 0.89], [0.58, 1.2, 0.08]);
  mesh(box, roofMat, cabin, [0.25, 0.62, 0.94], [0.48, 1.1, 0.04]);
  mesh(sphere, glow, cabin, [0.4, 0.65, 0.98], [0.045, 0.045, 0.045], false);
  for (const x of [-0.77, 0.9]) {
    mesh(box, trim, cabin, [x, 1.05, 0.94], [0.58, 0.62, 0.06]);
    mesh(box, glow, cabin, [x, 1.05, 0.98], [0.45, 0.48, 0.045], false);
    mesh(box, timber, cabin, [x, 1.05, 1.01], [0.04, 0.5, 0.03]);
    mesh(box, timber, cabin, [x, 1.05, 1.01], [0.46, 0.04, 0.03]);
  }
  mesh(box, trim, cabin, [0.25, 0.07, 1.15], [1, 0.13, 0.62]);
  mesh(box, roofMat, cabin, [0.78, 2.42, -0.37], [0.35, 1.1, 0.38]);
  mesh(box, trim, cabin, [0.78, 2.99, -0.37], [0.45, 0.12, 0.48]);
  const warm = new THREE.PointLight("#ffb865", 7, 6, 2);
  warm.position.set(3.4, 1, 1);
  scene.add(warm);
  function tree(x: number, z: number, size: number, angle: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    group.scale.setScalar(size);
    scene.add(group);
    mesh(cylinder, timber, group, [0, 0.6, 0], [0.11, 1.2, 0.11]);
    for (let k = 0; k < 3; k++)
      mesh(
        cone,
        k % 2 ? pineDark : pine,
        group,
        [0, 1.03 + k * 0.55, 0],
        [0.82 - k * 0.16, 1.3, 0.82 - k * 0.16],
      );
  }
  [
    [-5.8, -1.4, 1.25],
    [-4.6, -2.7, 0.82],
    [-2.5, -3.2, 0.6],
    [1, -3.3, 0.85],
    [5.8, -1.9, 1.4],
    [6.4, 0.2, 0.9],
  ].forEach(([x, z, s], i) => tree(x, z, s, i));
  for (let i = 0; i < 20; i++) {
    const angle = i * 2.399;
    mesh(
      sphere,
      i % 2 ? earthEdge : pineDark,
      scene,
      [
        Math.cos(angle) * (5.4 + (i % 3) * 0.65),
        0.12,
        Math.sin(angle) * (3.2 + (i % 2) * 0.5),
      ],
      [0.15 + (i % 3) * 0.04, 0.13, 0.18],
    );
  }
  // The creature is sculpted from rounded clay forms, with physically separate face and limbs.
  const monster = new THREE.Group();
  scene.add(monster);
  monster.rotation.y = 0.2;
  mesh(sphere, mint, monster, [0, 1.32, 0], [0.86, 1.02, 0.64]);
  mesh(sphere, darkMint, monster, [0, 1.03, 0.49], [0.54, 0.62, 0.2]);
  const feet = [-1, 1].map((side) =>
    mesh(
      sphere,
      darkMint,
      monster,
      [side * 0.43, 0.24, 0.2],
      [0.3, 0.26, 0.46],
    ),
  );
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.73, 1.35, 0.08);
    monster.add(arm);
    mesh(sphere, mint, arm, [side * 0.12, -0.3, 0], [0.2, 0.49, 0.22]);
    return arm;
  });
  for (const side of [-1, 1]) {
    const horn = mesh(
      cone,
      ivory,
      monster,
      [side * 0.48, 2.25, -0.01],
      [0.15, 0.47, 0.14],
    );
    horn.rotation.z = -side * 0.25;
    mesh(
      sphere,
      ivory,
      monster,
      [side * 0.28, 1.68, 0.56],
      [0.235, 0.26, 0.115],
    );
    mesh(
      sphere,
      ink,
      monster,
      [side * 0.28 + 0.048, 1.68, 0.665],
      [0.082, 0.119, 0.04],
    );
    mesh(
      sphere,
      ivory,
      monster,
      [side * 0.28 + 0.02, 1.73, 0.699],
      [0.025, 0.034, 0.012],
      false,
    );
    mesh(
      sphere,
      ceramic,
      monster,
      [side * 0.5, 1.39, 0.562],
      [0.13, 0.075, 0.04],
    );
  }
  const mouth = mesh(
    sphere,
    ink,
    monster,
    [0.035, 1.29, 0.63],
    [0.16, 0.075, 0.025],
  );
  const umbrella = new THREE.Group();
  umbrella.position.set(1.04, 1.8, 0.06);
  monster.add(umbrella);
  mesh(cylinder, trim, umbrella, [0, 0.55, 0], [0.033, 1.52, 0.033]);
  const canopy = new THREE.Group();
  canopy.position.y = 1.05;
  umbrella.add(canopy);
  const panels = 8,
    rings = 8,
    segments = 8;
  for (let panel = 0; panel < panels; panel++) {
    const positions: number[] = [],
      indices: number[] = [];
    for (let ring = 0; ring <= rings; ring++) {
      const radius = (ring / rings) * 1.42;
      for (let segment = 0; segment <= segments; segment++) {
        const angle = ((panel + segment / segments) / panels) * Math.PI * 2;
        const scallop =
          ring === rings ? Math.sin((segment / segments) * Math.PI) * 0.105 : 0;
        positions.push(
          Math.cos(angle) * radius,
          0.69 * Math.cos(((ring / rings) * Math.PI) / 2) + scallop,
          Math.sin(angle) * radius,
        );
        if (ring < rings && segment < segments) {
          const a = ring * (segments + 1) + segment,
            b = a + segments + 1;
          indices.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    mesh(
      geometry,
      material(panel % 2 ? "#e9a277" : "#bd634e", {
        side: THREE.DoubleSide,
        roughness: 0.72,
      }),
      canopy,
      [0, 0, 0],
    );
  }
  mesh(sphere, trim, canopy, [0, 0.71, 0], [0.075, 0.095, 0.075]);
  // Sparse rain is one instanced draw call; no particles or materials are allocated during playback.
  const rainGeometry = new THREE.CylinderGeometry(0.009, 0.009, 0.16, 3);
  geometries.add(rainGeometry);
  const rain = new THREE.InstancedMesh(
    rainGeometry,
    material("#a6c1d4", {
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
    96,
  );
  scene.add(rain);
  const dummy = new THREE.Object3D();
  dummy.rotation.z = -0.18;
  const moon = mesh(
    sphere,
    material("#f3cc91", { emissive: "#e5b271", emissiveIntensity: 0.5 }),
    scene,
    [-0.9, 6.1, -5.8],
    [0.72, 0.72, 0.28],
    false,
  );
  mesh(
    sphere,
    material("#293149"),
    scene,
    [-0.64, 6.28, -5.55],
    [0.65, 0.65, 0.22],
    false,
  );
  moon.receiveShadow = false;
  const starGeometry = new THREE.BufferGeometry();
  const starPositions: number[] = [];
  for (let i = 0; i < 45; i++)
    starPositions.push(
      -13 + ((i * 7.71) % 26),
      3.5 + ((i * 0.83) % 4),
      -8 - (i % 3),
    );
  starGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  geometries.add(starGeometry);
  const starMat = new THREE.PointsMaterial({
    color: "#b1c3cd",
    size: 0.045,
    sizeAttenuation: true,
  });
  materials.add(starMat);
  scene.add(new THREE.Points(starGeometry, starMat));
  // Bake the stationary set by material/shadow behavior. The creature and rain
  // keep their independent transforms; static timber no longer costs a draw per batten.
  scene.updateMatrixWorld(true);
  const batches = new Map<
    string,
    {
      material: THREE.Material;
      cast: boolean;
      receive: boolean;
      geometries: THREE.BufferGeometry[];
      objects: THREE.Mesh[];
    }
  >();
  scene.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      object === rain ||
      Array.isArray(object.material)
    )
      return;
    for (
      let parent: THREE.Object3D | null = object;
      parent;
      parent = parent.parent
    )
      if (parent === monster) return;
    const key = `${object.material.uuid}:${object.castShadow}:${object.receiveShadow}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = {
        material: object.material,
        cast: object.castShadow,
        receive: object.receiveShadow,
        geometries: [],
        objects: [],
      };
      batches.set(key, batch);
    }
    batch.geometries.push(
      object.geometry.clone().applyMatrix4(object.matrixWorld),
    );
    batch.objects.push(object);
  });
  for (const batch of batches.values()) {
    const combined = mergeGeometries(batch.geometries);
    batch.geometries.forEach((geometry) => geometry.dispose());
    if (!combined) continue;
    geometries.add(combined);
    const object = new THREE.Mesh(combined, batch.material);
    object.castShadow = batch.cast;
    object.receiveShadow = batch.receive;
    scene.add(object);
    batch.objects.forEach((mesh) => mesh.removeFromParent());
  }
  const gl = renderer.getContext();
  const rendererInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const stats: Stats = {
    frames: 0,
    disposed: false,
    time: 0,
    reduced: false,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    dpr: renderer.getPixelRatio(),
    cpuMs: [],
    intervalsMs: [],
    monsterX: 0,
    umbrella: 0,
    renderer: gl.getParameter(
      rendererInfo ? rendererInfo.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
    ),
  };
  canvas.foleyStats = stats;
  let lastTime = NaN,
    lastReduced = false,
    lastWall = 0,
    width = 0,
    height = 0;
  function draw(time: number, reduced: boolean) {
    if (stats.disposed) return;
    const rect = canvas.parentElement!.getBoundingClientRect();
    const resized =
      width !== Math.round(rect.width) || height !== Math.round(rect.height);
    if (resized) {
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, innerWidth < 720 ? 1.5 : 1.75),
      );
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const span = 4.8;
      camera.left = -span * aspect;
      camera.right = span * aspect;
      camera.top = span;
      camera.bottom = -span;
      camera.updateProjectionMatrix();
    }
    if (!resized && time === lastTime && reduced === lastReduced) return;
    const started = performance.now();
    const t = Math.max(0, Math.min(20, time));
    const travel = clamp((t - 1.1) / 9);
    const walking = t > 1.1 && t < CUES.footsteps.at(-1)!;
    const stride = walking
      ? Math.sin(((t - CUES.footsteps[0]) / 1.5) * Math.PI)
      : 0;
    monster.position.set(
      -4.4 + travel * 4.8,
      reduced ? 0 : Math.abs(stride) * 0.07,
      0.95,
    );
    monster.rotation.z = reduced ? 0 : stride * 0.022;
    feet[0].position.y = 0.24 + Math.max(0, stride) * 0.17;
    feet[1].position.y = 0.24 + Math.max(0, -stride) * 0.17;
    feet[0].position.z = 0.2 + stride * 0.15;
    feet[1].position.z = 0.2 - stride * 0.15;
    const opening = ease((t - 16) / 0.8);
    umbrella.visible = t >= 16;
    umbrella.scale.setScalar(Math.max(0.001, opening));
    arms[0].rotation.z = -0.15 + (reduced ? 0 : stride * 0.09);
    arms[1].rotation.z = 0.15 + opening * 1.8;
    const talking = CUES.creature.some((cue) => t >= cue && t < cue + 2.1);
    mouth.scale.y = talking
      ? 0.12 + (reduced ? 0.02 : Math.abs(Math.sin(t * 19)) * 0.12)
      : 0.065;
    for (let i = 0; i < 96; i++) {
      const phase = reduced ? 9 : t;
      dummy.position.set(
        -8 + ((i * 1.731 + phase * 0.26) % 16),
        0.4 + ((i * 0.791 - ((phase * 4.3) % 6) + 6) % 6),
        -3.7 + ((i * 0.647) % 8.2),
      );
      dummy.updateMatrix();
      rain.setMatrixAt(i, dummy.matrix);
    }
    rain.instanceMatrix.needsUpdate = true;
    // Reduced motion keeps the content clock and cues, removes flashes, bob and falling rain.
    key.intensity =
      3.1 +
      (!reduced && ((t > 5.35 && t < 5.48) || (t > 10.5 && t < 10.62))
        ? 1.7
        : 0);
    renderer.render(scene, camera);
    stats.frames++;
    stats.time = t;
    stats.reduced = reduced;
    stats.monsterX = monster.position.x;
    stats.umbrella = opening;
    stats.drawCalls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    stats.geometries = renderer.info.memory.geometries;
    stats.textures = renderer.info.memory.textures;
    stats.dpr = renderer.getPixelRatio();
    stats.cpuMs.push(performance.now() - started);
    if (stats.cpuMs.length > 180) stats.cpuMs.shift();
    if (lastWall && time !== lastTime) {
      stats.intervalsMs.push(started - lastWall);
      if (stats.intervalsMs.length > 180) stats.intervalsMs.shift();
    }
    lastWall = started;
    lastTime = time;
    lastReduced = reduced;
  }
  const resize = new ResizeObserver(() => draw(lastTime || 0, lastReduced));
  resize.observe(canvas.parentElement!);
  canvas.foleySeek = (time, reduced = false) => draw(time, reduced);
  return {
    draw,
    dispose() {
      if (stats.disposed) return;
      stats.disposed = true;
      resize.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      rain.dispose();
      key.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      stats.geometries = renderer.info.memory.geometries;
      stats.textures = renderer.info.memory.textures;
      delete canvas.foleySeek;
    },
  };
}
