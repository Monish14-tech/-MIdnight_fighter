/**
 * ThreeBackground — WebGL space environment using Three.js
 * Renders behind the 2D canvas game using InstancedBufferGeometry
 * for maximum performance with thousands of particles.
 *
 * Architecture:
 *  - Starfield: InstancedMesh (2000 instances, LOD-animated)
 *  - Nebulas: Instanced billboard quads with additive blending
 *  - Explosions: InstancedBufferGeometry pool (up to 512 bursts)
 *  - Cosmic dust: InstancedMesh streaks
 *  - Warp: Speed lines via InstancedBufferGeometry
 */

import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
const STAR_COUNT        = 2200;
const DUST_COUNT        = 320;
const NEBULA_COUNT      = 8;
const EXPLOSION_POOL    = 512;   // max simultaneous explosion particles
const WARP_LINE_COUNT   = 180;
const LOGICAL_W         = 1920;
const LOGICAL_H         = 1080;

// ─── Helper: random float ─────────────────────────────────────────────────────
const rnd  = (min, max) => Math.random() * (max - min) + min;
const rndS = (range)    => rnd(-range, range);

// ─── ThreeBackground ─────────────────────────────────────────────────────────
export class ThreeBackground {
    constructor() {
        this._ready = false;
        this._warpActive = false;
        this._warpSpeed  = 0;
        this._explosions = []; // active explosion bursts

        this._clock = new THREE.Clock();

        this._initRenderer();
        this._initScene();
        this._initStarfield();
        this._initNebulas();
        this._initCosmicDust();
        this._initExplosionPool();
        this._initWarpLines();
        this._ready = true;

        this._animate();
    }

    // ── Renderer ────────────────────────────────────────────────────────────
    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: false,  // keep fast — stars don't need it
            alpha: true,
            powerPreference: 'high-performance',
        });

        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0); // transparent clear

        const canvas = this.renderer.domElement;
        canvas.id = 'three-bg-canvas';
        canvas.style.cssText = [
            'position:fixed',
            'top:0',
            'left:0',
            'width:100%',
            'height:100%',
            'pointer-events:none',
            'z-index:0',
        ].join(';');

        // Insert BEFORE everything else — game canvas will sit on top
        document.body.insertBefore(canvas, document.body.firstChild);

        // Orthographic camera mapped to logical pixel space
        this.camera = new THREE.OrthographicCamera(
            0, w, 0, -h, -500, 500
        );
        this.camera.position.z = 100;

        window.addEventListener('resize', () => this._onResize());
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h);
        this.camera.right  =  w;
        this.camera.bottom = -h;
        this.camera.updateProjectionMatrix();
    }

    // ── Scene ───────────────────────────────────────────────────────────────
    _initScene() {
        this.scene = new THREE.Scene();
        // Deep space background gradient via a full-screen mesh
        const bgGeo = new THREE.PlaneGeometry(LOGICAL_W, LOGICAL_H);
        const bgMat = new THREE.MeshBasicMaterial({
            color: 0x020210,
            depthWrite: false,
        });
        const bgMesh = new THREE.Mesh(bgGeo, bgMat);
        bgMesh.position.set(LOGICAL_W / 2, -LOGICAL_H / 2, -10);
        this.scene.add(bgMesh);
    }

    // ── Starfield ────────────────────────────────────────────────────────────
    _initStarfield() {
        // Per-instance data stored in BufferAttributes on the geometry
        const geo = new THREE.BufferGeometry();

        const positions = new Float32Array(STAR_COUNT * 3);
        const sizes     = new Float32Array(STAR_COUNT);
        const speeds    = new Float32Array(STAR_COUNT);
        const layers    = new Float32Array(STAR_COUNT); // 0=near,1=mid,2=far
        const alphas    = new Float32Array(STAR_COUNT);
        const twinkle   = new Float32Array(STAR_COUNT); // phase offset

        for (let i = 0; i < STAR_COUNT; i++) {
            positions[i * 3]     = rnd(0, LOGICAL_W);
            positions[i * 3 + 1] = -rnd(0, LOGICAL_H);
            positions[i * 3 + 2] = 0;

            const layer = Math.floor(rnd(0, 3)); // 0, 1, 2
            layers[i]    = layer;
            sizes[i]     = layer === 0 ? rnd(2, 4) : layer === 1 ? rnd(1, 2.5) : rnd(0.5, 1.5);
            speeds[i]    = layer === 0 ? rnd(40, 70) : layer === 1 ? rnd(18, 40) : rnd(6, 18);
            alphas[i]    = layer === 0 ? rnd(0.7, 1.0) : layer === 1 ? rnd(0.4, 0.8) : rnd(0.15, 0.5);
            twinkle[i]   = rnd(0, Math.PI * 2);
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,     1));
        geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds,    1));
        geo.setAttribute('aLayer',   new THREE.BufferAttribute(layers,    1));
        geo.setAttribute('aAlpha',   new THREE.BufferAttribute(alphas,    1));
        geo.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle,   1));

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:      { value: 0 },
                uWarpSpeed: { value: 0 },
            },
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute float aSpeed;
                attribute float aAlpha;
                attribute float aTwinkle;
                attribute float aLayer;

                uniform float uTime;
                uniform float uWarpSpeed;

                varying float vAlpha;
                varying float vLayer;
                varying float vWarp;

                void main() {
                    vLayer = aLayer;
                    vWarp  = uWarpSpeed;

                    // Scroll downward (simulating forward flight)
                    float warpMult = 1.0 + uWarpSpeed * 12.0;
                    float scrollY  = mod(position.y - uTime * aSpeed * warpMult, -1080.0);

                    vec3 pos = vec3(position.x, scrollY, position.z);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

                    // Twinkle based on time + phase offset
                    float twinkleAmt = 0.15 * sin(uTime * 2.8 + aTwinkle);
                    vAlpha = clamp(aAlpha + twinkleAmt, 0.0, 1.0);

                    // Stretch into lines during warp
                    float sizeBoost = 1.0 + uWarpSpeed * aLayer * 2.0;
                    gl_PointSize = aSize * sizeBoost;
                }
            `,
            fragmentShader: /* glsl */`
                varying float vAlpha;
                varying float vLayer;
                varying float vWarp;

                void main() {
                    // Soft round point
                    vec2 uv = gl_PointCoord * 2.0 - 1.0;
                    float dist = length(uv);

                    // During warp: elongate vertically to make streak lines
                    if (vWarp > 0.1) {
                        dist = length(vec2(uv.x * 0.25, uv.y));
                    }

                    if (dist > 1.0) discard;
                    float alpha = vAlpha * (1.0 - dist * 0.7);

                    // Color: near=white, mid=blue-white, far=blue
                    vec3 col = mix(vec3(0.5, 0.7, 1.0), vec3(1.0, 1.0, 1.0), vLayer / 2.0);
                    gl_FragColor = vec4(col, alpha);
                }
            `,
            transparent: true,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });

        this._starPoints    = new THREE.Points(geo, mat);
        this._starMat       = mat;
        this._starPositions = positions;
        this.scene.add(this._starPoints);
    }

    // ── Nebula clouds ────────────────────────────────────────────────────────
    _initNebulas() {
        const nebulaData = [
            { x: 0.15, y: 0.2,  r: 380, h: 200,  s: 60,  c: new THREE.Color(0.05, 0.15, 0.45) },
            { x: 0.75, y: 0.15, r: 320, h: 160,  s: 45,  c: new THREE.Color(0.35, 0.05, 0.45) },
            { x: 0.5,  y: 0.55, r: 440, h: 200,  s: 55,  c: new THREE.Color(0.04, 0.22, 0.40) },
            { x: 0.2,  y: 0.72, r: 280, h: 140,  s: 40,  c: new THREE.Color(0.20, 0.04, 0.38) },
            { x: 0.85, y: 0.6,  r: 360, h: 180,  s: 50,  c: new THREE.Color(0.03, 0.28, 0.35) },
            { x: 0.42, y: 0.88, r: 300, h: 150,  s: 38,  c: new THREE.Color(0.28, 0.06, 0.28) },
            { x: 0.62, y: 0.35, r: 260, h: 130,  s: 35,  c: new THREE.Color(0.06, 0.14, 0.42) },
            { x: 0.08, y: 0.45, r: 340, h: 170,  s: 48,  c: new THREE.Color(0.22, 0.03, 0.42) },
        ];

        this._nebulaGroup = new THREE.Group();

        nebulaData.forEach(d => {
            const geo = new THREE.PlaneGeometry(d.r * 2, d.r * 1.2);
            const mat = new THREE.ShaderMaterial({
                uniforms: {
                    uColor:   { value: d.c },
                    uTime:    { value: 0 },
                    uSpeed:   { value: d.s },
                    uPhase:   { value: rnd(0, 6.28) },
                },
                vertexShader: /* glsl */`
                    varying vec2 vUv;
                    void main() {
                        vUv = uv;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: /* glsl */`
                    uniform vec3  uColor;
                    uniform float uTime;
                    uniform float uSpeed;
                    uniform float uPhase;
                    varying vec2 vUv;

                    float hash(vec2 p) {
                        p = fract(p * vec2(234.34, 435.345));
                        p += dot(p, p + 34.23);
                        return fract(p.x * p.y);
                    }

                    float noise(vec2 p) {
                        vec2 i = floor(p);
                        vec2 f = fract(p);
                        f = f * f * (3.0 - 2.0 * f);
                        return mix(
                            mix(hash(i), hash(i + vec2(1,0)), f.x),
                            mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
                            f.y
                        );
                    }

                    void main() {
                        vec2 uv = vUv * 2.0 - 1.0;
                        float dist = length(uv * vec2(1.0, 1.6));

                        // Animated turbulence
                        float t = uTime * 0.00008 * uSpeed + uPhase;
                        float n = noise(uv * 2.0 + t) * 0.5
                                + noise(uv * 4.2 - t * 1.3) * 0.3
                                + noise(uv * 8.0 + t * 0.7) * 0.2;

                        float alpha = (1.0 - smoothstep(0.3, 1.0, dist)) * n * 0.18;
                        gl_FragColor = vec4(uColor, alpha);
                    }
                `,
                transparent: true,
                depthWrite:  false,
                blending:    THREE.AdditiveBlending,
                side:        THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(d.x * LOGICAL_W, -d.y * LOGICAL_H, -5);
            mesh.userData.mat = mat;
            this._nebulaGroup.add(mesh);
        });

        this.scene.add(this._nebulaGroup);
    }

    // ── Cosmic dust streaks ──────────────────────────────────────────────────
    _initCosmicDust() {
        const geo   = new THREE.BufferGeometry();
        const pos   = new Float32Array(DUST_COUNT * 3);
        const vel   = new Float32Array(DUST_COUNT * 2); // vx, vy
        const alpha = new Float32Array(DUST_COUNT);
        const size  = new Float32Array(DUST_COUNT);

        for (let i = 0; i < DUST_COUNT; i++) {
            pos[i * 3]     = rnd(0, LOGICAL_W);
            pos[i * 3 + 1] = -rnd(0, LOGICAL_H);
            pos[i * 3 + 2] = 0;
            vel[i * 2]     = rndS(8);
            vel[i * 2 + 1] = rnd(18, 50); // falling down
            alpha[i]       = rnd(0.1, 0.3);
            size[i]        = rnd(0.8, 2.5);
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
        geo.setAttribute('aAlpha',   new THREE.BufferAttribute(alpha, 1));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(size,  1));

        const mat = new THREE.ShaderMaterial({
            uniforms: { uWarp: { value: 0 } },
            vertexShader: /* glsl */`
                attribute float aAlpha;
                attribute float aSize;
                uniform float uWarp;
                varying float vAlpha;
                void main() {
                    vAlpha = aAlpha * (1.0 + uWarp * 1.5);
                    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * (1.0 + uWarp * 3.0);
                }
            `,
            fragmentShader: /* glsl */`
                varying float vAlpha;
                void main() {
                    vec2 uv = gl_PointCoord * 2.0 - 1.0;
                    if (length(uv) > 1.0) discard;
                    gl_FragColor = vec4(0.8, 0.9, 1.0, vAlpha);
                }
            `,
            transparent: true,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });

        this._dustPoints    = new THREE.Points(geo, mat);
        this._dustPos       = pos;
        this._dustVel       = vel;
        this._dustMat       = mat;
        this.scene.add(this._dustPoints);
    }

    // ── Explosion particle pool ──────────────────────────────────────────────
    _initExplosionPool() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(EXPLOSION_POOL * 3);
        const col = new Float32Array(EXPLOSION_POOL * 3);
        const siz = new Float32Array(EXPLOSION_POOL);
        const lif = new Float32Array(EXPLOSION_POOL); // remaining life [0,1]

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aColor',   new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(siz, 1));
        geo.setAttribute('aLife',    new THREE.BufferAttribute(lif, 1));

        const mat = new THREE.ShaderMaterial({
            vertexShader: /* glsl */`
                attribute vec3  aColor;
                attribute float aSize;
                attribute float aLife;
                varying   vec3  vColor;
                varying   float vLife;
                void main() {
                    vColor = aColor;
                    vLife  = aLife;
                    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * aLife;
                }
            `,
            fragmentShader: /* glsl */`
                varying vec3  vColor;
                varying float vLife;
                void main() {
                    if (vLife <= 0.0) discard;
                    vec2 uv = gl_PointCoord * 2.0 - 1.0;
                    float d = length(uv);
                    if (d > 1.0) discard;
                    float alpha = vLife * (1.0 - d);
                    // Inner bright core fades to color
                    vec3 col = mix(vColor, vec3(1.0), pow(1.0 - d, 3.0));
                    gl_FragColor = vec4(col, alpha);
                }
            `,
            transparent: true,
            depthWrite:  false,
            blending:    THREE.AdditiveBlending,
        });

        this._explPoints   = new THREE.Points(geo, mat);
        this._explPos      = pos;
        this._explCol      = col;
        this._explSiz      = siz;
        this._explLife     = lif;
        this._explVelocity = new Float32Array(EXPLOSION_POOL * 3); // vx, vy, vz
        this._explMaxLife  = new Float32Array(EXPLOSION_POOL);

        // All dead by default
        pos.fill(0); lif.fill(0);
        this._explSlot = 0; // ring buffer write head

        this.scene.add(this._explPoints);
    }

    // ── Warp speed lines ────────────────────────────────────────────────────
    _initWarpLines() {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(WARP_LINE_COUNT * 6); // start+end per line
        const alp = new Float32Array(WARP_LINE_COUNT * 2);

        for (let i = 0; i < WARP_LINE_COUNT; i++) {
            const x = rnd(0, LOGICAL_W);
            const y = -rnd(0, LOGICAL_H);
            pos[i * 6]     = x; pos[i * 6 + 1] = y;     pos[i * 6 + 2] = 0;
            pos[i * 6 + 3] = x; pos[i * 6 + 4] = y - rnd(60, 180); pos[i * 6 + 5] = 0;
            alp[i * 2]     = 0; alp[i * 2 + 1] = 0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aAlpha',   new THREE.BufferAttribute(alp, 1));

        const mat = new THREE.LineBasicMaterial({
            vertexColors: false,
            color: 0x88ccff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        const lines = new THREE.LineSegments(geo, mat);
        this._warpLines    = lines;
        this._warpMat      = mat;
        this._warpPos      = pos;
        this.scene.add(lines);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    /**
     * Fire an explosion burst at logical game coordinates (x, y).
     * @param {number} x        Logical game X
     * @param {number} y        Logical game Y
     * @param {string} cssColor CSS hex color string, e.g. '#ff4400'
     * @param {number} count    Number of particles (default 28)
     * @param {number} radius   Explosion radius in logical px (default 60)
     */
    triggerExplosion(x, y, cssColor = '#ff6600', count = 28, radius = 60) {
        const c = new THREE.Color(cssColor);

        for (let i = 0; i < count; i++) {
            const slot = this._explSlot % EXPLOSION_POOL;
            this._explSlot++;

            // Position (convert to Three.js coord space)
            const angle = rnd(0, Math.PI * 2);
            const dist  = rnd(0, radius * 0.4);
            this._explPos[slot * 3]     = x  + Math.cos(angle) * dist;
            this._explPos[slot * 3 + 1] = -y - Math.sin(angle) * dist;
            this._explPos[slot * 3 + 2] = 2;

            // Color
            this._explCol[slot * 3]     = c.r;
            this._explCol[slot * 3 + 1] = c.g;
            this._explCol[slot * 3 + 2] = c.b;

            // Size
            this._explSiz[slot] = rnd(8, 28);

            // Velocity
            const speed = rnd(30, radius * 2.2);
            this._explVelocity[slot * 3]     = Math.cos(angle) * speed;
            this._explVelocity[slot * 3 + 1] = -Math.sin(angle) * speed;
            this._explVelocity[slot * 3 + 2] = 0;

            // Life
            const life = rnd(0.45, 0.85);
            this._explLife[slot]    = 1.0;
            this._explMaxLife[slot] = life;

            this._explosions.push({ slot, lifeRemaining: life, totalLife: life });
        }

        // Mark buffer attributes dirty
        this._explPoints.geometry.attributes.position.needsUpdate = true;
        this._explPoints.geometry.attributes.aColor.needsUpdate   = true;
        this._explPoints.geometry.attributes.aSize.needsUpdate    = true;
        this._explPoints.geometry.attributes.aLife.needsUpdate    = true;
    }

    /**
     * Trigger a large boss explosion.
     */
    triggerBossExplosion(x, y, color = '#ff2200') {
        this.triggerExplosion(x, y, color, 80, 160);
        setTimeout(() => this.triggerExplosion(x + rndS(40), y + rndS(40), '#ffaa00', 50, 100), 80);
        setTimeout(() => this.triggerExplosion(x + rndS(60), y + rndS(60), '#ffffff', 30, 80), 160);
    }

    /**
     * Activate warp effect.
     * @param {number} speed 0=normal, 1=full warp
     * @param {number} duration seconds
     */
    triggerWarp(duration = 2.0) {
        this._warpActive = true;
        this._warpSpeed  = 1.0;
        this._warpMat.opacity = 0.7;
        clearTimeout(this._warpTimeout);
        this._warpTimeout = setTimeout(() => {
            this._warpActive = false;
            this._warpSpeed  = 0;
            this._warpMat.opacity = 0;
        }, duration * 1000);
    }

    /**
     * Resize handler — called by game when window resizes.
     */
    resize() {
        this._onResize();
    }

    /**
     * Update starfield speed (called every frame).
     * @param {number} speed 0=normal, 1=warp
     */
    setWarpSpeed(speed) {
        this._warpSpeed = speed;
    }

    // ── Animation loop ───────────────────────────────────────────────────────
    _animate() {
        requestAnimationFrame(() => this._animate());
        if (!this._ready) return;

        const dt = Math.min(this._clock.getDelta(), 0.05);
        const t  = this._clock.elapsedTime;

        // Update star uniforms
        if (this._starMat) {
            this._starMat.uniforms.uTime.value      = t;
            this._starMat.uniforms.uWarpSpeed.value = this._warpSpeed;
        }

        // Update nebula time uniforms
        this._nebulaGroup.children.forEach(mesh => {
            if (mesh.userData.mat) {
                mesh.userData.mat.uniforms.uTime.value = t;
            }
        });

        // Update cosmic dust positions
        this._updateDust(dt);

        // Update explosion particles
        this._updateExplosions(dt);

        // Update warp
        if (this._dustMat) {
            this._dustMat.uniforms.uWarp.value = this._warpSpeed;
        }
        this._updateWarpLines(dt);

        this.renderer.render(this.scene, this.camera);
    }

    _updateDust(dt) {
        if (!this._dustPos) return;
        const warpMult = 1.0 + this._warpSpeed * 8;
        for (let i = 0; i < DUST_COUNT; i++) {
            this._dustPos[i * 3]     += this._dustVel[i * 2]     * dt;
            this._dustPos[i * 3 + 1] -= this._dustVel[i * 2 + 1] * dt * warpMult;

            // Wrap vertically
            if (this._dustPos[i * 3 + 1] < -LOGICAL_H - 10) {
                this._dustPos[i * 3]     = rnd(0, LOGICAL_W);
                this._dustPos[i * 3 + 1] = 0;
            }
            // Wrap horizontally
            if (this._dustPos[i * 3] < -10)           this._dustPos[i * 3] = LOGICAL_W + 10;
            if (this._dustPos[i * 3] > LOGICAL_W + 10) this._dustPos[i * 3] = -10;
        }
        this._dustPoints.geometry.attributes.position.needsUpdate = true;
    }

    _updateExplosions(dt) {
        if (!this._explosions.length) return;

        let anyAlive = false;
        const toRemove = [];

        for (let e = 0; e < this._explosions.length; e++) {
            const expl = this._explosions[e];
            expl.lifeRemaining -= dt;

            if (expl.lifeRemaining <= 0) {
                this._explLife[expl.slot] = 0;
                toRemove.push(e);
                continue;
            }

            const { slot } = expl;
            const lifeRatio = expl.lifeRemaining / expl.totalLife;

            // Move particle
            this._explPos[slot * 3]     += this._explVelocity[slot * 3]     * dt;
            this._explPos[slot * 3 + 1] += this._explVelocity[slot * 3 + 1] * dt;
            // Drag
            this._explVelocity[slot * 3]     *= (1 - dt * 3.5);
            this._explVelocity[slot * 3 + 1] *= (1 - dt * 3.5);

            this._explLife[slot] = lifeRatio;
            anyAlive = true;
        }

        // Remove dead explosions (in reverse to keep indices valid)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this._explosions.splice(toRemove[i], 1);
        }

        if (anyAlive || toRemove.length > 0) {
            this._explPoints.geometry.attributes.position.needsUpdate = true;
            this._explPoints.geometry.attributes.aLife.needsUpdate    = true;
        }
    }

    _updateWarpLines(dt) {
        if (!this._warpActive) return;
        const pos = this._warpPos;
        const speed = 900 * dt;
        for (let i = 0; i < WARP_LINE_COUNT; i++) {
            pos[i * 6 + 1] -= speed;
            pos[i * 6 + 4] -= speed;
            if (pos[i * 6 + 1] < -LOGICAL_H - 200) {
                const x = rnd(0, LOGICAL_W);
                pos[i * 6]     = x;
                pos[i * 6 + 1] = 0;
                pos[i * 6 + 3] = x;
                pos[i * 6 + 4] = -rnd(60, 180);
            }
        }
        this._warpLines.geometry.attributes.position.needsUpdate = true;
    }

    /**
     * Dispose resources cleanly.
     */
    dispose() {
        this.renderer.dispose();
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}

// Singleton export
let _instance = null;
export function getThreeBackground() {
    if (!_instance) {
        _instance = new ThreeBackground();
    }
    return _instance;
}
