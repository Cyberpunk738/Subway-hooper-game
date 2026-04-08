# 🚇 Subway Super Hopper

**🎮 A 3D endless-runner browser game built with Three.js and vanilla JavaScript.**

Players control a randomly generated animal character that sprints down an infinite lane-based corridor, dodging procedurally spawned obstacles while the world accelerates around them.

---

## 📑 Table of Contents

- [🛠️ Tech Stack](#-tech-stack)
- [📁 Project Structure](#-project-structure)
- [🏗️ Architecture Overview](#️-architecture-overview)
- [⚙️ Core Systems](#️-core-systems)
  - [🔄 Game Loop](#-game-loop)
  - [🐾 Player Controller](#-player-controller)
  - [🌍 World Generation](#-world-generation)
  - [💥 Collision Detection](#-collision-detection)
  - [🎨 Theme Engine](#-theme-engine)
- [📐 Configuration Reference](#-configuration-reference)
- [🎮 Controls](#-controls)
- [🚀 Getting Started](#-getting-started)
- [🌐 Browser Compatibility](#-browser-compatibility)
- [📄 License](#-license)

---

## 🛠️ Tech Stack

| Layer         | Technology                                                                 |
|---------------|---------------------------------------------------------------------------|
| **🖥️ Rendering** | [Three.js v0.160.0](https://threejs.org/) via ES Module import map (CDN) |
| **📜 Language**  | Vanilla JavaScript (ES Modules)                                          |
| **📄 Markup**    | HTML5                                                                     |
| **🎨 Styling**   | Vanilla CSS with CSS Custom Properties                                   |
| **🔤 Typography**| [VT323](https://fonts.google.com/specimen/VT323) — Google Fonts (retro pixel font) |

> **⚡ Zero build tools.** No bundler, no transpiler, no `node_modules`. Open `index.html` in a browser and play.

---

## 📁 Project Structure

```
Subway Super Hopper Game/
├── index.html      # Entry point — DOM structure, import map, script loading
├── script.js       # Game engine — all Three.js rendering, physics, and game logic
├── style.css       # UI layer styles — HUD, menus, overlays
└── README.md       # This file
```

### 📊 File Breakdown

| File         | Size   | Lines | Responsibility                                                                |
|--------------|--------|-------|-------------------------------------------------------------------------------|
| `index.html` | ~1.3 KB | 49   | Semantic HTML shell, UI screens (start / game-over), Three.js import map     |
| `script.js`  | ~12 KB  | 487  | Scene init, player creation, obstacle/decoration spawning, physics, game loop |
| `style.css`  | ~2.2 KB | 133  | Glassmorphism overlays, retro button styling, HUD score display               |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        index.html                           │
│  ┌──────────────┐  ┌────────────────────────────────────┐   │
│  │  #ui-layer   │  │  #game-container                   │   │
│  │  (CSS HUD)   │  │  (Three.js WebGL Canvas)           │   │
│  │              │  │                                    │   │
│  │  Start Screen│  │  ┌──────────────────────────────┐  │   │
│  │  Score HUD   │  │  │  THREE.Scene                 │  │   │
│  │  Game Over   │  │  │  ├── PerspectiveCamera       │  │   │
│  │              │  │  │  ├── AmbientLight            │  │   │
│  │              │  │  │  ├── DirectionalLight (shadow)│  │   │
│  │              │  │  │  ├── Floor Plane + GridHelper │  │   │
│  │              │  │  │  ├── Player (Group)           │  │   │
│  │              │  │  │  ├── Obstacles[] (Mesh)       │  │   │
│  │              │  │  │  └── Decorations[] (Group)    │  │   │
│  │              │  │  └──────────────────────────────┘  │   │
│  └──────────────┘  └────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

The game uses a **static-camera, world-scrolling** pattern:

- 🧍 The **player** remains at world Z = 0 and moves only along the X-axis (lane switching) and Y-axis (jumping).
- 🚧 **Obstacles and decorations** spawn at Z = −60 and scroll toward the camera at Z = +10, at which point they are culled from the scene and the `worldObjects` array.

---

## ⚙️ Core Systems

### 🔄 Game Loop

The main loop runs via `requestAnimationFrame` and executes the following pipeline each frame:

```
animate()
  ├── Update score += speed
  ├── Increment speed += CONFIG.speedInc       // progressive difficulty
  ├── Lerp player X toward target lane          // smooth lane transitions
  ├── Apply jump physics (velocity + gravity)   // or run-bounce sine wave
  ├── Spawn row if spawnTimer threshold met
  ├── Move all worldObjects along +Z
  ├── Collision check (AABB-style)
  ├── Cull objects past Z > 10
  └── renderer.render(scene, camera)
```

> **Note:** The game uses a simplified fixed-step approach rather than delta-time normalization.

### 🐾 Player Controller

The player is a `THREE.Group` composed of procedurally generated low-poly meshes:

| Part    | Geometry                                      | Randomization                                   |
|---------|-----------------------------------------------|--------------------------------------------------|
| Body    | `BoxGeometry(1, 1, 1)`                        | Color chosen from 4 animal tones                |
| Eyes    | `BoxGeometry(0.15, 0.15, 0.05)` × 2          | Fixed black, positioned on face                 |
| Ears    | `BoxGeometry` / `ConeGeometry` × 2            | 3 ear types: Bunny (tall), Bear (round), Cat (pointy) |

**Movement model:**

- ↔️ **Lane switching:** 3 lanes (−1, 0, +1), each offset by `CONFIG.laneWidth` (2.5 units). Position lerps at 15% per frame for smooth sliding.
- ⬆️ **Jump:** Applies an initial upward velocity (`CONFIG.jumpPower = 0.35`), decremented each frame by `CONFIG.gravity` (0.015). Grounded when Y ≤ 0.
- 🏃 **Run bounce:** When grounded, a subtle sine-wave bounce (`Math.abs(Math.sin(Date.now() * 0.015)) * 0.1`) gives a lively idle animation.
- 🔀 **Tilt:** Slight Z-rotation during lane changes; forward lean (X-rotation) during jumps.

### 🌍 World Generation

Objects are spawned in **rows** by the `spawnRow()` function, triggered when `spawnTimer` exceeds a threshold of 3:

| Object Type       | Spawn Position           | Probability   | Details                                                                 |
|-------------------|--------------------------|---------------|-------------------------------------------------------------------------|
| 🌳 Decoration     | X: ±5 to ±10, Z: −60    | ~70% per side | Tree meshes (cylinder trunk + dodecahedron canopy), themed color      |
| 🚧 Obstacle        | X: lane × 2.5, Z: −60   | ~70%          | Random shape per game: Cone (spike), Box (cube), or Cylinder (barrel)  |

All spawned objects are tracked in the `worldObjects[]` array and move at `speed × 2` units per frame along the +Z axis.

### 💥 Collision Detection

Uses a simplified **AABB proximity check**:

```
Z range:  obstacle.z ∈ (-0.8, +0.8)   // near the player
X check:  |player.x − obstacle.x| < 0.8
Y check:  |player.y − obstacle.y| < 0.8  // allows jumping over
```

A collision triggers `gameOver()`, which halts the animation loop and displays the final score overlay.

### 🎨 Theme Engine

Each game session randomly selects one of **5 color themes**, applied to the scene background, fog, floor, obstacles, and decorations:

| Theme          | Sky       | Ground    | Obstacle  | Decor     |
|----------------|-----------|-----------|-----------|-----------|
| 🍬 **Candy**    | `#FFD1DC` | `#FFF0F5` | `#FF6B6B` | `#98FB98` |
| 💜 **Neon**     | `#1A1A2E` | `#16213E` | `#E94560` | `#0F3460` |
| 🌅 **Sunset**   | `#FF9A8B` | `#FF6A88` | `#2C3E50` | `#F9CA24` |
| 🍃 **Mint**     | `#E0F7FA` | `#FFFFFF` | `#009688` | `#80CBC4` |
| 🌙 **Midnight** | `#000000` | `#222222` | `#FFFF00` | `#444444` |

Fog is applied with `THREE.Fog` (linear) matching the sky color, creating depth from 10 to 50 units.

---

## 📐 Configuration Reference

All tunable gameplay parameters are centralized in the `CONFIG` object:

```js
const CONFIG = {
  laneWidth:     2.5,     // X-axis spacing between lanes
  cameraOffset:  { x: 0, y: 7, z: 10 },  // Fixed camera position
  gravity:       0.015,   // Jump deceleration per frame
  jumpPower:     0.35,    // Initial upward velocity on jump
  baseSpeed:     0.2,     // Starting scroll speed
  speedInc:      0.0001,  // Speed increment per frame (difficulty curve)
  floorLength:   400,     // Floor plane extent
  fogDensity:    0.02     // (unused — using linear fog instead)
};
```

---

## 🎮 Controls

| Input              | Action                           |
|--------------------|----------------------------------|
| ⬅️ `←` Arrow Left   | Move one lane left               |
| ➡️ `→` Arrow Right  | Move one lane right              |
| ⬆️ `↑` Arrow Up     | Jump                             |
| 🟢 `Space` / `Enter` | Start game (from menu screens)  |

---

## 🚀 Getting Started

### 📋 Prerequisites

- 🌐 A modern web browser with WebGL support (Chrome, Firefox, Edge, Safari)
- 📂 No server required for local play — just open the HTML file

### ▶️ Run Locally

```bash
# Option 1: Open directly
# Double-click index.html in your file explorer

# Option 2: Serve with any static server (avoids CORS issues with ES modules)
npx serve .
# Then open http://localhost:3000
```

> **Important:** Because the game uses ES Module `import` syntax, some browsers may block module loading via `file://` protocol. Use a local HTTP server if you encounter CORS errors.

---

## 🖼️ Rendering Pipeline

| Feature             | Implementation                                |
|---------------------|-----------------------------------------------|
| 🖥️ Renderer         | `WebGLRenderer` with antialiasing enabled     |
| 🌑 Shadows          | `PCFSoftShadowMap`, 1024×1024 shadow map      |
| 🔷 Shading          | `MeshStandardMaterial` with `flatShading`      |
| 💡 Lighting         | Ambient (0.6 intensity) + Directional (0.8)   |
| 📷 Camera           | `PerspectiveCamera`, 60° FOV, fixed position  |
| 🌫️ Fog              | Linear `THREE.Fog`, 10–50 unit range          |

---

## 🌐 Browser Compatibility

| Browser         | Support |
|-----------------|---------|
| Chrome 89+      | ✅       |
| Firefox 108+    | ✅       |
| Edge 89+        | ✅       |
| Safari 16.4+    | ✅       |

Requires: **ES Modules**, **Import Maps**, **WebGL 2.0**

---

## 📄 License

This project is provided as-is for educational and personal use.