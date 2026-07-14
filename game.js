// --- OYUN AYARLARI VE DEĞİŞKENLER ---
let scene, camera, renderer;
let player, playerSize = 1.0;
let keys = {};
let moveSpeed = 0.15;

let buildings = [];
let bots = [];
const MAP_SIZE = 100; // Harita sınırları (-50 ile 50 arası)

// UI Elemanları
const sizeValEl = document.getElementById('size-val');

// --- BAŞLANGIÇ KURULUMU ---
function init() {
    // 1. Sahne (Scene)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xa0e0fc); // Gökyüzü mavisi
    scene.fog = new THREE.FogExp2(0xa0e0fc, 0.015);

    // 2. Kamera (Camera)
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // 4. Işıklandırma
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // 5. Zemin (Çimen)
    const floorGeo = new THREE.PlaneGeometry(MAP_SIZE * 2, MAP_SIZE * 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x558a2f, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Sınır çizgileri (Grid)
    const grid = new THREE.GridHelper(MAP_SIZE * 2, 50, 0x33691e, 0x33691e);
    grid.position.y = 0.01;
    scene.add(grid);

    // 6. Oyuncuyu (Dinozor) Oluştur
    createPlayer();

    // 7. Çevreyi Oluştur (Binalar ve Botlar)
    spawnWorld();

    // Kontrolleri Dinle
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', onWindowResize);

    // Oyun Döngüsünü Başlat
    animate();
}

// --- DİNOZOR MODELİ OLUŞTURMA ---
function createPlayer() {
    player = new THREE.Group();

    const greenMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.5 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    // Gövde
    const bodyGeo = new THREE.BoxGeometry(1, 0.8, 1.5);
    const body = new THREE.Mesh(bodyGeo, greenMat);
    body.position.y = 0.6;
    body.castShadow = true;
    player.add(body);

    // Kafa
    const headGeo = new THREE.BoxGeometry(0.7, 0.6, 0.9);
    const head = new THREE.Mesh(headGeo, greenMat);
    head.position.set(0, 1.1, 0.5);
    head.castShadow = true;
    player.add(head);

    // Gözler
    const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.15);
    const pupilGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(0.36, 1.2, 0.7);
    const pupilL = new THREE.Mesh(pupilGeo, pupilMat);
    pupilL.position.set(0.41, 1.2, 0.75);
    player.add(eyeL, pupilL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(-0.36, 1.2, 0.7);
    const pupilR = new THREE.Mesh(pupilGeo, pupilMat);
    pupilR.position.set(-0.41, 1.2, 0.75);
    player.add(eyeR, pupilR);

    // Kuyruk
    const tailGeo = new THREE.BoxGeometry(0.4, 0.4, 1);
    const tail = new THREE.Mesh(tailGeo, greenMat);
    tail.position.set(0, 0.5, -1);
    tail.rotation.x = -0.2;
    tail.castShadow = true;
    player.add(tail);

    scene.add(player);
}

// --- DÜNYA ELEMENTLERİNİ SE serpme ---
function spawnWorld() {
    // Binaları Oluştur (Rastgele Boyutlarda)
    const buildingColors = [0x78909c, 0xb0bec5, 0x546e7a, 0x90a4ae];
    for (let i = 0; i < 80; i++) {
        const height = Math.random() * 12 + 3; // 3 ile 15 arası yükseklik
        const width = Math.random() * 3 + 2;   // 2 ile 5 arası genişlik
        
        const geo = new THREE.BoxGeometry(width, height, width);
        const mat = new THREE.MeshStandardMaterial({ 
            color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
            roughness: 0.7 
        });
        const building = new THREE.Mesh(geo, mat);

        // Rastgele konumlandır
        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(x*x + z*z) < 10); // Oyuncunun tam üstünde doğmasınlar

        building.position.set(x, height / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;

        // Çarpışma kutusu (bounding box) için boyut saklıyoruz
        building.userData = {
            width: width,
            height: height,
            radius: Math.max(width, height) / 2, // Basit çarpışma yarıçapı
            isEaten: false
        };

        scene.add(building);
        buildings.push(building);
    }

    // Botları Oluştur (İnsanlar)
    const botMat = new THREE.MeshStandardMaterial({ color: 0xe91e63, roughness: 0.5 }); // Pembe minik insanlar
    for (let i = 0; i < 150; i++) {
        const botGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.6, 8);
        const bot = new THREE.Mesh(botGeo, botMat);
        
        let x = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
        let z = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
        
        bot.position.set(x, 0.3, z);
        bot.castShadow = true;

        // Botun hareket yönü (açı olarak)
        bot.userData = {
            angle: Math.random() * Math.PI * 2,
            speed: 0.03 + Math.random() * 0.04,
            changeDirTimer: Math.random() * 100
        };

        scene.add(bot);
        bots.push(bot);
    }
}

// --- HAREKET VE KONTROLLER ---
function updatePlayer() {
    let moveX = 0;
    let moveZ = 0;

    if (keys['w'] || keys['arrowup']) moveZ = 1;
    if (keys['s'] || keys['arrowdown']) moveZ = -1;
    if (keys['a'] || keys['arrowleft']) moveX = 1;
    if (keys['d'] || keys['arrowright']) moveX = -1;

    if (moveX !== 0 || moveZ !== 0) {
        // Hareket açısını hesapla
        const targetAngle = Math.atan2(moveX, moveZ);
        player.rotation.y = targetAngle;

        // Hızı boyutumuza göre ölçeklendiriyoruz (büyüdükçe biraz daha hızlı veya dengeli gitsin)
        const currentSpeed = moveSpeed * (1 + (playerSize - 1) * 0.1);
        
        const nextX = player.position.x + Math.sin(targetAngle) * currentSpeed;
        const nextZ = player.position.z + Math.cos(targetAngle) * currentSpeed;

        // Sınır kontrolü
        if (Math.abs(nextX) < MAP_SIZE && Math.abs(nextZ) < MAP_SIZE) {
            // Engel kontrolü (Binalarla çarpışma)
            let canMove = true;
            for (let b of buildings) {
                if (b.userData.isEaten) continue;

                const dist = Math.sqrt(Math.pow(nextX - b.position.x, 2) + Math.pow(nextZ - b.position.z, 2));
                // Eğer binadan küçüksek ve çok yaklaştıysak çarpışırız ve geçemeyiz
                const minCollisionDist = (b.userData.width / 2) + (playerSize * 0.5);
                
                if (dist < minCollisionDist) {
                    // Eğer binadan büyüksek, onu yeriz!
                    if (playerSize > b.userData.height * 0.4) {
                        eatBuilding(b);
                    } else {
                        canMove = false; // Geçemez
                    }
                }
            }

            if (canMove) {
                player.position.x = nextX;
                player.position.z = nextZ;
            }
        }
    }

    // Dinozoru zemin seviyesinde tut
    player.position.y = 0; 
}

// --- BOTLARI HAREKET ETTİR ---
function updateBots() {
    for (let bot of bots) {
        bot.userData.changeDirTimer--;
        if (bot.userData.changeDirTimer <= 0) {
            bot.userData.angle = Math.random() * Math.PI * 2;
            bot.userData.changeDirTimer = 100 + Math.random() * 200;
        }

        bot.position.x += Math.sin(bot.userData.angle) * bot.userData.speed;
        bot.position.z += Math.cos(bot.userData.angle) * bot.userData.speed;

        // Harita dışına çıkmasınlar
        if (Math.abs(bot.position.x) > MAP_SIZE) bot.userData.angle += Math.PI;
        if (Math.abs(bot.position.z) > MAP_SIZE) bot.userData.angle += Math.PI;

        // Dinozor ile bot (insan) çarpışma kontrolü
        const distToPlayer = player.position.distanceTo(bot.position);
        if (distToPlayer < (playerSize * 0.8) + 0.3) {
            eatBot(bot);
        }
    }
}

// --- YEME VE BÜYÜME MEKANİKLERİ ---
function eatBot(bot) {
    // Botu haritanın başka bir yerine ışınla (yeniden doğuş)
    bot.position.x = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
    bot.position.z = (Math.random() - 0.5) * (MAP_SIZE * 1.9);
    bot.userData.angle = Math.random() * Math.PI * 2;

    // Dinozoru büyüt
    growPlayer(0.05);
}

function eatBuilding(building) {
    building.userData.isEaten = true;
    
    // Bina çökme efekti (küçülerek yok olma animasyonu)
    let shrinkInterval = setInterval(() => {
        building.scale.x -= 0.1;
        building.scale.y -= 0.1;
        building.scale.z -= 0.1;

        if (building.scale.x <= 0.1) {
            clearInterval(shrinkInterval);
            scene.remove(building);
            
            // Yeni bir bina üret (oyun alanı boş kalmasın)
            respawnBuilding(building);
        }
    }, 30);

    // Dinozoru büyük oranda büyüt
    growPlayer(building.userData.height * 0.05);
}

function respawnBuilding(oldBuilding) {
    // Eski binayı temizle ve listesinden çıkar
    const index = buildings.indexOf(oldBuilding);
    if (index > -1) buildings.splice(index, 1);

    // Yeni bina ekle
    const height = Math.random() * 12 + 3;
    const width = Math.random() * 3 + 2;
    const geo = new THREE.BoxGeometry(width, height, width);
    const mat = new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.7 });
    const building = new THREE.Mesh(geo, mat);

    building.position.set(
        (Math.random() - 0.5) * (MAP_SIZE * 1.8),
        height / 2,
        (Math.random() - 0.5) * (MAP_SIZE * 1.8)
    );
    building.castShadow = true;
    building.receiveShadow = true;
    building.userData = { width: width, height: height, isEaten: false };

    scene.add(building);
    buildings.push(building);
}

function growPlayer(amount) {
    playerSize += amount;
    player.scale.set(playerSize, playerSize, playerSize);
    
    // UI Güncelle (Virgülden sonra 2 basamak)
    sizeValEl.innerText = playerSize.toFixed(2);
}

// --- PENCERE BOYUTU DEĞİŞİNCE ---
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- OYUN DÖNGÜSÜ (ANIMATE) ---
function animate() {
    requestAnimationFrame(animate);

    updatePlayer();
    updateBots();

    // Kameranın Dinozoru Arkadan Takip Etmesi
    // Dinozor büyüdükçe kamerayı da geriye çekiyoruz ki her şeyi görebilelim
    const camOffsetZ = -12 - (playerSize * 4);
    const camOffsetY = 8 + (playerSize * 3);

    camera.position.x = player.position.x;
    camera.position.y = player.position.y + camOffsetY;
    camera.position.z = player.position.z + camOffsetZ;
    camera.lookAt(player.position);

    renderer.render(scene, camera);
}

// Oyunu Başlat
window.onload = init;
