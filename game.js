// --- SİSTEM DEĞİŞKENLERİ ---
let scene, camera, renderer;
let player, playerScale = 1.0;
let moveSpeed = 0.15;

// Animasyon Değişkenleri
let walkCycle = 0;
let tailMesh, eyeLMesh, eyeRMesh;

// Kontroller
const keys = {};
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

// Dünyadaki Nesneler
let buildings = [];
let bots = [];
let cars = [];
let aiDinos = [];
const MAP_SIZE = 50; // 50'ye 50 yarıçap (Toplamda tam 100x100 harita)

// UI Elemanları
const sizeValEl = document.getElementById('size-val');
const warningMsgEl = document.getElementById('warning-msg');
let warningTimeout = null;

// --- BAŞLANGIÇ (INIT) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x475569); // Şehir havası için gri gökyüzü

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // IŞIKLANDIRMA (Doğal Güneş Işığı)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(30, 60, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // ZEMİN (Şehir Alanı)
    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Harita Sınırları (100x100 Sınır Bariyerleri)
    createMapBorders();

    // Şehir Yolları ve Altyapı
    createCityGrid();

    // Nesneleri ve Karakterleri Yarat
    createOsDino();
    spawnCityAssets();
    spawnAIDinos();
    setupControls();

    animate();
}

// --- HARİTA SINIR BARİYERLERİ ---
function createMapBorders() {
    const borderMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }); // Kırmızı sınırlar
    const borderGeoH = new THREE.BoxGeometry(MAP_SIZE * 2, 1.5, 0.4);
    const borderGeoV = new THREE.BoxGeometry(0.4, 1.5, MAP_SIZE * 2);

    const north = new THREE.Mesh(borderGeoH, borderMat);
    north.position.set(0, 0.75, MAP_SIZE);
    
    const south = new THREE.Mesh(borderGeoH, borderMat);
    south.position.set(0, 0.75, -MAP_SIZE);

    const east = new THREE.Mesh(borderGeoV, borderMat);
    east.position.set(MAP_SIZE, 0.75, 0);

    const west = new THREE.Mesh(borderGeoV, borderMat);
    west.position.set(-MAP_SIZE, 0.75, 0);

    scene.add(north, south, east, west);
}

// --- ASFALT YOLLAR ---
function createCityGrid() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    
    // Yatay ve dikey kesişen yollar
    for (let pos = -MAP_SIZE + 15; pos < MAP_SIZE; pos += 25) {
        // Yatay Yol
        const roadH = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE * 2, 3), roadMat);
        roadH.rotation.x = -Math.PI/2;
        roadH.position.set(0, 0.01, pos);
        roadH.receiveShadow = true;
        scene.add(roadH);

        // Dikey Yol
        const roadV = new THREE.Mesh(new THREE.PlaneGeometry(3, MAP_SIZE * 2), roadMat);
        roadV.rotation.x = -Math.PI/2;
        roadV.position.set(pos, 0.01, 0);
        roadV.receiveShadow = true;
        scene.add(roadV);
    }
}

// --- PÜRÜZSÜZ DİNOZOR OLUŞTURMA ŞABLONU (OYUNCU VE AI İÇİN) ---
function buildDinoMesh(colorHex) {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.1 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Gövde (Pürüzsüz Küre)
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

    // Çene/Ağız
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), skinMat);
    snout.scale.set(1, 0.7, 1.1);
    snout.position.set(0, 1.05, 0.85);
    snout.castShadow = true;
    group.add(snout);

    // GÖZLER (Senin istediğin belirgin büyük gözler)
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

    return { group, eyeL, eyeR, tail };
}

function createOsDino() {
    const dino = buildDinoMesh(0x22c55e); // Oyuncu yeşil renk
    player = dino.group;
    tailMesh = dino.tail;
    scene.add(player);
}

// --- ŞEHİR ELEMANLARI (HASTANE, EVLER, ARABALAR, İNSANLAR) ---
function spawnCityAssets() {
    const buildingColors = [0x64748b, 0x475569, 0x78716c, 0x57534e];
    
    // 1. Hastane Binası (Büyük ve Çatısında Kırmızı Artı İşareti Var)
    const hospital = new THREE.Group();
    const hospMain = new THREE.Mesh(new THREE.BoxGeometry(7, 8, 7), new THREE.MeshStandardMaterial({ color: 0xe2e8f0 }));
    hospMain.castShadow = true;
    hospMain.receiveShadow = true;
    hospital.add(hospMain);

    // Çatıdaki Kırmızı Artı (Hastane Simgesi)
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 0.6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    crossH.position.set(0, 4.2, 0);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 2), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    crossV.position.set(0, 4.2, 0);
    hospital.add(crossH, crossV);

    hospital.position.set(0, 4, 0); // Şehrin merkezine yakın
    hospital.userData = { width: 7, height: 8, isEaten: false, isHospital: true };
    scene.add(hospital);
    buildings.push(hospital);

    // 2. Normal Evler ve Gökdelenler
    for (let i = 0; i < 45; i++) {
        const h = Math.random() * 8 + 3;
        const w = Math.random() * 1.5 + 2.5;

        const bGroup = new THREE.Group();
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ 
            color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
            roughness: 0.7 
        }));
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        bGroup.add(bMesh);

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
        } while (Math.sqrt(x*x + z*z) < 15); // Başlangıç yerinden uzak

        bGroup.position.set(x, h/2, z);
        bGroup.userData = { width: w, height: h, isEaten: false };
        scene.add(bGroup);
        buildings.push(bGroup);
    }

    // 3. Küçük Arabalar (Yollarda hareket eden 3D kutular)
    const carMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
    for (let i = 0; i < 15; i++) {
        const car = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.7), carMat);
        car.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.6), 0.3, (Math.random() - 0.5) * (MAP_SIZE * 1.6));
        car.castShadow = true;
        car.userData = {
            speed: 0.05 + Math.random() * 0.05,
            dirX: Math.random() > 0.5 ? 1 : -1,
            dirZ: Math.random() > 0.5 ? 1 : -1
        };
        scene.add(car);
        cars.push(car);
    }

    // 4. Botlar (Yayalar)
    const botMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6 });
    for (let i = 0; i < 60; i++) {
        const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), botMat);
        bot.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.8), 0.25, (Math.random() - 0.5) * (MAP_SIZE * 1.8));
        bot.castShadow = true;
        bot.userData = {
            angle: Math.random() * Math.PI * 2,
            speed: 0.03
        };
        scene.add(bot);
        bots.push(bot);
    }
}

// --- RAKİP DİNOZORLAR (AI DINOS) ---
function spawnAIDinos() {
    const aiColors = [0x3b82f6, 0xa855f7, 0xf97316, 0xec4899]; // Mavi, Mor, Turuncu, Pembe rakipler
    
    for (let i = 0; i < 4; i++) {
        const scale = 0.8 + Math.random() * 0.8; // Farklı boyutlarda başlarlar
        const dinoData = buildDinoMesh(aiColors[i]);
        
        const aiGroup = dinoData.group;
        aiGroup.scale.set(scale, scale, scale);
        aiGroup.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.5), 0, (Math.random() - 0.5) * (MAP_SIZE * 1.5));
        
        scene.add(aiGroup);

        // AI bilgisi ve arayüz etiketi oluşturma
        const labelEl = document.createElement('div');
        labelEl.className = 'ai-label';
        document.body.appendChild(labelEl);

        aiDinos.push({
            mesh: aiGroup,
            scale: scale,
            tail: dinoData.tail,
            label: labelEl,
            angle: Math.random() * Math.PI * 2,
            speed: 0.08,
            changeDirTimer: Math.random() * 100
        });
    }
}

// --- EKRANDA GEÇİCİ UYARI GÖSTER (HAREKETİ ENGELLEMEZ) ---
function showSizeWarning(requiredSize) {
    warningMsgEl.innerText = `${requiredSize.toFixed(2)}m Olmalısın!`;
    warningMsgEl.style.display = 'block';

    if (warningTimeout) clearTimeout(warningTimeout);
    
    warningTimeout = setTimeout(() => {
        warningMsgEl.style.display = 'none';
    }, 1000); // 1 Saniye sonra kaybolur
}

// --- MOBİL VE KLAVYE KONTROLLERİ ---
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

// --- ANA GÜNCELLEMELER (UPDATE) ---
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

        // 100x100 Harita Sınır Koruması
        if (Math.abs(nextX) < MAP_SIZE - 1 && Math.abs(nextZ) < MAP_SIZE - 1) {
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
                        // Engelle ama HAREKETİ durdurma, sadece uyar
                        canGo = false;
                        showSizeWarning(requiredSize);
                    }
                }
            }

            if (canGo) {
                player.position.x = nextX;
                player.position.z = nextZ;

                // Yürüme/Kuyruk animasyonu
                walkCycle += 0.2;
                player.scale.y = playerScale + (Math.sin(walkCycle) * 0.04 * playerScale);
                if (tailMesh) tailMesh.rotation.y = Math.sin(walkCycle) * 0.35;
            }
        }
    }
}

function updateCarsAndBots() {
    // Arabaları hareket ettir
    for (let car of cars) {
        car.position.x += car.userData.speed * car.userData.dirX;
        
        if (Math.abs(car.position.x) > MAP_SIZE - 2) {
            car.userData.dirX *= -1;
        }

        // Oyuncu arabayı yer mi?
        if (player.position.distanceTo(car.position) < (playerScale * 0.8) + 0.5) {
            scene.remove(car);
            cars.splice(cars.indexOf(car), 1);
            growPlayer(0.08);
            respawnCar();
        }
    }

    // Botları (Yayaları) hareket ettir ve ye
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
            ai.userData = Math.random() * Math.PI * 2;
            ai.changeDirTimer = 80 + Math.random() * 120;
        }

        // Rastgele yürüyüş
        const nextX = ai.mesh.position.x + Math.sin(ai.angle) * ai.speed;
        const nextZ = ai.mesh.position.z + Math.cos(ai.angle) * ai.speed;

        if (Math.abs(nextX) < MAP_SIZE - 2 && Math.abs(nextZ) < MAP_SIZE - 2) {
            ai.mesh.position.x = nextX;
            ai.mesh.position.z = nextZ;
            ai.mesh.rotation.y = ai.angle;
        } else {
            ai.angle += Math.PI;
        }

        // Kuyruk Sallama Animasyonu
        if (ai.tail) ai.tail.rotation.y = Math.sin(Date.now() * 0.01) * 0.35;

        // Etiket Pozisyon Güncellemesi (3D dünyayı 2D HTML etiketine eşleme)
        const tempV = new THREE.Vector3(ai.mesh.position.x, ai.mesh.position.y + (ai.scale * 1.5), ai.mesh.position.z);
        tempV.project(camera);
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;
        
        ai.label.style.left = `${x}px`;
        ai.label.style.top = `${y}px`;
        ai.label.innerText = `Dino: ${ai.scale.toFixed(2)}m`;

        // --- SAVAŞ MEKANİZMASI (BİZ VS YAPAY ZEKA) ---
        const distToPlayer = player.position.distanceTo(ai.mesh.position);
        if (distToPlayer < (playerScale * 0.7) + (ai.scale * 0.7)) {
            if (playerScale > ai.scale) {
                // Biz büyüğüz, AI'ı yeriz!
                scene.remove(ai.mesh);
                ai.label.remove();
                aiDinos.splice(aiDinos.indexOf(ai), 1);
                growPlayer(ai.scale * 0.3);
            } else {
                // AI büyük, o bizi yedi! Kaybettik.
                alert("Senden daha büyük bir dinozor seni yedi! Yeniden başlıyor...");
                location.reload();
            }
        }
    }
}

// --- OYUNCU BÜYÜME VE YENİDEN DOĞMA ---
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

    const h = Math.random() * 8 + 3;
    const w = Math.random() * 1.5 + 2.5;
    const group = new THREE.Group();
    const bMesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x475569 }));
    bMesh.castShadow = true;
    group.add(bMesh);

    group.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.7), h/2, (Math.random() - 0.5) * (MAP_SIZE * 1.7));
    group.userData = { width: w, height: h, isEaten: false };

    scene.add(group);
    buildings.push(group);
}

function respawnCar() {
    const car = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    car.position.set((Math.random() - 0.5) * (MAP_SIZE * 1.6), 0.3, (Math.random() - 0.5) * (MAP_SIZE * 1.6));
    car.castShadow = true;
    car.userData = { speed: 0.05 + Math.random()*0.05, dirX: 1, dirZ: 1 };
    scene.add(car);
    cars.push(car);
}

function respawnBot() {
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
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

    // Kamera Takibi
    const targetCamY = player.position.y + 7 + (playerScale * 3.5);
    const targetCamZ = player.position.z - 11 - (playerScale * 4.5);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
    
    camera.lookAt(player.position.x, player.position.y + (playerScale * 0.4), player.position.z);

    renderer.render(scene, camera);
}

window.onload = init;
