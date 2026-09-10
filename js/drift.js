// drift.js - V14 + volta de aderência gradual (só isso, resto V14 original)
let driftEntrySpeed = 0;
let steerHoldTime = 0;
let lastSteerInput = 0;
let gripRecoveryProgress = 0;

// ===== CONFIGURAÇÃO - VOCÊ CONTROLA TUDO AQUI =====
const WHEEL_CONFIG = {
    normalSteerSpeed: 0.05,
    driftSteerSpeed: 0.04,
    returnSpeed: 0.01,
    normalAngle: 0.55,
    driftAngle: 1.0,
    useDeltaTime: true
};

// ===== ADERÊNCIA - VOLTA LENTA DURANTE SEGUNDOS =====
const GRIP_CONFIG = {
    gripReturnOnExit: 0.008,
    normalGripSlow: 0.10,
    normalGripFast: 0.22,
    gripRecoverySpeed: 0.6,
    gripReturnSlow: 0.02,
    gripReturnFast: 0.06
};

function updateDriftPhysics(player, keys, spacePressed, dt) {
    const gearCfg = { 
        "-1": { acc: -0.005, max: -0.25, steer: 0.095 },
        "1":  { acc: 0.004, max: 0.166, steer: 0.090 },
        "2":  { acc: 0.005, max: 0.35,  steer: 0.075 },
        "3":  { acc: 0.006, max: 0.55,  steer: 0.060 },
        "4":  { acc: 0.007, max: 0.70,  steer: 0.045 },
        "5":  { acc: 0.008, max: 0.80,  steer: 0.030 }
    };

    const currentGear = gearCfg[player.gear] || gearCfg["1"];
    let acc = 0;
    
    player.isBurnout = false;
    if (player.gear === 1 && spacePressed && (keys['KeyW'] || keys['ArrowUp'])) {
        player.isBurnout = true;
        acc = player.speed < 0.04 ? 0.005 : -0.01;
    } else {
        if (keys['KeyW'] || keys['ArrowUp']) {
            if (player.gear > 0 && player.speed < currentGear.max) acc = currentGear.acc;
            else if (player.gear === -1 && player.speed > currentGear.max) acc = currentGear.acc;
        } else if (keys['KeyS'] || keys['ArrowDown']) {
            acc = player.speed > 0 ? -0.008 : 0.005;
        }
    }

    let steerInput = 0;
    if (keys['KeyA'] || keys['ArrowLeft']) steerInput = 1;
    if (keys['KeyD'] || keys['ArrowRight']) steerInput = -1;

    if (steerInput !== 0 && steerInput === lastSteerInput) {
        steerHoldTime += dt;
    } else if (steerInput !== 0 && steerInput !== lastSteerInput) {
        steerHoldTime = dt;
    } else {
        steerHoldTime = 0;
    }
    lastSteerInput = steerInput;

    const wasDrifting = player.isDrifting;
    let wantDriftByHandbrake = !player.isBurnout && spacePressed && Math.abs(player.speed) > 0.15;
    player.isDrifting = wantDriftByHandbrake;
    const justStartedDrift = player.isDrifting && !wasDrifting;
    const justExitedDrift = wasDrifting && !player.isDrifting;

    if (justStartedDrift) {
        driftEntrySpeed = player.speed;
    }

    const DRIFT_SPEED_CONFIG = {
        entryLoss: 0.02,
        friction: 0.985,
        accelInDrift: 0.002,
        maxDriftSpeed: 0.45,
        minDriftSpeed: 0.12
    };

    if (player.isDrifting) {
        if (justStartedDrift) {
            player.speed = Math.max(player.speed - DRIFT_SPEED_CONFIG.entryLoss, DRIFT_SPEED_CONFIG.minDriftSpeed);
        }
        if (keys['KeyW'] || keys['ArrowUp']) {
            if (player.speed < DRIFT_SPEED_CONFIG.maxDriftSpeed) {
                let driftAcc = DRIFT_SPEED_CONFIG.accelInDrift + acc * 0.3;
                player.speed += driftAcc;
            }
        }
        player.speed *= DRIFT_SPEED_CONFIG.friction;
        if (Math.abs(player.speed) < DRIFT_SPEED_CONFIG.minDriftSpeed) {
            player.speed = Math.sign(player.speed) * DRIFT_SPEED_CONFIG.minDriftSpeed;
        }
        if (player.speed > DRIFT_SPEED_CONFIG.maxDriftSpeed) {
            player.speed = DRIFT_SPEED_CONFIG.maxDriftSpeed;
        }
        if (player.speed < -DRIFT_SPEED_CONFIG.maxDriftSpeed) {
            player.speed = -DRIFT_SPEED_CONFIG.maxDriftSpeed;
        }
    } else {
        driftEntrySpeed = 0;
        player.speed = (player.speed + acc) * 0.99;
        if (Math.abs(player.speed) < 0.001) player.speed = 0;
    }
    
    const baseSteerSpeed = currentGear.steer;

    if (!player.wheelRotation) player.wheelRotation = 0;
    player.wheelRotation += player.isBurnout ? 0.5 : player.speed * -15;

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
                const entrySlow = THREE.MathUtils.clamp(Math.abs(driftEntrySpeed) * 1.2, 0.4, 1.0);
                const driftSteerFactor = 1.30;
                player.carAngle += steerInput * baseSteerSpeed * driftSteerFactor * entrySlow;
            } else {
                const speedFactor = Math.min(Math.abs(player.speed) * 2.5, 1.0);
                player.carAngle += steerInput * baseSteerSpeed * speedFactor * 0.55;
            }
        }
        
        if (player.isDrifting) {
            let wheelFL = player.frontWheels.find(w => w.name.includes('FL') || (w.name.includes('Wheel') && w.position.x < 0)) || player.frontWheels[0];
            let wheelFR = player.frontWheels.find(w => w.name.includes('FR') || (w.name.includes('Wheel') && w.position.x > 0)) || player.frontWheels[1];

            if (wheelFL) {
                let targetFL = steerInput * -WHEEL_CONFIG.driftAngle;
                let lerpSpeed = WHEEL_CONFIG.driftSteerSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
                wheelFL.rotation.y = THREE.MathUtils.lerp(wheelFL.rotation.y, targetFL, lerpSpeed);
            }
            if (wheelFR) {
                let targetFR = steerInput * WHEEL_CONFIG.driftAngle;
                let lerpSpeed = WHEEL_CONFIG.driftSteerSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
                wheelFR.rotation.y = THREE.MathUtils.lerp(wheelFR.rotation.y, targetFR, lerpSpeed);
            }
        } else {
            let wheelFL = player.frontWheels.find(w => w.name.includes('FL') || (w.name.includes('Wheel') && w.position.x < 0)) || player.frontWheels[0];
            let wheelFR = player.frontWheels.find(w => w.name.includes('FR') || (w.name.includes('Wheel') && w.position.x > 0)) || player.frontWheels[1];

            if (wheelFL) {
                let targetFL = steerInput * WHEEL_CONFIG.normalAngle;
                let isOpposite = Math.sign(wheelFL.rotation.y) !== Math.sign(targetFL) && Math.abs(wheelFL.rotation.y) > 0.15;
                let baseSpeed = justExitedDrift || isOpposite ? WHEEL_CONFIG.returnSpeed : WHEEL_CONFIG.normalSteerSpeed;
                if (isOpposite) baseSpeed = Math.min(WHEEL_CONFIG.returnSpeed, WHEEL_CONFIG.driftSteerSpeed);
                let lerpSpeed = baseSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
                wheelFL.rotation.y = THREE.MathUtils.lerp(wheelFL.rotation.y, targetFL, lerpSpeed);
            }
            if (wheelFR) {
                let targetFR = steerInput * -WHEEL_CONFIG.normalAngle;
                let isOpposite = Math.sign(wheelFR.rotation.y) !== Math.sign(targetFR) && Math.abs(wheelFR.rotation.y) > 0.15;
                let baseSpeed = justExitedDrift || isOpposite ? WHEEL_CONFIG.returnSpeed : WHEEL_CONFIG.normalSteerSpeed;
                if (isOpposite) baseSpeed = Math.min(WHEEL_CONFIG.returnSpeed, WHEEL_CONFIG.driftSteerSpeed);
                let lerpSpeed = baseSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
                wheelFR.rotation.y = THREE.MathUtils.lerp(wheelFR.rotation.y, targetFR, lerpSpeed);
            }
        }

        if (player.wheelParts) {
            player.wheelParts.forEach(w => { 
                if(w.isMesh) w.rotation.z = player.wheelRotation;
            });
            player.frontWheels.forEach(pivot => {
                if(pivot.userData && pivot.userData.wheelMesh){
                    pivot.userData.wheelMesh.rotation.z = player.wheelRotation;
                } else {
                    pivot.rotation.z = player.wheelRotation;
                }
            });
        }
        if (player.steeringWheel) {
            if (player.isDrifting) {
                let lerpSpeed = WHEEL_CONFIG.driftSteerSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1) * 5;
                player.steeringWheel.rotation.z = THREE.MathUtils.lerp(player.steeringWheel.rotation.z, steerInput * 0.8, lerpSpeed);
            } else {
                let baseSpeed = justExitedDrift ? WHEEL_CONFIG.returnSpeed : WHEEL_CONFIG.normalSteerSpeed;
                let lerpSpeed = baseSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1) * 5;
                player.steeringWheel.rotation.z = THREE.MathUtils.lerp(player.steeringWheel.rotation.z, steerInput * 0.6, lerpSpeed);
            }
        }
    } else {
        player.frontWheels.forEach(wheel => {
            let lerpSpeed = WHEEL_CONFIG.returnSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
            wheel.rotation.y = THREE.MathUtils.lerp(wheel.rotation.y, 0, lerpSpeed);
        });
        if (player.steeringWheel) {
            let lerpSpeed = WHEEL_CONFIG.returnSpeed * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
            player.steeringWheel.rotation.z = THREE.MathUtils.lerp(player.steeringWheel.rotation.z, 0, lerpSpeed);
        }
    }
    
    if (player.isDrifting) {
        player.driftIntensity = THREE.MathUtils.lerp(player.driftIntensity, 1.2, 0.05);
        let targetRoll = 0;
        if (steerInput !== 0) {
            const speedBasedPull = THREE.MathUtils.mapLinear(Math.abs(driftEntrySpeed), 0.15, 0.8, 0.018, 0.008);
            player.moveAngle += steerInput * speedBasedPull;
            targetRoll = (player.carAngle - player.moveAngle) * 0.12;
            targetRoll = THREE.MathUtils.clamp(targetRoll, -0.18, 0.18);
        } else {
            const returnSpeed = THREE.MathUtils.mapLinear(Math.abs(driftEntrySpeed), 0.15, 0.8, 0.012, 0.004);
            player.moveAngle += (player.carAngle - player.moveAngle) * returnSpeed;
        }
        player.mesh.rotation.z = THREE.MathUtils.lerp(player.mesh.rotation.z, targetRoll, 0.);
        player.driftPoints += 25 * (1 + Math.abs(player.carAngle - player.moveAngle));
        player.multiplier = Math.min(10, player.multiplier + 0.005);
    } else {
        player.driftIntensity = THREE.MathUtils.lerp(player.driftIntensity, 0, 0.25);

        let frontPullLerp;
        if (justExitedDrift) {
            gripRecoveryProgress = 0;
            frontPullLerp = GRIP_CONFIG.gripReturnOnExit;
        } else if (gripRecoveryProgress < 1.0) {
            gripRecoveryProgress = Math.min(gripRecoveryProgress + dt * GRIP_CONFIG.gripRecoverySpeed, 1.0);
            let normalGrip = THREE.MathUtils.mapLinear(Math.abs(player.speed), 0.05, 0.6, GRIP_CONFIG.normalGripSlow, GRIP_CONFIG.normalGripFast);
            frontPullLerp = THREE.MathUtils.lerp(GRIP_CONFIG.gripReturnOnExit, normalGrip, gripRecoveryProgress);
        } else {
            frontPullLerp = THREE.MathUtils.mapLinear(Math.abs(player.speed), 0.05, 0.6, GRIP_CONFIG.normalGripSlow, GRIP_CONFIG.normalGripFast);
        }
        let lerpWithDt = frontPullLerp * (WHEEL_CONFIG.useDeltaTime ? dt * 60 : 1);
        player.moveAngle = THREE.MathUtils.lerp(player.moveAngle, player.carAngle, lerpWithDt);
        
        player.mesh.rotation.z = THREE.MathUtils.lerp(player.mesh.rotation.z, 0, 0.20);
        player.mesh.rotation.x = THREE.MathUtils.lerp(player.mesh.rotation.x, 0, 0.20);
        if (Math.abs(player.speed) < 0.05) player.multiplier = 1.0;
    }

    player.mesh.position.x += Math.sin(player.moveAngle) * player.speed;
    player.mesh.position.z += Math.cos(player.moveAngle) * player.speed;
    player.mesh.rotation.y = player.carAngle;
}
