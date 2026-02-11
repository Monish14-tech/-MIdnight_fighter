export class ScreenShake {
    constructor() {
        this.duration = 0;
        this.intensity = 0;
        this.offsetX = 0;
        this.offsetY = 0;
    }

    trigger(intensity, duration) {
        this.intensity = intensity;
        this.duration = duration;
    }

    update(deltaTime) {
        if (this.duration > 0) {
            this.duration -= deltaTime;
            this.offsetX = (Math.random() * 2 - 1) * this.intensity;
            this.offsetY = (Math.random() * 2 - 1) * this.intensity;
        } else {
            this.offsetX = 0;
            this.offsetY = 0;
        }
    }
}
