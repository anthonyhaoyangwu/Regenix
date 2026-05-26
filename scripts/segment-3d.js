// Regenix — exoskeleton_segment.stl viewer
// Used in the semi-rigid chain alignment diagram (index.html).
// Identical lighting rig to chain-3d.js; auto-rotates slowly.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const HOST_ID  = 'segment-canvas';
const STL_URL  = 'assets/exoskeleton.stl';

const host = document.getElementById(HOST_ID);
if (host) initSegmentViewer(host);

function initSegmentViewer(host) {
  const scene = new THREE.Scene();
  scene.background = null;           // transparent — CSS background shows through

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);

  // ── Lights (match hero / chain viewers) ──────────────────────
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
  scene.add(hemi);

  // ── Controls ─────────────────────────────────────────────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.5;
  controls.maxDistance = 16.0;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;

  renderer.domElement.addEventListener('dblclick', () => {
    camera.position.copy(homeCamPos);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  // ── Material — warm PETG-like plastic ───────────────────────
  const mat = new THREE.MeshStandardMaterial({
    color: 0xdfd6c2,
    roughness: 0.72,
    metalness: 0.08,
    flatShading: false,
  });

  // ── Load STL ─────────────────────────────────────────────────
  let homeCamPos = new THREE.Vector3(3, 0.6, 4);

  const loader = new STLLoader();
  loader.load(STL_URL, (geometry) => {
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    const rawSize   = new THREE.Vector3();
    const rawCenter = new THREE.Vector3();
    geometry.boundingBox.getSize(rawSize);
    geometry.boundingBox.getCenter(rawCenter);
    geometry.translate(-rawCenter.x, -rawCenter.y, -rawCenter.z);

    const mesh = new THREE.Mesh(geometry, mat);

    // Orient longest axis vertical
    if (rawSize.z >= rawSize.y && rawSize.z >= rawSize.x) {
      mesh.rotation.x = -Math.PI / 2;
    } else if (rawSize.x > rawSize.y) {
      mesh.rotation.z = -Math.PI / 2;
    }

    const longest = Math.max(rawSize.x, rawSize.y, rawSize.z);
    mesh.scale.setScalar(1.6 / longest);

    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    // Re-centre after orient + scale
    const worldBox    = new THREE.Box3().setFromObject(group);
    const worldCenter = new THREE.Vector3();
    worldBox.getCenter(worldCenter);
    group.position.sub(worldCenter);

    // Frame camera
    const worldSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(worldSize);
    const radius = 0.5 * worldSize.length();
    const fovRad = camera.fov * Math.PI / 180;
    const dist   = (radius / Math.sin(fovRad / 2)) * 1.1;

    camera.position.set(dist * 0.55, dist * 0.2, dist * 0.85);
    controls.target.set(0, 0, 0);
    controls.update();
    homeCamPos = camera.position.clone();

    const hint = document.getElementById('segment-loading');
    if (hint) hint.style.display = 'none';

  }, (xhr) => {
    const hint = document.getElementById('segment-loading');
    if (hint && xhr.lengthComputable) {
      hint.textContent = 'Loading · ' + Math.round((xhr.loaded / xhr.total) * 100) + '%';
    }
  }, (err) => {
    console.error('Segment STL load failed', err);
    const hint = document.getElementById('segment-loading');
    if (hint) hint.textContent = 'Model unavailable';
  });

  // ── Resize ───────────────────────────────────────────────────
  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();
  new ResizeObserver(fit).observe(host);

  // ── Render loop ──────────────────────────────────────────────
  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();
}
