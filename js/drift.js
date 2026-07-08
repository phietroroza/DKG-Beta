// drift.js - Versão Corrigida (Com Volante Móvel)
function updateDriftPhysics(player, keys, spacePressed) {
    // O fator de conversão no HUD é Math.round(Math.abs(player.speed) * 120)
    // Para 220 km/h: 220 / 120 = 1.833
    // Para 40 km/h: 40 / 120 = 0.333
    // Para subir 15 km/h em 3 segundos (a 60 FPS):
    // 15 km/h no HUD = 15 / 120 = 0.125 de speed real.
    // 3 segundos = 180 frames.
    // Aceleração necessária = 0.125 / 180 = ~0.0007 (muito lento)
    // Vamos usar um valor equilibrado para todas as marchas e reduzir na 4 e 5.
    const gearCfg = { 
        "-1": { acc: -0.010, max: -0.5 }, 
        "1": { acc: 0.012, max: 0.333 }, // 40 km/h
        "2": { acc: 0.012, max: 0.75 },  // 90 km/h
        "3": { acc: 0.012, max: 1.166 }, // 140 km/h
        "4": { acc: 0.010, max: 1.541 }, // Ajustado para 0.010 para manter força
        "5": { acc: 0.009, max: 1.833 }  // Ajustado para 0.009 para manter força
    };

    const currentGear = gearCfg[player.gear] || gearCfg["1"];
    let acc = 0;
    
    player.isBurnout = false;
    if (player.gear === 1 && spacePressed && (keys['KeyW'] || keys['ArrowUp'])) {
        player.isBurnout = true;
        if (player.speed < 0.04) acc = 0.005;
        else acc = -0.01;
    } else {
        if (keys['KeyW'] || keys['ArrowUp']) {
            if (player.gear > 0 && player.speed < currentGear.max) acc = currentGear.acc;
            else if (player.gear === -1 && player.speed > currentGear.max) acc = currentGear.acc;
        } else if (keys['KeyS'] || keys['ArrowDown']) {
            acc = player.speed > 0 ? -0.003 : 0.005;
        }
    }

    player.speed = (player.speed + acc) * 0.99;
    player.isDrifting = !player.isBurnout && spacePressed && Math.abs(player.speed) > 0.15;

    const steerSpeed = 0.045;
    let steerInput = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) steerInput = 1;
    if (keys['KeyD'] || keys['ArrowRight']) steerInput = -1;

    if (!player.wheelRotation) player.wheelRotation = 0;
    if (player.isBurnout) {
        player.wheelRotation += 0.5; 
    } else {
        player.wheelRotation += player.speed * -5;
    }

    if (Math.abs(player.speed) > 0.02 || player.isBurnout) {
        const driftAngleLimit = 1.8; 
        let angleDiff = player.carAngle - player.moveAngle;
        
        let canSteer = true;
        if (player.isDrifting) {
            if (steerInput === 1 && angleDiff > driftAngleLimit) canSteer = false;
            if (steerInput === -1 && angleDiff < -driftAngleLimit) canSteer = false;
        }

        if (canSteer) {
            if (player.isDrifting) {
                // No drift, a direção é rápida e agressiva
                player.carAngle += steerInput * steerSpeed;
            } else {
                // Direção realista: a força da curva depende da velocidade
                // Se estiver parado ou quase parado, vira menos.
                // Aumenta conforme a velocidade, mas tem um limite para não ficar impossível de controlar
                const speedFactor = Math.min(Math.abs(player.speed) * 2.5, 1.0);
                player.carAngle += steerInput * steerSpeed * speedFactor;
            }
        }
        
        // --- LÓGICA DE RODAS DIANTEIRAS ---
        player.frontWheels.forEach(wheel => {
            let effectiveSteer = player.isDrifting ? steerInput : -steerInput;
            let targetWheelRot = effectiveSteer * 0.6;
            const name = wheel.name.toUpperCase();
            if (name.includes('FL') || wheel.position.x < 0) {
                targetWheelRot = -targetWheelRot;
            }
            wheel.rotation.y = THREE.MathUtils.lerp(wheel.rotation.y, targetWheelRot, 0.2);
            wheel.rotation.z = player.wheelRotation;
        });
        
        if (player.wheelParts) {
            player.wheelParts.forEach(wheel => {
                // Verificação extra: o volante NUNCA deve girar no eixo Z
                if (!player.frontWheels.includes(wheel) && wheel !== player.steeringWheel) {
                    wheel.rotation.z = player.wheelRotation;
                }
            });
        }

        // --- VOLANTE FIXO ---
        if (player.steeringWheel) {
            player.steeringWheel.rotation.z = 0;
            player.steeringWheel.rotation.y = 0;
            player.steeringWheel.rotation.x = 0;
        }

    } else {
        player.frontWheels.forEach(wheel => {
            wheel.rotation.y = THREE.MathUtils.lerp(wheel.rotation.y, 0, 0.1);
            wheel.rotation.z = player.wheelRotation;
        });
        if (player.wheelParts) {
            player.wheelParts.forEach(wheel => {
                // Verificação extra: o volante NUNCA deve girar no eixo Z
                if (!player.frontWheels.includes(wheel) && wheel !== player.steeringWheel) {
                    wheel.rotation.z = player.wheelRotation;
                }
            });
        }
        // --- VOLANTE FIXO ---
        if (player.steeringWheel) {
            player.steeringWheel.rotation.z = 0;
            player.steeringWheel.rotation.y = 0;
            player.steeringWheel.rotation.x = 0;
        }
    }

    if (player.isDrifting) {
        player.driftIntensity = THREE.MathUtils.lerp(player.driftIntensity, 1.2, 0.05);
        if (steerInput !== 0) {
            player.moveAngle += steerInput * 0.022;
        } else {
            player.moveAngle += (player.carAngle - player.moveAngle) * 0.012;
        }
        const rollAmount = (player.carAngle - player.moveAngle) * 0.3;
        player.mesh.rotation.x = THREE.MathUtils.lerp(player.mesh.rotation.x, rollAmount, 0);
        player.driftPoints += 25;
        player.multiplier = Math.min(10, player.multiplier + 0.005);
    } else {
        player.driftIntensity = THREE.MathUtils.lerp(player.driftIntensity, 0, 0.1);
        player.moveAngle = THREE.MathUtils.lerp(player.moveAngle, player.carAngle, 0.1);
        player.mesh.rotation.z = THREE.MathUtils.lerp(player.mesh.rotation.z, 0, 0.1);
        if (Math.abs(player.speed) < 0.05) player.multiplier = 1.0;
    }

    player.mesh.position.x += Math.sin(player.moveAngle) * player.speed;
    player.mesh.position.z += Math.cos(player.moveAngle) * player.speed;
    player.mesh.rotation.y = player.carAngle;
}