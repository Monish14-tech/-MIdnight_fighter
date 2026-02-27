export class InputHandler {
    constructor(options = {}) {
        this.enabled = options.enabled !== false;
        this.bindings = options.bindings || InputHandler.bindings.singlePlayer;
        this.enableTouch = options.enableTouch !== false;

        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false,
            missile: false,
            dash: false
        };

        this.touch = {
            active: false,
            originX: 0,
            originY: 0,
            currX: 0,
            currY: 0,
            dx: 0,
            dy: 0, // Normalized direction
            lastTapTime: 0
        };
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Touch listeners
        if (this.enableTouch) {
            const joystickZone = document.getElementById('joystick-zone');
            const fireBtn = document.getElementById('fire-btn');
            const dashBtn = document.getElementById('dash-btn');

            if (joystickZone) {
                joystickZone.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
                joystickZone.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
                joystickZone.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
            }

            if (fireBtn) {
                const handleFireStart = (e) => {
                    e.preventDefault();
                    this.keys.fire = true;
                };
                const handleFireEnd = (e) => {
                    e.preventDefault();
                    this.keys.fire = false;
                };
                fireBtn.addEventListener('touchstart', handleFireStart, { passive: false });
                fireBtn.addEventListener('touchend', handleFireEnd, { passive: false });
                fireBtn.addEventListener('mousedown', () => this.keys.fire = true);
                fireBtn.addEventListener('mouseup', () => this.keys.fire = false);
            }

            if (dashBtn) {
                const handleDashStart = (e) => {
                    e.preventDefault();
                    this.keys.dash = true;
                };
                const handleDashEnd = (e) => {
                    e.preventDefault();
                    this.keys.dash = false;
                };
                dashBtn.addEventListener('touchstart', handleDashStart, { passive: false });
                dashBtn.addEventListener('touchend', handleDashEnd, { passive: false });
                dashBtn.addEventListener('mousedown', () => this.keys.dash = true);
                dashBtn.addEventListener('mouseup', () => this.keys.dash = false);
            }

            const missileBtn = document.getElementById('missile-btn');
            if (missileBtn) {
                const handleMissileStart = (e) => {
                    e.preventDefault();
                    this.keys.missile = true;
                };
                const handleMissileEnd = (e) => {
                    e.preventDefault();
                    this.keys.missile = false;
                };
                missileBtn.addEventListener('touchstart', handleMissileStart, { passive: false });
                missileBtn.addEventListener('touchend', handleMissileEnd, { passive: false });
                missileBtn.addEventListener('mousedown', () => this.keys.missile = true);
                missileBtn.addEventListener('mouseup', () => this.keys.missile = false);
            }
        }
    }

    setBindings(bindings) {
        this.bindings = bindings || InputHandler.bindings.singlePlayer;
    }

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        if (!this.enabled) {
            this.keys.up = false;
            this.keys.down = false;
            this.keys.left = false;
            this.keys.right = false;
            this.keys.fire = false;
            this.keys.missile = false;
            this.keys.dash = false;
            this.touch.active = false;
            this.touch.dx = 0;
            this.touch.dy = 0;
        }
    }

    matchesBinding(action, e) {
        const binding = this.bindings[action];
        if (!binding) return false;

        const code = e.code;
        const key = (e.key || '').toLowerCase();

        if (binding.codes && binding.codes.includes(code)) return true;
        if (binding.keys && binding.keys.includes(key)) return true;

        return false;
    }

    onKeyDown(e) {
        if (!this.enabled) return;

        if (this.matchesBinding('up', e)) this.keys.up = true;
        if (this.matchesBinding('down', e)) this.keys.down = true;
        if (this.matchesBinding('left', e)) this.keys.left = true;
        if (this.matchesBinding('right', e)) this.keys.right = true;
        if (this.matchesBinding('fire', e)) this.keys.fire = true;
        if (this.matchesBinding('missile', e)) {
            e.preventDefault();
            this.keys.missile = true;
        }
        if (this.matchesBinding('dash', e)) this.keys.dash = true;
    }

    onKeyUp(e) {
        if (!this.enabled) return;

        if (this.matchesBinding('up', e)) this.keys.up = false;
        if (this.matchesBinding('down', e)) this.keys.down = false;
        if (this.matchesBinding('left', e)) this.keys.left = false;
        if (this.matchesBinding('right', e)) this.keys.right = false;
        if (this.matchesBinding('fire', e)) this.keys.fire = false;
        if (this.matchesBinding('missile', e)) {
            e.preventDefault();
            this.keys.missile = false;
        }
        if (this.matchesBinding('dash', e)) this.keys.dash = false;
    }

    // Touch Logic
    onTouchStart(e) {
        if (!this.enableTouch || !this.enabled) return;
        e.preventDefault();
        const now = Date.now();
        if (now - this.touch.lastTapTime < 250) {
            this.keys.dash = true;
            setTimeout(() => { this.keys.dash = false; }, 150);
        }
        this.touch.lastTapTime = now;
        // Use changedTouches to handle multiple touches
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            const rect = e.target.getBoundingClientRect();

            // Center of the joystick zone
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            this.touch.active = true;
            this.touch.id = touch.identifier; // Track specific touch ID
            this.touch.originX = centerX;
            this.touch.originY = centerY;
            this.touch.currX = touch.clientX;
            this.touch.currY = touch.clientY;

            this.updateTouchDirection();
        }
    }

    onTouchMove(e) {
        if (!this.enableTouch || !this.enabled) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const touch = e.changedTouches[i];
            if (touch.identifier === this.touch.id) {
                this.touch.currX = touch.clientX;
                this.touch.currY = touch.clientY;
                this.updateTouchDirection();
                break;
            }
        }
    }

    onTouchEnd(e) {
        if (!this.enableTouch || !this.enabled) return;
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === this.touch.id) {
                this.touch.active = false;
                this.touch.dx = 0;
                this.touch.dy = 0;
                this.touch.id = null;

                // Reset Visuals
                const knob = document.getElementById('joystick-knob');
                if (knob) {
                    knob.style.transform = `translate(-50%, -50%)`;
                }
                // Do NOT break here, in case there are weird edge cases, but conceptually unique.
            }
        }
    }

    updateTouchDirection() {
        if (!this.enableTouch || !this.enabled) return;
        const maxDist = 35; // Max visual distance for knob
        let dx = this.touch.currX - this.touch.originX;
        let dy = this.touch.currY - this.touch.originY;

        const distance = Math.sqrt(dx * dx + dy * dy);

        // Clamping for logic
        let normalX = dx;
        let normalY = dy;

        if (distance > maxDist) {
            const ratio = maxDist / distance;
            normalX = dx * ratio;
            normalY = dy * ratio;
        }

        // Normalize for Input (-1 to 1)
        this.touch.dx = normalX / maxDist;
        this.touch.dy = normalY / maxDist;

        // Visual Update
        const knob = document.getElementById('joystick-knob');
        if (knob) {
            // Apply translation relative to center
            knob.style.transform = `translate(calc(-50% + ${normalX}px), calc(-50% + ${normalY}px))`;
        }
    }



    getMovementVector() {
        // Return x, y between -1 and 1
        let x = 0;
        let y = 0;

        if (this.keys.left) x -= 1;
        if (this.keys.right) x += 1;
        if (this.keys.up) y -= 1;
        if (this.keys.down) y += 1;

        // Prioritize touch if active
        if (this.touch.active) {
            x = this.touch.dx;
            y = this.touch.dy;
        }

        // Normalize keyboard diagonal
        if (x !== 0 || y !== 0) {
            // If not using touch (which is already circular), normalize
            if (!this.touch.active) {
                const len = Math.sqrt(x * x + y * y);
                x /= len;
                y /= len;
            }
        }

        return { x, y };
    }
}

InputHandler.bindings = {
    singlePlayer: {
        up: { codes: ['KeyW', 'ArrowUp'], keys: ['w', 'arrowup'] },
        down: { codes: ['KeyS', 'ArrowDown'], keys: ['s', 'arrowdown'] },
        left: { codes: ['KeyA', 'ArrowLeft'], keys: ['a', 'arrowleft'] },
        right: { codes: ['KeyD', 'ArrowRight'], keys: ['d', 'arrowright'] },
        fire: { codes: ['Space'], keys: [' '] },
        missile: { codes: ['AltLeft', 'AltRight'], keys: ['alt'] },
        dash: { codes: ['ShiftLeft', 'ShiftRight'], keys: ['shift'] }
    },
    coopPlayerOne: {
        up: { codes: ['KeyW'], keys: ['w'] },
        down: { codes: ['KeyS'], keys: ['s'] },
        left: { codes: ['KeyA'], keys: ['a'] },
        right: { codes: ['KeyD'], keys: ['d'] },
        fire: { codes: ['Space'], keys: [' '] },
        missile: { codes: ['AltLeft', 'AltRight'], keys: ['alt'] },
        dash: { codes: ['ShiftLeft', 'ShiftRight'], keys: ['shift'] }
    },
    coopPlayerTwo: {
        up: { codes: ['ArrowUp'], keys: ['arrowup'] },
        down: { codes: ['ArrowDown'], keys: ['arrowdown'] },
        left: { codes: ['ArrowLeft'], keys: ['arrowleft'] },
        right: { codes: ['ArrowRight'], keys: ['arrowright'] },
        fire: { codes: ['Enter'], keys: ['enter'] },
        missile: { codes: ['ControlRight'], keys: ['control'] },
        dash: { codes: ['ShiftRight'], keys: ['shift'] }
    }
};
