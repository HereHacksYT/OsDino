// --- SİSTEM DEĞİŞKENLERİ ---
let scene, camera, renderer;
let player, playerScale = 1.0;
let moveSpeed = 0.14;

// Animasyon ve Kuyruk Sallama Değişkenleri
let walkCycle = 0;
let tailMesh;

// Efekt Sistemleri
let particles = [];
let screenShakeIntensity = 0;

// Kontroller
const keys = {};
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

let buildings = [];
let bots = [];
const MAP_SIZE = 90;

const sizeValEl = document.getElementById('size-val');

// --- BAŞLANGIÇ (INIT) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    // Gerçekçi sis (Havadaki toz ve derinlik hissi için)
    scene.fog = new THREE.FogExp2(0x0f172a, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Yumuşak Gölgeler
    document.body.appendChild(renderer.domElement);

    // IŞIKLANDIRMA (Sinematik Atmosfer)
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.6);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfef08a, 1.2); // Tatlı gün batımı sarısı
    sunLight.position.set(40, 60, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048; // Yüksek kaliteli gölge haritası
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Dolaylı Mavi Işık (Siber hissi desteklemek için gölgelere hafif mavi ton verir)
    const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.4);
    fillLight.position.set(-40, 20, -20);
    scene.add(fillLight);

    // ZEMİN (Yumuşak PBR Materyal)
    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x0f172a, 
        roughness: 0.8, 
        metalness: 0.2 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Izgara Tasarımı
    const grid = new THREE.GridHelper(MAP_SIZE * 2, 60, 0x1e293b, 0x1e293b);
    grid.position.y = 0.02;
    scene.add(grid);

    // OSDINO VE DÜNYA KURULUMU
    createOsDino();
    spawnWorld();
    setupControls();

    animate();
}

// --- ULTRA KALİTELİ CANAVAR MODELİ (OSDINO) ---
function createOsDino() {
    player = new THREE.Group();

    // PBR Smooth Materyal
    const skinMat = new THREE.MeshStandardMaterial({ 
        color: 0x10b981, 
        roughness: 0.2, 
        metalness: 0.15,
        flatShading: false
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x020617 });
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 }); // Parlak kırmızı sırt boynuzları

    // Gövde (Küre tabanlı organik yapı)
    const bodyGeo = new THREE.SphereGeometry(0.7, 32, 32);
    const body = new THREE.Mesh(bodyGeo, skinMat);
    body.scale.set(1, 0.85, 1.3);
    body.position.y = 0.65;
    body.castShadow = true;
    player.add(body);

    // Kafa
    const headGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.15, 0.55);
    head.castShadow = true;
    player.add(head);

    // Çene/Ağız (Daha canavarca bir burun yapısı)
    const snoutGeo = new THREE.SphereGeometry(0.38, 32, 32);
    const snout = new THREE.Mesh(snoutGeo, skinMat);
    snout.scale.set(1, 0.7, 1.15);
    snout.position.set(0, 1.05, 0.9);
    snout.castShadow = true;
    player.add(snout);

    // Gözler ve Gözbebekleri
    const eyeGeo = new THREE.SphereGeometry(0.1, 16, 16);
    const pupilGeo = new THREE.SphereGeometry(0.05, 16, 16);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(0.28, 1.28, 0.75);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat); pupilL.position.set(0.31, 1.28, 0.82);
    player.add(eyeL, pupilL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(-0.28, 1.28, 0.75);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat); pupilR.position.set(-0.31, 1.28, 0.82);
    player.add(eyeR, pupilR);

    // Kuyruk (Oynatılabilmesi için ayrı bir değişkene atandı)
    tailMesh = new THREE.Group();
    const tailConeGeo = new THREE.ConeGeometry(0.25, 1.2, 16);
    const tailCone = new THREE.Mesh(tailConeGeo, skinMat);
    tailCone.rotation.x = -Math.PI / 2.8;
    tailCone.position.set(0, 0, -0.5);
    tailCone.castShadow = true;
    tailMesh.add(tailCone);
    tailMesh.position.set(0, 0.55, -0.85);
    player.add(tailMesh);

    // Dinozorun Sırt Dikenleri/Boynuzları
    for (let i = 0; i < 5; i++) {
        const spikeGeo = new THREE.ConeGeometry(0.12, 0.35, 16);
        const spike = new THREE.Mesh(spikeGeo, hornMat);
        spike.position.set(0, 0.95 - (i * 0.15), -0.05 - (i * 0.28));
        spike.rotation.x = 0.25;
        spike.castShadow = true;
        player.add(spike);
    }

    scene.add(player);
}

// --- HARİTA VE KALİTELİ BİNALAR ---
function spawnWorld() {
    const buildingColors = [0x1e293b, 0x334155, 0x475569, 0x0284c7, 0x0f766e, 0x4f46e5];
    
    for (let i = 0; i < 70; i++) {
        const h = Math.random() * 11 + 3;
        const w = Math.random() * 2.2 + 2;
        
        // Klasik binalardan daha kaliteli durması için pencereli bina illüzyonu
        const group = new THREE.Group();
        
        const bGeo = new THREE.BoxGeometry(w, h, w);
        const bMat = new THREE.MeshStandardMaterial({ 
            color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
            roughness: 0.5,
            metalness: 0.3
        });
        const buildingMesh = new THREE.Mesh(bGeo, bMat);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;
        group.add(buildingMesh);

        // Pencere parıltıları ekle (Detay seviyesini artıran siber neon pencereler)
        if (Math.random() > 0.3) {
            const windowGeo = new THREE.BoxGeometry(w + 0.05, 0.2, w + 0.05);
            const windowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // Parlak mavi pencereler
            
            // Farklı katlara pencere çizgileri yerleştir
            for (let y = 1; y < h; y += 1.5) {
                const win = new THREE.Mesh(windowGeo, windowMat);
                win.position.y = -h/2 + y;
                group.add(win);
            }
        }

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(x*x + z*z) < 14);

        group.position.set(x, h/2, z);
        group.userData = { width: w, height: h, isEaten: false, color: bMat.color };
        
        scene.add(group);
        buildings.push(group);
    }

    // Botlar (Kaçan pembe kapsüller)
    const botMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 });
    for (let i = 0; i < 110; i++) {
        const botGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 16);
        const bot = new THREE.Mesh(botGeo, botMat);
        
        let x = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
        let z = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
        
        bot.position.set(x, 0.25, z);
        bot.castShadow = true;
        bot.userData = {
            angle: Math.random() * Math.PI * 2,
            speed: 0.035 + Math.random() * 0.04,
            changeDirTimer: Math.random() * 120
        };

        scene.add(bot);
        bots.push(bot);
    }
}

// --- PARÇACIK PATLAMA SİSTEMİ (KALİTE HİSSİ) ---
function createExplosion(x, y, z, color, count = 20) {
    for (let i = 0; i < count; i++) {
        const pSize = 0.15 + Math.random() * 0.25;
        const geo = new THREE.BoxGeometry(pSize, pSize, pSize);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const p = new THREE.Mesh(geo, mat);

        p.position.set(x, y + (Math.random() * 2 - 1), z);
        
        // Rastgele fırlama hızları
        p.userData = {
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() * 0.3) + 0.1, // Yukarı doğru fırlama ağırlıklı
            vz: (Math.random() - 0.5) * 0.3,
            life: 1.0 // Ömür çarpanı
        };

        scene.add(p);
        particles.push(p);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // Fizik simülasyonu (Hız ve Yerçekimi)
        p.position.x += p.userData.vx;
        p.position.y += p.userData.vy;
        p.position.z += p.userData.vz;
        
        p.userData.vy -= 0.015; // Yerçekimi etkisi
        
        // Zamanla küçülme efekti
        p.userData.life -= 0.03;
        p.scale.set(p.userData.life, p.userData.life, p.userData.life);

        if (p.userData.life <= 0) {
            scene.remove(p);
            particles.splice(i, 1);
        }
    }
}

// --- TEXT POP-UP EFEKTİ (+0.04m yazısı) ---
function spawnPopText(text, x, y, z) {
    const el = document.createElement('div');
    el.className = 'pop-text';
    el.innerText = text;
    
    // 3D pozisyonu 2D ekrana çevirme
    const vector = new THREE.Vector3(x, y, z);
    vector.project(camera);
    
    const screenX = (vector.x * .5 + .5) * window.innerWidth;
    const screenY = (-(vector.y * .5) + .5) * window.innerHeight;
    
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    
    document.getElementById('floating-texts').appendChild(el);
    
    setTimeout(() => el.remove(), 800);
}

// --- KONTROL MEKANİZMALARI ---
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

// --- FİZİK VE CANAVAR HAREKETLERİ ---
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

        // Büyüdükçe hızın çok az artması ve akıcı olması
        const speedMult = moveSpeed * (1 + (playerScale - 1) * 0.08);
        const power = joystickActive ? Math.sqrt(moveX*moveX + moveZ*moveZ) : 1.0;
        
        const nextX = player.position.x + Math.sin(targetAngle) * speedMult * power;
        const nextZ = player.position.z + Math.cos(targetAngle) * speedMult * power;

        if (Math.abs(nextX) < MAP_SIZE && Math.abs(nextZ) < MAP_SIZE) {
            let canGo = true;

            for (let b of buildings) {
                if (b.userData.isEaten) continue;

                const dist = Math.sqrt(Math.pow(nextX - b.position.x, 2) + Math.pow(nextZ - b.position.z, 2));
                const collisionRadius = (b.userData.width / 2) + (playerScale * 0.6);

                if (dist < collisionRadius) {
                    // Dinozor binayı yiyebilecek boyutta mı?
                    if (playerScale > b.userData.height * 0.3) {
                        eatBuilding(b);
                    } else {
                        canGo = false; // Geçemez, çarpışma sesi efekti veya hissi
                    }
                }
            }

            if (canGo) {
                player.position.x = nextX;
                player.position.z = nextZ;

                // --- KALİTELİ YÜRÜME VE KUYRUK ANIMASYONU ---
                walkCycle += 0.18;
                // Gövdede "Squash & Stretch" (Yukarı/Aşağı yaylanma hareketi)
                player.scale.y = playerScale + (Math.sin(walkCycle) * 0.04 * playerScale);
                // Kuyruk sallama mekaniği
                if (tailMesh) {
                    tailMesh.rotation.y = Math.sin(walkCycle) * 0.3;
                }
            }
        }
    } else {
        // Dururken animasyonları yavaşça normal haline getir
        player.scale.y = THREE.MathUtils.lerp(player.scale.y, playerScale, 0.1);
        if (tailMesh) {
            tailMesh.rotation.y = THREE.MathUtils.lerp(tailMesh.rotation.y, 0, 0.1);
        }
    }
    player.position.y = 0;
}

function updateBots() {
    for (let bot of bots) {
        bot.userData.changeDirTimer--;
        if (bot.userData.changeDirTimer <= 0) {
            bot.userData.angle = Math.random() * Math.PI * 2;
            bot.userData.changeDirTimer = 100 + Math.random() * 200;
        }

        bot.position.x += Math.sin(bot.userData.angle) * bot.userData.speed;
        bot.position.z += Math.cos(bot.userData.angle) * bot.userData.speed;

        if (Math.abs(bot.position.x) > MAP_SIZE) bot.userData.angle += Math.PI;
        if (Math.abs(bot.position.z) > MAP_SIZE) bot.userData.angle += Math.PI;

        const distToPlayer = player.position.distanceTo(bot.position);
        if (distToPlayer < (playerScale * 0.8) + 0.3) {
            eatBot(bot);
        }
    }
}

// --- YEME MEKANİZMASI ---
function eatBot(bot) {
    // Parçacık patlaması (Pembe kan/pırıltı tozları)
    createExplosion(bot.position.x, bot.position.y, bot.position.z, 0xf43f5e, 12);
    
    // Ekranda "+0.04m" yazısı çıkart
    spawnPopText("+0.04m", bot.position.x, bot.position.y + 1, bot.position.z);

    // Yeniden doğdur
    bot.position.x = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
    bot.position.z = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
    bot.userData.angle = Math.random() * Math.PI * 2;

    growPlayer(0.04);
}

function eatBuilding(building) {
    building.userData.isEaten = true;

    // Toz ve Beton Molozu Patlaması (Binanın renginde)
    createExplosion(building.position.x, building.position.y, building.position.z, building.userData.color, 35);
    
    // Ekranı sars (Kamera Sarsıntısı)
    screenShakeIntensity = 0.3 + (building.userData.height * 0.05);

    // Büyüme Yazısı çıkart
    const growth = building.userData.height * 0.05;
    spawnPopText(`+${growth.toFixed(2)}m`, building.position.x, building.position.y + 2, building.position.z);

    // Fiziksel Yıkım Efekti (Hızlıca küçülerek yerin dibine çökme)
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
    }, 20);

    growPlayer(growth);
}

function respawnBuilding(oldBuilding) {
    const index = buildings.indexOf(oldBuilding);
    if (index > -1) buildings.splice(index, 1);

    const h = Math.random() * 11 + 3;
    const w = Math.random() * 2.2 + 2;
    const group = new THREE.Group();
    
    const bGeo = new THREE.BoxGeometry(w, h, w);
    const bMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.6 });
    const buildingMesh = new THREE.Mesh(bGeo, bMat);
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
    group.add(buildingMesh);

    group.position.set(
        (Math.random() - 0.5) * (MAP_SIZE * 1.8),
        h / 2,
        (Math.random() - 0.5) * (MAP_SIZE * 1.8)
    );
    group.userData = { width: w, height: h, isEaten: false, color: bMat.color };

    scene.add(group);
    buildings.push(group);
}

function growPlayer(amount) {
    playerScale += amount;
    player.scale.set(playerScale, playerScale, playerScale);
    sizeValEl.innerText = playerScale.toFixed(2);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- ANA ANIMASYON DÖNGÜSÜ (RENDER & EFEKTLER) ---
function animate() {
    requestAnimationFrame(animate);

    updatePlayer();
    updateBots();
    updateParticles();

    // Akıcı Kamera Takip Hesaplamaları
    const desiredOffsetY = 6.5 + (playerScale * 3.6);
    const desiredOffsetZ = -10.5 - (playerScale * 4.6);

    const targetCamY = player.position.y + desiredOffsetY;
    const targetCamZ = player.position.z + desiredOffsetZ;

    // Yumuşak Takip (Lerp)
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
    
    // --- EKRAN SALLANMASI (SCREEN SHAKE) MEKANİZMASI ---
    if (screenShakeIntensity > 0.01) {
        camera.position.x += (Math.random() - 0.5) * screenShakeIntensity;
        camera.position.y += (Math.random() - 0.5) * screenShakeIntensity;
        camera.position.z += (Math.random() - 0.5) * screenShakeIntensity;
        
        // Sarsıntıyı zamanla sönümle
        screenShakeIntensity *= 0.85;
    }

    camera.lookAt(player.position.x, player.position.y + (playerScale * 0.45), player.position.z);

    renderer.render(scene, camera);
}

window.onload = init;
