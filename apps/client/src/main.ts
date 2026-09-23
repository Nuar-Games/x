/**
 * @x/client — 2.5D arena renderer (Three.js).
 *
 * Boundary (enforced by CI):
 * - may import only @x/engine's public API;
 * - sends commands, plays animations from engine events;
 * - never owns or mutates game truth.
 *
 * This is a greybox scene that proves the render pipeline builds and runs.
 * Arena work starts in X2 (see DECISIONS.md D-007).
 */
import * as THREE from "three";
import { RULES_VERSION } from "@x/engine";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

// Tilted 2.5D table camera.
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 9, 9);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(3, 8, 4);
sun.castShadow = true;
scene.add(sun);

const table = new THREE.Mesh(
  new THREE.BoxGeometry(12, 0.2, 8),
  new THREE.MeshStandardMaterial({ color: 0x3a3a3a })
);
table.position.y = -0.1;
table.receiveShadow = true;
scene.add(table);

// Greybox VS slots, one per player.
function card(z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.02, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x9a9a9a })
  );
  mesh.position.set(0, 0.01, z);
  mesh.castShadow = true;
  scene.add(mesh);
  return mesh;
}
const top = card(-1.3);
const bottom = card(1.3);

const hud = document.getElementById("hud");
if (hud) hud.textContent = `X greybox · rules ${RULES_VERSION}`;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Presentation-only idle motion. Not game state.
renderer.setAnimationLoop((timeMs: number) => {
  const lift = 0.05 + Math.sin(timeMs / 600) * 0.03;
  top.position.y = lift;
  bottom.position.y = lift;
  renderer.render(scene, camera);
});
