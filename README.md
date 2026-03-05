# Vibe Shooter — 2D Space Shooter

A 2D space shooter built with **Three.js** (orthographic camera, 2D plane gameplay).

## How to run

The game uses ES modules and must be served over HTTP (no `file://`).

**Option 1 — VS Code / Cursor**  
Use the “Live Server” extension: right-click `index.html` → “Open with Live Server”.

**Option 2 — Node**  
From this folder:

```bash
npx serve .
```

Then open the URL shown (e.g. http://localhost:3000).

**Option 3 — Python**  
```bash
python -m http.server 8000
```
Then open http://localhost:8000.

## Controls

| Key | Action |
|-----|--------|
| **Arrow keys** or **WASD** | Move |
| **Space** | Shoot |

## Features

- Player ship with movement and shooting
- Enemies spawning from the top
- Collision: bullets destroy enemies (+100 score), enemies damage the player (lose a life)
- Score and lives, game over and play again
- Starfield background and Orbitron UI

Enjoy.
