// main.js - Versão DKG com Lanternas Traseiras Corrigidas
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.physicallyCorrectLights = true; // necessário para reflexo correto de luz no MeshStandardMaterial
document.body.appendChild(renderer.domElement);
window.renderer = renderer;

// --- PÓS-PROCESSAMENTO ---
const renderScene = new THREE.RenderPass(scene, camera);
const bloomPass = new THREE.UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    1.0, 0.4, 0.85
);
const composer = new THREE.EffectComposer(renderer);
composer.addPass(renderScene);
composer.addPass(bloomPass);

// Luzes Globais
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(50, 100, 50);
sunLight.castShadow = true;
scene.add(sunLight);

const carAura = new THREE.PointLight(0xffffff, 1.5, 12);
scene.add(carAura);

// --- SISTEMA DE CONFIGURAÇÕES ---
const settings = { map: 'low', quality: 'low', smoke: 'low', lights: 'low', vehicles: 'low' };

function updateResolution() {
    const width = window.innerWidth, height = window.innerHeight;
    renderer.setSize(width, height);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function setSetting(category, value) {
    const container = document.getElementById(`setting-${category}`);
    if (container) {
        container.querySelectorAll('.quality-opt-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-value') === value);
        });
    }
    if (category === 'quality') {
        settings.quality = value;
        bloomPass.enabled = (value !== 'low');
        updateResolution();
        if (player.bodyParts) {
            player.bodyParts.forEach(p => {
                if(p.material) {
                    p.material.roughness = value === 'high' ? 0.1 : (value === 'medium' ? 0.5 : 1.0);
                    p.material.metalness = value === 'high' ? 0.8 : 0;
                }
            });
        }
        // Ajusta reflexividade da pista conforme qualidade
        if (window.roadAsphaltMat) {
            window.roadAsphaltMat.roughness  = value === 'high' ? 0.15 : (value === 'medium' ? 0.35 : 0.55);
            window.roadAsphaltMat.metalness  = value === 'high' ? 0.45 : (value === 'medium' ? 0.30 : 0.15);
            window.roadAsphaltMat.needsUpdate = true;
        }
    }
    if (category === 'map') {
        const radius = value === 'low' ? 1 : (value === 'medium' ? 2 : 4);
        if (window.setChunkRadius) window.setChunkRadius(radius);
    }
    if (category === 'lights') {
        renderer.shadowMap.enabled = (value !== 'low');
        sunLight.castShadow = (value !== 'low');
        updateCarLightsState();
    }
}
window.setSetting = setSetting;

function toggleSettings() {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
}
window.toggleSettings = toggleSettings;

let isBigMap = false;
function toggleBigMap() {
    isBigMap = !isBigMap;
    const overlay = document.getElementById('big-map-overlay');
    if (overlay) overlay.style.display = isBigMap ? 'flex' : 'none';
}
window.toggleBigMap = toggleBigMap;

// --- SISTEMA DE TEMPO ---
let currentTime = 'noite';
const timeConfigs = {
    dia: { bg: 0xadd8e6, fog: 0xadd8e6, fogDensity: 0.001, ambient: 1.0, sun: 1.5, bloom: 0.1, exposure: 1.0, lightsOn: false },
    tarde: { bg: 0xffa07a, fog: 0xffa07a, fogDensity: 0.003, ambient: 0.6, sun: 1.0, bloom: 0.5, exposure: 1.1, lightsOn: true },
    noite: { bg: 0x050505, fog: 0x0a0a15, fogDensity: 0.004, ambient: 0.15, sun: 0.05, bloom: 0.8, exposure: 1.3, lightsOn: true }
};

function setTimeOfDay(time) {
    currentTime = time;
    const config = timeConfigs[time];
    scene.background = new THREE.Color(config.bg);
    scene.fog = new THREE.FogExp2(config.fog, config.fogDensity);
    ambientLight.intensity = config.ambient;
    sunLight.intensity = config.sun;
    if (settings.quality !== 'low') bloomPass.strength = config.bloom;
    renderer.toneMappingExposure = config.exposure;
    updateCarLightsState();
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.toggle('active', btn.innerText.toLowerCase() === time);
    });
}
window.setTimeOfDay = setTimeOfDay;

let lightIntensities = { front: 0, neon: 0, tail: 0, frontEnabled: false, neonEnabled: false };

function updateCarLightsState() {
    if (!player.carLights) return;
    const config = timeConfigs[currentTime];
    const isNight = config.lightsOn;
    
    player.carLights.front.forEach(l => {
        l.visible = isNight && lightIntensities.frontEnabled && lightIntensities.front > 0;
        l.intensity = lightIntensities.front * 8.0; // Aumentado drasticamente
        l.distance = 100 + (lightIntensities.front * 1.0); // Alcance maior
    });
    
    player.carLights.neon.forEach(l => {
        l.visible = isNight && lightIntensities.neonEnabled && lightIntensities.neon > 0;
        l.intensity = lightIntensities.neon * 0.25;
        l.distance = 5 + (lightIntensities.neon * 0.03);
    });
    
    player.carLights.tail.forEach((l, index) => {
        l.visible = isNight && lightIntensities.tail > 0;
        l.intensity = lightIntensities.tail * 0.03; 
        l.distance = 3 + (lightIntensities.tail * 0.03);
        
        // CORREÇÃO DE POSIÇÃO: Joga as luzes para as lanternas reais e para trás
        // Se for o R34, as lanternas estão em z aproximado de -2.2 e x de +-0.7
        if (player.mesh) {
            const side = (index % 2 === 0) ? 1 : -1;
            l.position.set(0 * side, 0, -5); // Posicionado na traseira externa
        }
    });
    
    if (player.carLights.lenses) {
        player.carLights.lenses.forEach(l => {
            if (l.material && l.material.emissiveIntensity !== undefined) {
                if (l.material.type === 'MeshStandardMaterial' || l.material.type === 'MeshPhongMaterial') {
                    l.material.emissiveIntensity = (lightIntensities.tail > 0 && isNight) ? lightIntensities.tail * 0.2 : 0;
                }
            }
        });
    }
    
    carAura.visible = isNight && lightIntensities.neonEnabled && lightIntensities.neon > 0;
    if (carAura.visible) {
        carAura.intensity = lightIntensities.neon * 0.05;
    }
}

function updateLightIntensity(type, value) {
    const intensity = parseFloat(value);
    if (type === 'front') { lightIntensities.front = intensity; lightIntensities.frontEnabled = intensity > 0; }
    else if (type === 'neon') {
        lightIntensities.neon = intensity;
        lightIntensities.neonEnabled = intensity > 0;
        if (player.carLights) {
            const neonColor = document.getElementById('neon-color');
            if (neonColor) {
                player.carLights.neon.forEach(l => l.color.set(neonColor.value));
                carAura.color.set(neonColor.value);
            }
        }
    } else if (type === 'tail') { lightIntensities.tail = intensity; }
    updateCarLightsState();
}
window.updateLightIntensity = updateLightIntensity;

function updateLightColor(type, colorStr) {
    if (!player.carLights) return;
    const color = new THREE.Color(colorStr);
    if (type === 'front') player.carLights.front.forEach(l => l.color.copy(color));
    else if (type === 'neon') { player.carLights.neon.forEach(l => l.color.copy(color)); carAura.color.copy(color); }
    else if (type === 'tail') {
        player.carLights.tail.forEach(l => l.color.copy(color));
        player.carLights.lenses.forEach(l => { if (l.material) { l.material.color.copy(color); if (l.material.emissive) l.material.emissive.copy(color); } });
    }
}
window.updateLightColor = updateLightColor;

function updateBodyColor(colorStr) {
    if (!player.bodyParts) return;
    const color = new THREE.Color(colorStr);
    player.bodyParts.forEach(part => { if (part.material) part.material.color.copy(color); });
}
window.updateBodyColor = updateBodyColor;

let purchasedUpgrades = { neon: false, frontLights: false, tailLights: false, bodyColor: false };
function handleBuyUpgrade(type) {
    const cost = 5000;
    if (purchasedUpgrades[type] || player.money < cost) return;
    player.money -= cost;
    purchasedUpgrades[type] = true;
    const btn = document.querySelector(`.garage-btn[data-type="${type}"]`);
    if (btn) { btn.innerText = 'COMPRADO ✓'; btn.classList.add('purchased'); btn.onclick = null; }
    updateHUD();
}
window.handleBuyUpgrade = handleBuyUpgrade;

let lastDriftRewardAt = 0;
function checkDriftReward() {
    const threshold = Math.floor(player.driftPoints / 10000) * 10000;
    if (threshold > lastDriftRewardAt && threshold > 0) { player.money += 1500; lastDriftRewardAt = threshold; }
}

const petals = [];
const petalGeo = new THREE.PlaneGeometry(0.1, 0.1);
const petalMat = new THREE.MeshBasicMaterial({ color: 0xffb7c5, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
function createPetalsAroundPlayer() {
    if (settings.quality === 'low' || !player.mesh || petals.length > 40) return;
    const petal = new THREE.Mesh(petalGeo, petalMat);
    petal.position.set(player.mesh.position.x + (Math.random()-0.5)*60, 15 + Math.random()*5, player.mesh.position.z + (Math.random()-0.5)*60);
    scene.add(petal);
    petals.push({ mesh: petal, life: 1.0, vel: new THREE.Vector3((Math.random()-0.5)*0.05, -0.04, (Math.random()-0.5)*0.05), rot: Math.random()*0.02 });
}
function updatePetals() {
    for(let i=petals.length-1; i>=0; i--) {
        const p = petals[i]; p.mesh.position.add(p.vel); p.mesh.rotation.z += p.rot;
        if(p.mesh.position.y < 0) { scene.remove(p.mesh); petals.splice(i, 1); }
    }
}

const trackPoints = [];
for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const radius = 150 + Math.sin(i * 0.7) * 40 + Math.cos(i * 0.3) * 20;
    const x = Math.sin(angle) * radius + Math.sin(i * 0.5) * 30, z = Math.cos(angle) * radius + Math.cos(i * 0.3) * 25;
    trackPoints.push(new THREE.Vector3(x, 0, z));
}
const trackCurve = new THREE.CatmullRomCurve3(trackPoints, true);
const trackCheckPoints = trackCurve.getPoints(400);

// --- PISTA PINTADA NO CHÃO (substituindo o modelo 3D tubular) ---
// Constrói a faixa da pista como uma série de quads planos ao longo da curva,
// usando MeshStandardMaterial com roughness baixo e metalness moderado para
// que os faróis, neon e lanternas reflitam corretamente na superfície.
(function buildFlatTrack() {
    const ROAD_WIDTH = 25;          // largura total da pista
    const STRIPE_WIDTH = 0.6;       // largura das faixas laterais
    const SEGMENTS = 400;           // resolução da curva

    // Material do asfalto — levemente reflexivo (como asfalto molhado/polido)
    const asphaltMat = new THREE.MeshStandardMaterial({
        color: 0x222222, // Levemente mais claro para refletir melhor
        roughness: 0.45,
        metalness: 0.25,
        envMapIntensity: 1.0
    });
    asphaltMat.needsUpdate = true;

    // Material das faixas brancas laterais
    const stripeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0x333333,
        emissiveIntensity: 0.15
    });

    // Material da linha central amarela tracejada
    const centerMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0x443300,
        emissiveIntensity: 0.2
    });

    const pts = trackCurve.getPoints(SEGMENTS);
    const roadVerts = [];
    const roadUVs = [];
    const leftStripeVerts = [], leftStripeUVs = [];
    const rightStripeVerts = [], rightStripeUVs = [];
    const centerVerts = [], centerUVs = [];

    const Y_OFFSET = 0.01; // elevação mínima para evitar z-fighting com o chão

        for (let i = 0; i <= SEGMENTS; i++) {
        const cur = pts[i % pts.length];
        const next = pts[(i + 1) % pts.length];
        const dir = new THREE.Vector3().subVectors(next, cur).normalize();
        const right = new THREE.Vector3(-dir.z, 0, dir.x); // perpendicular horizontal

        const t = i / SEGMENTS;

        // Vértices da pista principal (2 por ponto: esquerda e direita)
        const halfW = ROAD_WIDTH / 2;
        const vL = cur.clone().addScaledVector(right, -halfW);
        const vR = cur.clone().addScaledVector(right,  halfW);
        vL.y = Y_OFFSET; vR.y = Y_OFFSET;
        roadVerts.push(vL.x, vL.y, vL.z, vR.x, vR.y, vR.z);
        roadUVs.push(0, t * 20, 1, t * 20);

        // Faixa branca esquerda
        const lsL = cur.clone().addScaledVector(right, -halfW);
        const lsR = cur.clone().addScaledVector(right, -halfW + STRIPE_WIDTH);
        lsL.y = Y_OFFSET + 0.001; lsR.y = Y_OFFSET + 0.001;
        leftStripeVerts.push(lsL.x, lsL.y, lsL.z, lsR.x, lsR.y, lsR.z);
        leftStripeUVs.push(0, t * 20, 1, t * 20);

        // Faixa branca direita
        const rsL = cur.clone().addScaledVector(right, halfW - STRIPE_WIDTH);
        const rsR = cur.clone().addScaledVector(right, halfW);
        rsL.y = Y_OFFSET + 0.001; rsR.y = Y_OFFSET + 0.001;
        rightStripeVerts.push(rsL.x, rsL.y, rsL.z, rsR.x, rsR.y, rsR.z);
        rightStripeUVs.push(0, t * 20, 1, t * 20);

        // Linha central amarela tracejada (aparece a cada 2 segmentos)
        if (i % 4 < 2) {
            const cL = cur.clone().addScaledVector(right, -STRIPE_WIDTH / 2);
            const cR = cur.clone().addScaledVector(right,  STRIPE_WIDTH / 2);
            cL.y = Y_OFFSET + 0.002; cR.y = Y_OFFSET + 0.002;
            centerVerts.push(cL.x, cL.y, cL.z, cR.x, cR.y, cR.z);
            centerUVs.push(0, t * 20, 1, t * 20);
        }
    }

    // FECHAR A EMENDA: Adiciona o primeiro ponto novamente no final dos índices
    function buildMesh(verts, uvs, mat, closed = true) {
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(verts);
        const uvsArr = new Float32Array(uvs);
        const n = verts.length / 3;
        const indices = [];
        for (let i = 0; i < n - 2; i += 2) {
            indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
        }
        if (closed) {
            // Conecta o último par de vértices ao primeiro par
            const last = n - 2;
            indices.push(last, last + 1, 0, last + 1, 1, 0);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvsArr, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        return mesh;
    }
    const roadMesh = buildMesh(roadVerts, roadUVs, asphaltMat);
    scene.add(roadMesh);
    // Expõe o material para que setSetting('quality') possa ajustar roughness/metalness
    window.roadAsphaltMat = asphaltMat;

    scene.add(buildMesh(leftStripeVerts,  leftStripeUVs,  stripeMat));
    scene.add(buildMesh(rightStripeVerts, rightStripeUVs, stripeMat));
    if (centerVerts.length > 0) scene.add(buildMesh(centerVerts, centerUVs, centerMat));
})();

let player = { mesh: null, frontWheels: [], bodyParts: [], wheelParts: [], steeringWheel: null, carLights: null, speed: 0, carAngle: 0, moveAngle: 0, driftIntensity: 0, gear: 1, driftPoints: 0, isDrifting: false, isBurnout: false, hp: 450, money: 0, multiplier: 1.0, wheelRotation: 0, cameraMode: 'third' };
const keys = {};
let spacePressed = false, isGarage = false;
window.addEventListener('mousemove', (e) => { mouseX = (e.clientX / window.innerWidth) * 2 - 1; mouseY = (e.clientY / window.innerHeight) * 2 - 1; });

const updateHUD = () => {
    const speed = document.getElementById('speed-val'), gear = document.getElementById('gear-val'), points = document.getElementById('drift-points'), mult = document.getElementById('multiplier'), money = document.getElementById('money'), gMoney = document.getElementById('g-money'), driftInd = document.getElementById('drift-indicator');
    if (speed) speed.innerText = Math.round(Math.abs(player.speed) * 120);
    if (gear) gear.innerText = player.gear === -1 ? 'R' : player.gear === 0 ? 'N' : player.gear;
    if (points) points.innerText = Math.floor(player.driftPoints);
    if (mult) mult.innerText = `x${player.multiplier.toFixed(1)}`;
    if (money) money.innerText = `$ ${player.money}`;
    if (gMoney) gMoney.innerText = `$ ${player.money}`;
    if (driftInd) { if (player.isBurnout) driftInd.innerText = "BURNOUT!"; else if (player.isDrifting) driftInd.innerText = "DRIFT!"; driftInd.style.display = (player.isBurnout || player.isDrifting) ? 'block' : 'none'; }
};

window.addEventListener('keydown', (e) => {
    if ((isGarage && e.code !== 'KeyP') || (isBigMap && e.code !== 'KeyM')) return;
    keys[e.code] = true;
    if (e.code === 'Space') spacePressed = true;
    if (e.code === 'KeyQ' && player.gear > -1) player.gear--;
    if (e.code === 'KeyE' && player.gear < 5) player.gear++;
    if (e.code === 'KeyO') player.cameraMode = player.cameraMode === 'third' ? 'first' : 'third';
    if (e.code === 'KeyM') toggleBigMap();
    if (e.code === 'Escape') toggleSettings();
    if (e.code === 'KeyP') {
        isGarage = !isGarage;
        const overlay = document.getElementById('garage-overlay');
        if (overlay) overlay.style.display = isGarage ? 'flex' : 'none';
        if (isGarage) {
            lightIntensities.front = parseFloat(document.getElementById('front-intensity-slider').value);
            lightIntensities.neon = parseFloat(document.getElementById('neon-intensity-slider').value);
            lightIntensities.tail = parseFloat(document.getElementById('tail-intensity-slider').value);
            lightIntensities.frontEnabled = lightIntensities.front > 0;
            lightIntensities.neonEnabled = lightIntensities.neon > 0;
        }
        updateCarLightsState();
    }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'Space') spacePressed = false; });



const smokeParticles = [];
const smokeGeo = new THREE.SphereGeometry(0.3, 6, 6);
const smokeMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 });

function createSmoke(pos) {
    // Aumentado para 500 para evitar o corte do rastro
    if (settings.smoke === 'off' || smokeParticles.length > 500) return;
    
    // Gera 3 partículas por chamada para densidade máxima
    for(let i=0; i<3; i++) {
        const smoke = new THREE.Mesh(smokeGeo, smokeMat.clone());
        smoke.position.copy(pos); 
        smoke.position.x += (Math.random()-0.5)*0.5;
        smoke.position.z += (Math.random()-0.5)*0.5;
        smoke.position.y = 0.1; 
        scene.add(smoke);
        smokeParticles.push({ 
            mesh: smoke, 
            life: 1.0, 
            vel: new THREE.Vector3((Math.random()-0.5)*0.1, 0.15 + Math.random()*0.1, (Math.random()-0.5)*0.1),
            growth: 0.04 + Math.random()*0.04 
        });
    }
}

function updateSmoke() {
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const p = smokeParticles[i]; 
        p.life -= 0.015; // Vida levemente reduzida para reciclar partículas mais rápido
        p.mesh.position.add(p.vel); 
        p.mesh.scale.addScalar(p.growth);
        p.mesh.material.opacity = Math.max(0, p.life * 0.45);
        if (p.life <= 0) { scene.remove(p.mesh); smokeParticles.splice(i, 1); }
    }
}

function drawMap(canvasId, isMini) {
    const canvas = document.getElementById(canvasId); if (!canvas || !player.mesh) return;
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h); if (!window.mapOffset) window.mapOffset = { x: 0, z: 0 };
    const scale = isMini ? 0.04 : 0.15, centerX = w / 2, centerY = h / 2;
    ctx.save();
    if (isMini) {
        ctx.translate(centerX, centerY); ctx.rotate(-player.carAngle);
        ctx.fillStyle = '#111'; ctx.fillRect(-w, -h, w*2, h*2);
        ctx.strokeStyle = '#ff9500'; ctx.lineWidth = 10; ctx.beginPath();
        trackCheckPoints.forEach((pt, i) => { const dx = (pt.x - player.mesh.position.x) * scale * 10, dz = (pt.z - player.mesh.position.z) * scale * 10; if (i === 0) ctx.moveTo(dx, dz); else ctx.lineTo(dx, dz); });
        ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(6, 8); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill();
    } else {
        ctx.translate(centerX + window.mapOffset.x, centerY + window.mapOffset.z);
        ctx.strokeStyle = '#ff9500'; ctx.lineWidth = 4; ctx.beginPath();
        trackCheckPoints.forEach((pt, i) => { const dx = pt.x * scale, dz = pt.z * scale; if (i === 0) ctx.moveTo(dx, dz); else ctx.lineTo(dx, dz); });
        ctx.stroke();
        const px = player.mesh.position.x * scale, pz = player.mesh.position.z * scale;
        ctx.save(); ctx.translate(px, pz); ctx.rotate(-player.carAngle); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.restore();
}

let isDraggingMap = false, lastMousePos = { x: 0, y: 0 };
window.addEventListener('mousedown', (e) => { if (isBigMap) { isDraggingMap = true; lastMousePos = { x: e.clientX, y: e.clientY }; } });
window.addEventListener('mousemove', (e) => { if (isDraggingMap && isBigMap) { const dx = e.clientX - lastMousePos.x, dy = e.clientY - lastMousePos.y; window.mapOffset.x += dx; window.mapOffset.z += dy; lastMousePos = { x: e.clientX, y: e.clientY }; } });
window.addEventListener('mouseup', () => { isDraggingMap = false; });

async function init() {
    try {
        const carData = await loadCar(scene);
        player.mesh = carData.mesh; player.frontWheels = carData.frontWheels; player.bodyParts = carData.bodyParts; player.wheelParts = carData.wheelParts; player.carLights = carData.carLights; player.steeringWheel = carData.steeringWheel;
        const startPos = trackCurve.getPoint(0); player.mesh.position.copy(startPos); player.mesh.position.y += 0.5; player.carAngle = Math.PI;
        document.getElementById('loading').style.display = 'none';
        setSetting('map', 'low'); setSetting('quality', 'low'); setSetting('smoke', 'low'); setSetting('lights', 'low'); setSetting('vehicles', 'low');
        setTimeOfDay('noite');
        const frontSlider = document.getElementById('front-intensity-slider'), neonSlider = document.getElementById('neon-intensity-slider'), tailSlider = document.getElementById('tail-intensity-slider');
        if (frontSlider) lightIntensities.front = parseFloat(frontSlider.value);
        if (neonSlider) lightIntensities.neon = parseFloat(neonSlider.value);
        if (tailSlider) lightIntensities.tail = parseFloat(tailSlider.value);
        lightIntensities.frontEnabled = lightIntensities.front > 0; lightIntensities.neonEnabled = lightIntensities.neon > 0;
        updateCarLightsState(); animate();
    } catch (error) { console.error('Erro:', error); }
}

let lastFpsTime = performance.now(), frameCount = 0, fps = 0;
function animate(time) {
    requestAnimationFrame(animate); frameCount++;
    if (time > lastFpsTime + 1000) { fps = Math.round((frameCount * 1000) / (time - lastFpsTime)); const fpsEl = document.getElementById('fps-counter'); if (fpsEl) fpsEl.innerText = `FPS: ${fps}`; lastFpsTime = time; frameCount = 0; }
    if (player.mesh && !isGarage) {
                        
        // --- EFEITOS DINÂMICOS DE CÂMERA ---
        const speedKmh = Math.abs(player.speed) * 120;
        let targetFov = 60;
        let shakeIntensity = 0;
        let targetRoll = 0;

        if (player.isDrifting) {
            targetFov = 75 + (speedKmh * 0.1);
            shakeIntensity = 0.15;
            targetRoll = (player.driftIntensity || 0.5) * 0.15; 
        } else if (speedKmh > 100) {
            targetFov = 60 + ((speedKmh - 100) * 0.2);
            shakeIntensity = (speedKmh - 100) * 0.003;
        }

        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, 0.08);
        camera.updateProjectionMatrix();
        camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, targetRoll, 0.05);

        let shake = new THREE.Vector3(
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity
        );



        updateDriftPhysics(player, keys, spacePressed); checkDriftReward(); updateHUD(); updateSmoke(); createPetalsAroundPlayer(); updatePetals(); drawMap('minimap-canvas', true);
        if (isBigMap) drawMap('big-map-canvas', false);
        
        
        if (player.isDrifting || player.isBurnout) {
            const leftOffset = new THREE.Vector3(-0.6, 0, -1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.carAngle);
            const rightOffset = new THREE.Vector3(0.6, 0, -1.5).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.carAngle);
            // Emite em cada frame para garantir que não haja vãos
            createSmoke(player.mesh.position.clone().add(leftOffset)); 
            createSmoke(player.mesh.position.clone().add(rightOffset));
        }
        carAura.position.copy(player.mesh.position); carAura.position.y += 1.5;
        const config = timeConfigs[currentTime];
        if (player.cameraMode === 'third') {
            ambientLight.intensity = config.ambient; renderer.toneMappingExposure = config.exposure;
            const cameraOffset = new THREE.Vector3(-Math.sin(player.carAngle) * 6, 3, -Math.cos(player.carAngle) * 6);
            camera.position.lerp(player.mesh.position.clone().add(cameraOffset), 0.1); camera.lookAt(player.mesh.position.x, 1, player.mesh.position.z);
            camera.position.add(shake);
        } else {
            ambientLight.intensity = config.ambient * 2.5; renderer.toneMappingExposure = config.exposure * 1.5;
            const cockpitPos = new THREE.Vector3(0.4, 1.1, -0.45).applyAxisAngle(new THREE.Vector3(0, 1, 0), player.carAngle);
            camera.position.copy(player.mesh.position.clone().add(cockpitPos));
            const lookAngleX = player.carAngle - (mouseX * 1.5); const lookTarget = new THREE.Vector3(Math.sin(lookAngleX) * 10, -(mouseY * 2.5), Math.cos(lookAngleX) * 10);
            camera.lookAt(camera.position.clone().add(lookTarget));
        }
        if (typeof updateChunks === 'function') updateChunks(scene, player.mesh.position.x, player.mesh.position.z, trackCheckPoints, window.currentChunkRadius);
    }
    composer.render();
}
window.addEventListener('resize', () => updateResolution());
init();