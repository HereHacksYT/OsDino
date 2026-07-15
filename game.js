// --- SİSTEM DEĞİŞKENLERİ ---
let scene, camera, renderer;
let player, playerScale = 1.0; 
const baseMoveSpeed = 0.132;

let gameStarted = false;
let walkCycle = 0;
let tailMesh;

const keys = {};
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

let buildings = [];
let bots = [];
let cars = [];
let aiDinos = [];
let borderMeshes = []; 
let roadMeshes = [];

const MAP_SIZE = 60; 

const ROAD_COORDS = [];
for (let pos = -100; pos < 100; pos += 20) {
    ROAD_COORDS.push(pos);
}

// UI Elemanları
const sizeValEl = document.getElementById('size-val');
const tierValEl = document.getElementById('tier-val');
const warningMsgEl = document.getElementById('warning-msg');
const timerValEl = document.getElementById('timer-val');
let warningTimeout = null;

const AI_COLORS = [0x3182ce, 0x805ad5, 0xdd6b20, 0xe53e3e, 0x319795];

let dangerTimer = 20;
let lastTimerUpdate = Date.now();

// --- BAŞLANGIÇ (INIT) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 5000); 

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(30, 80, 10);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // ZEMİN
    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    createMapBorders();
    createCityGrid();

    createOsDino();       
    
    spawnCityAssets(45, 15, 45); 
    spawnAIDinos();      
    setupControls();
    setupAdminPanel();

    animate();
}

function createMapBorders() {
    for (let b of borderMeshes) scene.remove(b);
    borderMeshes = [];

    const borderMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    const barrierHeight = 6;
    const barrierThickness = 1.5;

    const borderGeoH = new THREE.BoxGeometry(MAP_SIZE * 2, barrierHeight, barrierThickness);
    const borderGeoV = new THREE.BoxGeometry(barrierThickness, barrierHeight, MAP_SIZE * 2);

    const north = new THREE.Mesh(borderGeoH, borderMat);
    north.position.set(0, barrierHeight / 2, MAP_SIZE);
    
    const south = new THREE.Mesh(borderGeoH, borderMat);
    south.position.set(0, barrierHeight / 2, -MAP_SIZE);

    const east = new THREE.Mesh(borderGeoV, borderMat);
    east.position.set(MAP_SIZE, barrierHeight / 2, 0);

    const west = new THREE.Mesh(borderGeoV, borderMat);
    west.position.set(-MAP_SIZE, barrierHeight / 2, 0);

    scene.add(north, south, east, west);
    borderMeshes.push(north, south, east, west);
}

function createCityGrid() {
    for (let r of roadMeshes) scene.remove(r);
    roadMeshes = [];

    const roadMat = new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 0.95 });
    
    for (let pos of ROAD_COORDS) {
        if (Math.abs(pos) < MAP_SIZE) {
            const roadH = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE * 2, 4.5), roadMat);
            roadH.rotation.x = -Math.PI/2;
            roadH.position.set(0, 0.02, pos); 
            roadH.receiveShadow = true;
            scene.add(roadH);
            roadMeshes.push(roadH);

            const roadV = new THREE.Mesh(new THREE.PlaneGeometry(4.5, MAP_SIZE * 2), roadMat);
            roadV.rotation.x = -Math.PI/2;
            roadV.position.set(pos, 0.02, 0);
            roadV.receiveShadow = true;
            scene.add(roadV);
            roadMeshes.push(roadV);
        }
    }
}

function isPointOnRoad(x, z, tolerance = 3.5) {
    for (let pos of ROAD_COORDS) {
        if (Math.abs(pos) < MAP_SIZE) {
            if (Math.abs(x - pos) < tolerance || Math.abs(z - pos) < tolerance) return true;
        }
    }
    return false;
}

// --- PENCERELİ BİNA OLUŞTURMA SİSTEMİ ---
function createDetailedBuilding(width, height, colorHex) {
    const buildingGroup = new THREE.Group();

    const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.6 })
    );
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    buildingGroup.add(bodyMesh);

    const roofKit = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.5, height * 0.08, width * 0.5),
        new THREE.MeshStandardMaterial({ color: 0x1f2937 })
    );
    roofKit.position.set(0, height / 2 + (height * 0.04), 0);
    buildingGroup.add(roofKit);

    const windowColor = Math.random() > 0.5 ? 0xfef08a : 0x22d3ee;
    const windowMat = new THREE.MeshBasicMaterial({ color: windowColor });
    const windowGeo = new THREE.BoxGeometry(0.3, 0.4, 0.05);

    const floors = Math.floor(height / 1.8);
    for (let f = 0; f < floors; f++) {
        const yPos = -height/2 + 1.0 + (f * 1.6);
        
        for (let xOff of [-width*0.3, 0, width*0.3]) {
            const winFront = new THREE.Mesh(windowGeo, windowMat);
            winFront.position.set(xOff, yPos, width/2 + 0.03);
            buildingGroup.add(winFront);

            const winBack = new THREE.Mesh(windowGeo, windowMat);
            winBack.position.set(xOff, yPos, -width/2 - 0.03);
            buildingGroup.add(winBack);
        }

        const windowGeoRot = new THREE.BoxGeometry(0.05, 0.4, 0.3);
        for (let zOff of [-width*0.3, 0, width*0.3]) {
            const winRight = new THREE.Mesh(windowGeoRot, windowMat);
            winRight.position.set(width/2 + 0.03, yPos, zOff);
            buildingGroup.add(winRight);

            const winLeft = new THREE.Mesh(windowGeoRot, windowMat);
            winLeft.position.set(-width/2 - 0.03, yPos, zOff);
            buildingGroup.add(winLeft);
        }
    }

    return buildingGroup;
}

function buildDinoMesh(colorHex) {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 16), skinMat);
    body.scale.set(1, 0.85, 1.3);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), skinMat);
    head.position.set(0, 1.15, 0.55);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), skinMat);
    snout.scale.set(1, 0.7, 1.1);
    snout.position.set(0, 1.05, 0.85);
    group.add(snout);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eyeL.position.set(0.28, 1.25, 0.7);
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pupilMat);
    pupilL.position.set(0.33, 1.25, 0.76);
    group.add(eyeL, pupilL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), eyeMat);
    eyeR.position.set(-0.28, 1.25, 0.7);
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), pupilMat);
    pupilR.position.set(-0.33, 1.25, 0.76);
    group.add(eyeR, pupilR);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.1, 12), skinMat);
    tail.rotation.x = -Math.PI / 2.8;
    tail.position.set(0, 0.5, -0.9);
    tail.castShadow = true;
    group.add(tail);

    return { group, tail };
}

function createOsDino() {
    const dino = buildDinoMesh(0x22c55e);
    player = dino.group;
    tailMesh = dino.tail;
    player.position.set(0, 0, 0);
    scene.add(player);
    
    updatePlayerPhysicalSize();
}

function spawnCityAssets(buildingCount, carCount, botCount) {
    const buildingColors = [0x4b5563, 0x374151, 0x1f2937, 0x7c3aed, 0x0f766e, 0xd97706];

    for (let i = 0; i < buildingCount; i++) {
        const h = Math.random() * 12 + 6; 
        const w = Math.random() * 2.0 + 3.0;

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(x*x + z*z) < 15 || isPointOnRoad(x, z, (w / 2) + 1.5));

        const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bGroup = createDetailedBuilding(w, h, bColor);
        bGroup.position.set(x, h / 2, z);
        
        bGroup.userData = { 
            width: w, 
            height: h, 
            isEaten: false, 
        };
        scene.add(bGroup);
        buildings.push(bGroup);
    }

    const carMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    for (let i = 0; i < carCount; i++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.9), carMat);
        let randomRoadPos = 0;
        if (ROAD_COORDS.length > 0) {
            const validRoads = ROAD_COORDS.filter(p => Math.abs(p) < MAP_SIZE);
            randomRoadPos = validRoads[Math.floor(Math.random() * validRoads.length)] || 0;
        }

        const isDikey = Math.random() > 0.5;
        car.position.y = 0.35;
        car.castShadow = true;
        car.userData = {
            speed: (0.055 + Math.random() * 0.044),
            isDikey: isDikey,
            roadPos: randomRoadPos,
            dir: Math.random() > 0.5 ? 1 : -1
        };

        if (isDikey) {
            car.position.x = randomRoadPos;
            car.position.z = (Math.random() - 0.5) * (MAP_SIZE * 1.6);
        } else {
            car.position.x = (Math.random() - 0.5) * (MAP_SIZE * 1.6);
            car.position.z = randomRoadPos;
            car.rotation.y = Math.PI / 2;
        }

        scene.add(car);
        cars.push(car);
    }

    const botMat = new THREE.MeshStandardMaterial({ color: 0x2563eb });
    for (let i = 0; i < botCount; i++) {
        const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), botMat);
        let bx, bz;
        do {
            bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(bx*bx + bz*bz) < 12 || isPointOnRoad(bx, bz, 1.0));

        bot.position.set(bx, 0.35, bz);
        bot.castShadow = true;
        bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.0385 };
        scene.add(bot);
        bots.push(bot);
    }
}

function spawnAIDinos() {
    for (let i = 0; i < 5; i++) {
        const d = createSingleAIDino(AI_COLORS[i]);
        aiDinos.push(d);
    }
}

function createSingleAIDino(colorHex, initialScale = null) {
    const scale = initialScale !== null ? initialScale : (0.8 + Math.random() * 0.5);
    const dinoData = buildDinoMesh(colorHex);
    
    const aiGroup = dinoData.group;
    
    let ax, az;
    do {
        ax = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
        az = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
    } while (Math.sqrt(Math.pow(ax, 2) + Math.pow(az, 2)) < 15);

    aiGroup.position.set(ax, 0, az);
    scene.add(aiGroup); 

    const labelEl = document.createElement('div');
    labelEl.className = 'ai-label';
    document.body.appendChild(labelEl);

    const indicatorEl = document.createElement('div');
    indicatorEl.className = 'radar-indicator';
    document.body.appendChild(indicatorEl);

    const aiObj = {
        mesh: aiGroup,
        scale: scale, 
        colorHex: colorHex,
        tail: dinoData.tail,
        label: labelEl,
        indicator: indicatorEl,
        angle: Math.random() * Math.PI * 2,
        speed: 0.055,
        needsDelayedGrowth: false
    };

    updateAIDinoPhysicalSize(aiObj);
    return aiObj;
}

function calculateVisualScale(realScale) {
    let visualScale = 1.0;

    if (realScale >= 1000) {
        visualScale = realScale / 1000;
    } else if (realScale >= 100) {
        visualScale = realScale / 100;
    } else if (realScale >= 10) {
        visualScale = realScale / 10;
    } else {
        visualScale = realScale;
    }

    return visualScale;
}

// Yeme mesafesi - GÖRSEL boyuta göre!
function getEatRange() {
    const visScale = calculateVisualScale(playerScale);
    // Görsel boyutla orantılı yeme mesafesi
    return 1.5 * visScale;
}

function updatePlayerPhysicalSize() {
    const visScale = calculateVisualScale(playerScale);
    player.scale.set(visScale, visScale, visScale);

    let tierText = "🦎 Yavru Dinozor";
    if (playerScale >= 100000) {
        tierText = "🐉 EFSANEVİ TİTAN (100.000m+)";
    } else if (playerScale >= 10000) {
        tierText = "🦖 DEVA ASA (10.000m+)";
    } else if (playerScale >= 1000) {
        tierText = "🦕 MUTANT MEGALODON (1.000m+)";
    } else if (playerScale >= 100) {
        tierText = "🐊 ALFA YIRTICI (100m+)";
    } else if (playerScale >= 10) {
        tierText = "🦖 BÜYÜK DİNOZOR (10m+)";
    }

    tierValEl.innerText = tierText;
}

function updateAIDinoPhysicalSize(ai) {
    const visScale = calculateVisualScale(ai.scale);
    ai.mesh.scale.set(visScale, visScale, visScale);
}

function getBuildingRequiredSize(buildingHeight) {
    let baseReq = buildingHeight * 0.35;

    if (playerScale >= 100000) {
        return baseReq * 3125;
    } else if (playerScale >= 10000) {
        return baseReq * 625;
    } else if (playerScale >= 1000) {
        return baseReq * 125;
    } else if (playerScale >= 100) {
        return baseReq * 25;
    } else if (playerScale >= 10) {
        return baseReq * 5;
    }

    return baseReq;
}

function growPlayer(amount) {
    const oldScale = playerScale;
    playerScale += amount;
    sizeValEl.innerText = playerScale.toFixed(2);
    
    if (oldScale < 10 && playerScale >= 10) {
        triggerEvolutionUI("🦖 BÜYÜK DİNOZOR OLDUN! ARTIK DAHA GÜÇLÜSÜN!");
    } else if (oldScale < 100 && playerScale >= 100) {
        triggerEvolutionUI("🐊 ALFA YIRTICI SEVİYESİNE ULAŞTIN!");
    } else if (oldScale < 1000 && playerScale >= 1000) {
        triggerEvolutionUI("🦕 MUTANT MEGALODON GÜCÜ KAZANDIN!");
    } else if (oldScale < 10000 && playerScale >= 10000) {
        triggerEvolutionUI("🦖 DEVA ASA BOYUTUNA ERİŞTİN!");
    } else if (oldScale < 100000 && playerScale >= 100000) {
        triggerEvolutionUI("🐉 EFSANEVİ TİTAN OLDUN!!!");
    }

    updatePlayerPhysicalSize();
}

function showSizeWarning(requiredSize) {
    warningMsgEl.innerText = `Gereken: ${requiredSize.toFixed(1)}m!`;
    warningMsgEl.style.color = '#ef4444';
    warningMsgEl.style.display = 'block';

    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        warningMsgEl.style.display = 'none';
    }, 1200);
}

function setupAdminPanel() {
    const adminBtn = document.getElementById('admin-btn');
    const adminControls = document.getElementById('admin-controls');
    const adminApplyBtn = document.getElementById('admin-apply-btn');
    const adminSizeInput = document.getElementById('admin-size-input');

    adminBtn.addEventListener('click', () => {
        const pw = prompt("OsDino Admin Şifresi:");
        if (pw === "osman123") {
            alert("Sisteme erişildi!");
            adminControls.style.display = 'block';
        } else {
            alert("Şifre Yanlış!");
        }
    });

    adminApplyBtn.addEventListener('click', () => {
        const newSize = parseFloat(adminSizeInput.value);
        if (!isNaN(newSize) && newSize > 0) {
            playerScale = newSize;
            sizeValEl.innerText = playerScale.toFixed(2);
            updatePlayerPhysicalSize();
        }
    });
}

function setupControls() {
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', onWindowResize);

    document.getElementById('play-btn').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        gameStarted = true;
        lastTimerUpdate = Date.now();
    });

    const joystickContainer = document.getElementById('joystick-container');
    const joystickKnob = document.getElementById('joystick-knob');

    const handleJoystickMove = (e) => {
        e.preventDefault();
        const touch = e.touches ? e.touches[0] : e;
        const rect = joystickContainer.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxLimit = rect.width / 2;

        if (distance > maxLimit) {
            dx = (dx / distance) * maxLimit;
            dy = (dy / distance) * maxLimit;
        }

        joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
        joystickVector.x = dx / maxLimit;
        joystickVector.y = dy / maxLimit;
        joystickActive = true;
    };

    const resetJoystick = () => {
        joystickKnob.style.transform = 'translate(0px, 0px)';
        joystickVector = { x: 0, y: 0 };
        joystickActive = false;
    };

    joystickContainer.addEventListener('touchstart', (e) => { joystickActive = true; handleJoystickMove(e); });
    joystickContainer.addEventListener('touchmove', handleJoystickMove);
    joystickContainer.addEventListener('touchend', resetJoystick);

    joystickContainer.addEventListener('mousedown', () => { joystickActive = true; });
    window.addEventListener('mousemove', (e) => { if(joystickActive) handleJoystickMove(e); });
    window.addEventListener('mouseup', resetJoystick);
}

function updatePlayer() {
    let moveX = 0;
    let moveZ = 0;

    if (joystickActive) {
        moveX = -joystickVector.x;
        moveZ = -joystickVector.y;
    } else {
        if (keys['w'] || keys['arrowup']) moveZ = 1;
        if (keys['s'] || keys['arrowdown']) moveZ = -1;
        if (keys['a'] || keys['arrowleft']) moveX = 1;
        if (keys['d'] || keys['arrowright']) moveX = -1;
    }

    if (moveX !== 0 || moveZ !== 0) {
        const targetAngle = Math.atan2(moveX, moveZ);
        player.rotation.y = targetAngle;

        const speedMult = baseMoveSpeed;
        const power = joystickActive ? Math.sqrt(moveX*moveX + moveZ*moveZ) : 1.0;
        
        const nextX = player.position.x + Math.sin(targetAngle) * speedMult * power;
        const nextZ = player.position.z + Math.cos(targetAngle) * speedMult * power;

        if (Math.abs(nextX) < MAP_SIZE - 0.5 && Math.abs(nextZ) < MAP_SIZE - 0.5) {
            let canGo = true;
            const eatRange = getEatRange();

            for (let b of buildings) {
                if (b.userData.isEaten) continue;

                const dist = Math.sqrt(Math.pow(nextX - b.position.x, 2) + Math.pow(nextZ - b.position.z, 2));
                
                if (dist < eatRange) {
                    const requiredSize = getBuildingRequiredSize(b.userData.height);
                    
                    if (playerScale > requiredSize) {
                        eatBuilding(b);
                    } else {
                        canGo = false;
                        showSizeWarning(requiredSize);
                    }
                }
            }

            if (canGo) {
                player.position.x = nextX;
                player.position.z = nextZ;

                walkCycle += 0.2;
                if (tailMesh) tailMesh.rotation.y = Math.sin(walkCycle) * 0.35;
            }
        }
    }
}

function updateCarsAndBots() {
    const eatRange = getEatRange();
    
    for (let car of cars) {
        const moveStep = car.userData.speed * car.userData.dir;
        
        if (car.userData.isDikey) {
            car.position.z += moveStep;
            if (Math.abs(car.position.z) > MAP_SIZE - 2) {
                car.userData.dir *= -1;
                car.rotation.y = car.userData.dir > 0 ? 0 : Math.PI;
            }
        } else {
            car.position.x += moveStep;
            if (Math.abs(car.position.x) > MAP_SIZE - 2) {
                car.userData.dir *= -1;
                car.rotation.y = car.userData.dir > 0 ? Math.PI/2 : -Math.PI/2;
            }
        }

        if (player.position.distanceTo(car.position) < eatRange) {
            scene.remove(car);
            cars.splice(cars.indexOf(car), 1);
            growPlayer(0.35); 
            respawnCar();
        }
    }

    for (let bot of bots) {
        bot.position.x += Math.sin(bot.userData.angle) * bot.userData.speed;
        bot.position.z += Math.cos(bot.userData.angle) * bot.userData.speed;

        if (Math.abs(bot.position.x) > MAP_SIZE - 2 || isPointOnRoad(bot.position.x, bot.position.z, 0.5)) {
            bot.userData.angle += Math.PI;
        }

        if (player.position.distanceTo(bot.position) < eatRange) {
            scene.remove(bot);
            bots.splice(bots.indexOf(bot), 1);
            growPlayer(0.18); 
            respawnBot();
        }
    }
}

function updateAIDinos() {
    for (let ai of aiDinos) {
        const distToPlayer = ai.mesh.position.distanceTo(player.position);

        const boundaryThreshold = MAP_SIZE - 4;
        if (Math.abs(ai.mesh.position.x) > boundaryThreshold || Math.abs(ai.mesh.position.z) > boundaryThreshold) {
            ai.angle = Math.atan2(0 - ai.mesh.position.x, 0 - ai.mesh.position.z);
        } else {
            let targetPos = null;
            if (distToPlayer <= 25 && ai.scale > playerScale) {
                targetPos = player.position; 
            } else {
                if (!targetPos) {
                    ai.angle += (Math.random() - 0.5) * 0.02;
                }
            }

            if (targetPos) {
                ai.angle = Math.atan2(targetPos.x - ai.mesh.position.x, targetPos.z - ai.mesh.position.z);
            }
        }

        ai.mesh.position.x += Math.sin(ai.angle) * ai.speed;
        ai.mesh.position.z += Math.cos(ai.angle) * ai.speed;
        ai.mesh.rotation.y = ai.angle;

        const tempV = new THREE.Vector3().copy(ai.mesh.position);
        tempV.project(camera);
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;

        ai.label.style.left = `${x}px`;
        ai.label.style.top = `${y}px`;
        ai.label.innerText = `Dino: ${ai.scale.toFixed(0)}m`;

        const isOffscreen = (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight);
        if (isOffscreen) {
            ai.indicator.style.display = 'flex';
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const angle = Math.atan2(y - screenCenterY, x - screenCenterX);
            const radius = Math.min(screenCenterX, screenCenterY) - 50;
            ai.indicator.style.left = `${screenCenterX + Math.cos(angle) * radius}px`;
            ai.indicator.style.top = `${screenCenterY + Math.sin(angle) * radius}px`;

            if (ai.scale > playerScale) {
                ai.indicator.innerHTML = '☠️';
                ai.indicator.style.color = '#ef4444';
                ai.indicator.style.transform = `rotate(0deg)`;
            } else {
                ai.indicator.innerHTML = '▲';
                ai.indicator.style.color = '#22c55e';
                ai.indicator.style.transform = `rotate(${angle * 180 / Math.PI + 90}deg)`;
            }
        } else {
            ai.indicator.style.display = 'none';
        }

        if (distToPlayer < 1.0) {
            if (playerScale > ai.scale) {
                const savedColor = ai.colorHex;
                scene.remove(ai.mesh);
                ai.label.remove();
                ai.indicator.remove();
                aiDinos.splice(aiDinos.indexOf(ai), 1);

                growPlayer(ai.scale * 0.25);

                setTimeout(() => {
                    const respawned = createSingleAIDino(savedColor, playerScale * 0.85);
                    aiDinos.push(respawned);
                }, 10000);
            } else {
                alert("Senden daha büyük bir dinozor seni yedi! Yeniden başlıyor...");
                location.reload();
            }
        }
    }
}

function eatBuilding(building) {
    building.userData.isEaten = true;
    
    let scaleVal = 1.0;
    const shrink = setInterval(() => {
        scaleVal -= 0.15;
        if (scaleVal <= 0.05) {
            clearInterval(shrink);
            scene.remove(building);
            
            setTimeout(() => {
                respawnBuilding(building);
            }, 6000); 
        } else {
            building.scale.set(scaleVal, scaleVal, scaleVal);
        }
    }, 25);

    let pointsMultiplier = 1;
    if (playerScale >= 100000) {
        pointsMultiplier = 3125;
    } else if (playerScale >= 10000) {
        pointsMultiplier = 625;
    } else if (playerScale >= 1000) {
        pointsMultiplier = 125;
    } else if (playerScale >= 100) {
        pointsMultiplier = 25;
    } else if (playerScale >= 10) {
        pointsMultiplier = 5;
    }
    
    growPlayer(building.userData.height * 0.2 * pointsMultiplier);
}

function respawnBuilding(oldBuilding) {
    const index = buildings.indexOf(oldBuilding);
    if (index > -1) buildings.splice(index, 1);

    const h = Math.random() * 12 + 6;
    const w = Math.random() * 2.0 + 3.0;
    
    let x, z;
    do {
        x = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
        z = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
    } while (Math.sqrt(x*x + z*z) < 15 || isPointOnRoad(x, z, (w / 2) + 1.5));

    const buildingColors = [0x4b5563, 0x374151, 0x1f2937, 0x7c3aed, 0x0f766e, 0xd97706];
    const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
    const bGroup = createDetailedBuilding(w, h, bColor);
    bGroup.position.set(x, h/2, z);

    bGroup.userData = { 
        width: w, 
        height: h, 
        isEaten: false, 
    };

    scene.add(bGroup);
    buildings.push(bGroup);
}

function respawnCar() {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.9), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    let randomRoadPos = 0;
    if (ROAD_COORDS.length > 0) {
        const validRoads = ROAD_COORDS.filter(p => Math.abs(p) < MAP_SIZE);
        randomRoadPos = validRoads[Math.floor(Math.random() * validRoads.length)] || 0;
    }

    car.position.y = 0.35;
    car.castShadow = true;
    car.userData = {
        speed: (0.055 + Math.random() * 0.044),
        isDikey: Math.random() > 0.5,
        roadPos: randomRoadPos,
        dir: 1
    };

    if (car.userData.isDikey) {
        car.position.x = randomRoadPos;
        car.position.z = (Math.random() - 0.5) * (MAP_SIZE * 1.6);
    } else {
        car.position.x = (Math.random() - 0.5) * (MAP_SIZE * 1.6);
        car.position.z = randomRoadPos;
        car.rotation.y = Math.PI / 2;
    }

    scene.add(car);
    cars.push(car);
}

function respawnBot() {
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x2563eb }));
    let bx, bz;
    do {
        bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
    } while (Math.sqrt(bx*bx + bz*bz) < 12 || isPointOnRoad(bx, bz, 1.0));

    bot.position.set(bx, 0.35, bz);
    bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.0385 };
    scene.add(bot);
    bots.push(bot);
}

// --- AI BÜYÜME SİSTEMİ ---
function updateDangerTimer() {
    const now = Date.now();
    if (now - lastTimerUpdate >= 1000) {
        dangerTimer--;
        lastTimerUpdate = now;

        if (dangerTimer <= 0) {
            dangerTimer = 20;

            for (let ai of aiDinos) {
                const distToPlayer = ai.mesh.position.distanceTo(player.position);

                if (distToPlayer > 30) {
                    ai.scale *= 1.20;
                    updateAIDinoPhysicalSize(ai);
                    ai.needsDelayedGrowth = false;
                } else {
                    ai.needsDelayedGrowth = true;
                }
            }
        }
        timerValEl.innerText = dangerTimer;
    }

    for (let ai of aiDinos) {
        if (ai.needsDelayedGrowth) {
            const distToPlayer = ai.mesh.position.distanceTo(player.position);
            if (distToPlayer > 30) {
                ai.scale *= 1.20;
                updateAIDinoPhysicalSize(ai);
                ai.needsDelayedGrowth = false;
            }
        }
    }
}

function triggerEvolutionUI(message) {
    warningMsgEl.innerText = message;
    warningMsgEl.style.color = '#22c55e';
    warningMsgEl.style.display = 'block';
    
    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        warningMsgEl.style.display = 'none';
    }, 2500);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- KAMERA VE OYUN DÖNGÜSÜ ---
function animate() {
    requestAnimationFrame(animate);

    if (!gameStarted) {
        renderer.render(scene, camera);
        return;
    }

    updateDangerTimer();
    updatePlayer();
    updateCarsAndBots();
    updateAIDinos();

    const visScale = calculateVisualScale(playerScale);
    const targetCamY = player.position.y + (3.8 * visScale);
    const targetCamZ = player.position.z - (5.8 * visScale);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
    
    camera.lookAt(player.position.x, player.position.y + (0.5 * visScale), player.position.z);

    renderer.render(scene, camera);
}

window.onload = init;