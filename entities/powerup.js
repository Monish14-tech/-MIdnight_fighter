export class PowerUp {
    constructor(game, type) {
        this.game = game;
        this.type = type; // 'speed', 'slowmo', 'invulnerability'
        this.markedForDeletion = false;

        // Random position on screen (not too close to edges)
        const margin = 100;
        this.x = margin + Math.random() * (game.width - margin * 2);
        this.y = margin + Math.random() * (game.height - margin * 2);

        this.radius = 20;
        this.lifetime = 15; // Despawn after 15 seconds
        this.age = 0;
        this.pulseTimer = 0;

        // Visual properties based on type
        switch (type) {
            case 'speed':
                this.color = '#00ff00'; // Green
                this.icon = 'S';
                break;
            case 'slowmo':
                this.color = '#ff00ff'; // Purple/Magenta
                this.icon = 'T';
                break;
            case 'invulnerability':
                this.color = '#ffdd00'; // Gold
                this.icon = 'I';
                break;
            case 'health_recover':
                this.color = '#ff0000'; // Red
                this.icon = '+';
                break;
            case 'health_boost':
                this.color = '#ffaa00'; // Orange
                this.icon = '^';
                break;
        }
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

        // Pulsing effect
        const pulse = 1 + Math.sin(this.pulseTimer * 5) * 0.2;
        const size = this.radius * pulse;

        // Outer glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = this.color;

        // Draw glowing shape (hexagon)
        ctx.fillStyle = this.color;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const x = Math.cos(angle) * size;
            const y = Math.sin(angle) * size;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.fill();

        // Inner core
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Icon/Letter
        ctx.fillStyle = this.color;
        ctx.font = 'bold 16px Orbitron';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 5;
        ctx.fillText(this.icon, 0, 0);

        ctx.restore();
    }
}
