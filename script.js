import * as THREE from "three";
import {
	initSupabase,
	submitScore,
	getTopScores,
	getPlayerBest,
	getWeeklyScores
} from "./supabase.js";

// --- CONFIG ---
const CONFIG = {
	laneWidth: 2.5,
	cameraOffset: { x: 0, y: 7, z: 10 },
	gravity: 0.015,
	jumpPower: 0.35,
	baseSpeed: 0.26,
	maxSpeed: 0.52,
	speedInc: 0.0001,
	floorLength: 400,
	fogNear: 32,
	fogFar: 100
};

// --- MILESTONES ---
const MILESTONES = [
	{ score: 100, label: "100m!" },
	{ score: 250, label: "250m!" },
	{ score: 500, label: "500m!" },
	{ score: 1000, label: "1KM!" },
	{ score: 2500, label: "2.5KM!" },
	{ score: 5000, label: "5KM!" },
	{ score: 10000, label: "10KM!" }
];

// --- UNLOCKABLE SKINS ---
const SKINS = [
	{ id: "default", name: "CLASSIC", color: 0x21f14f, cost: 0, unlockScore: 0 },
	{ id: "blue", name: "OCEAN", color: 0x4fc3f7, cost: 50, unlockScore: 100 },
	{ id: "gold", name: "GOLD", color: 0xffd700, cost: 100, unlockScore: 500 },
	{ id: "neon", name: "NEON", color: 0x76ff03, cost: 200, unlockScore: 1000 },
	{ id: "ruby", name: "RUBY", color: 0xff1744, cost: 300, unlockScore: 2500 },
	{ id: "cosmic", name: "COSMIC", color: 0xea80fc, cost: 500, unlockScore: 5000 }
];

// --- ACHIEVEMENTS ---
const ACHIEVEMENTS = [
	{ id: 0, name: "FIRST STEPS", desc: "Play your first game", icon: "🎮" },
	{ id: 1, name: "CENTURY", desc: "Score 100 points", icon: "💯" },
	{ id: 2, name: "GRAND", desc: "Score 1000 points", icon: "🌟" },
	{ id: 3, name: "COIN COLLECTOR", desc: "Collect 10 coins in one run", icon: "🪙" },
	{ id: 4, name: "COIN HOARDER", desc: "Collect 50 coins in one run", icon: "💰" },
	{ id: 5, name: "COMBO MASTER", desc: "Reach 3x combo", icon: "🔥" },
	{ id: 6, name: "DAREDEVIL", desc: "Get 5 near misses in one run", icon: "💀" },
	{ id: 7, name: "SURVIVOR", desc: "Survive a Speed Zone", icon: "⚡" },
	{ id: 8, name: "DEDICATED", desc: "7-day streak", icon: "📅" },
	{ id: 9, name: "FASHIONISTA", desc: "Buy a skin", icon: "👗" }
];

// --- PERFORMANCE: Geometry Cache & Helpers ---
let _cachedGeos = null;
let _frameNow = 0;

function getCachedGeos() {
	if (!_cachedGeos) {
		_cachedGeos = {
			unitBox: new THREE.BoxGeometry(1, 1, 1),
			rounded: new THREE.SphereGeometry(1, 12, 8),
			characterBody: new THREE.CapsuleGeometry(0.32, 0.25, 4, 8),
			particle: new THREE.BoxGeometry(0.08, 0.08, 0.08),
			coin: new THREE.OctahedronGeometry(0.35, 0),
			coinRing: new THREE.TorusGeometry(0.45, 0.04, 8, 16),
			trunk: new THREE.CylinderGeometry(0.2, 0.3, 1.5, 5),
			leaves: new THREE.DodecahedronGeometry(0.8),
			powerupSphere: new THREE.IcosahedronGeometry(0.4, 1),
			powerupRing: new THREE.TorusGeometry(0.55, 0.05, 8, 16),
			shieldSphere: new THREE.SphereGeometry(1.0, 12, 8),
			coneBand: new THREE.CylinderGeometry(0.152, 0.245, 0.2, 6),
			obstacleCone: new THREE.ConeGeometry(0.5, 1, 6),
			obstacleCube: new THREE.BoxGeometry(1, 1, 1),
			obstacleCylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
		};
	}
	return _cachedGeos;
}

function disposeMeshMaterials(obj) {
	const materials = new Set();
	obj.traverse(child => { if (child.material) materials.add(child.material); });
	materials.forEach(material => material.dispose());
}

// --- PLAYER IDENTITY ---
const STORAGE_KEY = "subway_hopper_username";
const STREAK_KEY = "subway_hopper_streak";
const COINS_BANK_KEY = "subway_hopper_bank";
const SKINS_UNLOCKED_KEY = "subway_hopper_skins";
const SELECTED_SKIN_KEY = "subway_hopper_skin_sel";
const ACHIEVEMENTS_KEY = "subway_hopper_achv";
const MUTE_KEY = "subway_hopper_mute";

function getSavedUsername() {
	return localStorage.getItem(STORAGE_KEY);
}

function saveUsername(name) {
	localStorage.setItem(STORAGE_KEY, name);
}

// --- PERSISTENCE HELPERS ---
function getStreakData() {
	try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { lastDate: null, count: 0 }; }
	catch(e) { return { lastDate: null, count: 0 }; }
}
function saveStreakData(d) { localStorage.setItem(STREAK_KEY, JSON.stringify(d)); }
function getCoinBank() { return parseInt(localStorage.getItem(COINS_BANK_KEY)) || 0; }
function saveCoinBank(n) { localStorage.setItem(COINS_BANK_KEY, String(n)); }
function getUnlockedSkins() {
	try { return JSON.parse(localStorage.getItem(SKINS_UNLOCKED_KEY)) || ["default"]; }
	catch(e) { return ["default"]; }
}
function saveUnlockedSkins(s) { localStorage.setItem(SKINS_UNLOCKED_KEY, JSON.stringify(s)); }
function getSelectedSkin() { return localStorage.getItem(SELECTED_SKIN_KEY) || "default"; }
function saveSelectedSkin(id) { localStorage.setItem(SELECTED_SKIN_KEY, id); }
function getAchievementBits() { return parseInt(localStorage.getItem(ACHIEVEMENTS_KEY)) || 0; }
function saveAchievementBits(b) { localStorage.setItem(ACHIEVEMENTS_KEY, String(b)); }
function hasAchievement(bf, id) { return (bf & (1 << id)) !== 0; }
function grantAchievement(id) {
	let bf = getAchievementBits();
	if (hasAchievement(bf, id)) return false;
	bf |= (1 << id);
	saveAchievementBits(bf);
	return true;
}

let currentUsername = null;

// =============================================
// SOUND SYSTEM (Web Audio API — No Files Needed)
// =============================================

let audioCtx = null;

function ensureAudio() {
	if (isMuted) return null;
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
		if (!ctx) return;
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
	comboTimer: 0,
	// New features
	nearMissCount: 0,
	nextMilestoneIdx: 0,
	lastThemeScore: 0,
	themeTransition: null,
	maxCombo: 0
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
	{ name: "Arcade", sky: 0xbfeaff, ground: 0x33344d, obstacle: 0xff408c, decor: 0x21f14f },
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
		if (shieldVisual) { player.remove(shieldVisual); shieldVisual.material.dispose(); }
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
				shieldVisual.material.dispose();
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
	if (state.comboCount > state.maxCombo) state.maxCombo = state.comboCount;
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
// NEAR MISS SYSTEM
// =============================================

function showNearMiss() {
	const el = document.getElementById("near-miss-flash");
	if (!el) return;
	el.classList.remove("hidden");
	el.style.animation = "none";
	el.offsetHeight;
	el.style.animation = "";
	setTimeout(() => el.classList.add("hidden"), 800);
}

// =============================================
// MILESTONE SYSTEM
// =============================================

function checkMilestones() {
	if (state.nextMilestoneIdx >= MILESTONES.length) return;
	const m = MILESTONES[state.nextMilestoneIdx];
	if (Math.floor(state.score) >= m.score) {
		state.nextMilestoneIdx++;
		showMilestone(m.label);
		if (player) spawnParticles(player.position.clone(), 0xffd700, 15, 1.5, 40);
		playTone(660, 0.15, "sine", 0.12);
		setTimeout(() => playTone(880, 0.15, "sine", 0.1), 100);
	}
}

function showMilestone(text) {
	const el = document.getElementById("milestone-banner");
	if (!el) return;
	el.textContent = text;
	el.classList.remove("hidden");
	el.style.animation = "none";
	el.offsetHeight;
	el.style.animation = "";
	setTimeout(() => el.classList.add("hidden"), 2000);
}

// =============================================
// THEME TRANSITION SYSTEM
// =============================================

function checkThemeTransition() {
	const interval = 500;
	const currentInterval = Math.floor(state.score / interval);
	const lastInterval = Math.floor(state.lastThemeScore / interval);

	if (currentInterval > lastInterval && !state.themeTransition) {
		state.lastThemeScore = state.score;
		const newTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
		if (newTheme.name !== state.theme.name) {
			state.themeTransition = {
				fromSky: scene.background.clone(),
				toSky: new THREE.Color(newTheme.sky),
				fromFog: scene.fog.color.clone(),
				toFog: new THREE.Color(newTheme.sky),
				progress: 0,
				newTheme: newTheme
			};
		}
	}

	if (state.themeTransition) {
		state.themeTransition.progress += 0.008;
		const t = state.themeTransition.progress;
		scene.background.copy(state.themeTransition.fromSky).lerp(state.themeTransition.toSky, t);
		scene.fog.color.copy(state.themeTransition.fromFog).lerp(state.themeTransition.toFog, t);
		if (t >= 1) {
			state.theme = state.themeTransition.newTheme;
			state.themeTransition = null;
		}
	}
}

// =============================================
// BACKGROUND MUSIC SYSTEM
// =============================================

let musicInterval = null;
let isMuted = false;
let musicBeat = 0;

const BASS_NOTES = [130.81, 130.81, 164.81, 146.83];
const ARP_NOTES = [523.25, 659.25, 783.99, 659.25, 523.25, 392.00, 523.25, 659.25];

function startMusic() {
	if (isMuted || musicInterval) return;
	musicBeat = 0;
	const beatMs = Math.floor(60000 / 140 / 2);
	musicInterval = setInterval(() => {
		if (!state.isPlaying || isMuted) { stopMusic(); return; }
		try {
			if (musicBeat % 4 === 0) {
				playTone(BASS_NOTES[(musicBeat / 4) % BASS_NOTES.length], 0.15, "triangle", 0.05);
			}
			playTone(ARP_NOTES[musicBeat % ARP_NOTES.length], 0.08, "square", 0.025);
			musicBeat++;
		} catch (e) { /* silent */ }
	}, beatMs);
}

function stopMusic() {
	if (musicInterval) { clearInterval(musicInterval); musicInterval = null; }
}

function toggleMute() {
	isMuted = !isMuted;
	localStorage.setItem(MUTE_KEY, isMuted ? "1" : "0");
	const btn = document.getElementById("mute-btn");
	if (btn) btn.textContent = isMuted ? "🔇" : "🔊";
	if (isMuted) stopMusic();
	else if (state.isPlaying) startMusic();
}

// =============================================
// DAILY STREAK SYSTEM
// =============================================

function checkDailyStreak() {
	const data = getStreakData();
	const today = new Date().toDateString();
	if (data.lastDate === today) return data.count;
	const yesterday = new Date(Date.now() - 86400000).toDateString();
	if (data.lastDate === yesterday) {
		data.count++;
	} else {
		data.count = 1;
	}
	data.lastDate = today;
	saveStreakData(data);
	const bonus = data.count * 5;
	saveCoinBank(getCoinBank() + bonus);
	return data.count;
}

function updateStreakDisplay() {
	const el = document.getElementById("streak-display");
	if (!el) return;
	const data = getStreakData();
	if (data.count > 1) {
		el.textContent = "🔥 " + data.count + "-DAY STREAK!";
		el.classList.remove("hidden");
	} else {
		el.classList.add("hidden");
	}
}

function updateBankDisplay() {
	const el = document.getElementById("bank-coins");
	if (el) el.textContent = getCoinBank();
}

// =============================================
// SKIN UNLOCK SYSTEM
// =============================================

function checkSkinUnlocks(score) {
	const unlocked = getUnlockedSkins();
	let changed = false;
	for (const skin of SKINS) {
		if (!unlocked.includes(skin.id) && score >= skin.unlockScore) {
			unlocked.push(skin.id);
			changed = true;
		}
	}
	if (changed) saveUnlockedSkins(unlocked);
}

// =============================================
// COIN SHOP
// =============================================

function openShop() {
	document.getElementById("shop-overlay").classList.remove("hidden");
	renderShop();
}

function closeShop() {
	document.getElementById("shop-overlay").classList.add("hidden");
}

function renderShop() {
	const grid = document.getElementById("skin-grid");
	const coinEl = document.getElementById("shop-coin-count");
	const bank = getCoinBank();
	if (coinEl) coinEl.textContent = bank;
	const unlocked = getUnlockedSkins();
	const selected = getSelectedSkin();
	grid.innerHTML = SKINS.map(function(skin) {
		const isUnlocked = unlocked.includes(skin.id);
		const isSelected = selected === skin.id;
		const canAfford = bank >= skin.cost;
		let label, cls;
		if (isSelected) { label = "✓ EQUIPPED"; cls = "skin-equipped"; }
		else if (isUnlocked) { label = "SELECT"; cls = "skin-unlocked"; }
		else if (canAfford) { label = "🪙 " + skin.cost; cls = "skin-buyable"; }
		else { label = "🔒 " + skin.cost; cls = "skin-locked"; }
		const hex = "#" + skin.color.toString(16).padStart(6, "0");
		return '<div class="skin-item ' + cls + '" data-skin="' + skin.id + '">' +
			'<div class="skin-color" style="background:' + hex + '"></div>' +
			'<div class="skin-name">' + skin.name + '</div>' +
			'<div class="skin-action">' + label + '</div></div>';
	}).join("");
	grid.querySelectorAll(".skin-item").forEach(function(el) {
		el.style.pointerEvents = "auto";
		el.addEventListener("click", function() {
			const skinId = el.dataset.skin;
			const skin = SKINS.find(function(s) { return s.id === skinId; });
			const ul = getUnlockedSkins();
			if (ul.includes(skinId)) {
				saveSelectedSkin(skinId);
			} else if (getCoinBank() >= skin.cost) {
				saveCoinBank(getCoinBank() - skin.cost);
				ul.push(skinId);
				saveUnlockedSkins(ul);
				saveSelectedSkin(skinId);
				grantAchievement(9);
			}
			renderShop();
			updateBankDisplay();
		});
	});
}

// =============================================
// ACHIEVEMENT SYSTEM
// =============================================

let achievementQueue = [];
let achievementShowing = false;

function checkAchievements() {
	const finalScore = Math.floor(state.score);
	if (grantAchievement(0)) showAchievementToast(ACHIEVEMENTS[0]);
	if (finalScore >= 100 && grantAchievement(1)) showAchievementToast(ACHIEVEMENTS[1]);
	if (finalScore >= 1000 && grantAchievement(2)) showAchievementToast(ACHIEVEMENTS[2]);
	if (state.coins >= 10 && grantAchievement(3)) showAchievementToast(ACHIEVEMENTS[3]);
	if (state.coins >= 50 && grantAchievement(4)) showAchievementToast(ACHIEVEMENTS[4]);
	if (state.maxCombo >= 3 && grantAchievement(5)) showAchievementToast(ACHIEVEMENTS[5]);
	if (state.nearMissCount >= 5 && grantAchievement(6)) showAchievementToast(ACHIEVEMENTS[6]);
	const streakData = getStreakData();
	if (streakData.count >= 7 && grantAchievement(8)) showAchievementToast(ACHIEVEMENTS[8]);
}

function showAchievementToast(achievement) {
	achievementQueue.push(achievement);
	if (!achievementShowing) processAchievementQueue();
}

function processAchievementQueue() {
	if (achievementQueue.length === 0) { achievementShowing = false; return; }
	achievementShowing = true;
	const a = achievementQueue.shift();
	const el = document.getElementById("achievement-toast");
	if (!el) return;
	el.innerHTML = a.icon + " <strong>" + a.name + "</strong><br><small>" + a.desc + "</small>";
	el.classList.remove("hidden");
	el.style.animation = "none";
	el.offsetHeight;
	el.style.animation = "";
	setTimeout(() => {
		el.classList.add("hidden");
		setTimeout(() => processAchievementQueue(), 300);
	}, 2500);
}

function openBadges() {
	document.getElementById("badges-overlay").classList.remove("hidden");
	renderBadges();
}

function closeBadges() {
	document.getElementById("badges-overlay").classList.add("hidden");
}

function renderBadges() {
	const grid = document.getElementById("badges-grid");
	const bf = getAchievementBits();
	grid.innerHTML = ACHIEVEMENTS.map(function(a) {
		const unlocked = hasAchievement(bf, a.id);
		return '<div class="badge-item ' + (unlocked ? "badge-unlocked" : "badge-locked") + '">' +
			'<div class="badge-icon-lg">' + (unlocked ? a.icon : "🔒") + '</div>' +
			'<div class="badge-name">' + a.name + '</div>' +
			'<div class="badge-desc">' + a.desc + '</div></div>';
	}).join("");
}

// =============================================
// WEEKLY LEADERBOARD
// =============================================

let currentLBTab = "all";

// =============================================
// SHARE SCORE
// =============================================

let shareInProgress = false;
let shareDialogReturnFocus = null;

function scoreShareData() {
	// Share the current deployment rather than a hard-coded, possibly stale host.
	const url = new URL(window.location.href);
	url.search = "";
	url.hash = "";
	const name = currentUsername || "A player";
	const text = `🏃 ${name} scored ${Math.floor(state.score)} points and collected ${state.coins} coins on Super Hopper! 🪙\nCan you beat it?`;
	return { title: "Super Hopper Score!", text, url: url.href };
}

async function shareScore() {
	if (shareInProgress) return;
	const data = scoreShareData();
	if (typeof navigator.share === "function") {
		shareInProgress = true;
		try {
			await navigator.share(data);
			return;
		} catch (error) {
			// Cancelling the system sheet is intentional, not a clipboard request.
			if (error.name === "AbortError") return;
		} finally {
			shareInProgress = false;
		}
	}
	openScoreShareDialog(data);
}

function openScoreShareDialog(data = scoreShareData()) {
	const overlay = document.getElementById("share-overlay");
	const text = `${data.text}\n${data.url}`;
	shareDialogReturnFocus = document.activeElement;
	document.getElementById("share-text").value = text;
	document.getElementById("share-status").textContent = "Copy your score or choose an app below.";
	document.getElementById("share-whatsapp").href = `https://wa.me/?text=${encodeURIComponent(text)}`;
	document.getElementById("share-x").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
	overlay.classList.remove("hidden");
	document.getElementById("copy-score-btn").focus();
}

function closeScoreShareDialog() {
	document.getElementById("share-overlay").classList.add("hidden");
	shareDialogReturnFocus?.focus();
}

async function copyScore() {
	const field = document.getElementById("share-text");
	const status = document.getElementById("share-status");
	try {
		if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
		await navigator.clipboard.writeText(field.value);
		status.textContent = "Score copied! Paste it into your favourite app.";
	} catch {
		// Embedded browsers may deny clipboard access and block window.prompt.
		// Keep a visible, selectable field as a reliable final fallback.
		field.focus();
		field.select();
		field.setSelectionRange(0, field.value.length);
		let copied = false;
		try { copied = document.execCommand("copy"); } catch { /* manual selection remains */ }
		status.textContent = copied ? "Score copied! Paste it into your favourite app." : "Your score is selected. Long-press or press Ctrl/Cmd+C to copy.";
	}
}

function initScoreShareHandlers() {
	const overlay = document.getElementById("share-overlay");
	document.getElementById("copy-score-btn").addEventListener("click", copyScore);
	document.getElementById("close-share-btn").addEventListener("click", closeScoreShareDialog);
	overlay.addEventListener("click", e => { if (e.target === overlay) closeScoreShareDialog(); });
	overlay.addEventListener("keydown", e => {
		if (e.key === "Escape") { e.preventDefault(); closeScoreShareDialog(); }
		if (e.key !== "Tab") return;
		const focusable = [...overlay.querySelectorAll("textarea,button,a[href]")];
		const first = focusable[0], last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
		else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
	});
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

async function openLeaderboard(tab) {
	if (typeof tab !== "string") tab = currentLBTab;
	currentLBTab = tab;
	uiLeaderboardOverlay.classList.remove("hidden");

	const tabAll = document.getElementById("lb-tab-all");
	const tabWeek = document.getElementById("lb-tab-week");
	if (tabAll) { tabAll.classList.toggle("lb-tab-active", tab === "all"); }
	if (tabWeek) { tabWeek.classList.toggle("lb-tab-active", tab === "week"); }

	elLeaderboardList.innerHTML = '<li class="lb-loading">LOADING...</li>';

	const scores = tab === "week" ? await getWeeklyScores(10) : await getTopScores(10);

	if (scores.length === 0) {
		elLeaderboardList.innerHTML = '<li class="lb-empty">' + (tab === "week" ? "NO SCORES THIS WEEK" : "NO SCORES YET — BE THE FIRST!") + '</li>';
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
	btnLeaderboard.addEventListener("click", () => openLeaderboard("all"));
	btnLeaderboardGO.addEventListener("click", () => openLeaderboard("all"));

	const tabAll = document.getElementById("lb-tab-all");
	const tabWeek = document.getElementById("lb-tab-week");
	if (tabAll) tabAll.addEventListener("click", () => openLeaderboard("all"));
	if (tabWeek) tabWeek.addEventListener("click", () => openLeaderboard("week"));

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
		150
	);
	camera.position.set(
		CONFIG.cameraOffset.x,
		CONFIG.cameraOffset.y,
		CONFIG.cameraOffset.z
	);
	camera.lookAt(0, 0, -5);

	// Renderer
	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouchDevice() ? 1.5 : 2));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = !isTouchDevice();
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

	initRunSettings();
	// UI Handlers
	document.getElementById("start-btn").addEventListener("click", startGame);
	document.getElementById("restart-btn").addEventListener("click", startGame);
	document.getElementById("home-btn").addEventListener("click", goHome);

	// Username & Leaderboard Handlers
	initUsernameHandlers();
	initLeaderboardHandlers();

	// Share button
	if (btnShare) btnShare.addEventListener("click", shareScore);
	initScoreShareHandlers();

	// Mute button
	const muteBtnInit = document.getElementById("mute-btn");
	if (muteBtnInit) {
		muteBtnInit.addEventListener("click", toggleMute);
		isMuted = localStorage.getItem(MUTE_KEY) === "1";
		muteBtnInit.textContent = isMuted ? "🔇" : "🔊";
	}

	// Shop & Badges buttons
	const shopBtnInit = document.getElementById("shop-btn");
	if (shopBtnInit) shopBtnInit.addEventListener("click", openShop);
	const closeShopInit = document.getElementById("close-shop-btn");
	if (closeShopInit) closeShopInit.addEventListener("click", closeShop);
	const shopOvl = document.getElementById("shop-overlay");
	if (shopOvl) shopOvl.addEventListener("click", (e) => {
		if (e.target === shopOvl) closeShop();
	});
	const badgesBtnInit = document.getElementById("badges-btn");
	if (badgesBtnInit) badgesBtnInit.addEventListener("click", openBadges);
	const closeBadgesInit = document.getElementById("close-badges-btn");
	if (closeBadgesInit) closeBadgesInit.addEventListener("click", closeBadges);
	const badgesOvl = document.getElementById("badges-overlay");
	if (badgesOvl) badgesOvl.addEventListener("click", (e) => {
		if (e.target === badgesOvl) closeBadges();
	});

	// Daily streak & displays
	checkDailyStreak();
	updateStreakDisplay();
	updateBankDisplay();

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

// Art is built from cached low-poly primitives; each skin keeps a stable silhouette.
function createPlayer() {
	if (player) { disposeOwnedObject(player); scene.remove(player); }
	const group = new THREE.Group();
	const skin = SKINS.find(s => s.id === getSelectedSkin()) || SKINS[0];
	const skinIndex = SKINS.indexOf(skin);
	const geo = getCachedGeos();
	const coat = new THREE.MeshStandardMaterial({ color: skin.color, roughness: 0.65, flatShading: true });
	const ink = new THREE.MeshStandardMaterial({ color: 0x202437, roughness: 0.8 });
	const cream = new THREE.MeshStandardMaterial({ color: 0xfff8e8, roughness: 0.8 });
	const accent = new THREE.MeshStandardMaterial({ color: skinIndex % 2 ? 0xffe448 : 0xff70b8, roughness: 0.65 });
	const eye = new THREE.MeshBasicMaterial({ color: 0x141827 });
	function part(geometry, material, x, y, z, sx = 1, sy = 1, sz = 1, parent = group) {
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(x, y, z);
		mesh.scale.set(sx, sy, sz);
		mesh.castShadow = true;
		parent.add(mesh);
		return mesh;
	}
	// Hoodie, oversized head, contrasting muzzle and expressive ears.
	part(geo.characterBody, coat, 0, 0.48, 0, 1, 1, 0.85);
	part(geo.rounded, coat, 0, 0.99, 0.03, 0.43, 0.38, 0.35);
	part(geo.rounded, cream, 0, 0.89, 0.3, 0.27, 0.16, 0.09);
	for (const side of [-1, 1]) {
		const pointed = skinIndex % 3 === 2;
		const ear = part(pointed ? geo.obstacleCone : geo.rounded, coat, side * 0.26, 1.39, 0.01, pointed ? 0.38 : 0.115, pointed ? 0.4 : skinIndex % 3 === 1 ? 0.14 : 0.29, pointed ? 0.3 : 0.1);
		ear.rotation.z = side * -0.2;
		part(geo.rounded, accent, side * 0.26, 1.4, 0.095, 0.055, pointed ? 0.1 : skinIndex % 3 === 1 ? 0.07 : 0.19, 0.025);
		part(geo.rounded, eye, side * 0.17, 1.035, 0.342, 0.052, 0.077, 0.025);
		part(geo.rounded, cream, side * 0.17 - 0.012, 1.065, 0.365, 0.017, 0.021, 0.01);
	}
	part(geo.rounded, eye, 0, 0.93, 0.4, 0.05, 0.035, 0.025);
	// A cross-body bag adds a contrasting detail at game scale.
	// Back seam and a small hoodie patch remain visible from the chase camera.
	part(geo.unitBox, cream, 0, 0.53, -0.28, 0.13, 0.16, 0.025);
	const strap = part(geo.unitBox, ink, 0, 0.49, 0.28, 0.09, 0.5, 0.035);
	strap.rotation.z = -0.55;
	part(geo.rounded, accent, 0.2, 0.37, 0.28, 0.16, 0.12, 0.08);
	const limbs = [];
	for (const side of [-1, 1]) {
		const arm = new THREE.Group();
		arm.position.set(side * 0.35, 0.65, 0);
		group.add(arm);
		part(geo.rounded, coat, side * 0.045, -0.14, 0, 0.1, 0.22, 0.11, arm);
		part(geo.rounded, cream, side * 0.045, -0.3, 0.01, 0.09, 0.085, 0.09, arm);
		const leg = new THREE.Group();
		leg.position.set(side * 0.18, 0.26, 0);
		group.add(leg);
		part(geo.rounded, ink, 0, -0.07, 0, 0.1, 0.16, 0.1, leg);
		part(geo.rounded, accent, 0, -0.2, 0.075, 0.14, 0.09, 0.23, leg);
		part(geo.unitBox, cream, 0, -0.25, 0.075, 0.25, 0.035, 0.34, leg);
		limbs.push({ arm, leg, side });
	}
	group.userData.limbs = limbs;
	// The track extends along negative Z; the camera follows from positive Z.
	group.rotation.y = Math.PI;
	scene.add(group);
	return group;
}

function animateCharacter() {
	if (!player.userData?.limbs) return;
	const stride = Math.sin(simulationTime * 0.022) * 0.65;
	for (const { arm, leg, side } of player.userData.limbs) {
		arm.rotation.x = state.isJumping ? -0.85 : stride * side;
		arm.rotation.z = side * (state.isJumping ? -0.35 : -0.08);
		leg.rotation.x = state.isJumping ? 0.4 : -stride * side;
	}
}

const OBSTACLES = [
	{ id: "barricade", width: 1.14, depth: 0.65, height: 0.96 },
	{ id: "cone", width: 0.86, depth: 0.86, height: 0.98 },
	{ id: "barrel", width: 0.86, depth: 0.86, height: 1.08 }
];

function createObstacleMesh(kind = Math.floor(Math.random() * OBSTACLES.length)) {
	const definition = OBSTACLES[kind];
	const group = new THREE.Group();
	const geo = getCachedGeos();
	const yellow = definition.id === "barricade" ? new THREE.MeshStandardMaterial({ color: 0xffd83f, roughness: 0.7 }) : null;
	const orange = new THREE.MeshStandardMaterial({ color: 0xff6540, roughness: 0.75 });
	const dark = new THREE.MeshStandardMaterial({ color: 0x25263b, roughness: 0.85 });
	const white = new THREE.MeshStandardMaterial({ color: 0xfff4da, roughness: 0.6 });
	function part(geometry, material, x, y, z, sx, sy, sz) {
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.set(x, y, z);
		mesh.scale.set(sx, sy, sz);
		mesh.castShadow = mesh.receiveShadow = true;
		group.add(mesh);
		return mesh;
	}
	if (definition.id === "barricade") {
		for (const side of [-1, 1]) {
			part(geo.unitBox, dark, side * 0.4, 0.06, 0, 0.3, 0.12, 0.65);
			part(geo.unitBox, white, side * 0.4, 0.43, 0, 0.1, 0.74, 0.12);
		}
		part(geo.unitBox, yellow, 0, 0.65, 0, 1.14, 0.4, 0.2);
		// Diagonal hazard bands are visible from both directions.
		for (const z of [-0.105, 0.105]) {
			for (const x of [-0.37, 0, 0.37]) {
				const stripe = part(geo.unitBox, dark, x, 0.65, z, 0.13, 0.37, 0.012);
				stripe.rotation.z = -0.38;
			}
		}
		part(geo.rounded, orange, 0, 0.9, 0, 0.085, 0.06, 0.085);
	} else if (definition.id === "cone") {
		part(geo.unitBox, dark, 0, 0.06, 0, 0.86, 0.12, 0.86);
		part(geo.obstacleCone, orange, 0, 0.55, 0, 0.76, 0.86, 0.76);
		// Separate tapered white band, lifted just outside the orange surface.
		part(geo.coneBand, white, 0, 0.56, 0, 1, 1, 1);
	} else {
		part(geo.obstacleCylinder, orange, 0, 0.54, 0, 0.82, 1.04, 0.82);
		for (const y of [0.08, 1.02]) part(geo.obstacleCylinder, dark, 0, y, 0, 0.86, 0.12, 0.86);
		for (const y of [0.35, 0.72]) part(geo.obstacleCylinder, white, 0, y, 0, 0.835, 0.14, 0.835);
		part(geo.obstacleCylinder, dark, 0, 1.065, 0, 0.16, 0.03, 0.16);
	}
	group.userData.hitbox = { halfWidth: definition.width / 2 + 0.28, halfDepth: definition.depth / 2 + 0.5, height: definition.height };
	group.userData.obstacleType = definition.id;
	return group;
}

function createDecorationMesh() {
	const geos = getCachedGeos();
	const group = new THREE.Group();
	const bark = new THREE.MeshStandardMaterial({ color: 0x655077, flatShading: true });
	const leaves = new THREE.MeshStandardMaterial({ color: state.theme.decor, flatShading: true });
	const planter = new THREE.Mesh(geos.unitBox, new THREE.MeshStandardMaterial({ color: 0xf6e7d7 }));
	planter.scale.set(1, 0.3, 1);
	planter.position.y = 0.15;
	group.add(planter);
	const trunk = new THREE.Mesh(geos.trunk, bark);
	trunk.position.y = 0.85;
	group.add(trunk);
	const canopy = new THREE.Mesh(geos.leaves, leaves);
	canopy.position.y = 1.9;
	canopy.scale.set(1, 1.3, 1);
	canopy.castShadow = true;
	group.add(canopy);
	return group;
}

// Instanced architecture keeps a colourful city to a handful of draw calls.
function createCityBackdrop() {
	const group = new THREE.Group();
	const box = getCachedGeos().unitBox;
	const buildings = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), 40);
	const windows = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: 0xffefb0 }), 160);
	const transform = new THREE.Object3D();
	const palette = [0x9283cc, 0x70b9d2, 0xffae9e, 0xa3d6be, 0xc5a8e2];
	let index = 0, windowIndex = 0;
	for (const side of [-1, 1]) {
		for (let row = 0; row < 20; row++) {
			const height = 3.5 + (row * 7 % 11) * 0.8;
			const x = side * (12 + row % 3 * 4);
			const z = 8 - row * 5;
			transform.position.set(x, height / 2, z);
			transform.rotation.set(0, 0, 0);
			transform.scale.set(3, height, 3.5);
			transform.updateMatrix();
			buildings.setMatrixAt(index, transform.matrix);
			buildings.setColorAt(index++, new THREE.Color(palette[row % palette.length]));
			for (let w = 0; w < 4; w++) {
				transform.position.set(x - side * 1.52, 1.2 + w * (height - 1.7) / 4, z);
				transform.scale.set(0.035, 0.45, 1.75);
				transform.updateMatrix();
				windows.setMatrixAt(windowIndex++, transform.matrix);
			}
		}
	}
	group.add(buildings, windows);
	// Warm horizon sun and cloud puffs, set behind the playable corridor.
	const sun = new THREE.Mesh(new THREE.CircleGeometry(6, 32), new THREE.MeshBasicMaterial({ color: 0xffdf75, fog: false }));
	sun.position.set(14, 20, -83);
	group.add(sun);
	const clouds = new THREE.InstancedMesh(getCachedGeos().rounded, new THREE.MeshBasicMaterial({ color: 0xf8fbff }), 9);
	for (let i = 0; i < 9; i++) {
		transform.position.set((i % 3 - 1) * 22 + (i % 2) * 4, 16 + i % 3 * 3, -65 - Math.floor(i / 3) * 5);
		transform.scale.set(5, 1.1, 1.4);
		transform.updateMatrix();
		clouds.setMatrixAt(i, transform.matrix);
	}
	group.add(clouds);
	scene.add(group);
	floorGroups.push(group);
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

function spawnRow(zStart = -60) {

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
		obs.position.set(lane * CONFIG.laneWidth, 0, zStart);
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
		theme: THEMES[0],
		hasShield: false,
		hasMagnet: false,
		has2x: false,
		shieldTimer: 0,
		magnetTimer: 0,
		multiplierTimer: 0,
		comboCount: 0,
		comboTimer: 0,
		nearMissCount: 0,
		nextMilestoneIdx: 0,
		lastThemeScore: 0,
		themeTransition: null,
		maxCombo: 0
	};

	powerupSpawnCounter = 0;
	spawnTimer = 0;
	dustTimer = 0;
	simulationTime = 0;
	jumpBuffer = 0;
	paused = false;
	deathTicks = 0;
	gesture = null;
	document.body.classList.add("running");
	document.getElementById("pause-screen").classList.add("hidden");
	document.getElementById("pause-btn").classList.remove("hidden");
	document.getElementById("pause-btn").textContent = "Ⅱ";
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

	// Hide new feature elements
	const nmEl = document.getElementById("near-miss-flash");
	const msEl = document.getElementById("milestone-banner");
	if (nmEl) nmEl.classList.add("hidden");
	if (msEl) msEl.classList.add("hidden");

	// Start background music
	startMusic();

	// Show username badge during gameplay
	if (currentUsername) {
		uiBadge.classList.remove("hidden");
	}

	// Environment Setup
	scene.background = new THREE.Color(state.theme.sky);
	scene.fog = new THREE.Fog(state.theme.sky, CONFIG.fogNear, CONFIG.fogFar);

	// Floor
	floorGroups.forEach((f) => { disposeOwnedObject(f); scene.remove(f); });
	floorGroups = [];

	const planeGeo = new THREE.PlaneGeometry(100, 200);
	const planeMat = new THREE.MeshStandardMaterial({
		color: state.theme.ground,
		roughness: 1,
		flatShading: true
	});
	const floor = new THREE.Mesh(planeGeo, planeMat);
	floor.rotation.x = -Math.PI / 2;
	floor.position.z = -50;
	floor.receiveShadow = true;
	scene.add(floor);
	floorGroups.push(floor);

	for (const side of [-1, 1]) {
		const verge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 200), new THREE.MeshStandardMaterial({ color: 0x8ccbc1 }));
		verge.position.set(side * 5.6, 0.04, -50);
		verge.receiveShadow = true;
		scene.add(verge);
		floorGroups.push(verge);
		const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.13, 200), new THREE.MeshStandardMaterial({ color: 0xffd85c }));
		rail.position.set(side * 3.85, 0.11, -50);
		scene.add(rail);
		floorGroups.push(rail);
	}
	const dashes = new THREE.InstancedMesh(getCachedGeos().unitBox, new THREE.MeshBasicMaterial({ color: 0xf9f1dc }), 56);
	const marker = new THREE.Object3D();
	let dash = 0;
	for (const x of [-1.25, 1.25]) {
		for (let i = 0; i < 28; i++) {
			marker.position.set(x, 0.012, 12 - i * 4);
			marker.scale.set(0.06, 0.015, 1.5);
			marker.updateMatrix();
			dashes.setMatrixAt(dash++, marker.matrix);
		}
	}
	dashes.userData.scrollingRoad = true;
	scene.add(dashes);
	floorGroups.push(dashes);

	createCityBackdrop();

	// Player
	player = createPlayer();
	player.position.set(0, 0, 0);

	// Clear Objects & Particles (dispose materials to free GPU memory)
	worldObjects.forEach((obj) => { disposeMeshMaterials(obj.mesh); scene.remove(obj.mesh); });
	worldObjects = [];
	particles.forEach((p) => { p.mesh.material.dispose(); scene.remove(p.mesh); });
	particles = [];

	for (let z = -22; z >= -60; z -= 15) spawnRow(z);

	// A single animation loop owns simulation, rendering and death effects.
	lastTime = performance.now();
	accumulator = 0;
	ensureLoop();
}

function goHome() {
	uiGameOver.classList.add("hidden");
	uiStart.classList.remove("hidden");
	updateBankDisplay();
	updateStreakDisplay();
}

function gameOver() {
	if (!state.isPlaying) return;
	state.isPlaying = false;
	deathTicks = 60;
	document.body.classList.remove("running");
	document.getElementById("pause-btn").classList.add("hidden");

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

	// Stop music
	stopMusic();

	// Save coins to bank and update display
	saveCoinBank(getCoinBank() + state.coins);
	updateBankDisplay();

	// Check for new skin unlocks
	checkSkinUnlocks(finalScore);

	// Check achievements
	checkAchievements();

}

// All controls use the same actions. A short jump buffer makes late landing taps count.
let jumpBuffer = 0;
let paused = false;
let gesture = null;
let swipeThreshold = Number(localStorage.getItem("hopper_sensitivity")) || 14;
function moveLane(direction) {
	if (state.isPlaying && !paused) state.lane = Math.max(-1, Math.min(1, state.lane + direction));
}
function requestJump() {
	if (state.isPlaying && !paused) jumpBuffer = 8;
}
function overlayOpen() {
	return [uiUsernameModal, uiLeaderboardOverlay, document.getElementById("shop-overlay"), document.getElementById("badges-overlay"), document.getElementById("share-overlay")]
		.some(el => !el.classList.contains("hidden"));
}
function handleInput(e) {
	if (e.target.closest("input, select, textarea") || overlayOpen()) return;
	if (e.target.closest("button") && ["Space", "Enter"].includes(e.code)) return;
	if (!["ArrowLeft", "ArrowRight", "ArrowUp", "Space", "Enter", "Escape", "KeyP", "KeyA", "KeyD", "KeyW"].includes(e.code)) return;
	e.preventDefault();
	if (e.repeat) return;
	if (e.code === "Escape" || e.code === "KeyP") { togglePause(); return; }
	if (!state.isPlaying) {
		if (e.code === "Space" || e.code === "Enter") startGame();
		return;
	}
	if (paused) return;
	if (["ArrowLeft", "KeyA"].includes(e.code)) moveLane(-1);
	else if (["ArrowRight", "KeyD"].includes(e.code)) moveLane(1);
	else requestJump();
}
function initTouchControls() {
	const el = document.getElementById("game-container");
	el.addEventListener("pointerdown", e => {
		if (!state.isPlaying || paused || !e.isPrimary) return;
		gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, used: false, started: performance.now() };
		el.setPointerCapture(e.pointerId);
	});
	el.addEventListener("pointermove", e => {
		if (!gesture || gesture.id !== e.pointerId || gesture.used || paused) return;
		const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
		if (Math.max(Math.abs(dx), Math.abs(dy)) < swipeThreshold) return;
		gesture.used = true;
		if (Math.abs(dx) > Math.abs(dy)) moveLane(Math.sign(dx));
		else if (dy < 0) requestJump();
	});
	el.addEventListener("pointerup", e => {
		if (!gesture || gesture.id !== e.pointerId) return;
		if (!gesture.used && performance.now() - gesture.started < 300) requestJump();
		gesture = null;
	});
	el.addEventListener("pointercancel", () => { gesture = null; });
	el.addEventListener("lostpointercapture", () => { gesture = null; });
}
function initMobileButtons() {
	for (const [id, action] of [["mobile-left", () => moveLane(-1)], ["mobile-right", () => moveLane(1)], ["mobile-jump", requestJump]]) {
		const btn = document.getElementById(id);
		btn.addEventListener("pointerdown", e => { e.preventDefault(); action(); });
		btn.addEventListener("click", e => { if (e.detail === 0) action(); });
	}
	if (isTouchDevice()) document.getElementById("mobile-controls").classList.remove("hidden");
}
function togglePause(force) {
	if (!state.isPlaying) return;
	paused = typeof force === "boolean" ? force : !paused;
	gesture = null;
	jumpBuffer = 0;
	document.getElementById("pause-screen").classList.toggle("hidden", !paused);
	document.getElementById("pause-btn").textContent = paused ? "▶" : "Ⅱ";
	lastTime = performance.now();
	accumulator = 0;
	if (paused) stopMusic(); else { startMusic(); ensureLoop(); }
}
function initRunSettings() {
	const sensitivity = document.getElementById("sensitivity");
	sensitivity.value = String(swipeThreshold);
	sensitivity.addEventListener("change", () => {
		swipeThreshold = Number(sensitivity.value);
		localStorage.setItem("hopper_sensitivity", String(swipeThreshold));
	});
	document.getElementById("pause-btn").addEventListener("click", () => togglePause());
	document.getElementById("resume-btn").addEventListener("click", () => togglePause(false));
	document.addEventListener("visibilitychange", () => { if (document.hidden) togglePause(true); });
	window.addEventListener("blur", () => togglePause(true));
}
function disposeOwnedObject(object) {
	const geometries = new Set(), materials = new Set();
	object.traverse(child => {
		if (child.isInstancedMesh) child.dispose();
		if (child.geometry) geometries.add(child.geometry);
		if (child.material) materials.add(child.material);
	});
	geometries.forEach(g => { if (!Object.values(getCachedGeos()).includes(g)) g.dispose(); });
	materials.forEach(m => m.dispose());
}

function isTouchDevice() {
	return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

let lastTime = 0, accumulator = 0, loopActive = false, deathTicks = 0, simulationTime = 0;
const STEP_MS = 1000 / 60;
function ensureLoop() {
	if (loopActive) return;
	loopActive = true;
	requestAnimationFrame(animate);
}
function animate(now) {
	accumulator += Math.min(100, Math.max(0, now - lastTime));
	lastTime = now;
	while (accumulator >= STEP_MS) {
		if (state.isPlaying && !paused) updateGame();
		else if (!state.isPlaying && deathTicks > 0) { updateParticles(); deathTicks--; }
		accumulator -= STEP_MS;
	}
	renderer.render(scene, camera);
	if ((state.isPlaying && !paused) || deathTicks > 0) requestAnimationFrame(animate);
	else loopActive = false;
}
function updateGame() {
	simulationTime += STEP_MS;
	_frameNow = simulationTime;
	if (jumpBuffer > 0) {
		jumpBuffer--;
		if (!state.isJumping) {
			state.isJumping = true;
			state.jumpVel = CONFIG.jumpPower;
			jumpBuffer = 0;
			sfxJump();
		}
	}
	// Update Score and Speed
	const scoreAdd = state.has2x ? state.speed * 2 : state.speed;
	state.score += scoreAdd;
	state.speed = Math.min(CONFIG.maxSpeed, state.speed + CONFIG.speedInc);
	const scoreText = String(Math.floor(state.score));
	if (elScore.textContent !== scoreText) elScore.textContent = scoreText;

	// Player Movement (Lane Lerp)
	const targetX = state.lane * CONFIG.laneWidth;
	state.currentLaneX += (targetX - state.currentLaneX) * 0.34;
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
	player.position.y = state.playerY + 0.05;

	// Player Rotation
	player.rotation.z = (targetX - state.currentLaneX) * -0.12;
	player.rotation.x = state.isJumping ? -0.2 : 0;
	animateCharacter();

	// Update power-up timers
	updatePowerupTimers();

	// Magnet effect
	magnetPull();

	// Combo timer
	updateCombo();

	// Milestones
	checkMilestones();

	// Theme transitions
	checkThemeTransition();

	// Running dust trail
	dustTimer++;
	if (dustTimer > 6 && !state.isJumping) {
		spawnDustTrail();
		dustTimer = 0;
	}

	// Move lane dashes without rebuilding geometry or instance matrices.
	for (const piece of floorGroups) {
		if (piece.userData.scrollingRoad) piece.position.z = (piece.position.z + state.speed * 2) % 4;
	}

	// Spawn World
	spawnTimer += state.speed;
	if (spawnTimer >= 7.5) {
		spawnRow();
		spawnTimer -= 7.5;
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
			const hitbox = obj.mesh.userData?.hitbox || { halfWidth: 0.8, halfDepth: 0.8, height: 0.95 };
			if (Math.abs(obj.mesh.position.z) < hitbox.halfDepth) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				// Match clearance to the new runner’s feet, rather than its visual origin.
				const feetClearObstacle = state.playerY + 0.05 >= hitbox.height;

				if (dx < hitbox.halfWidth && !feetClearObstacle) {
					if (state.hasShield) {
						// Shield absorbs the hit
						state.hasShield = false;
						state.shieldTimer = 0;
						if (shieldVisual) {
							player.remove(shieldVisual);
							shieldVisual.material.dispose();
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
						return;
					}
				}
			}
		}

		// Near miss detection
		if (obj.type === "obstacle" && !obj.nearMissChecked && obj.mesh.position.z > 1.0) {
			obj.nearMissChecked = true;
			const nmDx = Math.abs(player.position.x - obj.mesh.position.x);
			if (nmDx < 1.5 && nmDx >= (obj.mesh.userData?.hitbox?.halfWidth || 0.8)) {
				state.nearMissCount++;
				state.score += 25;
				showNearMiss();
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

}

// Start
init();