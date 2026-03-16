export class NotificationManager {
    constructor(game) {
        this.game = game;
        this.container = document.getElementById('notification-container');

        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.style.position = 'fixed';
            this.container.style.top = '64px';
            this.container.style.right = '14px';
            this.container.style.zIndex = '5000';
            this.container.style.display = 'flex';
            this.container.style.flexDirection = 'column';
            this.container.style.gap = '8px';
            this.container.style.pointerEvents = 'none';
            document.body.appendChild(this.container);
        }
    }

    notify(title, message = '') {
        if (!this.container) return;

        const item = document.createElement('div');
        item.style.minWidth = '240px';
        item.style.maxWidth = '360px';
        item.style.background = 'rgba(5, 10, 22, 0.92)';
        item.style.border = '1px solid rgba(0, 243, 255, 0.65)';
        item.style.boxShadow = '0 0 12px rgba(0, 243, 255, 0.35)';
        item.style.borderRadius = '8px';
        item.style.padding = '10px 12px';
        item.style.color = '#dffcff';
        item.style.fontFamily = "Orbitron, 'Courier New', monospace";
        item.style.opacity = '0';
        item.style.transform = 'translateY(-6px)';
        item.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

        const titleEl = document.createElement('div');
        titleEl.textContent = title;
        titleEl.style.color = '#00f3ff';
        titleEl.style.fontWeight = '700';
        titleEl.style.fontSize = '0.78rem';
        titleEl.style.marginBottom = message ? '4px' : '0';

        item.appendChild(titleEl);

        if (message) {
            const messageEl = document.createElement('div');
            messageEl.textContent = message;
            messageEl.style.color = '#ffffff';
            messageEl.style.fontSize = '0.72rem';
            messageEl.style.lineHeight = '1.35';
            item.appendChild(messageEl);
        }

        this.container.appendChild(item);

        requestAnimationFrame(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(-6px)';
            setTimeout(() => item.remove(), 220);
        }, 2600);
    }
}
