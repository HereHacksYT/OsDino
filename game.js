// --- SİSTEM DEĞİŞKENLERİ ---
let scene, camera, renderer;
let player, playerScale = 1.0;
const moveSpeed = 0.12;

let gameStarted = false; // Başlangıçta oyun durur, Play basınca başlar

// Animasyon Değişkenleri
let walkCycle = 0;
let tailMesh;

// Kontroller
const keys = {};
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

// Dünyadaki Nesneler
let buildings = [];
let bots = [];
let cars = [];
let aiDinos = [];
let borderMeshes = []; // Sınırları kolayca güncellemek için diziye aldık

let MAP_SIZE = 50; // Başlangıç harita yarıçapı (100x100 toplam alan)
let currentPhase = 1; // 1: <10m, 2: 10m-100m, 3: >=100m

const ROAD_COORDS = [];
for (let pos = -1000; pos < 1000; pos += 25) { // Yol koordinat havuzunu genişlettik
    ROAD_COORDS.push(pos);
}

// UI Elemanları
const sizeValEl = document.getElementById('size-val');
const warningMsgEl = document.getElementById('warning-msg');
let warningTimeout = null;

const AI_COLORS = [0x3182ce, 0x805ad5, 0xdd6b20, 0xe53e3e, 0x319795];

// --- BAŞLANGIÇ (INIT) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x556677);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50000); // Görüş mesafesini devasa haritalar için arttırdık

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // IŞIKLANDIRMA
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.85);
    sunLight.position.set(40, 70, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // ZEMİN (En büyük evreye de yetecek kadar devasa bir zemin)
    const floorGeo = new THREE.PlaneGeometry(20000, 20000);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Sınırlar ve Yollar
    createMapBorders();
    createCityGrid();

    // Varlıkları Oluştur
    createOsDino();       
    spawnCityAssets(40, 15, 45); // İlk faz sayıları
    spawnAIDinos();      
    setupControls();

    animate();
}

// --- HARİTA SINIR BARİYERLERİ (Dinamik Güncellenebilir) ---
function createMapBorders() {
    // Varsa eski sınırları sahneden sil
    for (let b of borderMeshes) {
        scene.remove(b);
    }
    borderMeshes = [];

    const borderMat = new THREE.MeshStandardMaterial({ color: 0xe53e3e, roughness: 0.5 });
    // Bariyerlerin yüksekliğini ve kalınlığını oyuncunun boyuna göre ölçeklendiriyoruz
    const barrierHeight = Math.max(2, playerScale * 5);
    const barrierThickness = Math.max(0.5, playerScale);

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
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.9 });
    // Sadece aktif harita sınırları içindeki yolları çizelim
    for (let pos of ROAD_COORDS) {
        if (Math.abs(pos) < MAP_SIZE) {
            const roadH = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE * 2, 4), roadMat);
            roadH.rotation.x = -Math.PI/2;
            roadH.position.set(0, 0.01, pos);
            roadH.receiveShadow = true;
            scene.add(roadH);

            const roadV = new THREE.Mesh(new THREE.PlaneGeometry(4, MAP_SIZE * 2), roadMat);
            roadV.rotation.x = -Math.PI/2;
            roadV.position.set(pos, 0.01, 0);
            roadV.receiveShadow = true;
            scene.add(roadV);
        }
    }
}

function isPointOnRoad(x, z, tolerance = 3.5) {
    for (let pos of ROAD_COORDS) {
        if (Math.abs(pos) < MAP_SIZE) {
            if (Math.abs(x - pos) < tolerance || Math.abs(z - pos) < tolerance) {
                return true;
            }
        }
    }
    return false;
}

function createDetailedBuilding(width, height, colorHex) {
    const buildingGroup = new THREE.Group();

    const bodyMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, height, width),
        new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, metalness: 0.1 })
    );
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    buildingGroup.add(bodyMesh);

    const roofKit = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.4, height * 0.1, width * 0.4),
        new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.6 })
    );
    roofKit.position.set(0, height / 2 + (height * 0.05), 0);
    buildingGroup.add(roofKit);

    const winGeo = new THREE.BoxGeometry(0.25, 0.4, 0.05);
    const winMat = new THREE.MeshStandardMaterial({ color: 0xedf2f7, roughness: 0.1, metalness: 0.8 });

    const floors = Math.floor(height / 1.5);
    const cols = Math.floor(width / 0.8);

    for (let f = 0; f < floors; f++) {
        const posY = -height / 2 + 0.8 + (f * 1.3);
        for (let c = 0; c < cols; c++) {
            const offset = -width / 2 + 0.5 + (c * 0.8);

            const winFront = new THREE.Mesh(winGeo, winMat);
            winFront.position.set(offset, posY, width / 2 + 0.02);
            buildingGroup.add(winFront);

            const winBack = new THREE.Mesh(winGeo, winMat);
            winBack.position.set(offset, posY, -width / 2 - 0.02);
            buildingGroup.add(winBack);
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

    // Büyük Gözler
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
}

// Parametrik Spawn Sistemi (Evrimlerde nesneleri arttırmak için)
function spawnCityAssets(buildingCount, carCount, botCount) {
    const buildingColors = [0x718096, 0x4a5568, 0x2d3748, 0x805ad5, 0x319795, 0xdd6b20];

    // Binalar
    for (let i = 0; i < buildingCount; i++) {
        // Bina boyutlarını oyuncu boyutuna göre dinamik ölçeklendiriyoruz ki sonraki evrelerde dev binalar olsun
        const sizeMult = currentPhase; 
        const h = (Math.random() * 8 + 4) * sizeMult;
        const w = (Math.random() * 1.5 + 2.5) * sizeMult;

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(x*x + z*z) < (15 * sizeMult) || isPointOnRoad(x, z, (w / 2) + 1.5));

        const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bGroup = createDetailedBuilding(w, h, bColor);
        bGroup.position.set(x, h / 2, z);
        
        bGroup.userData = { width: w, height: h, isEaten: false, color: new THREE.Color(bColor) };
        scene.add(bGroup);
        buildings.push(bGroup);
    }

    // Arabalar
    const carMat = new THREE.MeshStandardMaterial({ color: 0xd69e2e, roughness: 0.4 });
    for (let i = 0; i < carCount; i++) {
        const carSizeMult = Math.max(1, currentPhase * 0.7);
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.2 * carSizeMult, 0.6 * carSizeMult, 0.7 * carSizeMult), carMat);
        
        let randomRoadPos = 0;
        if (ROAD_COORDS.length > 0) {
            // Sadece aktif sınırlar içindeki yolları seç
            const validRoads = ROAD_COORDS.filter(p => Math.abs(p) < MAP_SIZE);
            randomRoadPos = validRoads[Math.floor(Math.random() * validRoads.length)] || 0;
        }

        const isDikey = Math.random() > 0.5;

        car.position.y = 0.3 * carSizeMult;
        car.castShadow = true;
        car.userData = {
            speed: (0.04 + Math.random() * 0.03) * carSizeMult,
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

    // İnsanlar
    const botMat = new THREE.MeshStandardMaterial({ color: 0x3182ce });
    for (let i = 0; i < botCount; i++) {
        const botSizeMult = Math.max(1, currentPhase * 0.7);
        const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * botSizeMult, 0.15 * botSizeMult, 0.5 * botSizeMult, 8), botMat);
        let bx, bz;
        do {
            bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(bx*bx + bz*bz) < (12 * botSizeMult) || isPointOnRoad(bx, bz, 1.0));

        bot.position.set(bx, 0.25 * botSizeMult, bz);
        bot.castShadow = true;
        bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.025 * botSizeMult };
        scene.add(bot);
        bots.push(bot);
    }
}

// --- RAKİP DİNOZOR OLUŞTURMA ---
function createSingleAIDino(colorHex, customScale = null) {
    const scale = customScale !== null ? customScale : (0.8 + Math.random() * 0.6);
    const dinoData = buildDinoMesh(colorHex);
    
    const aiGroup = dinoData.group;
    aiGroup.scale.set(scale, scale, scale);
    
    // Oyuncudan en az 25 metre uzakta doğma garantisi
    let ax, az, distToPlayer;
    do {
        ax = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
        az = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
        distToPlayer = Math.sqrt(Math.pow(ax - player.position.x, 2) + Math.pow(az - player.position.z, 2));
    } while (distToPlayer < 25);

    aiGroup.position.set(ax, 0, az);
    scene.add(aiGroup);

    const labelEl = document.createElement('div');
    labelEl.className = 'ai-label';
    document.body.appendChild(labelEl);

    const indicatorEl = document.createElement('div');
    indicatorEl.className = 'radar-indicator';
    document.body.appendChild(indicatorEl);

    return {
        mesh: aiGroup,
        scale: scale,
        colorHex: colorHex,
        tail: dinoData.tail,
        label: labelEl,
        indicator: indicatorEl,
        angle: Math.random() * Math.PI * 2,
        speed: 0.05 * Math.max(1, currentPhase * 0.7), // Evreye göre hızlanırlar
        walkTime: 0,
        pendingSuperGrow: false, 
        lastGrowCheckTime: Date.now() 
    };
}

function spawnAIDinos() {
    for (let i = 0; i < 5; i++) {
        const d = createSingleAIDino(AI_COLORS[i]);
        aiDinos.push(d);
    }
}

// --- HARİTA EVRİM VE BÜYÜME SİSTEMİ (10m ve 100m) ---
function checkMapEvolution() {
    if (playerScale >= 10.0 && currentPhase === 1) {
        currentPhase = 2;
        MAP_SIZE = 500; // Harita 1000x1000 oldu!
        triggerEvolutionUI("EVRİM I: 1000x1000 DÜNYA!");
    } else if (playerScale >= 100.0 && currentPhase === 2) {
        currentPhase = 3;
        MAP_SIZE = 5000; // Harita 10000x10000 oldu!
        triggerEvolutionUI("EVRİM II: DEVASEŞTİN! 10000x10000!");
    }
}

function triggerEvolutionUI(message) {
    // Sınır bariyerlerini yeni boyutlara taşı
    createMapBorders();
    createCityGrid();

    // 10 KAT DAHA FAZLA nesne doğur (Mevcut nesneleri silmeden ek üzerine ekler)
    spawnCityAssets(300, 100, 300);

    // Ekranda havalı bildirim
    warningMsgEl.innerText = message;
    warningMsgEl.style.color = '#22c55e';
    warningMsgEl.style.display = 'block';
    
    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        warningMsgEl.style.display = 'none';
        warningMsgEl.style.color = '#f43f5e'; // Eski rengine geri çek
    }, 3000);
}

function showSizeWarning(requiredSize) {
    warningMsgEl.innerText = `${requiredSize.toFixed(2)}m Olmalısın!`;
    warningMsgEl.style.display = 'block';

    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        warningMsgEl.style.display = 'none';
    }, 1000);
}

function setupControls() {
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', onWindowResize);

    document.getElementById('play-btn').addEventListener('click', () => {
        document.getElementById('start-screen').style.display = 'none';
        gameStarted = true;
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

        const speedMult = moveSpeed * (1 + (playerScale - 1) * 0.015);
        const power = joystickActive ? Math.sqrt(moveX*moveX + moveZ*moveZ) : 1.0;
        
        const nextX = player.position.x + Math.sin(targetAngle) * speedMult * power;
        const nextZ = player.position.z + Math.cos(targetAngle) * speedMult * power;

        if (Math.abs(nextX) < MAP_SIZE - 1.2 && Math.abs(nextZ) < MAP_SIZE - 1.2) {
            let canGo = true;

            for (let b of buildings) {
                if (b.userData.isEaten) continue;

                const dist = Math.sqrt(Math.pow(nextX - b.position.x, 2) + Math.pow(nextZ - b.position.z, 2));
                const collisionRadius = (b.userData.width / 2) + (playerScale * 0.5);

                if (dist < collisionRadius) {
                    const requiredSize = b.userData.height * 0.35;
                    if (playerScale > requiredSize) {
                        eatBuilding(b, true);
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
                player.scale.y = playerScale + (Math.sin(walkCycle) * 0.04 * playerScale);
                if (tailMesh) tailMesh.rotation.y = Math.sin(walkCycle) * 0.35;
            }
        }
    }
}

function updateCarsAndBots() {
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

        if (player.position.distanceTo(car.position) < (playerScale * 0.8) + 0.5) {
            scene.remove(car);
            cars.splice(cars.indexOf(car), 1);
            growPlayer(0.015); 
            respawnCar();
        }
    }

    for (let bot of bots) {
        bot.position.x += Math.sin(bot.userData.angle) * bot.userData.speed;
        bot.position.z += Math.cos(bot.userData.angle) * bot.userData.speed;

        if (Math.abs(bot.position.x) > MAP_SIZE - 2 || isPointOnRoad(bot.position.x, bot.position.z, 0.5)) {
            bot.userData.angle += Math.PI;
        }

        if (player.position.distanceTo(bot.position) < (playerScale * 0.8) + 0.2) {
            scene.remove(bot);
            bots.splice(bots.indexOf(bot), 1);
            growPlayer(0.008); 
            respawnBot();
        }
    }
}

// --- GÜNCEL YAPAY ZEKA SİSTEMİ (ADİL BİNA KURALI + SİNSİ BÜYÜME) ---
function updateAIDinos() {
    const now = Date.now();

    for (let ai of aiDinos) {
        ai.walkTime++;

        const distToPlayer = ai.mesh.position.distanceTo(player.position);

        // --- 1. SİNSİ BÜYÜME ZAMANLAYICISI (10 saniyede bir tetiklenir) ---
        if (now - ai.lastGrowCheckTime >= 10000) {
            ai.pendingSuperGrow = true; // %20 büyüme hakkı kazandı
            ai.lastGrowCheckTime = now;
        }

        // Büyüme bekliyorsa ve oyuncudan uzaktaysa (30 metreden fazlaysa) BÜYÜ!
        if (ai.pendingSuperGrow && distToPlayer >= 30) {
            ai.scale = playerScale * 1.20; // Sinsi bir şekilde oyuncudan %20 büyük olur
            ai.mesh.scale.set(ai.scale, ai.scale, ai.scale);
            ai.pendingSuperGrow = false; // Büyüme hakkı tüketildi
        }

        // --- 2. 20 METREDEN KOVALAMA MENZİLİ ---
        let targetPos = null;

        if (distToPlayer <= 20) {
            // Mesafe 20 metre altındaysa:
            if (ai.scale > playerScale) {
                // Bizden büyükse vahşi bir şekilde bizi kovalar!
                targetPos = player.position;
            } else if (ai.scale < playerScale) {
                // Bizden küçükse korkarak zıt yöne kaçar!
                ai.angle = Math.atan2(ai.mesh.position.x - player.position.x, ai.mesh.position.z - player.position.z);
            }
        } else {
            // Mesafe 20 metrenin dışındaysa en yakın yemeğe yönelip büyümeye çalışır!
            let nearestDist = 50 * currentPhase; // Evrelere göre arama menzilini arttır

            // Yakındaki Binalar
            for (let b of buildings) {
                if (b.userData.isEaten) continue;
                const req = b.userData.height * 0.35;
                if (ai.scale > req) {
                    const d = ai.mesh.position.distanceTo(b.position);
                    if (d < nearestDist) {
                        nearestDist = d;
                        targetPos = b.position;
                    }
                }
            }

            // Yakındaki Arabalar
            for (let car of cars) {
                const d = ai.mesh.position.distanceTo(car.position);
                if (d < nearestDist) {
                    nearestDist = d;
                    targetPos = car.position;
                }
            }

            // Yakındaki İnsanlar
            for (let bot of bots) {
                const d = ai.mesh.position.distanceTo(bot.position);
                if (d < nearestDist) {
                    nearestDist = d;
                    targetPos = bot.position;
                }
            }
        }

        // Hedefe yönelme hareketleri
        if (targetPos) {
            ai.angle = Math.atan2(targetPos.x - ai.mesh.position.x, targetPos.z - ai.mesh.position.z);
        } else if (ai.walkTime % 80 === 0) {
            ai.angle = Math.random() * Math.PI * 2;
        }

        const nextX = ai.mesh.position.x + Math.sin(ai.angle) * ai.speed;
        const nextZ = ai.mesh.position.z + Math.cos(ai.angle) * ai.speed;

        if (Math.abs(nextX) < MAP_SIZE - 2 && Math.abs(nextZ) < MAP_SIZE - 2) {
            ai.mesh.position.x = nextX;
            ai.mesh.position.z = nextZ;
            ai.mesh.rotation.y = ai.angle;
        } else {
            ai.angle += Math.PI;
        }

        // --- 3. DOĞAL BÜYÜME VE ADALET KURALI (Binalardan büyüme ALMAZLAR) ---
        for (let b of buildings) {
            if (b.userData.isEaten) continue;
            const dist = ai.mesh.position.distanceTo(b.position);
            const req = b.userData.height * 0.35;
            
            if (dist < (b.userData.width/2) + (ai.scale*0.5) && ai.scale > req) {
                eatBuilding(b, false); // Sadece binayı yok eder, büyüme kazanmaz! (Gelişim hızı adil kılındı)
            }
        }

        for (let car of cars) {
            if (ai.mesh.position.distanceTo(car.position) < (ai.scale * 0.8) + 0.5) {
                scene.remove(car);
                cars.splice(cars.indexOf(car), 1);
                ai.scale += (0.015 * 1.30); // Arabalardan %30 ekstra hızlı büyümeye devam
                ai.mesh.scale.set(ai.scale, ai.scale, ai.scale);
                respawnCar();
            }
        }

        for (let bot of bots) {
            if (ai.mesh.position.distanceTo(bot.position) < (ai.scale * 0.8) + 0.2) {
                scene.remove(bot);
                bots.splice(bots.indexOf(bot), 1);
                ai.scale += (0.008 * 1.30); // İnsanlardan %30 ekstra hızlı büyümeye devam
                ai.mesh.scale.set(ai.scale, ai.scale, ai.scale);
                respawnBot();
            }
        }

        if (ai.tail) ai.tail.rotation.y = Math.sin(Date.now() * 0.01) * 0.35;

        // --- 4. ARAYÜZ ETİKETLERİ VE RADAR OKLARI ---
        const tempV = new THREE.Vector3(ai.mesh.position.x, ai.mesh.position.y + (ai.scale * 1.5), ai.mesh.position.z);
        tempV.project(camera);
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        
        ai.label.style.left = `${x}px`;
        ai.label.style.top = `${y}px`;
        ai.label.innerText = `Dino: ${ai.scale.toFixed(2)}m`;

        const isOffscreen = (x < 0 || x > window.innerWidth || y < 0 || y > window.innerHeight);
        
        if (isOffscreen) {
            ai.indicator.style.display = 'flex';
            const screenCenterX = window.innerWidth / 2;
            const screenCenterY = window.innerHeight / 2;
            const angle = Math.atan2(y - screenCenterY, x - screenCenterX);
            
            const radius = Math.min(screenCenterX, screenCenterY) - 50;
            const indX = screenCenterX + Math.cos(angle) * radius;
            const indY = screenCenterY + Math.sin(angle) * radius;
            
            ai.indicator.style.left = `${indX}px`;
            ai.indicator.style.top = `${indY}px`;
            
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

        // --- 5. SAVAŞ & 10 SANİYE SONRA UZAKTA RESPAWN OLMA SİSTEMİ ---
        if (distToPlayer < (playerScale * 0.7) + (ai.scale * 0.7)) {
            if (playerScale > ai.scale) {
                const savedColor = ai.colorHex;

                scene.remove(ai.mesh);
                ai.label.remove();
                ai.indicator.remove();
                aiDinos.splice(aiDinos.indexOf(ai), 1);

                growPlayer(ai.scale * 0.1); 

                // Ölen dinozor 10 saniye sonra oyuncudan en az 25m uzakta yeniden doğar!
                setTimeout(() => {
                    const respawnedDino = createSingleAIDino(savedColor, playerScale * 0.85); 
                    aiDinos.push(respawnedDino);
                }, 10000);

            } else {
                alert("Senden daha büyük bir dinozor seni yedi! Yeniden başlıyor...");
                location.reload();
            }
        }
    }
}

// --- BİNA YEME VE DOĞMA ---
function eatBuilding(building, isPlayer) {
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

    if (isPlayer) {
        growPlayer(building.userData.height * 0.007); 
    }
}

function growPlayer(amount) {
    playerScale += amount;
    player.scale.set(playerScale, playerScale, playerScale);
    sizeValEl.innerText = playerScale.toFixed(2);
    
    // Her büyümede evrim sınırlarını kontrol et
    checkMapEvolution();
}

function respawnBuilding(oldBuilding) {
    const index = buildings.indexOf(oldBuilding);
    if (index > -1) buildings.splice(index, 1);

    const sizeMult = currentPhase;
    const h = (Math.random() * 8 + 4) * sizeMult;
    const w = (Math.random() * 1.5 + 2.5) * sizeMult;
    
    let x, z;
    do {
        x = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
        z = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
    } while (Math.sqrt(x*x + z*z) < (15 * sizeMult) || isPointOnRoad(x, z, (w / 2) + 1.5));

    const bGroup = createDetailedBuilding(w, h, 0x4a5568);
    bGroup.position.set(x, h/2, z);
    bGroup.userData = { width: w, height: h, isEaten: false, color: new THREE.Color(0x4a5568) };

    scene.add(bGroup);
    buildings.push(bGroup);
}

function respawnCar() {
    const carSizeMult = Math.max(1, currentPhase * 0.7);
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.2 * carSizeMult, 0.6 * carSizeMult, 0.7 * carSizeMult), new THREE.MeshStandardMaterial({ color: 0xd69e2e }));
    
    let randomRoadPos = 0;
    if (ROAD_COORDS.length > 0) {
        const validRoads = ROAD_COORDS.filter(p => Math.abs(p) < MAP_SIZE);
        randomRoadPos = validRoads[Math.floor(Math.random() * validRoads.length)] || 0;
    }

    const isDikey = Math.random() > 0.5;

    car.position.y = 0.3 * carSizeMult;
    car.castShadow = true;
    
    car.userData = {
        speed: (0.04 + Math.random() * 0.03) * carSizeMult,
        isDikey: isDikey,
        roadPos: randomRoadPos,
        dir: 1
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

function respawnBot() {
    const botSizeMult = Math.max(1, currentPhase * 0.7);
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * botSizeMult, 0.15 * botSizeMult, 0.5 * botSizeMult, 8), new THREE.MeshStandardMaterial({ color: 0x3182ce }));
    let bx, bz;
    do {
        bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
    } while (Math.sqrt(bx*bx + bz*bz) < (12 * botSizeMult) || isPointOnRoad(bx, bz, 1.0));

    bot.position.set(bx, 0.25 * botSizeMult, bz);
    bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.025 * botSizeMult };
    scene.add(bot);
    bots.push(bot);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ANİMASYON / OYUN DÖNGÜSÜ ---
function animate() {
    requestAnimationFrame(animate);

    if (!gameStarted) {
        renderer.render(scene, camera);
        return;
    }

    updatePlayer();
    updateCarsAndBots();
    updateAIDinos();

    // Kamera Takip Sınırlandırması (Kamerayı evre büyüdükçe çok daha geriye çekiyoruz)
    const targetCamY = player.position.y + 7.5 + (playerScale * 4.5);
    const targetCamZ = player.position.z - 11.5 - (playerScale * 5.5);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
    
    camera.lookAt(player.position.x, player.position.y + (playerScale * 0.4), player.position.z);

    renderer.render(scene, camera);
}

window.onload = init;
