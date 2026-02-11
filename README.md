# MIDNIGHT - Neon Action Game

A fast-paced, neon-styled arcade shooter built with HTML5 Canvas.

## 🚀 How to Play
-   **PC**:
    -   **WASD / Arrows**: Move
    -   **Space**: Shoot Bullets
    -   **Shift**: Fire Homing Missiles
-   **Mobile**:
    -   **Left Stick**: Move
    -   **FIRE Button**: Shoot Bullets
    -   **MISSILE Button**: Fire Homing Missiles
    -   *Note: Landscape mode required.*

## 🛠️ Features
-   **Shop System**: Earn coins to buy 6 unique ships.
-   **High Score**: Persists locally.
-   **Mobile Support**: Touch controls and landscape optimization.
-   **Visuals**: Neon glow, screen shake, and particle effects.

## 🌍 How to Deploy (Get it Online)

You can host this game for free! Here are the best options:

### Option 1: Vercel (Recommended 🥇)
1.  Install Vercel CLI: `npm i -g vercel`
2.  Open terminal in this folder.
3.  Run: `vercel`
4.  Follow the prompts (press Enter for defaults).
5.  **Done!** You'll get a link like `midnight-runner.vercel.app`.

### Option 2: Netlify (Easiest 🥈)
1.  Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2.  **Drag and drop** the entire `mid night runner` folder onto the page.
3.  **Done!** Netlify will generate a link for you.

### Option 3: GitHub Pages
1.  Upload this code to a GitHub repository.
2.  Go to **Settings** > **Pages**.
3.  Select `main` branch and save.
4.  **Done!**

## 📂 File Structure
```
mid night runner/
├── index.html          # Main game page
├── style.css           # Neon styling
├── main.js             # Entry point
├── game.js             # Game loop & logic
├── input.js            # Keyboard/touch controls
├── audio.js            # Sound effects
├── utils.js            # Screen shake
└── entities/
    ├── player.js       # Player character & Ship models
    ├── enemy.js        # Enemy types
    ├── projectile.js   # Bullets & Missiles
    ├── powerup.js      # Medkits & Boosts
    └── particle.js     # Explosions
```
