export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Lower volume
        this.masterGain.connect(this.ctx.destination);
    }

    playTone(freq, type, duration) {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    dash() {
        // Whoosh sound
        this.playTone(200, 'triangle', 0.1);
        this.playTone(400, 'sine', 0.2);
    }

    explosion() {
        // Noise buffer for explosion
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

        noise.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    powerUp() {
        // Arpeggio sound for power-up
        this.playTone(440, 'sine', 0.1);
        setTimeout(() => this.playTone(660, 'sine', 0.1), 50);
        setTimeout(() => this.playTone(880, 'sine', 0.1), 100);
    }

    gameOver() {
        this.playTone(100, 'sawtooth', 1.0);
        setTimeout(() => this.playTone(50, 'sawtooth', 1.0), 200);
    }
}
