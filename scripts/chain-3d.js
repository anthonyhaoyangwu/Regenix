// RENA semi-rigid chain — Three.js viewer for the chain STL.
// Plays the same museum-specimen lighting as the hero viewer
// but with no overlays, no stat ticker, no view-offset.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const HOST_ID = 'chain-canvas';
const STL_URL = 'assets/chain.stl';

const host = document.getElementById(HOST_ID);
if (host) initChainViewer(host);

function initChainViewer(host) {
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.01, 200);
  camera.position.set(3.2, 0.6, 4.0);

  // ---------- lights (match hero) ----------
  const key = new THREE.DirectionalLight(0xe6efff, 1.55);
  key.position.set(4, 5.5, 3.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xa3c9b1, 0.65);
  fill.position.set(-4, 2, 2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xf0d6b0, 0.85);
  rim.position.set(-2, 1.5, -4);
  scene.add(rim);

  const hemi = new THREE.HemisphereLight(0xfdfbf5, 0.55);
  hemi.groundColor = new THREE.Color(0xd8d4c6);
  hemi.intensity = 0.55;
  scene.add(hemi);

  // Faint ground bounce disc
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3.0, 64),
    new THREE.MeshBasicMaterial({ color: 0xd8d4c6, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1.0;
  scene.add(ground);

  // ---------- controls ----------
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.0;
  controls.maxDistance = 12.0;
  controls.target.set(0, 0, 0);
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  let homeCamPos = camera.position.clone();
  let homeTarget = new THREE.Vector3(0, 0, 0);
  renderer.domElement.addEventListener('dblclick', () => {
    camera.position.copy(homeCamPos);
    controls.target.copy(homeTarget);
    controls.update();
  });

  // ---------- material ----------
  const chainMaterial = new THREE.MeshStandardMaterial({
    color: 0xefe9d9,
    roughness: 0.78,
    metalness: 0.10,
    flatShading: false,
  });

  // ---------- load STL ----------
  const loader = new STLLoader();
  loader.load(STL_URL, (geometry) => {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const rawSize = new THREE.Vector3();
    const rawCenter = new THREE.Vector3();
    geometry.boundingBox.getSize(rawSize);
    geometry.boundingBox.getCenter(rawCenter);
    geometry.translate(-rawCenter.x, -rawCenter.y, -rawCenter.z);

    const mesh = new THREE.Mesh(geometry, chainMaterial);

    // Orient longest axis vertical
    if (rawSize.z >= rawSize.y && rawSize.z >= rawSize.x) {
      mesh.rotation.x = -Math.PI / 2;
    } else if (rawSize.x > rawSize.y) {
      mesh.rotation.z = -Math.PI / 2;
    }

    const longest = Math.max(rawSize.x, rawSize.y, rawSize.z);
    mesh.scale.setScalar(1.4 / longest);

    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    // Recenter
    const worldBox = new THREE.Box3().setFromObject(group);
    const worldCenter = new THREE.Vector3();
    worldBox.getCenter(worldCenter);
    group.position.sub(worldCenter);

    // Frame
    const worldSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(worldSize);
    const radius = 0.5 * worldSize.length();
    const fovV = camera.fov * Math.PI / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * camera.aspect);
    const fov = Math.min(fovV, fovH);
    const dist = (radius / Math.sin(fov / 2)) * 1.05;

    // Zoomed out — model reads small in the frame
    const ZOOM_OUT = 2.4;
    camera.position.set(dist * 0.55 * ZOOM_OUT, dist * 0.18 * ZOOM_OUT, dist * 0.82 * ZOOM_OUT);
    controls.target.set(0, 0, 0);
    applyShiftLeft();
    controls.update();
    homeCamPos = camera.position.clone();
    homeTarget = controls.target.clone();

    const hint = document.getElementById('chain-loading');
    if (hint) hint.style.display = 'none';
  }, (xhr) => {
    if (xhr.lengthComputable) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      const el = document.getElementById('chain-loading');
      if (el) el.textContent = 'Loading chain · ' + pct + '%';
    }
  }, (err) => {
    console.error('Chain STL load failed', err);
    const el = document.getElementById('chain-loading');
    if (el) el.textContent = 'Chain model unavailable';
  });

  // ---------- view offset (shift content within viewport) ----------
  const VIEW_SHIFT_FRAC_X = 0.15; // slight leftward shift (model moves right vs prior)
  const VIEW_SHIFT_FRAC_Y = 0.28; // upward shift (model moves up)
  function applyShiftLeft() {
    if (!renderer.domElement) return;
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    if (!w || !h) return;
    const fullW = w / (1 - VIEW_SHIFT_FRAC_X);
    const fullH = h / (1 - VIEW_SHIFT_FRAC_Y);
    // Render the bottom-right slice of the virtual canvas;
    // net effect: content shifts left and up in the viewport.
    camera.setViewOffset(fullW, fullH, fullW - w, fullH - h, w, h);
  }

  // ---------- resize ----------
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    applyShiftLeft();
  }
  fit();
  new ResizeObserver(fit).observe(host);
  window.addEventListener('resize', fit);

  // ---------- loop ----------
  function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  }
  loop();
}
