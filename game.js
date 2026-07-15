// --- SİSTEM DEĞİŞKENLERİ ---
let scene, camera, renderer;
let player, playerScale = 1.0;
let playerModel;
const baseMoveSpeed = 0.132;

let gameStarted = false;
let gameLoaded = false;
let loadingProgress = 0;

let walkCycle = 0;
let tailMesh, leftArmMesh, rightArmMesh, leftLegMesh, rightLegMesh;

const keys = {};
let joystickActive = false;
let joystickVector = { x: 0, y: 0 };

let buildings = [];
let bots = [];
let cars = [];
let aiDinos = [];
let borderMeshes = []; 
let roadMeshes = [];

const MAP_SIZE = 300;

const ROAD_COORDS = [];
for (let pos = -500; pos < 500; pos += 100) {
    ROAD_COORDS.push(pos);
}

// UI Elemanları
const sizeValEl = document.getElementById('size-val');
const tierValEl = document.getElementById('tier-val');
const warningMsgEl = document.getElementById('warning-msg');
const timerValEl = document.getElementById('timer-val');
const timerDisplayEl = document.getElementById('timer-display');
const loadingScreenEl = document.getElementById('loading-screen');
const loadingBarEl = document.getElementById('loading-bar');
const loadingTextEl = document.getElementById('loading-text');
const loadingPercentEl = document.getElementById('loading-percent');
const playBtnEl = document.getElementById('play-btn');
let warningTimeout = null;

const AI_COLORS = [0x3182ce, 0x805ad5, 0xdd6b20, 0xe53e3e, 0x319795];

let dangerTimer = 20;
let lastTimerUpdate = Date.now();

let gltfLoader;
let cachedGLBModel = null;

// --- BAŞLANGIÇ (INIT) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d); 

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 50000);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    sunLight.position.set(150, 400, 50);
    sunLight.castShadow = true;
    sunLight.shadow.camera.left = -300;
    sunLight.shadow.camera.right = 300;
    sunLight.shadow.camera.top = 300;
    sunLight.shadow.camera.bottom = -300;
    scene.add(sunLight);

    // ZEMİN
    const floorGeo = new THREE.PlaneGeometry(1500, 1500);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    createMapBorders();
    createCityGrid();

    gltfLoader = new THREE.GLTFLoader();
    loadDinoModel();
    
    spawnCityAssets(45, 15, 45); 
    setupControls();
    setupAdminPanel();

    if (timerDisplayEl) timerDisplayEl.style.display = 'none';

    animate();
}

function loadDinoModel() {
    updateLoadingProgress(0, "Dinozor modeli yükleniyor...");
    
    gltfLoader.load(
        'dino.glb',
        (gltf) => {
            playerModel = gltf.scene;
            playerModel.scale.set(5, 5, 5);
            
            updateLoadingProgress(100, "Model yüklendi!");
            
            playerModel.traverse((node) => {
                if (node.isMesh) {
                    node.castShadow = true;
                    node.receiveShadow = true;
                }
            });
            
            cachedGLBModel = playerModel.clone();
            
            player = playerModel;
            player.position.set(0, 0, 0);
            scene.add(player);
            
            player.traverse((node) => {
                const name = node.name.toLowerCase();
                if (name.includes('tail') || name.includes('kuyruk')) tailMesh = node;
                if (name.includes('arm') || name.includes('kol')) {
                    if (node.position.x > 0) rightArmMesh = node;
                    else leftArmMesh = node;
                }
                if (name.includes('leg') || name.includes('bacak')) {
                    if (node.position.x > 0) rightLegMesh = node;
                    else leftLegMesh = node;
                }
            });
            
            updatePlayerPhysicalSize();
            spawnAIDinos();
            
            setTimeout(() => {
                gameLoaded = true;
                if (loadingScreenEl) {
                    loadingScreenEl.style.opacity = '0';
                    setTimeout(() => {
                        loadingScreenEl.style.display = 'none';
                    }, 500);
                }
                if (playBtnEl) {
                    playBtnEl.classList.add('ready');
                }
            }, 500);
        },
        (xhr) => {
            if (xhr.total > 0) {
                const percent = Math.round((xhr.loaded / xhr.total) * 90);
                updateLoadingProgress(percent, `Dinozor yükleniyor... %${percent}`);
            }
        },
        (error) => {
            console.warn('GLB yüklenemedi, yedek model kullanılıyor:', error);
            updateLoadingProgress(100, "Yedek model oluşturuluyor...");
            createBackupDino();
        }
    );
}

function createBackupDino() {
    const dino = buildDinoMesh(0x22c55e);
    player = dino.group;
    tailMesh = dino.tail;
    leftArmMesh = dino.leftArm;
    rightArmMesh = dino.rightArm;
    leftLegMesh = dino.leftLeg;
    rightLegMesh = dino.rightLeg;
    player.position.set(0, 0, 0);
    player.scale.set(5, 5, 5);
    scene.add(player);
    
    updatePlayerPhysicalSize();
    spawnAIDinos();
    
    gameLoaded = true;
    if (loadingScreenEl) {
        loadingScreenEl.style.opacity = '0';
        setTimeout(() => {
            loadingScreenEl.style.display = 'none';
        }, 500);
    }
    if (playBtnEl) {
        playBtnEl.classList.add('ready');
    }
}

function updateLoadingProgress(percent, text) {
    loadingProgress = percent;
    if (loadingBarEl) {
        loadingBarEl.style.width = percent + '%';
    }
    if (loadingPercentEl) {
        loadingPercentEl.textContent = '%' + percent;
    }
    if (loadingTextEl) {
        loadingTextEl.innerHTML = `<span id="loading-percent">%${percent}</span> - ${text}`;
    }
}

function createMapBorders() {
    for (let b of borderMeshes) scene.remove(b);
    borderMeshes = [];

    const borderMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 });
    const barrierHeight = 30;
    const barrierThickness = 7.5;

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
            const roadH = new THREE.Mesh(new THREE.PlaneGeometry(MAP_SIZE * 2, 22.5), roadMat);
            roadH.rotation.x = -Math.PI/2;
            roadH.position.set(0, 0.1, pos); 
            roadH.receiveShadow = true;
            scene.add(roadH);
            roadMeshes.push(roadH);

            const roadV = new THREE.Mesh(new THREE.PlaneGeometry(22.5, MAP_SIZE * 2), roadMat);
            roadV.rotation.x = -Math.PI/2;
            roadV.position.set(pos, 0.1, 0);
            roadV.receiveShadow = true;
            scene.add(roadV);
            roadMeshes.push(roadV);
        }
    }
}

function isPointOnRoad(x, z, tolerance = 17.5) {
    for (let pos of ROAD_COORDS) {
        if (Math.abs(pos) < MAP_SIZE) {
            if (Math.abs(x - pos) < tolerance || Math.abs(z - pos) < tolerance) return true;
        }
    }
    return false;
}

// --- BİNA OLUŞTURMA ---
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
    const windowGeo = new THREE.BoxGeometry(1.5, 2, 0.25);

    const floors = Math.floor(height / 9);
    for (let f = 0; f < floors; f++) {
        const yPos = -height/2 + 5 + (f * 8);
        
        for (let xOff of [-width*0.3, 0, width*0.3]) {
            const winFront = new THREE.Mesh(windowGeo, windowMat);
            winFront.position.set(xOff, yPos, width/2 + 0.15);
            buildingGroup.add(winFront);

            const winBack = new THREE.Mesh(windowGeo, windowMat);
            winBack.position.set(xOff, yPos, -width/2 - 0.15);
            buildingGroup.add(winBack);
        }

        const windowGeoRot = new THREE.BoxGeometry(0.25, 2, 1.5);
        for (let zOff of [-width*0.3, 0, width*0.3]) {
            const winRight = new THREE.Mesh(windowGeoRot, windowMat);
            winRight.position.set(width/2 + 0.15, yPos, zOff);
            buildingGroup.add(winRight);

            const winLeft = new THREE.Mesh(windowGeoRot, windowMat);
            winLeft.position.set(-width/2 - 0.15, yPos, zOff);
            buildingGroup.add(winLeft);
        }
    }

    return buildingGroup;
}

function buildDinoMesh(colorHex) {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ 
        color: colorHex, 
        roughness: 0.3,
        metalness: 0.1
    });
    const darkSkinMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(colorHex).multiplyScalar(0.6), 
        roughness: 0.4 
    });
    const bellyMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(colorHex).multiplyScalar(1.3), 
        roughness: 0.5 
    });
    const eyeMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        roughness: 0.1,
        emissive: 0x222222
    });
    const pupilMat = new THREE.MeshStandardMaterial({ 
        color: 0x000000,
        roughness: 0.05
    });
    const clawMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a, 
        roughness: 0.2 
    });
    const toothMat = new THREE.MeshStandardMaterial({ 
        color: 0xf5f5f5, 
        roughness: 0.2 
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(3.5, 24, 24), skinMat);
    body.scale.set(1, 0.85, 1.3);
    body.position.y = 3.25;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    for (let i = -0.6; i <= 0.6; i += 0.2) {
        const spike = new THREE.Mesh(
            new THREE.ConeGeometry(0.3, 1, 6),
            darkSkinMat
        );
        spike.position.set(0, 5.5 + Math.abs(i) * 1.5, 3 + i * 2);
        spike.rotation.x = -0.2;
        group.add(spike);
    }

    const belly = new THREE.Mesh(new THREE.SphereGeometry(2.5, 16, 16), bellyMat);
    belly.scale.set(0.7, 0.6, 1.1);
    belly.position.set(0, 2.75, 3.25);
    group.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(2.5, 20, 20), skinMat);
    head.position.set(0, 5.75, 2.75);
    head.castShadow = true;
    group.add(head);

    const snout = new THREE.Mesh(new THREE.SphereGeometry(1.75, 16, 16), skinMat);
    snout.scale.set(1, 0.7, 1.1);
    snout.position.set(0, 5.25, 4.25);
    group.add(snout);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 1.75), skinMat);
    jaw.position.set(0, 4.9, 4.5);
    group.add(jaw);

    for (let i = -1; i <= 1; i += 0.5) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.4, 4), toothMat);
        tooth.position.set(i * 0.6, 4.65, 5.25);
        group.add(tooth);
    }

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), eyeMat);
    eyeL.position.set(1.4, 6.25, 3.5);
    group.add(eyeL);
    
    const pupilL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), pupilMat);
    pupilL.position.set(1.65, 6.25, 3.85);
    group.add(pupilL);

    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), eyeMat);
    eyeR.position.set(-1.4, 6.25, 3.5);
    group.add(eyeR);
    
    const pupilR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), pupilMat);
    pupilR.position.set(-1.65, 6.25, 3.85);
    group.add(pupilR);

    const browL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.75), darkSkinMat);
    browL.position.set(1.5, 6.65, 3.4);
    group.add(browL);
    
    const browR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.75), darkSkinMat);
    browR.position.set(-1.5, 6.65, 3.4);
    group.add(browR);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.75, 2, 12), skinMat);
    neck.position.set(0, 4.75, 1.75);
    group.add(neck);

    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 2.75, 8), skinMat);
    leftArm.position.set(2, 2.75, 2.5);
    leftArm.rotation.z = 0.3;
    leftArm.rotation.x = -0.3;
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 2.75, 8), skinMat);
    rightArm.position.set(-2, 2.75, 2.5);
    rightArm.rotation.z = -0.3;
    rightArm.rotation.x = -0.3;
    rightArm.castShadow = true;
    group.add(rightArm);

    for (let side = -1; side <= 1; side += 2) {
        for (let i = -1; i <= 1; i++) {
            const claw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 6), clawMat);
            claw.position.set(side * (2.25 + i * 0.3), 1.25, 3.25);
            claw.rotation.x = -0.5;
            group.add(claw);
        }
    }

    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 2.5, 10), skinMat);
    leftLeg.position.set(1.75, 1.25, -1.5);
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 2.5, 10), skinMat);
    rightLeg.position.set(-1.75, 1.25, -1.5);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    for (let side = -1; side <= 1; side += 2) {
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.4, 1), darkSkinMat);
        foot.position.set(side * 1.75, 0, -1.25);
        group.add(foot);

        for (let i = -1; i <= 1; i += 2) {
            const toe = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6), clawMat);
            toe.position.set(side * 1.75 + i * 0.4, -0.1, -0.75);
            toe.rotation.x = -0.3;
            group.add(toe);
        }
    }

    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.25, 5.5, 12), skinMat);
    tail.rotation.x = -Math.PI / 2.8;
    tail.position.set(0, 2.5, -4.5);
    tail.castShadow = true;
    group.add(tail);

    const tailTip = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), darkSkinMat);
    tailTip.position.set(0, 0.75, -6.5);
    group.add(tailTip);

    return { 
        group, 
        tail, 
        leftArm, 
        rightArm,
        leftLeg,
        rightLeg
    };
}

function spawnCityAssets(buildingCount, carCount, botCount) {
    const buildingColors = [0x4b5563, 0x374151, 0x1f2937, 0x7c3aed, 0x0f766e, 0xd97706];

    for (let i = 0; i < buildingCount; i++) {
        const h = Math.random() * 60 + 30;
        const w = Math.random() * 10 + 15;

        let x, z;
        do {
            x = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            z = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(x*x + z*z) < 75 || isPointOnRoad(x, z, (w / 2) + 7.5));

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
        const car = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 4.5), carMat);
        let randomRoadPos = 0;
        if (ROAD_COORDS.length > 0) {
            const validRoads = ROAD_COORDS.filter(p => Math.abs(p) < MAP_SIZE);
            randomRoadPos = validRoads[Math.floor(Math.random() * validRoads.length)] || 0;
        }

        const isDikey = Math.random() > 0.5;
        car.position.y = 1.75;
        car.castShadow = true;
        car.userData = {
            speed: (0.275 + Math.random() * 0.22),
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
        const bot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.5, 8), botMat);
        let bx, bz;
        do {
            bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
            bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        } while (Math.sqrt(bx*bx + bz*bz) < 60 || isPointOnRoad(bx, bz, 5));

        bot.position.set(bx, 1.75, bz);
        bot.castShadow = true;
        bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.1925 };
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
    
    let aiGroup;
    let dinoData;
    
    if (cachedGLBModel) {
        aiGroup = cachedGLBModel.clone();
        aiGroup.traverse((node) => {
            if (node.isMesh) {
                node.material = node.material.clone();
                if (node.material.color && node.material.color.getHex() === 0x22c55e) {
                    node.material.color.setHex(colorHex);
                }
            }
        });
        dinoData = { tail: null, leftArm: null, rightArm: null, leftLeg: null, rightLeg: null };
        aiGroup.traverse((node) => {
            const name = node.name.toLowerCase();
            if (name.includes('tail') || name.includes('kuyruk')) dinoData.tail = node;
            if (name.includes('arm') || name.includes('kol')) {
                if (node.position.x > 0) dinoData.rightArm = node;
                else dinoData.leftArm = node;
            }
            if (name.includes('leg') || name.includes('bacak')) {
                if (node.position.x > 0) dinoData.rightLeg = node;
                else dinoData.leftLeg = node;
            }
        });
    } else {
        dinoData = buildDinoMesh(colorHex);
        aiGroup = dinoData.group;
        aiGroup.scale.set(5, 5, 5);
    }
    
    let ax, az;
    do {
        ax = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
        az = (Math.random() - 0.5) * (MAP_SIZE * 1.5);
    } while (Math.sqrt(Math.pow(ax, 2) + Math.pow(az, 2)) < 75);

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
        leftArm: dinoData.leftArm,
        rightArm: dinoData.rightArm,
        leftLeg: dinoData.leftLeg,
        rightLeg: dinoData.rightLeg,
        label: labelEl,
        indicator: indicatorEl,
        angle: Math.random() * Math.PI * 2,
        speed: 0.275,
        needsDelayedGrowth: false,
        walkCycle: Math.random() * Math.PI * 2
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

function getEatRange() {
    const visScale = calculateVisualScale(playerScale);
    return 7.5 * visScale;
}

function updatePlayerPhysicalSize() {
    if (!player) return;
    const visScale = calculateVisualScale(playerScale);
    player.scale.set(visScale * 5, visScale * 5, visScale * 5);

    let tierText = "🦎 Yavru";
    if (playerScale >= 100000) tierText = "🐉 Titan";
    else if (playerScale >= 10000) tierText = "🦖 Deva";
    else if (playerScale >= 1000) tierText = "🦕 Mutant";
    else if (playerScale >= 100) tierText = "🐊 Alfa";
    else if (playerScale >= 10) tierText = "🦖 Büyük";

    if (tierValEl) tierValEl.innerText = tierText;
}

function updateAIDinoPhysicalSize(ai) {
    const visScale = calculateVisualScale(ai.scale);
    const baseScale = cachedGLBModel ? 5 : 5;
    ai.mesh.scale.set(visScale * baseScale, visScale * baseScale, visScale * baseScale);
}

// DÜZELTİLDİ: Sadece 10m ve üstü evrimlerde 5 kat artar
function getBuildingRequiredSize(buildingHeight) {
    // Temel gereksinim (her zaman aynı)
    let baseReq = buildingHeight * 0.35;
    
    // SADECE 10 metreden sonra çarpan uygulanır
    if (playerScale >= 100000) {
        return baseReq * 3125; // 5^5
    } else if (playerScale >= 10000) {
        return baseReq * 625;  // 5^4
    } else if (playerScale >= 1000) {
        return baseReq * 125;  // 5^3
    } else if (playerScale >= 100) {
        return baseReq * 25;   // 5^2
    } else if (playerScale >= 10) {
        return baseReq * 5;    // 5^1
    }
    
    // 10 metreden küçükse normal
    return baseReq;
}

function growPlayer(amount) {
    const oldScale = playerScale;
    playerScale += amount;
    if (sizeValEl) sizeValEl.innerText = playerScale.toFixed(1) + "m";
    
    if (oldScale < 10 && playerScale >= 10) triggerEvolutionUI("🦖 BÜYÜK DİNOZOR!");
    else if (oldScale < 100 && playerScale >= 100) triggerEvolutionUI("🐊 ALFA YIRTICI!");
    else if (oldScale < 1000 && playerScale >= 1000) triggerEvolutionUI("🦕 MUTANT MEGALODON!");
    else if (oldScale < 10000 && playerScale >= 10000) triggerEvolutionUI("🦖 DEVA ASA!");
    else if (oldScale < 100000 && playerScale >= 100000) triggerEvolutionUI("🐉 EFSANEVİ TİTAN!");

    updatePlayerPhysicalSize();
}

function showSizeWarning(requiredSize) {
    if (warningMsgEl) {
        warningMsgEl.innerText = `${requiredSize.toFixed(1)}m gerekli!`;
        warningMsgEl.style.color = '#ef4444';
        warningMsgEl.style.display = 'block';
    }
    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        if (warningMsgEl) warningMsgEl.style.display = 'none';
    }, 1200);
}

function setupAdminPanel() {
    const adminBtn = document.getElementById('admin-btn');
    const adminControls = document.getElementById('admin-controls');
    const adminApplyBtn = document.getElementById('admin-apply-btn');
    const adminSizeInput = document.getElementById('admin-size-input');

    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            const pw = prompt("OsDino Admin Şifresi:");
            if (pw === "osman123") {
                alert("Sisteme erişildi!");
                if (adminControls) adminControls.style.display = 'block';
            } else {
                alert("Şifre Yanlış!");
            }
        });
    }

    if (adminApplyBtn) {
        adminApplyBtn.addEventListener('click', () => {
            const newSize = parseFloat(adminSizeInput.value);
            if (!isNaN(newSize) && newSize > 0) {
                playerScale = newSize;
                if (sizeValEl) sizeValEl.innerText = playerScale.toFixed(1) + "m";
                updatePlayerPhysicalSize();
            }
        });
    }
}

function setupControls() {
    window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', onWindowResize);

    if (playBtnEl) {
        playBtnEl.addEventListener('click', () => {
            if (!gameLoaded) {
                alert("Dinozor modeli henüz yüklenmedi, lütfen bekleyin!");
                return;
            }
            document.getElementById('start-screen').style.display = 'none';
            gameStarted = true;
            lastTimerUpdate = Date.now();
        });
    }

    const joystickContainer = document.getElementById('joystick-container');
    const joystickKnob = document.getElementById('joystick-knob');

    if (joystickContainer && joystickKnob) {
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
}

function updatePlayer() {
    if (!player || !gameStarted) return;
    
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

        const speedMult = baseMoveSpeed * 5;
        const power = joystickActive ? Math.sqrt(moveX*moveX + moveZ*moveZ) : 1.0;
        
        const nextX = player.position.x + Math.sin(targetAngle) * speedMult * power;
        const nextZ = player.position.z + Math.cos(targetAngle) * speedMult * power;

        if (Math.abs(nextX) < MAP_SIZE - 2.5 && Math.abs(nextZ) < MAP_SIZE - 2.5) {
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

                walkCycle += 0.25;
                if (leftArmMesh && rightArmMesh) {
                    leftArmMesh.rotation.x = Math.sin(walkCycle) * 0.4 - 0.3;
                    rightArmMesh.rotation.x = Math.sin(walkCycle + Math.PI) * 0.4 - 0.3;
                }
                if (leftLegMesh && rightLegMesh) {
                    leftLegMesh.rotation.x = Math.sin(walkCycle + Math.PI) * 0.3;
                    rightLegMesh.rotation.x = Math.sin(walkCycle) * 0.3;
                }
                if (tailMesh) tailMesh.rotation.y = Math.sin(walkCycle) * 0.3;
            }
        }
    }
}

function updateCarsAndBots() {
    if (!gameStarted) return;
    const eatRange = getEatRange();
    
    for (let car of cars) {
        const moveStep = car.userData.speed * car.userData.dir;
        
        if (car.userData.isDikey) {
            car.position.z += moveStep;
            if (Math.abs(car.position.z) > MAP_SIZE - 10) {
                car.userData.dir *= -1;
                car.rotation.y = car.userData.dir > 0 ? 0 : Math.PI;
            }
        } else {
            car.position.x += moveStep;
            if (Math.abs(car.position.x) > MAP_SIZE - 10) {
                car.userData.dir *= -1;
                car.rotation.y = car.userData.dir > 0 ? Math.PI/2 : -Math.PI/2;
            }
        }

        if (player && player.position.distanceTo(car.position) < eatRange) {
            scene.remove(car);
            cars.splice(cars.indexOf(car), 1);
            growPlayer(0.35); 
            respawnCar();
        }
    }

    for (let bot of bots) {
        bot.position.x += Math.sin(bot.userData.angle) * bot.userData.speed;
        bot.position.z += Math.cos(bot.userData.angle) * bot.userData.speed;

        if (Math.abs(bot.position.x) > MAP_SIZE - 10 || isPointOnRoad(bot.position.x, bot.position.z, 2.5)) {
            bot.userData.angle += Math.PI;
        }

        if (player && player.position.distanceTo(bot.position) < eatRange) {
            scene.remove(bot);
            bots.splice(bots.indexOf(bot), 1);
            growPlayer(0.18); 
            respawnBot();
        }
    }
}

function updateAIDinos() {
    if (!gameStarted) return;
    
    for (let ai of aiDinos) {
        const distToPlayer = player ? ai.mesh.position.distanceTo(player.position) : 500;

        const boundaryThreshold = MAP_SIZE - 20;
        if (Math.abs(ai.mesh.position.x) > boundaryThreshold || Math.abs(ai.mesh.position.z) > boundaryThreshold) {
            ai.angle = Math.atan2(0 - ai.mesh.position.x, 0 - ai.mesh.position.z);
        } else {
            if (distToPlayer <= 125 && ai.scale > playerScale) {
                ai.angle = Math.atan2(player.position.x - ai.mesh.position.x, player.position.z - ai.mesh.position.z);
            } else {
                ai.angle += (Math.random() - 0.5) * 0.02;
            }
        }

        ai.mesh.position.x += Math.sin(ai.angle) * ai.speed;
        ai.mesh.position.z += Math.cos(ai.angle) * ai.speed;
        ai.mesh.rotation.y = ai.angle;

        ai.walkCycle += 0.2;
        if (ai.leftArm) ai.leftArm.rotation.x = Math.sin(ai.walkCycle) * 0.3 - 0.3;
        if (ai.rightArm) ai.rightArm.rotation.x = Math.sin(ai.walkCycle + Math.PI) * 0.3 - 0.3;
        if (ai.leftLeg) ai.leftLeg.rotation.x = Math.sin(ai.walkCycle + Math.PI) * 0.2;
        if (ai.rightLeg) ai.rightLeg.rotation.x = Math.sin(ai.walkCycle) * 0.2;
        if (ai.tail) ai.tail.rotation.y = Math.sin(ai.walkCycle) * 0.2;

        const tempV = new THREE.Vector3().copy(ai.mesh.position);
        tempV.project(camera);
        const x = (tempV.x * .5 + .5) * window.innerWidth;
        const y = (-(tempV.y * .5) + .5) * window.innerHeight;

        ai.label.style.left = `${x}px`;
        ai.label.style.top = `${y}px`;
        ai.label.innerText = `${ai.scale.toFixed(0)}m`;

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
            } else {
                ai.indicator.innerHTML = '▲';
                ai.indicator.style.color = '#22c55e';
                ai.indicator.style.transform = `rotate(${angle * 180 / Math.PI + 90}deg)`;
            }
        } else {
            ai.indicator.style.display = 'none';
        }

        if (player && distToPlayer < 5) {
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
            setTimeout(() => respawnBuilding(building), 6000); 
        } else {
            building.scale.set(scaleVal, scaleVal, scaleVal);
        }
    }, 25);

    let pointsMultiplier = 1;
    if (playerScale >= 100000) pointsMultiplier = 3125;
    else if (playerScale >= 10000) pointsMultiplier = 625;
    else if (playerScale >= 1000) pointsMultiplier = 125;
    else if (playerScale >= 100) pointsMultiplier = 25;
    else if (playerScale >= 10) pointsMultiplier = 5;
    
    growPlayer(building.userData.height * 0.2 * pointsMultiplier);
}

function respawnBuilding(oldBuilding) {
    const index = buildings.indexOf(oldBuilding);
    if (index > -1) buildings.splice(index, 1);

    const h = Math.random() * 60 + 30;
    const w = Math.random() * 10 + 15;
    
    let x, z;
    do {
        x = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
        z = (Math.random() - 0.5) * (MAP_SIZE * 1.7);
    } while (Math.sqrt(x*x + z*z) < 75 || isPointOnRoad(x, z, (w / 2) + 7.5));

    const buildingColors = [0x4b5563, 0x374151, 0x1f2937, 0x7c3aed, 0x0f766e, 0xd97706];
    const bColor = buildingColors[Math.floor(Math.random() * buildingColors.length)];
    const bGroup = createDetailedBuilding(w, h, bColor);
    bGroup.position.set(x, h/2, z);
    bGroup.userData = { width: w, height: h, isEaten: false };
    scene.add(bGroup);
    buildings.push(bGroup);
}

function respawnCar() {
    const car = new THREE.Mesh(new THREE.BoxGeometry(8, 3.5, 4.5), new THREE.MeshStandardMaterial({ color: 0xf59e0b }));
    let randomRoadPos = 0;
    if (ROAD_COORDS.length > 0) {
        const validRoads = ROAD_COORDS.filter(p => Math.abs(p) < MAP_SIZE);
        randomRoadPos = validRoads[Math.floor(Math.random() * validRoads.length)] || 0;
    }
    car.position.y = 1.75;
    car.castShadow = true;
    car.userData = {
        speed: (0.275 + Math.random() * 0.22),
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
    const bot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.5, 8), new THREE.MeshStandardMaterial({ color: 0x2563eb }));
    let bx, bz;
    do {
        bx = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
        bz = (Math.random() - 0.5) * (MAP_SIZE * 1.8);
    } while (Math.sqrt(bx*bx + bz*bz) < 60 || isPointOnRoad(bx, bz, 5));
    bot.position.set(bx, 1.75, bz);
    bot.userData = { angle: Math.random() * Math.PI * 2, speed: 0.1925 };
    scene.add(bot);
    bots.push(bot);
}

function updateDangerTimer() {
    const now = Date.now();
    if (now - lastTimerUpdate >= 1000) {
        dangerTimer--;
        lastTimerUpdate = now;
        if (dangerTimer <= 0) {
            dangerTimer = 20;
            for (let ai of aiDinos) {
                const distToPlayer = player ? ai.mesh.position.distanceTo(player.position) : 500;
                if (distToPlayer > 150) {
                    ai.scale *= 1.20;
                    updateAIDinoPhysicalSize(ai);
                    ai.needsDelayedGrowth = false;
                } else {
                    ai.needsDelayedGrowth = true;
                }
            }
        }
        if (timerValEl) timerValEl.innerText = dangerTimer;
    }
    for (let ai of aiDinos) {
        if (ai.needsDelayedGrowth) {
            const distToPlayer = player ? ai.mesh.position.distanceTo(player.position) : 500;
            if (distToPlayer > 150) {
                ai.scale *= 1.20;
                updateAIDinoPhysicalSize(ai);
                ai.needsDelayedGrowth = false;
            }
        }
    }
}

function triggerEvolutionUI(message) {
    if (warningMsgEl) {
        warningMsgEl.innerText = message;
        warningMsgEl.style.color = '#22c55e';
        warningMsgEl.style.display = 'block';
    }
    if (warningTimeout) clearTimeout(warningTimeout);
    warningTimeout = setTimeout(() => {
        if (warningMsgEl) warningMsgEl.style.display = 'none';
    }, 2000);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    if (!gameStarted) {
        const time = Date.now() * 0.0005;
        camera.position.x = Math.sin(time) * 75;
        camera.position.z = Math.cos(time) * 75;
        camera.position.y = 40;
        camera.lookAt(0, 0, 0);
    }

    if (gameStarted && player) {
        updateDangerTimer();
        updatePlayer();
        updateCarsAndBots();
        updateAIDinos();

        const visScale = calculateVisualScale(playerScale);
        // KAMERA 20 KAT UZAKLAŞTIRILDI
        const targetCamY = player.position.y + (76 * visScale); // 3.8 * 20 = 76
        const targetCamZ = player.position.z - (116 * visScale); // 5.8 * 20 = 116

        camera.position.x = THREE.MathUtils.lerp(camera.position.x, player.position.x, 0.08);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.08);
        camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCamZ, 0.08);
        camera.lookAt(player.position.x, player.position.y + (10 * visScale), player.position.z); // 0.5 * 20 = 10
    }

    renderer.render(scene, camera);
}

window.onload = init;