// carloader.js - BASE + FIX PIVÔ CORRETO (roda gira no próprio eixo) + SÓ FAROL TRASEIRO
function loadCar(scene) {
    return new Promise((resolve, reject) => {
        const loader = new THREE.GLTFLoader();
        
        loader.load('./models/r34.glb', (gltf) => {
            const carMesh = gltf.scene;
            const box = new THREE.Box3().setFromObject(carMesh);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            
            // Centralização e ajuste de altura do modelo original
            carMesh.position.x -= center.x;
            carMesh.position.z -= center.z;
            carMesh.position.y = (size.y / 2) - center.y - 0.05; 
            carMesh.rotation.y = -Math.PI / 2; // DESVIRADO - antes tava invertido
            
            const wrapper = new THREE.Group();
            wrapper.add(carMesh);
            
            const carLights = { front: [], neon: [], tail: [], lenses: [] };

            // --- FAROIS DA FRENTE REMOVIDOS - deixa só traseiro como pediu ---
            // leftHeadlight e rightHeadlight removidos

            // --- NEON ---
            const neonLight = new THREE.SpotLight(0xFF0000, 20, 7, Math.PI / 2.2, 0.6, 0.5);
            neonLight.position.set(0, 0.2, 0);
            neonLight.target.position.set(0, -1, 0);
            wrapper.add(neonLight);
            wrapper.add(neonLight.target);
            carLights.neon.push(neonLight);

            // --- TRASEIRAS - MANTIDAS (essas da foto) ---
            const tailLightColor = 0xff0000;
            const tailPositions = [
                { x: -0.55, y: 0.75, z: -2.15 }, { x: -0.65, y: 0.75, z: -2.15 },
                { x: 0.55, y: 0.75, z: -2.15 }, { x: 0.65, y: 0.75, z: -2.15 }
            ];

            // FAROL TRASEIRO - só luz, sem bola vermelha na frente
            // As bolas vermelhas (CircleGeometry) removidas como pediu
            tailPositions.forEach(pos => {
                // Spot só pra brilho, mas posicionado atrás
                const spot = new THREE.SpotLight(tailLightColor, 20, 3, Math.PI / 4, 0.5, 2);
                spot.position.set(pos.x, pos.y, pos.z + 0.1);
                const target = new THREE.Object3D();
                target.position.set(pos.x, pos.y, pos.z - 5);
                wrapper.add(target);
                spot.target = target;
                wrapper.add(spot);
                carLights.tail.push(spot);

                const pLight = new THREE.PointLight(tailLightColor, 3, 1.0);
                pLight.position.set(pos.x, pos.y, pos.z);
                wrapper.add(pLight);
                carLights.tail.push(pLight);

                // BOLA VERMELHA REMOVIDA - era CircleGeometry que aparecia na frente
            });

            const bodyParts = [];
            const frontWheels = [];
            const wheelParts = [];
            let steeringWheel = null;
            const frontWheelMeshes = [];
            
            carMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true; 
                    child.receiveShadow = true;
                    if(child.material) { 
                        child.material.roughness = 0.3; 
                        child.material.metalness = 0.6; 
                        child.material.envMapIntensity = 1.5; 
                    }
                    const name = child.name.toLowerCase();
                    
                    if (name.includes('body') || name.includes('paint') || name.includes('carroceria') || name.includes('hood') || name.includes('door') || name.includes('chassis')) {
                        bodyParts.push(child);
                    }

                    if (name.includes('tail') || name.includes('light_r') || name.includes('lanterna') || name.includes('brake')) {
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 15.0
                        });
                        carLights.lenses.push(child);
                    } else if (name.includes('steeringwheel') || name.includes('volante') || name.includes('direcao') || name.includes('steering')) {
                        steeringWheel = child;
                    } else if (name.includes('wheel')) {
                        wheelParts.push(child);
                        if (name.includes('fr') || name.includes('fl') || name.includes('front')) {
                            frontWheelMeshes.push(child);
                        }
                    }
                }
            });

            // --- FIX PIVÔ CENTRALIZADO: roda gira no próprio eixo e centralizada no para-lama ---
            frontWheelMeshes.forEach((wheelMesh) => {
                const originalParent = wheelMesh.parent;

                // Calcula centro da geometria da roda para centralizar
                if(wheelMesh.geometry){
                    wheelMesh.geometry.computeBoundingBox();
                    const gCenter = new THREE.Vector3();
                    wheelMesh.geometry.boundingBox.getCenter(gCenter);
                    // Centraliza geometria no próprio eixo
                    wheelMesh.geometry.translate(-gCenter.x, -gCenter.y, -gCenter.z);
                    // Compensa posição para manter roda no mesmo lugar visual
                    wheelMesh.position.add(gCenter);
                }

                // Cria pivô exatamente no centro visual da roda
                const pivot = new THREE.Group();
                pivot.position.copy(wheelMesh.position);
                pivot.rotation.copy(wheelMesh.rotation);
                pivot.scale.copy(wheelMesh.scale);
                pivot.name = wheelMesh.name + '_PIVOT';

                // Reseta mesh filha para origem do pivô (agora geometria já centralizada)
                wheelMesh.position.set(0, 0, 0);
                wheelMesh.rotation.set(0, 0, 0);
                wheelMesh.scale.set(1, 1, 1);

                originalParent.remove(wheelMesh);
                pivot.add(wheelMesh);
                originalParent.add(pivot);
                
                frontWheels.push(pivot);
                pivot.userData.wheelMesh = wheelMesh;
                pivot.userData.isFrontPivot = true;
            });

            resolve({
                mesh: wrapper,
                frontWheels: frontWheels,
                bodyParts: bodyParts,
                wheelParts: wheelParts,
                carLights: carLights,
                steeringWheel: steeringWheel
            });
        }, undefined, (error) => {
            console.error('Erro ao carregar carro:', error);
            reject(error);
        });
    });
}
