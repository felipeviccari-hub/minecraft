import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// =====================================================
// CONFIGURAÇÃO DA CENA E ILUMINAÇÃO
// =====================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 120);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.8);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(40, 60, 20);
sun.castShadow = true;
sun.shadow.mapSize.width = 1024;
sun.shadow.mapSize.height = 1024;
scene.add(sun);

// =====================================================
// GERADOR DE TEXTURAS PROCEDURAIS (PIXEL ART)
// =====================================================
function createPixelTexture(baseColor, noiseColor, size = 16) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      if (Math.random() > 0.6) {
        ctx.fillStyle = noiseColor;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  return texture;
}

const materials = {
  grass: new THREE.MeshLambertMaterial({ map: createPixelTexture("#4caf50", "#388e3c") }),
  dirt: new THREE.MeshLambertMaterial({ map: createPixelTexture("#795548", "#5d4037") }),
  stone: new THREE.MeshLambertMaterial({ map: createPixelTexture("#9e9e9e", "#616161") }),
  wood: new THREE.MeshLambertMaterial({ map: createPixelTexture("#8d6e63", "#4e342e") }),
  leaves: new THREE.MeshLambertMaterial({ map: createPixelTexture("#2e7d32", "#1b5e20") })
};

// =====================================================
// DESTAQUE DO BLOCO (OUTLINE)
// =====================================================
const highlightGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
const highlightMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true });
const highlightBox = new THREE.Mesh(highlightGeo, highlightMat);
highlightBox.visible = false;
scene.add(highlightBox);

// =====================================================
// ESTRUTURA DO MUNDO (GRELHA 3D)
// =====================================================
const blockGeometry = new THREE.BoxGeometry(1, 1, 1);
const worldMap = new Map(); // Guarda blocos por chave "x,y,z"

function getKey(x, y, z) {
  return `${x},${y},${z}`;
}

function addBlockData(x, y, z, type) {
  const key = getKey(x, y, z);
  if (worldMap.has(key)) removeBlockData(x, y, z);

  const mesh = new THREE.Mesh(blockGeometry, materials[type] || materials.grass);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { x, y, z, type };

  scene.add(mesh);
  worldMap.set(key, mesh);
}

function removeBlockData(x, y, z) {
  const key = getKey(x, y, z);
  const mesh = worldMap.get(key);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    worldMap.delete(key);
  }
}

// =====================================================
// GERAÇÃO DE TERRENO E ÁRVORES
// =====================================================
const WORLD_SIZE = 25;

function getHeight(x, z) {
  return Math.floor(3 + Math.sin(x * 0.2) * 2 + Math.cos(z * 0.2) * 2);
}

for (let x = -WORLD_SIZE; x <= WORLD_SIZE; x++) {
  for (let z = -WORLD_SIZE; z <= WORLD_SIZE; z++) {
    const height = getHeight(x, z);
    for (let y = 0; y <= height; y++) {
      let type = "dirt";
      if (y === height) type = "grass";
      if (y < height - 2) type = "stone";
      addBlockData(x, y, z, type);
    }
  }
}

function createTree(x, y, z) {
  for (let i = 1; i <= 4; i++) addBlockData(x, y + i, z, "wood");
  for (let dx = -2; dx <= 2; dx++) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dy = 3; dy <= 5; dy++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy - 4) < 4) {
          if (!worldMap.has(getKey(x + dx, y + dy, z + dz))) {
            addBlockData(x + dx, y + dy, z + dz, "leaves");
          }
        }
      }
    }
  }
}

for (let i = 0; i < 15; i++) {
  const x = Math.floor(Math.random() * (WORLD_SIZE * 2 - 4)) - (WORLD_SIZE - 2);
  const z = Math.floor(Math.random() * (WORLD_SIZE * 2 - 4)) - (WORLD_SIZE - 2);
  const y = getHeight(x, z);
  createTree(x, y, z);
}

// =====================================================
// JOGADOR E CONTROLES
// =====================================================
const player = {
  position: new THREE.Vector3(0, 10, 0),
  velocity: new THREE.Vector3(),
  speed: 7,
  jumpPower: 8.5,
  height: 1.8
};

const keys = {};
let selectedBlock = "grass";

document.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (e.code === "Digit1") selectBlock("grass");
  if (e.code === "Digit2") selectBlock("dirt");
  if (e.code === "Digit3") selectBlock("stone");
  if (e.code === "Digit4") selectBlock("wood");
  if (e.code === "Digit5") selectBlock("leaves");
});

document.addEventListener("keyup", (e) => { keys[e.code] = false; });

function selectBlock(type) {
  selectedBlock = type;
  document.querySelectorAll(".slot").forEach(s => s.classList.remove("selected"));
  const target = document.querySelector(`.slot[data-block="${type}"]`);
  if (target) target.classList.add("selected");
}

// Movimento do Mouse
let yaw = 0, pitch = 0;
document.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement !== document.body) return;
  yaw -= e.movementX * 0.0025;
  pitch -= e.movementY * 0.0025;
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
});

// =====================================================
// INTERAÇÃO (RAYCASTING E COLISÃO SIMPLES)
// =====================================================
const raycaster = new THREE.Raycaster();

function getTargetBlock() {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const meshes = Array.from(worldMap.values());
  const intersects = raycaster.intersectObjects(meshes);
  return intersects.length > 0 ? intersects[0] : null;
}

document.addEventListener("mousedown", (e) => {
  if (document.pointerLockElement !== document.body) return;
  const hit = getTargetBlock();
  if (!hit) return;

  const bPos = hit.object.userData;

  // Quebrar Bloco
  if (e.button === 0) {
    removeBlockData(bPos.x, bPos.y, bPos.z);
  }
  // Colocar Bloco
  else if (e.button === 2) {
    const normal = hit.face.normal;
    const nx = bPos.x + normal.x;
    const ny = bPos.y + normal.y;
    const nz = bPos.z + normal.z;

    // Evita colocar bloco no próprio jogador
    const pX = Math.round(player.position.x);
    const pY = Math.floor(player.position.y);
    const pZ = Math.round(player.position.z);

    if (nx === pX && (ny === pY || ny === pY - 1) && nz === pZ) return;

    addBlockData(nx, ny, nz, selectedBlock);
  }
});

document.addEventListener("contextmenu", e => e.preventDefault());

// =====================================================
// FÍSICA E ATUALIZAÇÃO DO JOGADOR
// =====================================================
function getGroundHeight(x, z) {
  let maxY = -1;
  for (let y = 20; y >= 0; y--) {
    if (worldMap.has(getKey(x, y, z))) {
      maxY = y;
      break;
    }
  }
  return maxY;
}

let grounded = false;

function updatePlayer(delta) {
  const move = new THREE.Vector3();
  if (keys["KeyW"]) move.z -= 1;
  if (keys["KeyS"]) move.z += 1;
  if (keys["KeyA"]) move.x -= 1;
  if (keys["KeyD"]) move.x += 1;

  if (move.length() > 0) move.normalize();
  move.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

  player.position.x += move.x * player.speed * delta;
  player.position.z += move.z * player.speed * delta;

  // Gravidade
  player.velocity.y -= 25 * delta;
  player.position.y += player.velocity.y * delta;

  // Checagem de Chão
  const pX = Math.round(player.position.x);
  const pZ = Math.round(player.position.z);
  const groundY = getGroundHeight(pX, pZ);
  const minY = groundY + 1 + player.height;

  if (player.position.y <= minY) {
    player.position.y = minY;
    player.velocity.y = 0;
    grounded = true;
  } else {
    grounded = false;
  }

  // Pulo
  if (keys["Space"] && grounded) {
    player.velocity.y = player.jumpPower;
    grounded = false;
  }

  // Limite do mapa
  player.position.x = THREE.MathUtils.clamp(player.position.x, -WORLD_SIZE, WORLD_SIZE);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -WORLD_SIZE, WORLD_SIZE);

  // Câmera
  camera.position.copy(player.position);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  // Atualizar Mira do Bloco
  const hit = getTargetBlock();
  if (hit) {
    highlightBox.position.copy(hit.object.position);
    highlightBox.visible = true;
  } else {
    highlightBox.visible = false;
  }
}

// =====================================================
// MENU E POINTER LOCK
// =====================================================
const menu = document.getElementById("menu");
const startButton = document.getElementById("start");

startButton.addEventListener("click", () => {
  document.body.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === document.body) {
    menu.style.display = "none";
  } else {
    menu.style.display = "flex";
  }
});

document.querySelectorAll(".slot").forEach(slot => {
  slot.addEventListener("click", () => selectBlock(slot.dataset.block));
});

// =====================================================
// LOOP PRINCIPAL
// =====================================================
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (document.pointerLockElement === document.body) {
    updatePlayer(delta);
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});