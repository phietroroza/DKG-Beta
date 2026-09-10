const CHUNK_SIZE = 400;
const chunkMap = new Map();
let renderRadius = 2;

// GEOMETRIA E MATERIAL COMPARTILHADOS - OTIMIZAÇÃO DE MEMÓRIA
const sharedGeometry = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
const sharedMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x1a4d1a,
    roughness: 0.95,
    metalness: 0.05
});

function updateChunks(scene, px, pz) {
    const currX = Math.floor(px / CHUNK_SIZE);
    const currZ = Math.floor(pz / CHUNK_SIZE);

    for (let x = currX - renderRadius; x <= currX + renderRadius; x++) {
        for (let z = currZ - renderRadius; z <= currZ + renderRadius; z++) {
            const key = `${x},${z}`;
            if (!chunkMap.has(key)) {
                const chunk = new THREE.Mesh(sharedGeometry, sharedMaterial);
                chunk.rotation.x = -Math.PI / 2;
                chunk.position.set(x * CHUNK_SIZE, -0.5, z * CHUNK_SIZE);
                chunk.receiveShadow = true;
                scene.add(chunk);
                chunkMap.set(key, chunk);
            }
        }
    }

    // Remover chunks distantes para otimizar
    chunkMap.forEach((chunk, key) => {
        const [cx, cz] = key.split(',').map(Number);
        if (Math.abs(cx - currX) > renderRadius + 1 || Math.abs(cz - currZ) > renderRadius + 1) {
            scene.remove(chunk);
            chunkMap.delete(key);
        }
    });
}
