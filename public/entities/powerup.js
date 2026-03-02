export class PowerUp {
    constructor(game, type, x = null, y = null) {
        this.game = game;
        this.type = type;
        this.markedForDeletion = false;

        // Use game.random() so co-op clients generate identical positions
        const rng = () => game.random ? game.random() : Math.random();
        const margin = 100;
        this.x = x !== null ? x : margin + rng() * (game.width - margin * 2);
        this.y = y !== null ? y : margin + rng() * (game.height - margin * 2);

        this.radius = 22;
        this.lifetime = 18; // 18 seconds before despawn
        this.age = 0;
        this.pulseTimer = 0;

        // Visual properties per type
        const TYPES = {
            'speed': { color: '#00ff88', icon: '▶▶', label: 'SPEED BOOST' },
            'slowmo': { color: '#dd00ff', icon: '⏸', label: 'SLOW TIME' },
            'invulnerability': { color: '#ffdd00', icon: '★', label: 'INVINCIBLE' },
            'health_recover': { color: '#ff3333', icon: '♥+', label: 'HEAL +2' },
            'health_boost': { color: '#ff8800', icon: '♥↑', label: 'MAX HP UP' },
            'shield': { color: '#00ccff', icon: '◉', label: 'SHIELD' },
            'double_damage': { color: '#ff0066', icon: '✕2', label: 'DOUBLE DMG' },
            'rapid_fire': { color: '#ffff00', icon: '≋', label: 'RAPID FIRE' },
            'nuke': { color: '#ff6600', icon: '☢', label: 'NUKE' },
            'ghost': { color: '#aaaaff', icon: '◌', label: 'GHOST' },
            'ammo_refill': { color: '#00ffcc', icon: '⬆✦', label: 'AMMO REFILL' },
        };
        const cfg = TYPES[type] || { color: '#ffffff', icon: '?', label: 'UNKNOWN' };
        this.color = cfg.color;
        this.icon = cfg.icon;
        this.label = cfg.label;
    }

    update(deltaTime) {
        this.age += deltaTime;
        this.pulseTimer += deltaTime;
        if (this.age >= this.lifetime) {
            this.markedForDeletion = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Despawn warning: blink when < 4 s remain
        const timeLeft = this.lifetime - this.age;
        if (timeLeft < 4) {
            const blink = Math.sin(this.pulseTimer * 12) > 0;
            if (!blink) { ctx.restore(); return; }
        }

        const pulse = 1 + Math.sin(this.pulseTimer * 5) * 0.18;
        const size = this.radius * pulse;

        // Outer rotating ring
        ctx.save();
        ctx.rotate(this.pulseTimer * 1.5);
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i;
            const r1 = size * 1.3;
            const r2 = size * 1.5;
            if (i === 0) ctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
            else ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
            ctx.lineTo(Math.cos(a + 0.15) * r2, Math.sin(a + 0.15) * r2);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // Hexagon body
        ctx.shadowBlur = 35;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6;
            const px = Math.cos(a) * size;
            const py = Math.sin(a) * size;
            i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Inner bright core
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
        ctx.fill();

        // Icon
        ctx.fillStyle = this.color;
        ctx.font = `bold ${Math.round(size * 0.65)}px Orbitron, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 6;
        ctx.fillText(this.icon, 0, 0);

        // Label below
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = this.color;
        ctx.font = 'bold 9px Orbitron, monospace';
        ctx.textBaseline = 'top';
        ctx.fillText(this.label, 0, size + 6);

        ctx.restore();
    }
}
