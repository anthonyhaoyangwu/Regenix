// RENA exoskeleton — Three.js scene loading the supplied STL scan.
//
// Lighting is botanical-specimen / museum: cool daylight key,
// soft green fill, warm rim. Background is the page cream.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const HOST_ID = 'viewer-canvas';
const STL_URL = 'assets/exoskeleton.stl';

const host = document.getElementById(HOST_ID);
if (host) initViewer(host);

function initViewer(host) {
  // ---------- scene & renderer ----------
  const scene = new THREE.Scene();
  scene.background = null; // CSS gradient shows through

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 200);
  camera.position.set(3.2, 0.6, 4.0);

  // ---------- lights (botanical specimen) ----------
  // Cool daylight key (top-right)
  const key = new THREE.DirectionalLight(0xe6efff, 1.55);
  key.position.set(4, 5.5, 3.5);
  scene.add(key);

  // Soft green botanical fill (left)
  const fill = new THREE.DirectionalLight(0xa3c9b1, 0.65);
  fill.position.set(-4, 2, 2);
  scene.add(fill);

  // Warm rim (back)
  const rim = new THREE.DirectionalLight(0xf0d6b0, 0.85);
  rim.position.set(-2, 1.5, -4);
  scene.add(rim);

  // Hemisphere for ambient body bounce — sky cream, ground deeper cream
  const hemi = new THREE.HemisphereLight(0xfdfbf5, 0.55);
  hemi.color.setHex(0xfdfbf5);
  hemi.groundColor = new THREE.Color(0xd8d4c6);
  hemi.intensity = 0.55;
  scene.add(hemi);

  // Faint ground bounce disc beneath the model
  const groundGeo = new THREE.CircleGeometry(3.0, 64);
  const groundMat = new THREE.MeshBasicMaterial({
    color: 0xd8d4c6, transparent: true, opacity: 0.35, side: THREE.DoubleSide
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.65;
  scene.add(ground);

  // ---------- placeholder (subtle dot at origin until model arrives) ----------
  // Intentionally tiny so it doesn't read as an "empty" sphere outline.
  const placeholder = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x3d7a5a })
  );
  scene.add(placeholder);

  // ---------- controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.0;
  controls.maxDistance = 12.0;
  controls.target.set(0, 0, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  // Default home position (recomputed once model loads)
  let homeCamPos = camera.position.clone();
  let homeTarget = new THREE.Vector3(0, 0, 0);

  renderer.domElement.addEventListener('dblclick', () => resetView());

  // ---------- material ----------
  // Cream specimen surface, slight metallic to catch the green fill
  const modelMaterial = new THREE.MeshStandardMaterial({
    color: 0xefe9d9,
    roughness: 0.82,
    metalness: 0.08,
    flatShading: false,
  });

  // ---------- load STL ----------
  let model = null;
  let modelMesh = null;
  const loader = new STLLoader();

  loader.load(STL_URL, (geometry) => {
    geometry.computeVertexNormals();

    // (1) Center the geometry on the origin so all subsequent
    // rotations + scales orbit around its center, not its corner.
    geometry.computeBoundingBox();
    const rawSize = new THREE.Vector3();
    const rawCenter = new THREE.Vector3();
    geometry.boundingBox.getSize(rawSize);
    geometry.boundingBox.getCenter(rawCenter);
    geometry.translate(-rawCenter.x, -rawCenter.y, -rawCenter.z);

    // (2) Pick the rotation that puts the longest axis vertical (+Y).
    //     The STL scan is laid out with Z as the long limb axis;
    //     the scan is also flipped, so we want +Z → -Y (head down
    //     in scan-space → head up in world-space).
    modelMesh = new THREE.Mesh(geometry, modelMaterial);
    if (rawSize.z >= rawSize.y && rawSize.z >= rawSize.x) {
      modelMesh.rotation.x = -Math.PI / 2;
    } else if (rawSize.x > rawSize.y) {
      modelMesh.rotation.z = -Math.PI / 2;
    } // else: Y already longest, no rotation

    // (3) Normalize the visual height so the model fills ~40% of the
    //     viewer height (room around it reads like a museum specimen).
    const longest = Math.max(rawSize.x, rawSize.y, rawSize.z);
    const targetSize = 1.2;
    modelMesh.scale.setScalar(targetSize / longest);

    model = new THREE.Group();
    model.add(modelMesh);
    scene.add(model);
    scene.remove(placeholder);

    // (4) Recenter the GROUP on world origin.
    const worldBox = new THREE.Box3().setFromObject(model);
    const worldCenter = new THREE.Vector3();
    worldBox.getCenter(worldCenter);
    model.position.sub(worldCenter);

    // (5) Camera framing: derive distance from the *projected* radius
    //     so the model fills ~70% of the smaller viewport dimension.
    const worldSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(model).getSize(worldSize);
    const radius = 0.5 * worldSize.length();
    const fovV = camera.fov * Math.PI / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const fov = Math.min(fovV, fovH);
    const dist = (radius / Math.sin(fov / 2)) * 1.05;

    camera.position.set(dist * 0.55, dist * 0.18, dist * 0.82);
    controls.target.set(0, 0, 0);

    // Shift the rendered subject to the left within the viewport
    // via an asymmetric view offset — the camera still orbits the
    // model center, but the visible frustum is cropped from the right.
    applyShiftLeft();
    controls.update();
    homeCamPos = camera.position.clone();
    homeTarget = controls.target.clone();

    // Hide loading hint
    const hint = document.getElementById('viewer-loading');
    if (hint) hint.style.display = 'none';
  }, (xhr) => {
    if (xhr.lengthComputable) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      const el = document.getElementById('viewer-loading');
      if (el) el.textContent = 'Loading specimen · ' + pct + '%';
    }
  }, (err) => {
    console.error('STL load failed', err);
    const el = document.getElementById('viewer-loading');
    if (el) el.textContent = 'Specimen unavailable';
  });

  // ---------- UI hooks ----------
  let wireframe = false;
  function setWireframe(on) {
    wireframe = on;
    modelMaterial.wireframe = on;
    document.getElementById('btn-wire')?.classList.toggle('on', on);
  }

  function setAutoRotate(on) {
    controls.autoRotate = on;
    document.getElementById('btn-rotate')?.classList.toggle('on', on);
  }

  function resetView() {
    camera.position.copy(homeCamPos);
    controls.target.copy(homeTarget);
    controls.update();
  }

  document.getElementById('btn-reset')?.addEventListener('click', resetView);
  document.getElementById('btn-wire')?.addEventListener('click', () => setWireframe(!wireframe));
  document.getElementById('btn-rotate')?.addEventListener('click', () => setAutoRotate(!controls.autoRotate));

  setAutoRotate(true);

  // ---------- view offset (shifts the rendered subject to the left) ----------
  // We expand the camera's virtual frustum to the right and render only
  // the right portion. Net effect: content appears shifted left in-viewport
  // without breaking auto-rotate (which still orbits the model center).
  const VIEW_SHIFT_FRAC_X = 0.30; // 30% leftward shift
  const VIEW_SHIFT_FRAC_Y = 0.14; // 14% upward shift
  function applyShiftLeft() {
    if (!renderer.domElement) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    if (!w || !h) return;
    const fullW = w / (1 - VIEW_SHIFT_FRAC_X);
    const fullH = h / (1 - VIEW_SHIFT_FRAC_Y);
    // Render the right-bottom slice of the virtual canvas; net effect:
    // content shifts left and up in the actual viewport.
    camera.setViewOffset(fullW, fullH, fullW - w, fullH - h, w, h);
  }

  // ---------- resize ----------
  // ---------- resize ----------
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (model) applyShiftLeft();
  }
  fit();
  new ResizeObserver(fit).observe(host);
  window.addEventListener('resize', fit);

  // ---------- live stat ticker ----------
  const elAngle = document.getElementById('stat-angle');
  const elForce = document.getElementById('stat-force');
  const elTorque = document.getElementById('stat-torque');
  let t = 0;
  function tickStats() {
    t += 0.012;
    const angle = 72 + Math.sin(t * 0.9) * 36;     // 36° – 108°
    const force = 180 + Math.sin(t * 1.1 + 1) * 80; // 100 – 260 N
    const torque = force * 0.04 + 1.2;
    if (elAngle) elAngle.textContent = angle.toFixed(1) + '°';
    if (elForce) elForce.textContent = force.toFixed(0) + ' N';
    if (elTorque) elTorque.textContent = torque.toFixed(2) + ' Nm';
  }

  // ---------- animation loop ----------
  function loop() {
    requestAnimationFrame(loop);
    controls.update();
    tickStats();
    renderer.render(scene, camera);
  }
  loop();
}
