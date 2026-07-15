// --- SİSTEM DEĞİŞKENLERİ ---
let scene, camera, renderer;
let player, playerScale = 1.0;
let moveSpeed = 0.15;

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
const MAP_SIZE = 50; // Toplam 100x100 harita sınırları

// UI Elemanları
const sizeValEl = document.getElementById('size-val');
const warningMsgEl = document.getElementById('warning-msg');
let warningTimeout = null;

// --- BAŞLANGIÇ (INIT) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x556677); // Gerçekçi gökyüzü rengi

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

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

    // ZEMİN (Şehir Alanı)
    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Harita Sınırları ve Yollar
    createMapBorders();
    createCityGrid();

    // Nesneleri Yarat
    createOsDino();       // Karakter tam (0, 0) noktasında doğacak
    spawnCityAssets();   // Binalar artık bu merkezin uzağına yerleşecek
    spawnAIDinos();
    setupControls();

    animate();
}

// --- HARİTA SINIR BARİYERLERİ ---
function createMapBorders() {
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xe53e3e, roughness: 0.5 });
    const borderGeoH = new THREE.BoxGeometry(MAP_SIZE * 2, 2, 0.5);
    const borderGeoV = new THREE.BoxGeometry(0.5, 2, MAP_SIZE * 2);

    const north = new THREE.Mesh(borderGeoH, borderMat);
    north.position.set(0, 1, MAP_SIZE);
    
    const south = new THREE.Mesh(borderGeoH, borderMat);
    south.position.set(0, 1, -MAP_SIZE);

    const east = new THREE.Mesh(borderGeoV, borderMat);
    east.position.set(MAP_SIZE, 1, 0);

    const west = new THREE.Mesh(borderGeoV, borderMat);
    west.position.set(-MAP_SIZE, 1, 0);

    scene.add(north, south, east, west);
}

// --- ASFALT YOLLAR ---
function createCityGrid() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.9 });
    for (let pos = -MAP_SIZE + 15; pos < MAP_SIZE; pos += 25) {
        const roadH = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE * 2, 3.5), roadMat);
        roadH.rotation.x = -Math.PI/2;
        roadH.position.set(0, 0.01, pos);
        roadH.receiveShadow = true;
        scene.add(roadH);

        const roadV = new THREE.Mesh(new THREE.PlaneGeometry(3.5, MAP_SIZE * 2), roadMat);
        roadV.rotation.x = -Math.PI/2;
        roadV.position.set(pos, 0.01, 0);
        roadV.receiveShadow = true;
        scene.add(roadV);
    }
}

// --- KALİTELİ BİNA MODELLEME FONKSİYONU ---
function createDetailedBuilding(width, height, colorHex) {
    const buildingGroup = new THREE.Group();

    // 1. Ana Duvar/Gövde
    const bodyGeo = new THREE.BoxGeometry(width, height, width);
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7, metalness: 0.1 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    buildingGroup.add(bodyMesh);

    // 2. Çatı Detayları (Su Deposu veya Havalandırma Kutusu)
    const roofKitGeo = new THREE.BoxGeometry(width * 0.4, height * 0.1, width * 0.4);
    const roofKitMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.6 });
    const roofKit = new THREE.Mesh(roofKitGeo, roofKitMat);
    roofKit.position.set(0, height / 2 + (height * 0.05), 0);
    roofKit.castShadow = true;
    buildingGroup.add(roofKit);

    // 3. 3D Kabartma Pencereler (Düz küp görüntüsünü tamamen yıkar)
    const winWidth = 0.25;
    const winHeight = 0.4;
    const winDepth = 0.05; // Dışa doğru kabartı sağlar
    const winGeo = new THREE.BoxGeometry(winWidth, winHeight, winDepth);
    const winMat = new THREE.MeshStandardMaterial({ color: 0xedf2f7, roughness: 0.2, metalness: 0.8 }); // Parlak cam rengi

    // Kat sayısına ve bina genişliğine göre pencereleri dizelim
    const floors = Math.floor(height / 1.5);
    const cols = Math.floor(width / 0.8);

    for (let f = 0; f < floors; f++) {
        const posY = -height / 2 + 0.8 + (f * 1.3); // Her katın yüksekliği

        for (let c = 0; c < cols; c++) {
            const offset = -width / 2 + 0.5 + (c * 0.8);

            // Ön Cephe Pencereleri
            const winFront = new THREE.Mesh(winGeo, winMat);
            winFront.position.set(offset, posY, width / 2 + 0.02);
            buildingGroup.add(winFront);

            // Arka Cephe Pencereleri
            const winBack = new THREE.Mesh(winGeo, winMat);
            winBack.position.set(offset, posY, -width / 2 - 0.02);
            buildingGroup.add(winBack);

            // Sol Cephe Pencereleri (Döndürülmüş)
            const winLeft = new THREE.Mesh(winGeo, winMat);
            winLeft.rotation.y = Math.PI / 2;
            winLeft.position.set(-width / 2 - 0.02, posY, offset);
            buildingGroup.add(winLeft);

            // Sağ Cephe Pencereleri (Döndürülmüş)
            const winRight = new THREE.Mesh(winGeo, winMat);
            winRight.rotation.y = Math.PI / 2;
            winRight.position.set(width / 2 + 0.02, posY, offset);
            buildingGroup.add(winRight);
        }
    }

    // 4. Bina Giriş Kapısı (Zeminde tek bir büyük kapı detayı)
    const doorGeo = new THREE.BoxGeometry(0.8, 1.2, 0.06);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x1a202c });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, -height / 2 + 0.6, width / 2 + 0.03);
    buildingGroup.add(door);

    return buildingGroup;
}

// --- DİNOZOR MODELLEME ŞABLONU ---
function buildDinoMesh(colorHex) {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.1 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Gövde
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 32), skinMat);
    body.scale.set(1, 0.85, 1.3);
    body.position.y = 0.65;
    body.castShadow = true;
    group.add(body);

    // Kafa
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), skinMat);
    head.position.set(0, 1.15, 0.55);
    head.castShadow = true;
    group.add(head);

    // Ağız/Çene
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), skinMat);
    snout.scale.set(1, 0.7, 1.1);
    snout.position.set(0, 1.05, 0.85);
    snout.castShadow = true;
    group.add(snout);

    // BÜYÜK GÖZLER
    const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(0.06, 16, 16);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.28, 1.25, 0.7);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(0.33, 1.25, 0.76);
    group.add(eyeL, pupilL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(-0.28, 1.25, 0.7);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(-0.33, 1.25, 0.76);
    group.add(eyeR, pupilR);

    // Kuyruk
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.1, 16), skinMat);
    tail.rotation.x = -Math.PI / 2.8;
    tail.position.set(0, 0.5, -0.9);
    tail.castShadow = true;
    group.add(tail);

    return { group, tail };
}

function createOsDino() {
    const dino = buildDinoMesh(0x22c55e); // Yeşil Dino
    player = dino.group;
    tailMesh = dino.tail;
    
    // Dinozor tam olarak merkeze (0,0,0) konumlandırılıyor
    player.position.set(0, 0, 0);
    scene.add(player);
}

// --- ŞEHİR DETAYLARI VE GÜVENLİ SPAWN ---
function spawnCityAssets() {
    const buildingColors = [0x718096, 0x4a5568, 0x2d3748, 0x805ad5, 0x319795, 0xdd6b20];
    
    // 1. Hastane Binası (Detaylı Tasarım)
    const hospital = new THREE.Group();
    const hospMain = createDetailedBuilding(7, 8, 0xe2e8f0);
    hospital.add(hospMain);

    // Çatıdaki Kırmızı Artı İşareti
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xe53e3e }));
    crossH.position.set(0, 4.4, 0);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 2), new THREE.MeshBasicMaterial({ color: 0xe53e3e }));
    crossV.position.set(0, 4.4, 0);
    hospital.add(crossH, crossV);

    // Başlangıç noktasından (0,0) uzak bir yere yerleştiriyoruz
    hospital.position.set(12, 4, -12);
    hospital.userData = { width: 7, height: 8, isEaten: false, color: new THREE.Color(0xe2e8f0) };
    scene.add(hospital);
    buildings.push(hospital);

    // 2. Detaylı Evler ve Gökdelenler
    for (let i = 0; i < 40; i++) {
        const h = Math.random() * 8 + 4;
        const w = Math.random() * 1.5 + 2.5;

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
        // MERKEZ GÜVENLİK KORUMASI: (0,0) noktasına 15 metreden yakınsa yeniden konumlandır
        } while (Math.sqrt(x*x + z*z) < 15);

        const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        const bGroup = createDetailedBuilding(w, h, bColor);
        bGroup.position.set(x, h / 2, z);
        
        // Çarpışma ve yeme bilgileri için userData'yı en üst gruba kaydediyoruz
        bGroup.userData = { width: w, height: h, isEaten: false, color: new THREE.Color(bColor) };
        
        scene.add(bGroup);
        buildings.push(bGroup);
    }

    // 3. Küçük Arabalar
    const carMat = new THREE.MeshStandardMaterial({ color: 0xd69e2e, roughness: 0.4 });
    for (let i = 0; i < 15; i++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.7), carMat);
        let cx, cz;
        do {
            cx = (Math.random() - 0.5) * (MAP_SIZE * 1.6);
            cz = (Math.random() - 0.5) * (MAP_SIZE * 1.6);
        } while (Math.sqrt(cx*cx + cz*cz) < 12);

        car.position.set(cx, 0.3, cz);
        car.castShadow = true;
        car.userData = {
            speed: 0.05 + Math.random() * 0.05,
            dirX: Math.random() > 0.5 ? 1 : -1,
            dirZ: Math.random() > 0.5 ? 1 : -1
        };
        scene.add(car);
        cars.push(car);
    }

    // 4. İnsanlar (Botlar)
    const botMat = new THREE.MeshStandardMaterial({ color: 0x3182ce });
    for (let i = 0; i < 50; i++) {
        const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), botMat);
        let bx, bz;
        do {
            bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(bx*bx + bz*bz) < 12);

        bot.position.set(bx, 0.25, bz);
        bot.castShadow = true;
        bot.userData = {
            angle: Math.random() * Math.PI * 2,
            speed: 0.03
        };
        scene.add(bot);
        bots.push(bot);
    }
}

// --- RAKİP YAPAY ZEKA DİNOZORLAR ---
function spawnAIDinos() {
    const aiColors = [0x3182ce, 0x805ad5, 0xdd6b20, 0xe53e3e];
    
    for (let i = 0; i < 4; i++) {
        const scale = 0.8 + Math.random() * 0.8;
        const dinoData = buildDinoMesh(aiColors[i]);
        
        const aiGroup = dinoData.group;
        aiGroup.scale.set(scale, scale, scale);
        
        let ax, az;
        do {
            ax = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
            az = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
        } while (Math.sqrt(ax*ax + az*az) < 15);

        aiGroup.position.set(ax, 0, az);
        scene.add(aiGroup);

        const labelEl = document.createElement('div');
        labelEl.className = 'ai-label';
        document.body.appendChild(labelEl);

        aiDinos.push({
            mesh: aiGroup,
            scale: scale,
            tail: dinoData.tail,
            label: labelEl,
            angle: Math.random() * Math.PI * 2,
            speed: 0.07,
            changeDirTimer: Math.random() * 100
        });
    }
}

// --- EKRANDA UYARI GÖSTER (HAREKETİ ENGELLEMEZ) ---
function showSizeWarning(requiredSize) {
    warningMsgEl.innerText = `${requiredSize.toFixed(2)}m Olmalısın!`;
    warningMsgEl.style.display = 'block';

    if (warningTimeout) clearTimeout(warningTimeout);
    
    warningTimeout = setTimeout(() => {
        warningMsgEl.style.display = 'none';
    }, 1000);
}

// --- KONTROLLER ---
function setupControls() {
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', onWindowResize);

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

// --- ANA DÖNGÜ GÜNCELLEMELERİ (UPDATE) ---
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

        const speedMult = moveSpeed * (1 + (playerScale - 1) * 0.05);
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
                player.scale.y = playerScale + (Math.sin(walkCycle) * 0.04 * playerScale);
                if (tailMesh) tailMesh.rotation.y = Math.sin(walkCycle) * 0.35;
            }
        }
    }
}

function updateCarsAndBots() {
    for (let car of cars) {
        car.position.x += car.userData.speed * car.userData.dirX;
        if (Math.abs(car.position.x) > MAP_SIZE - 2) car.userData.dirX *= -1;

        if (player.position.distanceTo(car.position) < (playerScale * 0.8) + 0.5) {
            scene.remove(car);
            cars.splice(cars.indexOf(car), 1);
            growPlayer(0.08);
            respawnCar();
        }
    }

    for (let bot of bots) {
        bot.position.x += Math.sin(bot.userData.angle) * bot.userData.speed;
        bot.position.z += Math.cos(bot.userData.angle) * bot.userData.speed;

        if (Math.abs(bot.position.x) > MAP_SIZE - 2) bot.userData.angle += Math.PI;

        if (player.position.distanceTo(bot.position) < (playerScale * 0.8) + 0.2) {
            scene.remove(bot);
            bots.splice(bots.indexOf(bot), 1);
            growPlayer(0.04);
            respawnBot();
        }
    }
}

function updateAIDinos() {
    for (let ai of aiDinos) {
        ai.changeDirTimer--;
        if (ai.changeDirTimer <= 0) {
            ai.angle = Math.random() * Math.PI * 2;
            ai.changeDirTimer = 80 + Math.random() * 120;
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

        if (ai.tail) ai.tail.rotation.y = Math.sin(Date.now() * 0.01) * 0.35;

        // AI etiketlerinin ekrandaki yerini ayarla
        const tempV = new THREE.Vector3(ai.mesh.position.x, ai.mesh.position.y + (ai.scale * 1.5), ai.mesh.position.z);
        tempV.project(camera);
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        
        ai.label.style.left = `${x}px`;
        ai.label.style.top = `${y}px`;
        ai.label.innerText = `Dino: ${ai.scale.toFixed(2)}m`;

        // Dinozor Savaş Mekaniği
        const distToPlayer = player.position.distanceTo(ai.mesh.position);
        if (distToPlayer < (playerScale * 0.7) + (ai.scale * 0.7)) {
            if (playerScale > ai.scale) {
                scene.remove(ai.mesh);
                ai.label.remove();
                aiDinos.splice(aiDinos.indexOf(ai), 1);
                growPlayer(ai.scale * 0.35);
            } else {
                alert("Senden daha büyük bir dinozor seni yedi! Yeniden başlıyor...");
                location.reload();
            }
        }
    }
}

// --- YEME VE BÜYÜME ---
function eatBuilding(building) {
    building.userData.isEaten = true;
    
    let scaleVal = 1.0;
    let shrink = setInterval(() => {
        scaleVal -= 0.15;
        if (scaleVal <= 0.05) {
            clearInterval(shrink);
            scene.remove(building);
            respawnBuilding(building);
        } else {
            building.scale.set(scaleVal, scaleVal, scaleVal);
        }
    }, 25);

    growPlayer(building.userData.height * 0.06);
}

function growPlayer(amount) {
    playerScale += amount;
    player.scale.set(playerScale, playerScale, playerScale);
    sizeValEl.innerText = playerScale.toFixed(2);
}

function respawnBuilding(oldBuilding) {
    const index = buildings.indexOf(oldBuilding);
    if (index > -1) buildings.splice(index, 1);

    const h = Math.random() * 8 + 4;
    const w = Math.random() * 1.5 + 2.5;
    
    let x, z;
    do {
        x = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
        z = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
    } while (Math.sqrt(x*x + z*z) < 15);

    const bGroup = createDetailedBuilding(w, h, 0x4a5568);
    bGroup.position.set(x, h/2, z);
    bGroup.userData = { width: w, height: h, isEaten: false, color: new THREE.Color(0x4a5568) };

    scene.add(bGroup);
    buildings.push(bGroup);
}

function respawnCar() {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xd69e2e }));
    car.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.6), 0.3, (Math.random() - 0.5) * (MAP_SIZE * 1.6));
    car.castShadow = true;
    car.userData = { speed: 0.05 + Math.random()*0.05, dirX: 1, dirZ: 1 };
    scene.add(car);
    cars.push(car);
}

function respawnBot() {
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x3182ce }));
    bot.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.8), 0.25, (Math.random() - 0.5) * (MAP_SIZE * 1.8));
    bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.03 };
    scene.add(bot);
    bots.push(bot);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- DÖNGÜ (ANIMATE) ---
function animate() {
    requestAnimationFrame(animate);

    updatePlayer();
    updateCarsAndBots();
    updateAIDinos();

    // Kamera Takip Hesaplaması
    const targetCamY = player.position.y + 7.5 + (playerScale * 3.5);
    const targetCamZ = player.position.z - 11.5 - (playerScale * 4.5);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
    
    camera.lookAt(player.position.x, player.position.y + (playerScale * 0.4), player.position.z);

    renderer.render(scene, camera);
}

window.onload = init;
