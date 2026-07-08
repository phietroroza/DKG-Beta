// carLoader.js - Versão Estável com Pintura de Carroceria
function loadCar(scene) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        
        loader.load('./models/r34.glb', (gltf) => {
            const carMesh = gltf.scene;
            
            const box = new THREE.Box3().setFromObject(carMesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            carMesh.position.x -= center.x;
            carMesh.position.z -= center.z;
            carMesh.position.y = (size.y / 2) - center.y - 0.05; 
            carMesh.rotation.y = Math.PI / -2;
            
            const wrapper = new THREE.Group();
            wrapper.add(carMesh);
            
            const carLights = { front: [], neon: [], tail: [], lenses: [] };

            // --- FARÓIS ---
            const headlightColor = 0xffffff;
            const leftHeadlight = new THREE.SpotLight(headlightColor, 50, 150, Math.PI / 4, 0.5, 0.5);
            leftHeadlight.position.set(-0.8, 0.6, 2); 
            leftHeadlight.target.position.set(-0.8, 0, 15);
            wrapper.add(leftHeadlight);
            wrapper.add(leftHeadlight.target);
            carLights.front.push(leftHeadlight);

            const rightHeadlight = new THREE.SpotLight(headlightColor, 50, 150, Math.PI / 4, 0.5, 0.5);
            rightHeadlight.position.set(0.8, 0.6, 2);
            rightHeadlight.target.position.set(0.8, 0.6, 15);
            wrapper.add(rightHeadlight);
            wrapper.add(rightHeadlight.target);
            carLights.front.push(rightHeadlight);

            // --- NEON ---
            const neonLight = new THREE.SpotLight(0xFF0000, 20, 7, Math.PI / 2.2, 0.6, 0.5);
            neonLight.position.set(0, 0.5, 0);
            neonLight.target.position.set(0, -1, 0);
            wrapper.add(neonLight);
            wrapper.add(neonLight.target);
            carLights.neon.push(neonLight);

            // --- TRASEIRAS ---
            const tailLightColor = 0xff0000;
            const tailPositions = [
                { x: -0.55, y: 0.75, z: -2.15 }, { x: -0.65, y: 0.75, z: -2.15 },
                { x: 0.55, y: 0.75, z: -2.15 }, { x: 0.65, y: 0.75, z: -2.15 }
            ];

            tailPositions.forEach(pos => {
                const spot = new THREE.SpotLight(tailLightColor, 60, 4, Math.PI / 4, 0.5, 2);
                spot.position.set(pos.x, pos.y, pos.z + 0.1);
                const target = new THREE.Object3D();
                target.position.set(pos.x, pos.y, pos.z - 5);
                wrapper.add(target);
                spot.target = target;
                wrapper.add(spot);
                carLights.tail.push(spot);

                const pLight = new THREE.PointLight(tailLightColor, 15, 0.8);
                pLight.position.set(pos.x, pos.y, pos.z);
                wrapper.add(pLight);
                carLights.tail.push(pLight);

                const lensGeo = new THREE.CircleGeometry(0.12, 32);
                const lensMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
                const lens = new THREE.Mesh(lensGeo, lensMat);
                lens.position.set(pos.x, pos.y, pos.z - 0.02);
                lens.rotation.y = Math.PI;
                wrapper.add(lens);
                carLights.lenses.push(lens);
            });

            const bodyParts = [];
            const frontWheels = [];
            const wheelParts = [];
            let steeringWheel = null;
            
            carMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    const name = child.name.toLowerCase();
                    
                    // Identifica partes da carroceria (Body) para pintura
                    if (name.includes('body') || name.includes('paint') || name.includes('carroceria') || name.includes('hood') || name.includes('door')) {
                        bodyParts.push(child);
                    }

                    if (name.includes('tail') || name.includes('light_r') || name.includes('lanterna')) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 20.0
                        });
                        carLights.lenses.push(child);
                    } else if (name.includes('steeringwheel') || name.includes('volante') || name.includes('direcao') || name.includes('steering')) {
                        // Identifica o volante PRIMEIRO e separadamente das rodas
                        steeringWheel = child;
                        // Forçamos ele a não ser tratado como mesh de roda
                        child.isWheel = false; 
                        return; 
                    } else if (name.includes('wheel')) {
                        wheelParts.push(child);
                        if (name.includes('fr') || name.includes('fl')) {
                            frontWheels.push(child);
                            child.position.z += -0.01; 
                        }
                    }
                }
            });

            scene.add(wrapper);
            resolve({
                mesh: wrapper,
                frontWheels: frontWheels,
                bodyParts: bodyParts,
                wheelParts: wheelParts,
                carLights: carLights,
                steeringWheel: steeringWheel
            });
        }, undefined, (error) => {
            console.error('Erro:', error);
            reject(error);
        });
    });
}