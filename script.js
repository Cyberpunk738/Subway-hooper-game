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

// --- PERFORMANCE: Geometry Cache & Helpers ---
let _cachedGeos = null;
let _frameNow = 0;

function getCachedGeos() {
	if (!_cachedGeos) {
		_cachedGeos = {
			particle: new THREE.BoxGeometry(0.08, 0.08, 0.08),
			coin: new THREE.OctahedronGeometry(0.35, 0),
			coinRing: new THREE.TorusGeometry(0.45, 0.04, 8, 16),
			trunk: new THREE.CylinderGeometry(0.2, 0.3, 1.5, 5),
			leaves: new THREE.DodecahedronGeometry(0.8),
			powerupSphere: new THREE.IcosahedronGeometry(0.4, 1),
			powerupRing: new THREE.TorusGeometry(0.55, 0.05, 8, 16),
			shieldSphere: new THREE.SphereGeometry(1.0, 12, 8),
			obstacleCone: new THREE.ConeGeometry(0.5, 1, 6),
			obstacleCube: new THREE.BoxGeometry(1, 1, 1),
			obstacleCylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
		};
	}
	return _cachedGeos;
}

function disposeMeshMaterials(obj) {
	if (obj.isMesh && obj.material) {
		obj.material.dispose();
	}
	if (obj.children) {
		for (const child of obj.children) {
			disposeMeshMaterials(child);
		}
	}
}

// --- PLAYER IDENTITY ---
const STORAGE_KEY = "subway_hopper_username";

function getSavedUsername() {
	return localStorage.getItem(STORAGE_KEY);
}

function saveUsername(name) {
	localStorage.setItem(STORAGE_KEY, name);
}

let currentUsername = null;

// =============================================
// SOUND SYSTEM (Web Audio API — No Files Needed)
// =============================================

let audioCtx = null;

function ensureAudio() {
	if (!audioCtx) {
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
	}
	if (audioCtx.state === "suspended") {
		audioCtx.resume();
	}
	return audioCtx;
}

function playTone(freq, duration, type = "square", volume = 0.15) {
	try {
		const ctx = ensureAudio();
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, ctx.currentTime);
		gain.gain.setValueAtTime(volume, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
		osc.connect(gain);
		gain.connect(ctx.destination);
		osc.start(ctx.currentTime);
		osc.stop(ctx.currentTime + duration);
	} catch (e) { /* silent fail */ }
}

function sfxJump() {
	playTone(400, 0.12, "square", 0.1);
	setTimeout(() => playTone(600, 0.1, "square", 0.08), 50);
}

function sfxCoin() {
	playTone(880, 0.08, "sine", 0.12);
	setTimeout(() => playTone(1200, 0.12, "sine", 0.1), 60);
}

function sfxCrash() {
	playTone(120, 0.3, "sawtooth", 0.2);
	playTone(80, 0.5, "sawtooth", 0.15);
}

function sfxPowerup() {
	playTone(523, 0.1, "sine", 0.12);
	setTimeout(() => playTone(659, 0.1, "sine", 0.12), 80);
	setTimeout(() => playTone(784, 0.15, "sine", 0.12), 160);
}

function sfxShieldBreak() {
	playTone(300, 0.15, "triangle", 0.15);
	setTimeout(() => playTone(200, 0.2, "triangle", 0.1), 100);
}

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
	theme: null,
	// Power-up state
	hasShield: false,
	hasMagnet: false,
	has2x: false,
	shieldTimer: 0,
	magnetTimer: 0,
	multiplierTimer: 0,
	// Combo
	comboCount: 0,
	comboTimer: 0
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

// Power-up HUD
const uiPowerups = document.getElementById("powerup-display");

// Combo Display
const uiCombo = document.getElementById("combo-display");

// Share Button
const btnShare = document.getElementById("share-btn");

// --- THREE.JS GLOBALS ---
let scene,
	camera,
	renderer,
	player,
	floorGroups = [];
let decorationMeshType, obstacleMeshType;
let shieldVisual = null; // Shield bubble around player

// --- PARTICLE SYSTEM ---
let particles = [];

function spawnParticles(position, color, count = 8, spread = 0.5, life = 30) {
	for (let i = 0; i < count; i++) {
		const geo = getCachedGeos().particle;
		const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0 });
		const mesh = new THREE.Mesh(geo, mat);
		mesh.position.set(
			position.x + (Math.random() - 0.5) * spread,
			position.y + (Math.random() - 0.5) * spread,
			position.z + (Math.random() - 0.5) * spread
		);
		const vel = new THREE.Vector3(
			(Math.random() - 0.5) * 0.15,
			Math.random() * 0.12 + 0.05,
			(Math.random() - 0.5) * 0.1
		);
		scene.add(mesh);
		particles.push({ mesh, vel, life, maxLife: life });
	}
}

function updateParticles() {
	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.mesh.position.add(p.vel);
		p.vel.y -= 0.003; // gravity
		p.life--;
		p.mesh.material.opacity = p.life / p.maxLife;
		p.mesh.scale.setScalar(p.life / p.maxLife);
		if (p.life <= 0) {
			p.mesh.material.dispose();
			scene.remove(p.mesh);
			particles.splice(i, 1);
		}
	}
}

// Running dust trail (spawns periodically)
let dustTimer = 0;
function spawnDustTrail() {
	if (!player) return;
	const pos = player.position.clone();
	pos.y = 0.1;
	pos.z += 0.5;
	spawnParticles(pos, 0xcccccc, 1, 0.3, 10);
}

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
// POWER-UP DEFINITIONS
// =============================================
const POWERUP_TYPES = [
	{ id: "shield", label: "🛡️", color: 0x4fc3f7, duration: 500 },
	{ id: "magnet", label: "🧲", color: 0xff4081, duration: 400 },
	{ id: "x2",     label: "×2", color: 0x76ff03, duration: 350 }
];

function createPowerupMesh(type) {
	const group = new THREE.Group();

	// Glowing sphere
	const sphereGeo = getCachedGeos().powerupSphere;
	const sphereMat = new THREE.MeshStandardMaterial({
		color: type.color,
		emissive: type.color,
		emissiveIntensity: 0.6,
		transparent: true,
		opacity: 0.85,
		flatShading: true
	});
	const sphere = new THREE.Mesh(sphereGeo, sphereMat);
	sphere.castShadow = true;
	group.add(sphere);

	// Outer ring
	const ringGeo = getCachedGeos().powerupRing;
	const ringMat = new THREE.MeshBasicMaterial({
		color: type.color,
		transparent: true,
		opacity: 0.5
	});
	const ring = new THREE.Mesh(ringGeo, ringMat);
	group.add(ring);

	return group;
}

function activatePowerup(typeId) {
	sfxPowerup();

	if (typeId === "shield") {
		state.hasShield = true;
		state.shieldTimer = POWERUP_TYPES[0].duration;
		// Create shield visual
		if (shieldVisual) scene.remove(shieldVisual);
		const shieldGeo = getCachedGeos().shieldSphere;
		const shieldMat = new THREE.MeshBasicMaterial({
			color: 0x4fc3f7,
			transparent: true,
			opacity: 0.2,
			wireframe: true
		});
		shieldVisual = new THREE.Mesh(shieldGeo, shieldMat);
		player.add(shieldVisual);
		shieldVisual.position.set(0, 0.5, 0);
	} else if (typeId === "magnet") {
		state.hasMagnet = true;
		state.magnetTimer = POWERUP_TYPES[1].duration;
	} else if (typeId === "x2") {
		state.has2x = true;
		state.multiplierTimer = POWERUP_TYPES[2].duration;
	}

	updatePowerupHUD();
}

function updatePowerupTimers() {
	let hudDirty = false;
	if (state.hasShield) {
		state.shieldTimer--;
		if (state.shieldTimer <= 0) {
			state.hasShield = false;
			hudDirty = true;
			if (shieldVisual) {
				player.remove(shieldVisual);
				shieldVisual = null;
			}
		}
	}
	if (state.hasMagnet) {
		state.magnetTimer--;
		if (state.magnetTimer <= 0) { state.hasMagnet = false; hudDirty = true; }
	}
	if (state.has2x) {
		state.multiplierTimer--;
		if (state.multiplierTimer <= 0) { state.has2x = false; hudDirty = true; }
	}
	if (hudDirty) updatePowerupHUD();
}

function updatePowerupHUD() {
	if (!uiPowerups) return;
	let html = "";
	if (state.hasShield) html += `<span class="pu-icon pu-shield">🛡️</span>`;
	if (state.hasMagnet) html += `<span class="pu-icon pu-magnet">🧲</span>`;
	if (state.has2x) html += `<span class="pu-icon pu-x2">×2</span>`;
	uiPowerups.innerHTML = html;
	if (html) {
		uiPowerups.classList.remove("hidden");
	} else {
		uiPowerups.classList.add("hidden");
	}
}

// Magnet: attract nearby coins toward player
function magnetPull() {
	if (!state.hasMagnet || !player) return;
	for (const obj of worldObjects) {
		if (obj.type !== "coin") continue;
		const dist = Math.abs(obj.mesh.position.x - player.position.x);
		const zDist = Math.abs(obj.mesh.position.z - player.position.z);
		if (dist < 4.0 && zDist < 5.0) {
			// Pull coin toward player X
			obj.mesh.position.x += (player.position.x - obj.mesh.position.x) * 0.12;
		}
	}
}

// =============================================
// COMBO SYSTEM
// =============================================

function registerCoinCombo() {
	state.comboCount++;
	state.comboTimer = 90; // frames (~1.5 sec window)
	updateComboDisplay();
}

function updateCombo() {
	if (state.comboTimer > 0) {
		state.comboTimer--;
		if (state.comboTimer <= 0) {
			state.comboCount = 0;
			updateComboDisplay();
		}
	}
}

function getComboMultiplier() {
	if (state.comboCount >= 8) return 4;
	if (state.comboCount >= 5) return 3;
	if (state.comboCount >= 3) return 2;
	return 1;
}

function updateComboDisplay() {
	if (!uiCombo) return;
	const mult = getComboMultiplier();
	if (mult > 1) {
		uiCombo.textContent = `COMBO x${mult}`;
		uiCombo.classList.remove("hidden");
		uiCombo.classList.add("combo-pop");
		setTimeout(() => uiCombo.classList.remove("combo-pop"), 200);
	} else {
		uiCombo.classList.add("hidden");
	}
}

// =============================================
// SHARE SCORE
// =============================================

async function shareScore() {
	const score = elScoreFinal.innerText;
	const coins = elFinalCoins.innerText;
	const name = currentUsername || "A player";
	const text = `🏃 ${name} scored ${score} points and collected ${coins} coins on Super Hopper! 🪙\nCan you beat it? 🔗\nhttps://subway-hooper-game.vercel.app`;

	// Try Web Share API first (mobile)
	if (navigator.share) {
		try {
			await navigator.share({ title: "Super Hopper Score!", text });
			return;
		} catch (e) { /* user cancelled or unsupported */ }
	}

	// Fallback: copy to clipboard
	try {
		await navigator.clipboard.writeText(text);
		if (btnShare) {
			const orig = btnShare.textContent;
			btnShare.textContent = "✅ COPIED!";
			setTimeout(() => { btnShare.textContent = orig; }, 1500);
		}
	} catch (e) {
		// Last resort
		prompt("Copy your score:", text);
	}
}

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
	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	document.getElementById("game-container").appendChild(renderer.domElement);

	// Lights
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambientLight);

	const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
	dirLight.position.set(10, 20, 10);
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.width = 512;
	dirLight.shadow.mapSize.height = 512;
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

	// Share button
	if (btnShare) btnShare.addEventListener("click", shareScore);

	// Unlock audio on first user interaction
	const unlockAudio = () => {
		ensureAudio();
		document.removeEventListener("click", unlockAudio);
		document.removeEventListener("touchstart", unlockAudio);
	};
	document.addEventListener("click", unlockAudio);
	document.addEventListener("touchstart", unlockAudio);

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
	// Randomize obstacle shape (cached geometries)
	const geos = getCachedGeos();
	const type = Math.floor(Math.random() * 3);
	const geo = type === 0 ? geos.obstacleCone : type === 1 ? geos.obstacleCube : geos.obstacleCylinder;

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
	// Trees or Pillars (cached geometries)
	const geos = getCachedGeos();
	const group = new THREE.Group();
	const trunkMat = new THREE.MeshStandardMaterial({
		color: 0x5d4037,
		flatShading: true
	});
	const trunk = new THREE.Mesh(geos.trunk, trunkMat);
	trunk.position.y = 0.75;
	trunk.castShadow = true;
	group.add(trunk);

	const leavesMat = new THREE.MeshStandardMaterial({
		color: state.theme.decor,
		flatShading: true
	});
	const leaves = new THREE.Mesh(geos.leaves, leavesMat);
	leaves.position.y = 1.8;
	leaves.castShadow = true;
	group.add(leaves);

	return group;
}

function createCoinMesh() {
	const geos = getCachedGeos();
	const group = new THREE.Group();

	// Golden spinning coin (cached geometry)
	const coinMat = new THREE.MeshStandardMaterial({
		color: 0xffd700,
		emissive: 0xffaa00,
		emissiveIntensity: 0.3,
		flatShading: true,
		metalness: 0.8,
		roughness: 0.2
	});
	const coin = new THREE.Mesh(geos.coin, coinMat);
	coin.castShadow = true;
	group.add(coin);

	// Small glow ring (cached geometry)
	const ringMat = new THREE.MeshBasicMaterial({
		color: 0xffd700,
		transparent: true,
		opacity: 0.4
	});
	const ring = new THREE.Mesh(geos.coinRing, ringMat);
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
let powerupSpawnCounter = 0;

function spawnRow() {
	// Spawn row at far Z (-60)
	const zStart = -60;

	// Left Decor
	if (Math.random() > 0.3) {
		const dL = createDecorationMesh();
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
	let obstacleLane = null;
	if (Math.random() > 0.3) {
		let lane = Math.floor(Math.random() * 3) - 1;
		obstacleLane = lane;

		const obs = createObstacleMesh();
		obs.position.set(lane * CONFIG.laneWidth, 0.5, zStart);
		scene.add(obs);
		worldObjects.push({ mesh: obs, type: "obstacle", lane: lane, passed: false });
	}

	// Coin Logic — 40% chance, never on same lane as obstacle
	if (Math.random() > 0.6) {
		let coinLane = Math.floor(Math.random() * 3) - 1;
		if (coinLane === obstacleLane) {
			coinLane = coinLane === 1 ? -1 : coinLane + 1;
		}
		const coinMesh = createCoinMesh();
		coinMesh.position.set(coinLane * CONFIG.laneWidth, 1.0, zStart);
		scene.add(coinMesh);
		worldObjects.push({ mesh: coinMesh, type: "coin", lane: coinLane });
	}

	// Power-up Logic — spawn every ~25 rows, random type
	powerupSpawnCounter++;
	if (powerupSpawnCounter >= 25 && Math.random() > 0.5) {
		powerupSpawnCounter = 0;
		let puLane = Math.floor(Math.random() * 3) - 1;
		if (puLane === obstacleLane) {
			puLane = puLane === 1 ? -1 : puLane + 1;
		}
		const puType = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
		const puMesh = createPowerupMesh(puType);
		puMesh.position.set(puLane * CONFIG.laneWidth, 1.2, zStart);
		scene.add(puMesh);
		worldObjects.push({ mesh: puMesh, type: "powerup", powerupType: puType, lane: puLane });
	}
}

function startGame() {
	if (state.isPlaying) return;

	// Unlock audio context on game start
	ensureAudio();

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
		theme: randomTheme(),
		hasShield: false,
		hasMagnet: false,
		has2x: false,
		shieldTimer: 0,
		magnetTimer: 0,
		multiplierTimer: 0,
		comboCount: 0,
		comboTimer: 0
	};

	powerupSpawnCounter = 0;
	shieldVisual = null;

	// UI
	uiStart.classList.add("hidden");
	uiGameOver.classList.add("hidden");
	uiScore.classList.remove("hidden");
	uiPersonalBest.classList.add("hidden");
	elScore.innerText = "0";

	// Coin display
	uiCoinDisplay.classList.remove("hidden");
	elCoins.innerText = "0";

	// Power-up HUD
	if (uiPowerups) { uiPowerups.innerHTML = ""; uiPowerups.classList.add("hidden"); }
	if (uiCombo) uiCombo.classList.add("hidden");

	// Show username badge during gameplay
	if (currentUsername) {
		uiBadge.classList.remove("hidden");
	}

	// Environment Setup
	scene.background = new THREE.Color(state.theme.sky);
	scene.fog = new THREE.Fog(state.theme.sky, 10, 50);

	// Floor
	floorGroups.forEach((f) => scene.remove(f));
	floorGroups = [];

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

	const grid = new THREE.GridHelper(200, 50, 0xffffff, 0xffffff);
	grid.position.y = 0.01;
	grid.position.z = -50;
	grid.material.opacity = 0.1;
	grid.material.transparent = true;
	scene.add(grid);
	floorGroups.push(grid);

	// Player
	player = createPlayer();
	player.position.set(0, 0, 0);

	// Clear Objects & Particles (dispose materials to free GPU memory)
	worldObjects.forEach((obj) => { disposeMeshMaterials(obj.mesh); scene.remove(obj.mesh); });
	worldObjects = [];
	particles.forEach((p) => { p.mesh.material.dispose(); scene.remove(p.mesh); });
	particles = [];

	// Loop
	lastTime = Date.now();
	animate();
}

function gameOver() {
	state.isPlaying = false;

	sfxCrash();

	// Death explosion particles
	if (player) {
		spawnParticles(player.position.clone(), 0xff4444, 20, 1.0, 40);
		spawnParticles(player.position.clone(), 0xffaa00, 12, 0.8, 35);
	}

	uiGameOver.classList.remove("hidden");
	uiScore.classList.add("hidden");
	uiCoinDisplay.classList.add("hidden");
	uiBadge.classList.add("hidden");
	if (uiPowerups) uiPowerups.classList.add("hidden");
	if (uiCombo) uiCombo.classList.add("hidden");

	const finalScore = Math.floor(state.score);
	elScoreFinal.innerText = finalScore;
	elFinalCoins.innerText = state.coins;

	// Show share button
	if (btnShare) btnShare.classList.remove("hidden");

	// Submit score to Supabase and show personal best
	handleScoreSubmission(finalScore);

	// Keep rendering briefly for death particles
	let deathFrames = 0;
	function deathAnim() {
		if (deathFrames > 60) return;
		deathFrames++;
		updateParticles();
		renderer.render(scene, camera);
		requestAnimationFrame(deathAnim);
	}
	deathAnim();
}

function handleInput(e) {
	if (!state.isPlaying) {
		if (e.code === "Space" || e.code === "Enter") startGame();
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
			sfxJump();
		}
	}
}

// --- TOUCH / SWIPE CONTROLS ---
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_THRESHOLD = 30;
const SWIPE_TIME_LIMIT = 400;

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

		if (dt > SWIPE_TIME_LIMIT) return;

		const absDx = Math.abs(dx);
		const absDy = Math.abs(dy);

		if (absDx < SWIPE_THRESHOLD && absDy < SWIPE_THRESHOLD) {
			if (state.isPlaying && !state.isJumping) {
				state.isJumping = true;
				state.jumpVel = CONFIG.jumpPower;
				sfxJump();
			}
			return;
		}

		if (!state.isPlaying) return;

		if (absDx > absDy) {
			if (dx < 0 && state.lane > -1) {
				state.lane--;
			} else if (dx > 0 && state.lane < 1) {
				state.lane++;
			}
		} else {
			if (dy < 0 && !state.isJumping) {
				state.isJumping = true;
				state.jumpVel = CONFIG.jumpPower;
				sfxJump();
			}
		}
	}, { passive: true });

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
			sfxJump();
		}
	});

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

	_frameNow = Date.now();

	// Update Score and Speed
	const scoreAdd = state.has2x ? state.speed * 2 : state.speed;
	state.score += scoreAdd;
	state.speed += CONFIG.speedInc;
	elScore.innerText = Math.floor(state.score);

	// Player Movement (Lane Lerp)
	const targetX = state.lane * CONFIG.laneWidth;
	state.currentLaneX += (targetX - state.currentLaneX) * 0.15;
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
		state.playerY = Math.abs(Math.sin(_frameNow * 0.015)) * 0.1;
	}
	player.position.y = state.playerY + 0.5;

	// Player Rotation
	player.rotation.z = (state.currentLaneX - player.position.x) * -0.1;
	player.rotation.x = state.isJumping ? -0.2 : 0;

	// Update power-up timers
	updatePowerupTimers();

	// Magnet effect
	magnetPull();

	// Combo timer
	updateCombo();

	// Running dust trail
	dustTimer++;
	if (dustTimer > 6 && !state.isJumping) {
		spawnDustTrail();
		dustTimer = 0;
	}

	// Spawn World
	spawnTimer += state.speed;
	if (spawnTimer > 3) {
		spawnRow();
		spawnTimer = 0;
	}

	// Move World Objects
	for (let i = worldObjects.length - 1; i >= 0; i--) {
		const obj = worldObjects[i];
		obj.mesh.position.z += state.speed * 2;

		// Spin coins & powerups
		if (obj.type === "coin") {
			obj.mesh.rotation.y += 0.06;
			obj.mesh.position.y = 1.0 + Math.sin(_frameNow * 0.005 + obj.mesh.position.x) * 0.15;
		}
		if (obj.type === "powerup") {
			obj.mesh.rotation.y += 0.04;
			obj.mesh.position.y = 1.2 + Math.sin(_frameNow * 0.004 + obj.mesh.position.x * 2) * 0.2;
		}

		// Collision Detection — Obstacles
		if (obj.type === "obstacle") {
			if (obj.mesh.position.z > -0.8 && obj.mesh.position.z < 0.8) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				const dy = Math.abs(player.position.y - obj.mesh.position.y);

				if (dx < 0.8 && dy < 0.8) {
					if (state.hasShield) {
						// Shield absorbs the hit
						state.hasShield = false;
						state.shieldTimer = 0;
						if (shieldVisual) {
							player.remove(shieldVisual);
							shieldVisual = null;
						}
						sfxShieldBreak();
						spawnParticles(obj.mesh.position.clone(), 0x4fc3f7, 10, 0.8, 25);
						// Remove obstacle
						disposeMeshMaterials(obj.mesh);
						scene.remove(obj.mesh);
						worldObjects.splice(i, 1);
						updatePowerupHUD();
						continue;
					} else {
						gameOver();
					}
				}
			}
		}

		// Coin Collection
		if (obj.type === "coin") {
			if (obj.mesh.position.z > -1.0 && obj.mesh.position.z < 1.0) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				if (dx < 1.0) {
					// Collect!
					const comboMult = getComboMultiplier();
					const coinValue = 10 * comboMult * (state.has2x ? 2 : 1);
					state.coins++;
					state.score += coinValue;
					elCoins.innerText = state.coins;

					sfxCoin();
					registerCoinCombo();

					// Sparkle particles
					spawnParticles(obj.mesh.position.clone(), 0xffd700, 6, 0.4, 20);

					// Pop animation on coin counter
					uiCoinDisplay.classList.add("coin-pop");
					setTimeout(() => uiCoinDisplay.classList.remove("coin-pop"), 150);

					disposeMeshMaterials(obj.mesh);
					scene.remove(obj.mesh);
					worldObjects.splice(i, 1);
					continue;
				}
			}
		}

		// Power-up Collection
		if (obj.type === "powerup") {
			if (obj.mesh.position.z > -1.0 && obj.mesh.position.z < 1.0) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				if (dx < 1.0) {
					activatePowerup(obj.powerupType.id);
					spawnParticles(obj.mesh.position.clone(), obj.powerupType.color, 10, 0.6, 25);
					disposeMeshMaterials(obj.mesh);
					scene.remove(obj.mesh);
					worldObjects.splice(i, 1);
					continue;
				}
			}
		}

		// Cleanup
		if (obj.mesh.position.z > 10) {
			disposeMeshMaterials(obj.mesh);
			scene.remove(obj.mesh);
			worldObjects.splice(i, 1);
		}
	}

	// Update particles
	updateParticles();

	renderer.render(scene, camera);
}

// Start
init();