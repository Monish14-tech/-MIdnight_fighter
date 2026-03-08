export class AudioController {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3; // Lower volume
        this.masterGain.connect(this.ctx.destination);

        // Distortion Node for "Rock" feel
        this.distortion = this.ctx.createWaveShaper();
        this.distortion.curve = this.makeDistortionCurve(400);
        this.distortion.oversample = '4x';
        this.distortion.connect(this.masterGain);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.musicGain.connect(this.distortion);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
        this.sfxGain.connect(this.distortion);

        // Jet Engine Hum (Noise)
        this.jetNoise = null;
        this.jetGain = this.ctx.createGain();
        this.jetGain.gain.value = 0;
        this.jetGain.connect(this.masterGain);

        this.currentTrack = null;
        this.isPlayingMusic = false;
        this.trackLoops = new Map();

        // High-Quality BGM Support
        this.menuBuffer = null;
        this.gameplayBuffer = null;
        this.bgmSource = null;
        this.preloadBGM();

        // Music Mute Persistence
        this.musicEnabled = localStorage.getItem('midnight_music_enabled') !== 'false';
        this.updateMusicGain();
    }

    async preloadBGM() {
        // BGM Disabled as per user request (wants only game audio/SFX)
        // console.log('BGM Preload skipped (Disabled)');
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    startJetHum() {
        if (this.jetNoise) return;
        const duration = 2;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.jetNoise = this.ctx.createBufferSource();
        this.jetNoise.buffer = buffer;
        this.jetNoise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, this.ctx.currentTime);

        this.jetNoise.connect(filter);
        filter.connect(this.jetGain);
        this.jetGain.gain.setTargetAtTime(0.12, this.ctx.currentTime, 0.5);
        this.jetNoise.start();
    }

    stopJetHum() {
        if (this.jetGain) {
            this.jetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
        }
    }

    updateMusicGain() {
        this.musicGain.gain.setTargetAtTime(this.musicEnabled ? 0.5 : 0, this.ctx.currentTime, 0.1);
    }

    toggleMusic(enabled) {
        this.musicEnabled = enabled;
        this.updateMusicGain();
    }

    playTone(freq, type, duration, target = this.sfxGain, gainVal = 1) {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(target);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // --- SFX SUITE ---

    shoot(shipType = 'default') {
        // More aggressive cannon sound: Higher distortion and low-end kick
        const freq = shipType === 'quantum' ? 180 : 120;
        this.playTone(freq, 'square', 0.12, this.sfxGain, 0.6);
        // Short white noise burst for "mechanical" snap
        this.explosion(0.1);
    }

    playerHit() {
        // Metallic crunch when player takes damage
        this.playTone(150, 'sawtooth', 0.15, this.sfxGain, 0.7);
        this.explosion(0.5); // Gritty vibration
    }

    dash() {
        // Whoosh sweep
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.2);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.2);
    }

    explosion(size = 1) {
        const duration = 0.5 + (size * 0.3);
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            // Distorted noise for gritty debris feel
            const noise = (Math.random() * 2 - 1);
            data[i] = noise * (1 - i / bufferSize);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        // Much deeper, heavier explosion frequency
        filter.frequency.setValueAtTime(400 * size, this.ctx.currentTime);
        filter.Q.value = 5;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(size > 2 ? 2.5 : 1.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain);
        noise.start();

        // Sub-bass impact shockwave
        if (size > 0.5) {
            this.playTone(45, 'sine', 0.4, this.sfxGain, 1.2);
        }
    }

    enemyShot() {
        this.playTone(1200, 'sine', 0.05, this.sfxGain, 0.2);
    }

    bossHit() {
        // FM metallic clank
        const osc = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, this.ctx.currentTime);

        modulator.frequency.setValueAtTime(45, this.ctx.currentTime);
        modGain.gain.setValueAtTime(500, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

        modulator.connect(modGain);
        modGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        modulator.start();
        osc.stop(this.ctx.currentTime + 0.2);
        modulator.stop(this.ctx.currentTime + 0.2);
    }

    powerUp() {
        this.playTone(440, 'sine', 0.1, this.sfxGain, 0.6);
        setTimeout(() => this.playTone(660, 'sine', 0.1, this.sfxGain, 0.6), 50);
        setTimeout(() => this.playTone(880, 'sine', 0.15, this.sfxGain, 0.6), 100);
    }

    levelUp() {
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            setTimeout(() => this.playTone(freq, 'sine', 0.4, this.sfxGain, 0.5), i * 150);
        });
    }

    gameOver() {
        this.stopMusic();
        this.playTone(100, 'sawtooth', 1.0, this.sfxGain, 0.8);
        setTimeout(() => this.playTone(50, 'sawtooth', 1.5, this.sfxGain, 0.8), 200);
    }

    // --- MUSIC SYNTH ENGINE ---

    playTrack(trackName) {
        // Music playback disabled
        this.stopMusic();
    }

    stopMusic() {
        this.isPlayingMusic = false;
        this.trackLoops.forEach(timer => clearInterval(timer));
        this.trackLoops.clear();

        if (this.bgmSource) {
            try { this.bgmSource.stop(); } catch (e) { }
            this.bgmSource = null;
        }

        this.currentTrack = null;
    }

    playBGM(buffer) {
        if (!buffer || this.bgmSource) return;

        // Ensure context is running
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.bgmSource = this.ctx.createBufferSource();
        this.bgmSource.buffer = buffer;
        this.bgmSource.loop = true;
        this.bgmSource.connect(this.musicGain);
        this.bgmSource.start(0);
    }

    startMenuTrack() {
        if (this.menuBuffer) {
            this.playBGM(this.menuBuffer);
            return;
        }
        let step = 0;
        const loop = () => {
            if (!this.isPlayingMusic || this.currentTrack !== 'menu') return;

            // Subtle "Terminator" Heartbeat (ta-ta ta ta-ta)
            const heartbeat = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0];
            if (heartbeat[step % heartbeat.length]) {
                this.playTone(60, 'square', 0.1, this.musicGain, 0.05);
            }

            // Distorted, distant melody motif (D, F, G, D)
            const motif = [73.42, 87.31, 98.00, 73.42]; // D2, F2, G2, D2
            if (step % 24 === 0) {
                const note = motif[(step / 24) % motif.length];
                this.playTone(note, 'sawtooth', 2.0, this.musicGain, 0.08);
            }
            step = (step + 1) % 96;
        };
        loop();
        this.trackLoops.set('menu', setInterval(loop, 200));
    }

    startGameplayTrack() {
        if (this.gameplayBuffer) {
            this.playBGM(this.gameplayBuffer);
            return;
        }
        let step = 0;
        const loop = () => {
            if (!this.isPlayingMusic || this.currentTrack !== 'gameplay') return;

            // Iconic Terminator Rhythm (ta-ta ta ta-ta)
            const rhythm = [1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0];
            if (rhythm[step % rhythm.length]) {
                // Anvil/Metallic sound
                this.playTone(50, 'square', 0.1, this.musicGain, 0.2);
                this.explosion(0.1);
            }

            // The Melody (D, F, G, D) - High Intensity
            const melody = [146.83, 174.61, 196.00, 146.83]; // D3, F3, G3, D3
            if (step % 32 === 0) {
                const note = melody[(step / 32) % melody.length];
                this.playTone(note, 'sawtooth', 1.0, this.musicGain, 0.15);
                // Power Chord feel
                this.playTone(note * 1.5, 'square', 1.0, this.musicGain, 0.1);
            }

            step = (step + 1) % 128;
        };
        loop();
        this.trackLoops.set('gameplay', setInterval(loop, 120));
    }

    startBossTrack() {
        if (this.gameplayBuffer) {
            this.playBGM(this.gameplayBuffer);
            return;
        }
        let step = 0;
        const loop = () => {
            if (!this.isPlayingMusic || this.currentTrack !== 'boss') return;

            // Aggressive Industrial Pulse
            this.playTone(step % 2 === 0 ? 55 : 45, 'square', 0.1, this.musicGain, 0.3);

            // Fast, distorted Terminator melody
            const melody = [293.66, 349.23, 392.00, 293.66]; // D4, F4, G4, D4
            if (step % 16 === 0) {
                this.playTone(melody[(step / 16) % melody.length], 'sawtooth', 0.4, this.musicGain, 0.2);
            }

            // Screeching siren every 8 steps
            if (step % 8 === 4) {
                this.playTone(1200, 'sawtooth', 0.8, this.musicGain, 0.15);
            }

            step = (step + 1) % 64;
        };
        loop();
        this.trackLoops.set('boss', setInterval(loop, 150));
    }
}
