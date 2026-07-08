// chunks.js - Estacionamento Central + Vila Exterior
const CHUNK_SIZE = 300;
window.currentChunkRadius = 1;
const activeChunks = new Map();

// --- MATERIAIS ---
const mats = {
    grass: new THREE.MeshBasicMaterial({ color: 0x1a3d0e }),
    asphalt: new THREE.MeshBasicMaterial({ color: 0x151515 }),
    curb: new THREE.MeshBasicMaterial({ color: 0x222222 }),
    wood: new THREE.MeshBasicMaterial({ color: 0x2d1a0f }),
    roof: new THREE.MeshBasicMaterial({ color: 0x2c3e50 }),
    roofRed: new THREE.MeshBasicMaterial({ color: 0x661111 }),
    wall: new THREE.MeshBasicMaterial({ color: 0xfdfdfd }),
    wallCream: new THREE.MeshBasicMaterial({ color: 0xf5f5dc }),
    cherry: new THREE.MeshBasicMaterial({ color: 0xffb7c5 }),
    pine: new THREE.MeshBasicMaterial({ color: 0x0a2d0a }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 5 })
};

// --- GEOMETRIAS ---
const geos = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 4),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 6),
    sphere: new THREE.SphereGeometry(1, 4, 4)
};

// --- MODELOS ---
function createJapaneseHouse(type) {
    const group = new THREE.Group();
    const isLarge = type > 7;
    const wallMat = type % 2 === 0 ? mats.wall : mats.wallCream;
    const roofMat = type % 4 === 0 ? mats.roofRed : mats.roof;
    
    const body = new THREE.Mesh(geos.box, wallMat);
    const w = isLarge ? 8 : 5.5;
    const h = isLarge ? 5.5 : 3.5;
    const d = isLarge ? 7 : 5;
    body.scale.set(w, h, d);
    body.position.y = h / 2;
    group.add(body);

    const roof1 = new THREE.Mesh(geos.cone, roofMat);
    roof1.position.y = h + 1;
    roof1.rotation.y = Math.PI / 4;
    roof1.scale.set(w * 1.2, 2, d * 1.2);
    group.add(roof1);

    return group;
}

function createVegetation(type) {
    const g = new THREE.Group();
    if (type === 'cherry') {
        const t = new THREE.Mesh(geos.cylinder, mats.wood);
        t.scale.set(0.15, 3, 0.15); t.position.y = 1.5; g.add(t);
        const l = new THREE.Mesh(geos.sphere, mats.cherry);
        l.scale.setScalar(1.8); l.position.y = 4; g.add(l);
    } else {
        const t = new THREE.Mesh(geos.cylinder, mats.wood);
        t.scale.set(0.15, 2.5, 0.15); t.position.y = 1.25; g.add(t);
        const l = new THREE.Mesh(geos.cone, mats.pine);
        l.scale.set(1.5, 3, 1.5); l.position.y = 3; g.add(l);
    }
    return g;
}

// --- SISTEMA DE CHUNKS ---
function updateChunks(scene, px, pz, trackCheckPoints, radius) {
    const effectiveRadius = radius || window.currentChunkRadius;
    const cx = Math.floor(px / CHUNK_SIZE), cz = Math.floor(pz / CHUNK_SIZE);
    const needed = new Set();

    const parkingMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.1 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });

    for (let x = cx - effectiveRadius; x <= cx + effectiveRadius; x++) {
        for (let z = cz - effectiveRadius; z <= cz + effectiveRadius; z++) {
            const key = x + "," + z;
            needed.add(key);
            if (!activeChunks.has(key)) {
                const group = new THREE.Group();
                const worldX = x * CHUNK_SIZE, worldZ = z * CHUNK_SIZE;
                
                // Grama de fundo
                const plane = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE), mats.grass);
                plane.rotation.x = -Math.PI / 2;
                plane.position.set(worldX + CHUNK_SIZE / 2, -0.1, worldZ + CHUNK_SIZE / 2);
                group.add(plane);

                const gridSize = 40;
                for (let gx = 0; gx < CHUNK_SIZE; gx += gridSize) {
                    for (let gz = 0; gz < CHUNK_SIZE; gz += gridSize) {
                        const qx = worldX + gx + gridSize/2;
                        const qz = worldZ + gz + gridSize/2;
                        
                        // 1. Calcular distância do centro (0,0) para o estacionamento
                        const distFromCenter = Math.sqrt(qx*qx + qz*qz);
                        
                        // 2. Calcular distância da pista para a vila
                        let minDistToTrack = 999;
                        if (trackCheckPoints) {
                            for (let i = 0; i < trackCheckPoints.length; i += 10) {
                                const pt = trackCheckPoints[i];
                                const d = Math.sqrt((qx - pt.x)**2 + (qz - pt.z)**2);
                                if (d < minDistToTrack) minDistToTrack = d;
                            }
                        }

                        if (distFromCenter < 120) {
                            // DENTRO: Estacionamento
                            const pArea = new THREE.Mesh(new THREE.PlaneGeometry(gridSize, gridSize), parkingMat);
                            pArea.rotation.x = -Math.PI / 2;
                            pArea.position.set(qx, 0.005, qz);
                            group.add(pArea);

                            if (Math.abs(qx % 20) < 1) {
                                const line = new THREE.Mesh(new THREE.PlaneGeometry(0.2, gridSize), lineMat);
                                line.rotation.x = -Math.PI / 2;
                                line.position.set(qx, 0.01, qz);
                                group.add(line);
                            }
                            
                            if (gx === 0 && gz === 0 && Math.random() > 0.4) {
                                const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12), mats.curb);
                                pole.position.set(qx, 6, qz);
                                group.add(pole);
                                const lamp = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 2), mats.lamp);
                                lamp.position.set(qx, 12, qz);
                                group.add(lamp);
                                const light = new THREE.PointLight(0xffffaa, 60, 50);
                                light.position.set(qx, 11, qz);
                                group.add(light);
                            }
                        } else if (minDistToTrack > 25 && minDistToTrack < 150) {
                            // FORA: Vila Viralejo
                            const house = createJapaneseHouse(Math.floor(Math.random()*10));
                            house.position.set(qx, 0, qz);
                            house.rotation.y = Math.floor(Math.random()*4)*(Math.PI/2);
                            group.add(house);
                            
                            if (Math.random() > 0.5) {
                                const veg = createVegetation(Math.random() > 0.5 ? 'cherry' : 'pine');
                                veg.position.set(qx + 5, 0, qz + 5);
                                group.add(veg);
                            }
                        } else if (minDistToTrack > 150) {
                            // BEM LONGE: Só árvores
                            if (Math.random() > 0.8) {
                                const veg = createVegetation('pine');
                                veg.position.set(qx, 0, qz);
                                group.add(veg);
                            }
                        }
                    }
                }
                
                scene.add(group);
                activeChunks.set(key, group);
            }
        }
    }
    
    for (const [key, group] of activeChunks.entries()) {
        if (!needed.has(key)) {
            scene.remove(group);
            activeChunks.delete(key);
        }
    }
}

window.updateChunks = updateChunks;
window.setChunkRadius = function(r) { window.currentChunkRadius = r; };
