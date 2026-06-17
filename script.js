import * as THREE from "three";
import {
	initSupabase,
	submitScore,
	getTopScores,
	getPlayerBest
} from "./supabase.js";

// --- CONFIG ---
const CONFIG = {
	laneWidth: 2.5,
	cameraOffset: { x: 0, y: 7, z: 10 },
	gravity: 0.015,
	jumpPower: 0.35,
	baseSpeed: 0.2,
	speedInc: 0.0001,
	floorLength: 400,
	fogDensity: 0.02
};

// --- PLAYER IDENTITY ---
const STORAGE_KEY = "subway_hopper_username";

function getSavedUsername() {
	return localStorage.getItem(STORAGE_KEY);
}

function saveUsername(name) {
	localStorage.setItem(STORAGE_KEY, name);
}

let currentUsername = null;

// --- STATE ---
let state = {
	isPlaying: false,
	score: 0,
	coins: 0,
	speed: CONFIG.baseSpeed,
	lane: 0, // -1, 0, 1
	currentLaneX: 0,
	isJumping: false,
	jumpVel: 0,
	playerY: 0,
	theme: null
};

// --- DOM ELEMENTS ---
const elScore = document.getElementById("score");
const elScoreFinal = document.getElementById("final-score");
const uiScore = document.getElementById("score-display");
const uiStart = document.getElementById("start-screen");
const uiGameOver = document.getElementById("game-over-screen");

// Username Modal Elements
const uiUsernameModal = document.getElementById("username-modal");
const elUsernameInput = document.getElementById("username-input");
const elUsernameError = document.getElementById("username-error");
const btnSetName = document.getElementById("set-name-btn");
const btnPlayAnon = document.getElementById("play-anon-btn");

// Leaderboard Elements
const uiLeaderboardOverlay = document.getElementById("leaderboard-overlay");
const elLeaderboardList = document.getElementById("leaderboard-list");
const btnCloseLB = document.getElementById("close-lb-btn");
const btnLeaderboard = document.getElementById("leaderboard-btn");
const btnLeaderboardGO = document.getElementById("leaderboard-btn-go");

// Username Badge
const uiBadge = document.getElementById("username-badge");
const elBadgeName = document.getElementById("badge-name");

// Coin Display
const uiCoinDisplay = document.getElementById("coin-display");
const elCoins = document.getElementById("coins");
const elFinalCoins = document.getElementById("final-coins");

// Personal Best
const uiPersonalBest = document.getElementById("personal-best");
const elBestScore = document.getElementById("best-score");

// --- THREE.JS GLOBALS ---
let scene,
	camera,
	renderer,
	player,
	floorGroups = [];
let decorationMeshType, obstacleMeshType;

// --- THEMES ---
const THEMES = [
	{
		name: "Candy",
		sky: 0xffd1dc,
		ground: 0xfff0f5,
		obstacle: 0xff6b6b,
		decor: 0x98fb98
	},
	{
		name: "Neon",
		sky: 0x1a1a2e,
		ground: 0x16213e,
		obstacle: 0xe94560,
		decor: 0x0f3460
	},
	{
		name: "Sunset",
		sky: 0xff9a8b,
		ground: 0xff6a88,
		obstacle: 0x2c3e50,
		decor: 0xf9ca24
	},
	{
		name: "Mint",
		sky: 0xe0f7fa,
		ground: 0xffffff,
		obstacle: 0x009688,
		decor: 0x80cbc4
	},
	{
		name: "Midnight",
		sky: 0x000000,
		ground: 0x222222,
		obstacle: 0xffff00,
		decor: 0x444444
	}
];

// =============================================
// USERNAME MODAL LOGIC
// =============================================

function showUsernameModal() {
	uiUsernameModal.classList.remove("hidden");
	uiStart.classList.add("hidden");
	elUsernameInput.value = "";
	elUsernameError.textContent = "";
	elUsernameInput.focus();
}

function hideUsernameModal() {
	uiUsernameModal.classList.add("hidden");
	uiStart.classList.remove("hidden");
}

function setPlayerName(name) {
	currentUsername = name;
	saveUsername(name);
	updateBadgeName();
	hideUsernameModal();
}

function updateBadgeName() {
	if (currentUsername) {
		elBadgeName.textContent = currentUsername;
	}
}

function initUsernameHandlers() {
	btnSetName.addEventListener("click", () => {
		const raw = elUsernameInput.value.trim();
		if (raw.length < 2) {
			elUsernameError.textContent = "NAME MUST BE AT LEAST 2 CHARACTERS";
			return;
		}
		if (raw.length > 16) {
			elUsernameError.textContent = "NAME MUST BE 16 CHARACTERS OR LESS";
			return;
		}
		// Sanitize: only allow alphanumeric, spaces, underscores, dashes
		const sanitized = raw.replace(/[^a-zA-Z0-9 _\-]/g, "");
		if (sanitized.length < 2) {
			elUsernameError.textContent = "USE ONLY LETTERS, NUMBERS, SPACES";
			return;
		}
		setPlayerName(sanitized);
	});

	btnPlayAnon.addEventListener("click", () => {
		// Generate a unique anonymous tag
		const tag = Math.floor(1000 + Math.random() * 9000);
		setPlayerName(`Anonymous#${tag}`);
	});

	// Allow Enter key to submit name
	elUsernameInput.addEventListener("keydown", (e) => {
		if (e.code === "Enter") {
			btnSetName.click();
		}
	});
}

// =============================================
// LEADERBOARD LOGIC
// =============================================

async function openLeaderboard() {
	uiLeaderboardOverlay.classList.remove("hidden");
	elLeaderboardList.innerHTML = '<li class="lb-loading">LOADING...</li>';

	const scores = await getTopScores(10);

	if (scores.length === 0) {
		elLeaderboardList.innerHTML = '<li class="lb-empty">NO SCORES YET — BE THE FIRST!</li>';
		return;
	}

	const rankIcons = ["🥇", "🥈", "🥉"];
	elLeaderboardList.innerHTML = scores
		.map((entry, i) => {
			const rank = rankIcons[i] || `${i + 1}`;
			return `<li>
				<span class="lb-rank">${rank}</span>
				<span class="lb-name">${escapeHTML(entry.username)}</span>
				<span class="lb-score">${entry.score.toLocaleString()}</span>
			</li>`;
		})
		.join("");
}

function closeLeaderboard() {
	uiLeaderboardOverlay.classList.add("hidden");
}

function escapeHTML(str) {
	const div = document.createElement("div");
	div.textContent = str;
	return div.innerHTML;
}

function initLeaderboardHandlers() {
	btnCloseLB.addEventListener("click", closeLeaderboard);
	btnLeaderboard.addEventListener("click", openLeaderboard);
	btnLeaderboardGO.addEventListener("click", openLeaderboard);

	// Close on overlay background click
	uiLeaderboardOverlay.addEventListener("click", (e) => {
		if (e.target === uiLeaderboardOverlay) closeLeaderboard();
	});
}

// =============================================
// SCORE SUBMISSION
// =============================================

async function handleScoreSubmission(finalScore) {
	if (!currentUsername || finalScore < 1) return;

	// Submit score (fire and forget — non-blocking)
	submitScore(currentUsername, finalScore);

	// Show personal best
	const best = await getPlayerBest(currentUsername);
	if (best !== null) {
		elBestScore.textContent = best.toLocaleString();
		uiPersonalBest.classList.remove("hidden");
	} else {
		uiPersonalBest.classList.add("hidden");
	}
}

// --- INIT ---
function init() {
	// Initialize Supabase
	initSupabase();

	// Scene
	scene = new THREE.Scene();

	// Camera
	camera = new THREE.PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		0.1,
		100
	);
	camera.position.set(
		CONFIG.cameraOffset.x,
		CONFIG.cameraOffset.y,
		CONFIG.cameraOffset.z
	);
	camera.lookAt(0, 0, -5);

	// Renderer
	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	document.getElementById("game-container").appendChild(renderer.domElement);

	// Lights
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambientLight);

	const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
	dirLight.position.set(10, 20, 10);
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.width = 1024;
	dirLight.shadow.mapSize.height = 1024;
	scene.add(dirLight);

	// Initial Render
	renderer.render(scene, camera);

	// Resize Handler
	window.addEventListener("resize", onWindowResize, false);

	// Input Handler
	document.addEventListener("keydown", handleInput);

	// Touch Swipe Handler
	initTouchControls();

	// On-screen Mobile Buttons
	initMobileButtons();

	// UI Handlers
	document.getElementById("start-btn").addEventListener("click", startGame);
	document.getElementById("restart-btn").addEventListener("click", startGame);

	// Username & Leaderboard Handlers
	initUsernameHandlers();
	initLeaderboardHandlers();

	// Check if user already has a saved username
	const saved = getSavedUsername();
	if (saved) {
		currentUsername = saved;
		updateBadgeName();
		// Show start screen normally
	} else {
		// First visit — show username modal
		showUsernameModal();
	}
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- GAME LOGIC ---

function randomTheme() {
	return THEMES[Math.floor(Math.random() * THEMES.length)];
}

function createPlayer() {
	if (player) scene.remove(player);

	const group = new THREE.Group();

	// Random Animal Features
	const animalColors = [0xffffff, 0xaaaaaa, 0xffcc99, 0x333333];
	const color = animalColors[Math.floor(Math.random() * animalColors.length)];

	// Material
	const mat = new THREE.MeshStandardMaterial({
		color: color,
		flatShading: true
	});

	// Body
	const bodyGeo = new THREE.BoxGeometry(1, 1, 1);
	const body = new THREE.Mesh(bodyGeo, mat);
	body.position.y = 0.5;
	body.castShadow = true;
	group.add(body);

	// Eyes
	const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
	const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);

	const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
	leftEye.position.set(-0.25, 0.6, 0.5);
	group.add(leftEye);

	const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
	rightEye.position.set(0.25, 0.6, 0.5);
	group.add(rightEye);

	// Ears (Random Shape)
	const earType = Math.floor(Math.random() * 3);
	const earGeo =
		earType === 0
			? new THREE.BoxGeometry(0.2, 0.5, 0.2) // Long (Bunny)
			: earType === 1
				? new THREE.BoxGeometry(0.3, 0.3, 0.1) // Roundish (Bear)
				: new THREE.ConeGeometry(0.2, 0.4, 4); // Pointy (Cat)

	const leftEar = new THREE.Mesh(earGeo, mat);
	leftEar.position.set(-0.3, 1.1, 0);
	if (earType !== 2) leftEar.castShadow = true;
	group.add(leftEar);

	const rightEar = new THREE.Mesh(earGeo, mat);
	rightEar.position.set(0.3, 1.1, 0);
	if (earType !== 2) rightEar.castShadow = true;
	group.add(rightEar);

	scene.add(group);
	return group;
}

function createObstacleMesh() {
	// Randomize obstacle shape per game
	const type = Math.floor(Math.random() * 3);
	const geo =
		type === 0
			? new THREE.ConeGeometry(0.5, 1, 6) // Spike
			: type === 1
				? new THREE.BoxGeometry(1, 1, 1) // Cube
				: new THREE.CylinderGeometry(0.5, 0.5, 1, 6); // Barrel

	const mat = new THREE.MeshStandardMaterial({
		color: state.theme.obstacle,
		flatShading: true
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	return mesh;
}

function createDecorationMesh() {
	// Trees or Pillars
	const group = new THREE.Group();
	const trunkMat = new THREE.MeshStandardMaterial({
		color: 0x5d4037,
		flatShading: true
	});
	const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.5, 5);
	const trunk = new THREE.Mesh(trunkGeo, trunkMat);
	trunk.position.y = 0.75;
	trunk.castShadow = true;
	group.add(trunk);

	const leavesMat = new THREE.MeshStandardMaterial({
		color: state.theme.decor,
		flatShading: true
	});
	const leavesGeo = new THREE.DodecahedronGeometry(0.8);
	const leaves = new THREE.Mesh(leavesGeo, leavesMat);
	leaves.position.y = 1.8;
	leaves.castShadow = true;
	group.add(leaves);

	return group;
}

function createCoinMesh() {
	const group = new THREE.Group();

	// Golden spinning coin — octahedron for a gem-like look
	const coinGeo = new THREE.OctahedronGeometry(0.35, 0);
	const coinMat = new THREE.MeshStandardMaterial({
		color: 0xffd700,
		emissive: 0xffaa00,
		emissiveIntensity: 0.3,
		flatShading: true,
		metalness: 0.8,
		roughness: 0.2
	});
	const coin = new THREE.Mesh(coinGeo, coinMat);
	coin.castShadow = true;
	group.add(coin);

	// Small glow ring around the coin
	const ringGeo = new THREE.TorusGeometry(0.45, 0.04, 8, 16);
	const ringMat = new THREE.MeshBasicMaterial({
		color: 0xffd700,
		transparent: true,
		opacity: 0.4
	});
	const ring = new THREE.Mesh(ringGeo, ringMat);
	group.add(ring);

	return group;
}

function generateWorldChunk(zPos) {
	// Create a row (chunk)
	// We recycle logic here: simpler to just managing list of objects
	// But for performance in JS, let's keep it simple: List of objects with Z > -50
}

// SIMPLIFIED APPROACH:
// We will have a loop that spawns rows at regular Z intervals ahead of the player?
// No, player is static at Z=0. Objects move towards player (+Z).
// Spawner is at Z = -80.
// Removal at Z = 10.

let worldObjects = [];
let spawnTimer = 0;
let lastObstacleLane = -99;

function spawnRow() {
	// Spawn row at far Z (-60)
	const zStart = -60;

	// Ground segment (Visual only, to give speed feeling if striped, or just endless plane)
	// To make it feel fast, we can use a grid helper or moving stripes.
	// Let's spawn "Décor" on sides always.

	// Left Decor
	if (Math.random() > 0.3) {
		const dL = createDecorationMesh(); // Clone?
		// Optimization: clone geometry
		// For this simple game, recreating is fine or simple helpers.
		dL.position.set(-5 - Math.random() * 5, 0, zStart);
		scene.add(dL);
		worldObjects.push({ mesh: dL, type: "decor" });
	}

	// Right Decor
	if (Math.random() > 0.3) {
		const dR = createDecorationMesh();
		dR.position.set(5 + Math.random() * 5, 0, zStart);
		scene.add(dR);
		worldObjects.push({ mesh: dR, type: "decor" });
	}

	// Obstacle Logic
	// Chance to spawn obstacle
	let obstacleLane = null;
	if (Math.random() > 0.3) {
		// 70% chance of obstacle
		let lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
		obstacleLane = lane;

		const obs = createObstacleMesh();
		obs.position.set(lane * CONFIG.laneWidth, 0.5, zStart);
		scene.add(obs);
		worldObjects.push({ mesh: obs, type: "obstacle", lane: lane, passed: false });
	}

	// Coin Logic — 40% chance, never on same lane as obstacle in this row
	if (Math.random() > 0.6) {
		let coinLane = Math.floor(Math.random() * 3) - 1;
		// Avoid placing coin on top of obstacle
		if (coinLane === obstacleLane) {
			coinLane = coinLane === 1 ? -1 : coinLane + 1;
		}
		const coinMesh = createCoinMesh();
		coinMesh.position.set(coinLane * CONFIG.laneWidth, 1.0, zStart);
		scene.add(coinMesh);
		worldObjects.push({ mesh: coinMesh, type: "coin", lane: coinLane });
	}
}

function startGame() {
	if (state.isPlaying) return;

	// Reset State
	state = {
		isPlaying: true,
		score: 0,
		coins: 0,
		speed: CONFIG.baseSpeed,
		lane: 0,
		currentLaneX: 0,
		isJumping: false,
		jumpVel: 0,
		playerY: 0,
		theme: randomTheme()
	};

	// UI
	uiStart.classList.add("hidden");
	uiGameOver.classList.add("hidden");
	uiScore.classList.remove("hidden");
	uiPersonalBest.classList.add("hidden");
	elScore.innerText = "0";

	// Coin display
	uiCoinDisplay.classList.remove("hidden");
	elCoins.innerText = "0";

	// Show username badge during gameplay
	if (currentUsername) {
		uiBadge.classList.remove("hidden");
	}

	// Environment Setup
	scene.background = new THREE.Color(state.theme.sky);
	scene.fog = new THREE.Fog(state.theme.sky, 10, 50);

	// Floor
	// Remove old floor if any
	floorGroups.forEach((f) => scene.remove(f));
	floorGroups = [];

	// Add Infinite Floor Plane
	const planeGeo = new THREE.PlaneGeometry(100, 200);
	const planeMat = new THREE.MeshStandardMaterial({
		color: state.theme.ground,
		roughness: 1,
		shading: THREE.FlatShading
	});
	const floor = new THREE.Mesh(planeGeo, planeMat);
	floor.rotation.x = -Math.PI / 2;
	floor.position.z = -50;
	floor.receiveShadow = true;
	scene.add(floor);
	floorGroups.push(floor);

	// Grid Helper for speed sensation
	const grid = new THREE.GridHelper(200, 100, 0xffffff, 0xffffff);
	grid.position.y = 0.01;
	grid.position.z = -50;
	grid.material.opacity = 0.1;
	grid.material.transparent = true;
	scene.add(grid);
	floorGroups.push(grid);

	// Player
	player = createPlayer();
	player.position.set(0, 0, 0);

	// Clear Objects
	worldObjects.forEach((obj) => scene.remove(obj.mesh));
	worldObjects = [];

	// Loop
	lastTime = Date.now();
	animate();
}

function gameOver() {
	state.isPlaying = false;
	uiGameOver.classList.remove("hidden");
	uiScore.classList.add("hidden");
	uiCoinDisplay.classList.add("hidden");
	uiBadge.classList.add("hidden");

	const finalScore = Math.floor(state.score);
	elScoreFinal.innerText = finalScore;
	elFinalCoins.innerText = state.coins;

	// Submit score to Supabase and show personal best
	handleScoreSubmission(finalScore);
}

function handleInput(e) {
	if (!state.isPlaying) {
		if (e.code === "Space" || e.code === "Enter") startGame(); // Optional helper
		return;
	}

	if (e.code === "ArrowLeft") {
		if (state.lane > -1) state.lane--;
	} else if (e.code === "ArrowRight") {
		if (state.lane < 1) state.lane++;
	} else if (e.code === "ArrowUp") {
		if (!state.isJumping) {
			state.isJumping = true;
			state.jumpVel = CONFIG.jumpPower;
		}
	}
}

// --- TOUCH / SWIPE CONTROLS ---
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 30; // minimum px distance for a swipe
const SWIPE_TIME_LIMIT = 400; // max ms for a valid swipe

function initTouchControls() {
	const el = document.getElementById("game-container");

	el.addEventListener("touchstart", (e) => {
		const touch = e.touches[0];
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchStartTime = Date.now();
	}, { passive: true });

	el.addEventListener("touchend", (e) => {
		const touch = e.changedTouches[0];
		const dx = touch.clientX - touchStartX;
		const dy = touch.clientY - touchStartY;
		const dt = Date.now() - touchStartTime;

		// Only register swipes within time limit
		if (dt > SWIPE_TIME_LIMIT) return;

		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		// Must exceed threshold
		if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
			// Tap — treat as jump
			if (state.isPlaying && !state.isJumping) {
				state.isJumping = true;
				state.jumpVel = CONFIG.jumpPower;
			}
			return;
		}

		if (!state.isPlaying) return;

		if (absDx > absDy) {
			// Horizontal swipe
			if (dx < 0 && state.lane > -1) {
				state.lane--;
			} else if (dx > 0 && state.lane < 1) {
				state.lane++;
			}
		} else {
			// Vertical swipe
			if (dy < 0 && !state.isJumping) {
				// Swipe up = jump
				state.isJumping = true;
				state.jumpVel = CONFIG.jumpPower;
			}
		}
	}, { passive: true });

	// Prevent scrolling / pull-to-refresh while playing
	document.addEventListener("touchmove", (e) => {
		if (state.isPlaying) {
			e.preventDefault();
		}
	}, { passive: false });
}

// --- ON-SCREEN MOBILE BUTTONS ---
function initMobileButtons() {
	const leftBtn = document.getElementById("mobile-left");
	const rightBtn = document.getElementById("mobile-right");
	const jumpBtn = document.getElementById("mobile-jump");

	if (!leftBtn || !rightBtn || !jumpBtn) return;

	const addMobileEvent = (btn, action) => {
		btn.addEventListener("touchstart", (e) => {
			e.preventDefault();
			e.stopPropagation();
			action();
		}, { passive: false });
		// Also support click for desktop testing
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			action();
		});
	};

	addMobileEvent(leftBtn, () => {
		if (state.isPlaying && state.lane > -1) state.lane--;
	});

	addMobileEvent(rightBtn, () => {
		if (state.isPlaying && state.lane < 1) state.lane++;
	});

	addMobileEvent(jumpBtn, () => {
		if (state.isPlaying && !state.isJumping) {
			state.isJumping = true;
			state.jumpVel = CONFIG.jumpPower;
		}
	});

	// Show mobile controls on touch devices
	const mobileControls = document.getElementById("mobile-controls");
	if (mobileControls && isTouchDevice()) {
		mobileControls.classList.remove("hidden");
	}
}

function isTouchDevice() {
	return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

let lastTime = 0;

function animate() {
	if (!state.isPlaying) return;

	requestAnimationFrame(animate);

	// Delta Time? simplified fixed step kinda
	// const now = Date.now();
	// const dt = (now - lastTime) / 1000;
	// lastTime = now;

	// Update Score and Speed
	state.score += state.speed;
	state.speed += CONFIG.speedInc;
	elScore.innerText = Math.floor(state.score);

	// Player Movement (Lane Lerp)
	const targetX = state.lane * CONFIG.laneWidth;
	state.currentLaneX += (targetX - state.currentLaneX) * 0.15; // Smooth slide
	player.position.x = state.currentLaneX;

	// Player Jump Physics
	if (state.isJumping) {
		state.playerY += state.jumpVel;
		state.jumpVel -= CONFIG.gravity;
		if (state.playerY <= 0) {
			state.playerY = 0;
			state.isJumping = false;
		}
	} else {
		// Run Bounce
		state.playerY = Math.abs(Math.sin(Date.now() * 0.015)) * 0.1;
	}
	player.position.y = state.playerY + 0.5; // +0.5 is visual center offset

	// Player Rotation (Tilt into turn)
	player.rotation.z = (state.currentLaneX - player.position.x) * -0.1;
	player.rotation.x = state.isJumping ? -0.2 : 0; // Lean forward jump

	// Spawn World
	spawnTimer += state.speed;
	if (spawnTimer > 3) {
		// Distance between rows
		spawnRow();
		spawnTimer = 0;
	}

	// Move World Objects
	for (let i = worldObjects.length - 1; i >= 0; i--) {
		const obj = worldObjects[i];
		obj.mesh.position.z += state.speed * 2; // Move towards camera

		// Spin coins
		if (obj.type === "coin") {
			obj.mesh.rotation.y += 0.06;
			// Gentle float bobbing
			obj.mesh.position.y = 1.0 + Math.sin(Date.now() * 0.005 + obj.mesh.position.x) * 0.15;
		}

		// Collision Detection
		if (obj.type === "obstacle") {
			// Z Check
			if (obj.mesh.position.z > -0.8 && obj.mesh.position.z < 0.8) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				const dy = Math.abs(player.position.y - obj.mesh.position.y);

				if (dx < 0.8 && dy < 0.8) {
					gameOver();
				}
			}
		}

		// Coin Collection
		if (obj.type === "coin") {
			if (obj.mesh.position.z > -1.0 && obj.mesh.position.z < 1.0) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				// More forgiving Y hitbox for coins (player can collect while jumping)
				if (dx < 1.0) {
					// Collect!
					state.coins++;
					state.score += 10; // Bonus score per coin
					elCoins.innerText = state.coins;

					// Pop animation on coin counter
					uiCoinDisplay.classList.add("coin-pop");
					setTimeout(() => uiCoinDisplay.classList.remove("coin-pop"), 150);

					// Remove coin from scene
					scene.remove(obj.mesh);
					worldObjects.splice(i, 1);
					continue;
				}
			}
		}

		// Cleanup
		if (obj.mesh.position.z > 10) {
			scene.remove(obj.mesh);
			worldObjects.splice(i, 1);
		}
	}

	renderer.render(scene, camera);
}

// Start
init();