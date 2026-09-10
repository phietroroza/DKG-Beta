// ============================================================
// CONFIGURAÇÕES DO MAPA 3D (driftpark.glb)
// ============================================================
let mapScaleX = 1.0;
let mapScaleY = 1.0;
let mapScaleZ = 1.0;
let mapPosX = 0;
let mapPosY = -0.01;
let mapPosZ = 0;
let mapRotY = 0;

const customObjects = [];
let spawnPosX = 50;
let spawnPosZ = 50;
let spawnRotY = 0;

// ============================================================
// SISTEMA BASE THREE.JS - SEMPRE VHS [V5 FIX CAM + FUMACA]
// ============================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
sunLight.position.set(100, 200, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.8;
bloomPass.strength = 0.4;
bloomPass.radius = 0.2;
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

const RetroVHSShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "uTime": { value: 0.0 },
        "uIntensity": { value: 0.5 },
        "uResolution": { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        uniform float uIntensity;
        uniform vec2 uResolution;
        varying vec2 vUv;
        float noise(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 uv = vUv;
            vec2 dc = uv - 0.5;
            float dist = dot(dc, dc);
            uv = uv + dc * dist * 0.05 * uIntensity;
            float jitter = noise(vec2(uTime * 10.0, uv.y)) * 0.003 * uIntensity;
            if (noise(vec2(uTime, 0.0)) > 0.98) uv.x += jitter * 5.0;
            float offset = 0.004 * uIntensity;
            float r = texture2D(tDiffuse, uv + vec2(offset, 0.0)).r;
            float g = texture2D(tDiffuse, uv).g;
            float b = texture2D(tDiffuse, uv - vec2(offset, 0.0)).b;
            vec3 color = vec3(r, g, b);
            float scanline = sin(uv.y * uResolution.y * 1.5) * 0.06 * uIntensity;
            color -= scanline;
            float n = (noise(uv + uTime) - 0.5) * 0.12 * uIntensity;
            color += n;
            float gray = dot(color, vec3(0.299, 0.587, 0.114));
            color = mix(color, vec3(gray), 0.25 * uIntensity);
            float vignette = 1.0 - dist * 1.8 * uIntensity;
            color *= vignette;
            gl_FragColor = vec4(color, 1.0);
        }
    `
};
const retroPass = new THREE.ShaderPass(RetroVHSShader);
retroPass.enabled = true;
composer.addPass(retroPass);

// --- ESTADOS ---
const settings = { quality: "medium" };
let isGarage = false, isSettings = false;
let smokeIntensity = 0.7;
const lightIntensities = { front: 0, neon: 40, tail: 40, frontEnabled: false, neonEnabled: true };
const lightColors = { front: "#ffffff", neon: "#ff0000", tail: "#ff0000" };
const carAura = new THREE.PointLight(0xff0000, 0, 15);
scene.add(carAura);

const timeConfigs = {
    dia: { ambient: 0.7, sun: 0.9, exposure: 1.0, fog: 0x87ceeb, fogNear: 50, fogFar: 1500, lightsOn: false },
    tarde: { ambient: 0.5, sun: 0.7, exposure: 1.1, fog: 0xff8c42, fogNear: 30, fogFar: 800, lightsOn: false },
    noite: { ambient: 0.15, sun: 0.15, exposure: 0.8, fog: 0x050510, fogNear: 20, fogFar: 350, lightsOn: true }
};
let currentTime = "dia";

function setTimeOfDay(time) {
    currentTime = time;
    const cfg = timeConfigs[time];
    ambientLight.intensity = cfg.ambient;
    sunLight.intensity = cfg.sun;
    renderer.toneMappingExposure = cfg.exposure;
    scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);
    renderer.setClearColor(cfg.fog);
    document.querySelectorAll(".time-btn").forEach(b => {
        b.classList.toggle("active", b.innerText.toLowerCase() === time);
    });
    updateCarLightsState();
}
window.setTimeOfDay = setTimeOfDay;

function setSetting(type, value) {
    settings[type] = value;
    document.querySelectorAll(`#setting-${type} .quality-opt-btn`).forEach(b => {
        b.classList.toggle("active", b.innerText.toLowerCase().includes(value.toLowerCase()));
    });
    if (type === "quality") {
        if(value === "low"){
            bloomPass.enabled = false;
            renderer.shadowMap.enabled = false;
            renderer.setPixelRatio(1);
        }
        if(value === "medium"){
            bloomPass.enabled = true;
            bloomPass.strength = 0.4;
            renderer.shadowMap.enabled = false;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
        if(value === "high"){
            bloomPass.enabled = true;
            bloomPass.strength = 0.7;
            renderer.shadowMap.enabled = true;
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        }
        rebuildSmokePool();
    }
}
window.setSetting = setSetting;

function toggleSettings() {
    isSettings = !isSettings;
    document.getElementById("settings-menu").style.display = isSettings ? "flex" : "none";
}
window.toggleSettings = toggleSettings;

function updateFogIntensity(value) {
    const pct = parseInt(value);
    if (scene.fog) {
        const baseNear = timeConfigs[currentTime].fogNear;
        const baseFar = timeConfigs[currentTime].fogFar;
        scene.fog.far = baseFar - (pct / 100) * (baseFar * 0.8);
        scene.fog.near = baseNear + (pct / 100) * 10;
    }
    const label = document.getElementById("fog-intensity-value");
    if (label) label.innerText = pct + "%";
}
window.updateFogIntensity = updateFogIntensity;

function updateRadialBlurIntensity(value) {
    retroPass.uniforms["uIntensity"].value = parseInt(value) / 100;
    const label = document.getElementById("radial-blur-value");
    if (label) label.innerText = value + "%";
}
window.updateRadialBlurIntensity = updateRadialBlurIntensity;

function updateCarLightsState() {
    if (!player || !player.carLights) return;
    const isNight = timeConfigs[currentTime].lightsOn;
    const shouldBeOn = isNight || lightIntensities.frontEnabled;
    if (player.carLights.front) {
        player.carLights.front.forEach(l => {
            l.visible = shouldBeOn && lightIntensities.front > 0;
            l.intensity = lightIntensities.front * 0.15;
            l.color.set(lightColors.front);
        });
    }
    if (player.carLights.neon) {
        player.carLights.neon.forEach(l => {
            l.visible = isNight && lightIntensities.neonEnabled && lightIntensities.neon > 0;
            l.intensity = lightIntensities.neon * 0.8;
            l.color.set(lightColors.neon);
        });
    }
    carAura.visible = isNight && lightIntensities.neonEnabled && lightIntensities.neon > 0;
    carAura.intensity = lightIntensities.neon * 0.1;
    carAura.color.set(lightColors.neon);
    if (player.carLights.tail) {
        player.carLights.tail.forEach(l => {
            l.visible = isNight;
            l.intensity = lightIntensities.tail * 0.15;
            l.color.set(lightColors.tail);
        });
    }
}

window.updateLightIntensity = (type, value) => {
    const val = parseInt(value);
    lightIntensities[type] = val;
    if (type === 'front') lightIntensities.frontEnabled = val > 0;
    updateCarLightsState();
};
window.updateLightColor = (type, color) => { lightColors[type] = color; updateCarLightsState(); };
window.updateBodyColor = (color) => {
    if (!player.bodyParts) return;
    const c = new THREE.Color(color);
    player.bodyParts.forEach(part => { if (part.material) part.material.color.copy(c); });
};
window.updateSmokeIntensity = (value) => { smokeIntensity = parseInt(value) / 100.0; };

// --- FUMAÇA DIFERENCIADA POR QUALIDADE [FIX] ---
let smokePool = [];
let smokeGeoHigh = new THREE.PlaneGeometry(1.8, 1.8);
let smokeGeoMed = new THREE.PlaneGeometry(1.2, 1.2);
let smokeGeoLow = new THREE.SphereGeometry(0.12, 6, 6);
const textureLoader = new THREE.TextureLoader();
const smokeTexture = textureLoader.load('https://threejs.org/examples/textures/sprites/spark1.png');

function clearSmokePool() {
    smokePool.forEach(p => {
        if(p.mesh) scene.remove(p.mesh);
    });
    smokePool = [];
}

function rebuildSmokePool() {
    clearSmokePool();
    let count = 300;
    let useTexture = true;
    let geo = smokeGeoHigh;
    let color = 0xaaaaaa;
    let opacity = 0.5;

    if(settings.quality === "medium"){
        count = 140;
        geo = smokeGeoMed;
        opacity = 0.35;
        color = 0x999999;
    }
    if(settings.quality === "low"){
        count = 60;
        geo = smokeGeoLow;
        useTexture = false;
        opacity = 0.9;
        color = 0x444444;
    }

    for (let i = 0; i < count; i++) {
        let mat;
        if(useTexture){
            mat = new THREE.MeshBasicMaterial({ 
                map: smokeTexture, 
                transparent: true, 
                opacity: opacity,
                depthWrite: false,
                color: color
            });
        } else {
            // LOW = bolinhas saindo do pneu
            mat = new THREE.MeshBasicMaterial({ 
                color: color,
                transparent: true,
                opacity: opacity
            });
        }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.visible = false; 
        scene.add(mesh);
        smokePool.push({ mesh, life: 0, vel: new THREE.Vector3(), growth: 0, useTexture });
    }
    console.log(`Fumaça rebuild: ${settings.quality} - ${count} particulas`);
}

// Inicializa com medium
rebuildSmokePool();

function createSmoke(pos) {
    if (smokeIntensity <= 0) return;
    let spawnCount = 3;
    if(settings.quality === "high") spawnCount = Math.max(1, Math.round(4 * smokeIntensity));
    if(settings.quality === "medium") spawnCount = Math.max(1, Math.round(2 * smokeIntensity));
    if(settings.quality === "low") spawnCount = 1;

    for (let i = 0; i < spawnCount; i++) {
        const p = smokePool.find(p => !p.mesh.visible);
        if (!p) return;
        p.mesh.visible = true; 
        p.mesh.position.copy(pos);
        p.mesh.position.y += 0.15;
        if(settings.quality === "low"){
            // bolinha pequena, quase não cresce
            p.mesh.scale.setScalar(0.5 + Math.random() * 0.5);
            p.growth = 0.005;
            p.vel.set((Math.random() - 0.5) * 0.08, 0.05 + Math.random() * 0.05, (Math.random() - 0.5) * 0.08);
            p.life = 0.6;
        } else {
            p.mesh.scale.setScalar(0.4 + Math.random() * smokeIntensity);
            p.life = 1.0; 
            p.vel.set((Math.random() - 0.5) * 0.15, 0.08 + Math.random() * 0.08, (Math.random() - 0.5) * 0.15);
            p.growth = (0.02 + Math.random() * 0.04) * smokeIntensity;
            if(settings.quality === "medium") p.growth *= 0.6;
            p.mesh.lookAt(camera.position);
        }
    }
}

function updateSmoke(dt) {
    smokePool.forEach(p => { 
        if (!p.mesh.visible) return; 
        if(settings.quality === "low"){
            p.life -= 0.03 * dt * 60; 
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt * 60)); 
            p.mesh.material.opacity = Math.max(0, p.life * 0.8); 
        } else {
            p.life -= 0.012 * dt * 60; 
            p.mesh.position.add(p.vel.clone().multiplyScalar(dt * 60)); 
            p.mesh.scale.addScalar(p.growth * dt * 60); 
            p.mesh.material.opacity = Math.max(0, p.life * 0.4 * smokeIntensity); 
            if(p.useTexture) p.mesh.lookAt(camera.position);
        }
        if (p.life <= 0) p.mesh.visible = false; 
    });
}

const petalPool = [];
const petalGeo = new THREE.PlaneGeometry(0.1, 0.1);
const petalMat = new THREE.MeshBasicMaterial({ color: 0xffb7c5, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
for (let i = 0; i < 50; i++) {
    const mesh = new THREE.Mesh(petalGeo, petalMat.clone()); mesh.visible = false; scene.add(mesh);
    petalPool.push({ mesh, vel: new THREE.Vector3(), rot: 0 });
}
function updatePetals(dt) {
    if (Math.random() < 0.05 && player.mesh) {
        const p = petalPool.find(p => !p.mesh.visible);
        if (p) { p.mesh.visible = true; p.mesh.position.set(player.mesh.position.x + (Math.random()-0.5)*80, 20, player.mesh.position.z + (Math.random()-0.5)*80); p.vel.set((Math.random()-0.5)*0.05, -0.05, (Math.random()-0.5)*0.05); p.rot = Math.random()*0.05; }
    }
    petalPool.forEach(p => { if (p.mesh.visible) { p.mesh.position.add(p.vel.clone().multiplyScalar(dt*60)); p.mesh.rotation.z += p.rot * dt*60; if (p.mesh.position.y < 0) p.mesh.visible = false; } });
}

function drawSpeedometer(speedKmh) {
    const canvas = document.getElementById("speed-canvas"); if (!canvas) return;
    const ctx = canvas.getContext("2d"), cx = 150, cy = 150, r = 120;
    ctx.clearRect(0, 0, 300, 300);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0.75 * Math.PI, 2.25 * Math.PI); ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 15; ctx.stroke();
    for(let i=0; i<=9; i++) {
        let angle = 0.75 * Math.PI + (i/9) * 1.5 * Math.PI;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle)*(r-10), cy + Math.sin(angle)*(r-10)); ctx.lineTo(cx + Math.cos(angle)*r, cy + Math.sin(angle)*r);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 18px Orbitron"; ctx.textAlign = "center"; ctx.fillText(i, cx + Math.cos(angle)*(r-30), cy + Math.sin(angle)*(r-30) + 7);
    }
    let speedAngle = 0.75 * Math.PI + (Math.min(speedKmh, 250)/250) * 1.5 * Math.PI;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(speedAngle)*(r-15), cy + Math.sin(speedAngle)*(r-15));
    ctx.strokeStyle = "#ff4500"; ctx.lineWidth = 5; ctx.lineCap = "round"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fillStyle = "#ff4500"; ctx.fill();
    ctx.fillStyle = "#00d4ff"; ctx.font = "bold 40px Share Tech Mono"; ctx.textAlign = "center"; ctx.fillText(Math.round(speedKmh).toString().padStart(3, '0'), cx, cy + 80);
    ctx.font = "14px Orbitron"; ctx.fillText("KM/H", cx, cy + 105);
}

function drawMap() {
    const canvas = document.getElementById("minimap-canvas"); if (!canvas || !player.mesh) return;
    const ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height, cx = w/2, cy = h/2;
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.translate(cx, cy); ctx.rotate(-player.carAngle);
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.beginPath(); ctx.arc(0,0,w/2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#00d4ff"; ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(6,8); ctx.lineTo(-6,8); ctx.closePath(); ctx.fill();
    ctx.restore();
}

let player = { mesh: null, frontWheels: [], bodyParts: [], wheelParts: [], steeringWheel: null, carLights: null, speed: 0, carAngle: 0, moveAngle: 0, driftIntensity: 0, gear: 1, driftPoints: 0, isDrifting: false, isBurnout: false, money: 0, multiplier: 1.0, wheelRotation: 0, cameraMode: "third" };
const keys = {};
let spacePressed = false;

window.addEventListener("keydown", (e) => {
    if ((isGarage && e.code !== "KeyP") || (isSettings && e.code !== "Escape")) return;
    keys[e.code] = true;
    if (e.code === "Space") spacePressed = true;
    if (e.code === "KeyQ" && player.gear > -1) player.gear--;
    if (e.code === "KeyE" && player.gear < 6) player.gear++;
    if (e.code === "KeyO") player.cameraMode = player.cameraMode === "third" ? "first" : "third";
    if (e.code === "Escape") toggleSettings();
    if (e.code === "KeyP") { isGarage = !isGarage; document.getElementById("garage-overlay").style.display = isGarage ? "flex" : "none"; updateCarLightsState(); }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; if (e.code === "Space") spacePressed = false; });

let lastTime = performance.now(), gameStartTime = Date.now(), frames = 0, lastFpsUpdate = 0;

// --- CAMERA FIX SEM SOQUINHO ---
let cameraLookTarget = new THREE.Vector3();
let cameraPosTarget = new THREE.Vector3();

// --- CAMERA ORBIT DEBUG K/L ---
let cameraOrbitAngle = 0; // angulo extra da camera ao redor do carro
let targetCameraOrbit = 0;


function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.033, (now - lastTime) / 1000); lastTime = now;
    frames++;
    if (now > lastFpsUpdate + 1000) {
        const fps = Math.round((frames * 1000) / (now - lastFpsUpdate));
        const el = document.getElementById("fps-counter");
        if(el) el.innerText = `FPS: ${fps}`;
        frames = 0; lastFpsUpdate = now;
    }

    if (player.mesh && !isGarage && !isSettings) {
        const speedKmh = Math.abs(player.speed) * 272;
        let elapsed = Date.now() - gameStartTime;
        let mins = Math.floor(elapsed / 60000).toString().padStart(2, '0'), secs = Math.floor((elapsed % 60000) / 1000).toString().padStart(2, '0'), ms = Math.floor((elapsed % 1000) / 10).toString().padStart(2, '0');
        const timeEl = document.getElementById("time-val");
        if(timeEl) timeEl.innerText = `${mins}:${secs}:${ms}`;
        const coordsEl = document.getElementById("coords-hud");
        if(coordsEl) coordsEl.innerText = `POS: X: ${player.mesh.position.x.toFixed(2)} | Z: ${player.mesh.position.z.toFixed(2)}`;

        updateDriftPhysics(player, keys, spacePressed, dt);
        updateSmoke(dt); updatePetals(dt); drawSpeedometer(speedKmh); drawMap();

        if (player.isDrifting || player.isBurnout) {
            const lO = new THREE.Vector3(-0.6, 0, -1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.carAngle);
            const rO = new THREE.Vector3(0.6, 0, -1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.carAngle);
            createSmoke(player.mesh.position.clone().add(lO)); 
            createSmoke(player.mesh.position.clone().add(rO));
        }

        const driftEl = document.getElementById("drift-points");
        if(driftEl) driftEl.innerText = Math.floor(player.driftPoints).toLocaleString();
        const currEl = document.getElementById("current-drift-points");
        if(currEl) currEl.innerText = Math.floor(player.isDrifting ? player.driftPoints * 0.1 : 0).toLocaleString();
        const moneyEl = document.getElementById("money");
        if(moneyEl) moneyEl.innerText = `$ ${player.money.toLocaleString()}`;
        const indEl = document.getElementById("drift-indicator");
        if(indEl) indEl.style.display = player.isDrifting ? "block" : "none";

        retroPass.uniforms["uTime"].value = now * 0.001;
        carAura.position.copy(player.mesh.position); carAura.position.y += 1.0;

        // CAMERA SEM SOQUINHO - LERP FIXO SEM TF
        if (player.cameraMode === "third") {
            let targetFov = 60, camDistance = 5, camHeight = 2.8;
            if (speedKmh > 100) { targetFov = 60 + (speedKmh - 100) * 0.18; camDistance += (speedKmh - 100) * 0.008; }
            if (player.isDrifting) targetFov += 10;
            // FOV com lerp suave fixo, sem *60
            camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.05);
            camera.updateProjectionMatrix();
            
            // K/L orbit - gira ao redor do carro
            if (keys['KeyK']) targetCameraOrbit -= 0.04;
            if (keys['KeyL']) targetCameraOrbit += 0.04;
            // Reset orbit com tecla R
            if (keys['KeyR']) targetCameraOrbit = 0;
            cameraOrbitAngle = THREE.MathUtils.lerp(cameraOrbitAngle, targetCameraOrbit, 0.08);
            
            const totalAngle = player.carAngle + cameraOrbitAngle;
            const idealOffset = new THREE.Vector3(-Math.sin(totalAngle) * camDistance, camHeight, -Math.cos(totalAngle) * camDistance);
            cameraPosTarget.copy(player.mesh.position).add(idealOffset);
            camera.position.lerp(cameraPosTarget, 0.08);
            
            cameraLookTarget.lerp(new THREE.Vector3(player.mesh.position.x, 1.0, player.mesh.position.z), 0.12);
            camera.lookAt(cameraLookTarget);
        } else {
            camera.fov = THREE.MathUtils.lerp(camera.fov, 75, 0.1);
            camera.updateProjectionMatrix();
            const cockpitOffset = new THREE.Vector3(0, 0.8, 0.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.carAngle);
            camera.position.copy(player.mesh.position.clone().add(cockpitOffset));
            const lookAtPos = new THREE.Vector3(Math.sin(player.carAngle) * 10, 0.8, Math.cos(player.carAngle) * 10).add(player.mesh.position);
            camera.lookAt(lookAtPos);
        }
        updateChunks(scene, player.mesh.position.x, player.mesh.position.z);
    }
    composer.render();
}

function loadMap(scene) {
    return new Promise((resolve) => {
        const loader = new THREE.GLTFLoader();
        loader.load("models/driftpark.glb", (gltf) => {
            const m = gltf.scene; 
            m.scale.set(mapScaleX, mapScaleY, mapScaleZ);
            m.position.set(mapPosX, mapPosY, mapPosZ);
            m.rotation.y = mapRotY;
            m.traverse(c => { 
                if (c.isMesh) { 
                    c.receiveShadow = true; 
                    if(c.material) { 
                        c.material.roughness = 0.8; 
                        c.material.metalness = 0.2; 
                    } 
                } 
            });
            scene.add(m); resolve();
        }, undefined, () => {
            console.warn("driftpark.glb não encontrado");
            resolve();
        });
    });
}

function loadCustomObjects(scene) {
    const loader = new THREE.GLTFLoader();
    return Promise.all(customObjects.map(obj => {
        return new Promise((resolve) => {
            loader.load(obj.path, (gltf) => {
                const m = gltf.scene; m.position.set(obj.x, obj.y, obj.z);
                m.scale.setScalar(obj.scale || 1.0); m.rotation.y = obj.rotY || 0;
                m.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                scene.add(m); resolve();
            }, undefined, () => resolve());
        });
    }));
}

function init() {
    document.getElementById("hud-container").classList.add("vhs-active");
    document.getElementById("vhs-overlay").style.display = "block";
    setTimeOfDay("dia");
    Promise.all([loadMap(scene), loadCar(scene), loadCustomObjects(scene)]).then(([_, carRes]) => {
        player = {...player,...carRes };
        player.mesh.position.set(spawnPosX, 0, spawnPosZ);
        scene.add(player.mesh);
        updateChunks(scene, spawnPosX, spawnPosZ);
        document.getElementById("loading").style.display = "none";
        updateCarLightsState();
        animate(performance.now());
    });
}
window.addEventListener("resize", () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight); });
init();
