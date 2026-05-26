// Regenix — exoskeleton_segment.stl viewer for the deep-dive approach section.
// Uses exoskeleton_segment.stl (single chain segment), distinct from the
// full exoskeleton.stl shown on the overview page.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

const HOST_ID = 'segment-detail-canvas';
const STL_URL = 'assets/exoskeleton_segment.stl';

const host = document.getElementById(HOST_ID);
if (host) initSegmentDetailViewer(host);

function initSegmentDetailViewer(host) {
  const scene = new THREE.Scene();
  scene.background = null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 200);

  // Lighting — match site-wide rig
  scene.add(Object.assign(new THREE.DirectionalLight(0xe6efff, 1.55), { position: new THREE.Vector3(4, 5.5, 3.5) }));
  scene.add(Object.assign(new THREE.DirectionalLight(0xa3c9b1, 0.65), { position: new THREE.Vector3(-4, 2, 2) }));
  scene.add(Object.assign(new THREE.DirectionalLight(0xf0d6b0, 0.85), { position: new THREE.Vector3(-2, 1.5, -4) }));
  const hemi = new THREE.HemisphereLight(0xfdfbf5, 0.55);
  hemi.groundColor = new THREE.Color(0xd8d4c6);
  scene.add(hemi);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;
  controls.minDistance = 0.5;
  controls.maxDistance = 16;

  let homeCamPos = new THREE.Vector3(3, 0.6, 4);
  renderer.domElement.addEventListener('dblclick', () => {
    camera.position.copy(homeCamPos);
    controls.target.set(0, 0, 0);
    controls.update();
  });

  const mat = new THREE.MeshStandardMaterial({
    color: 0xdfd6c2,
    roughness: 0.72,
    metalness: 0.08,
  });

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
    if (rawSize.z >= rawSize.y && rawSize.z >= rawSize.x)      mesh.rotation.x = -Math.PI / 2;
    else if (rawSize.x > rawSize.y) mesh.rotation.z = -Math.PI / 2;

    mesh.scale.setScalar(1.6 / Math.max(rawSize.x, rawSize.y, rawSize.z));

    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    const worldBox = new THREE.Box3().setFromObject(group);
    const worldCenter = new THREE.Vector3();
    worldBox.getCenter(worldCenter);
    group.position.sub(worldCenter);

    const worldSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(group).getSize(worldSize);
    const radius = 0.5 * worldSize.length();
    const dist   = (radius / Math.sin((camera.fov * Math.PI / 180) / 2)) * 1.1;
    camera.position.set(dist * 0.55, dist * 0.2, dist * 0.85);
    controls.update();
    homeCamPos = camera.position.clone();

    const hint = document.getElementById('segment-detail-loading');
    if (hint) hint.style.display = 'none';
  }, (xhr) => {
    const hint = document.getElementById('segment-detail-loading');
    if (hint && xhr.lengthComputable)
      hint.textContent = 'Loading · ' + Math.round((xhr.loaded / xhr.total) * 100) + '%';
  }, (err) => {
    console.error('Segment detail STL load failed', err);
  });

  function fit() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  fit();
  new ResizeObserver(fit).observe(host);

  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();
}
