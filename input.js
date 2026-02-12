export class InputHandler {
    constructor() {
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            left: false,
            right: false,
            fire: false,
            missile: false
        };

        this.touch = {
            active: false,
            originX: 0,
            originY: 0,
            currX: 0,
            currY: 0,
            dx: 0,
            dy: 0 // Normalized direction
        };



        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));

        // Touch listeners
        const joystickZone = document.getElementById('joystick-zone');
        const dashBtn = document.getElementById('dash-btn');

        if (joystickZone) {
            joystickZone.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
            joystickZone.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
            joystickZone.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
        }

        if (dashBtn) {
            dashBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys.fire = true;
            }, { passive: false });
            dashBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.fire = false;
            }, { passive: false });
        }

        const missileBtn = document.getElementById('missile-btn');
        if (missileBtn) {
            missileBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.keys.missile = true;
            }, { passive: false });
            missileBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.keys.missile = false;
            }, { passive: false });
        }
    }

    onKeyDown(e) {
        const code = e.code;
        const key = e.key.toLowerCase();

        if (code === 'ArrowUp' || key === 'w' || key === 'arrowup') this.keys.up = true;
        if (code === 'ArrowDown' || key === 's' || key === 'arrowdown') this.keys.down = true;
        if (code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') this.keys.left = true;
        if (code === 'ArrowRight' || key === 'd' || key === 'arrowright') this.keys.right = true;
        if (code === 'Space' || key === ' ') {
            this.keys.fire = true;
        }
        if (code === 'AltLeft' || code === 'AltRight' || key === 'alt') {
            e.preventDefault(); // Prevent browser menu
            this.keys.missile = true;
        }
    }

    onKeyUp(e) {
        const code = e.code;
        const key = e.key.toLowerCase();

        if (code === 'ArrowUp' || key === 'w' || key === 'arrowup') this.keys.up = false;
        if (code === 'ArrowDown' || key === 's' || key === 'arrowdown') this.keys.down = false;
        if (code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') this.keys.left = false;
        if (code === 'ArrowRight' || key === 'd' || key === 'arrowright') this.keys.right = false;
        if (code === 'Space' || key === ' ') this.keys.fire = false;
        if (code === 'AltLeft' || code === 'AltRight' || key === 'alt') {
            e.preventDefault();
            this.keys.missile = false;
        }
    }

    // Touch Logic
    onTouchStart(e) {
        e.preventDefault();
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
