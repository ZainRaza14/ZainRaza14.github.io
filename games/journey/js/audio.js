/* ============================================================
   Journey to the Light - audio.js
   All sound is synthesized with the Web Audio API so the game
   ships with zero audio assets. Exposes a global `GameAudio`.

   Sounds:
     - ambient: two soft detuned pads + filtered noise "wind"
     - footsteps: quiet filtered-noise ticks while running
     - jump: gentle sine sweep upward
     - collect: two-partial bell chime
     - fall: soft descending tone (never harsh)
   ============================================================ */

(function () {
    'use strict';

    var ctx = null;          // AudioContext, created lazily on first user input
    var master = null;       // master gain (mute control)
    var ambientNodes = [];   // running ambient graph nodes, for teardown
    var muted = false;
    var ambientOn = false;
    var ambientIntensity = null; // gain node scaled with progress

    /** Create the context on first gesture (required by autoplay policies). */
    function ensureContext() {
        if (ctx) return true;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            ctx = new AC();
            master = ctx.createGain();
            master.gain.value = muted ? 0 : 1;
            master.connect(ctx.destination);
            return true;
        } catch (e) {
            return false; // no audio support; every call below becomes a no-op
        }
    }

    /** White-noise buffer used by wind and footsteps. */
    function noiseBuffer(seconds) {
        var len = Math.floor(ctx.sampleRate * seconds);
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }

    /** Start the looping ambient bed: warm pads + wind. Idempotent. */
    function startAmbient() {
        if (!ensureContext() || ambientOn) return;
        ambientOn = true;

        // Intensity rises as the player approaches the light (see setProgress)
        ambientIntensity = ctx.createGain();
        ambientIntensity.gain.value = 0.5;
        ambientIntensity.connect(master);

        // --- two soft detuned pads a fifth apart ---
        var padFreqs = [110, 164.8]; // A2, E3
        padFreqs.forEach(function (f, idx) {
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            osc.detune.value = idx === 0 ? -4 : 5; // slight detune = warmth

            var g = ctx.createGain();
            g.gain.value = 0.035;

            // slow tremolo so the pad breathes
            var lfo = ctx.createOscillator();
            lfo.frequency.value = 0.08 + idx * 0.05;
            var lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.012;
            lfo.connect(lfoGain);
            lfoGain.connect(g.gain);

            osc.connect(g);
            g.connect(ambientIntensity);
            osc.start();
            lfo.start();
            ambientNodes.push(osc, lfo);
        });

        // --- wind: looping noise through a slowly wandering bandpass ---
        var wind = ctx.createBufferSource();
        wind.buffer = noiseBuffer(2.5);
        wind.loop = true;

        var bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 420;
        bp.Q.value = 0.6;

        var windGain = ctx.createGain();
        windGain.gain.value = 0.018;

        var windLfo = ctx.createOscillator();
        windLfo.frequency.value = 0.05;
        var windLfoGain = ctx.createGain();
        windLfoGain.gain.value = 180;
        windLfo.connect(windLfoGain);
        windLfoGain.connect(bp.frequency);

        wind.connect(bp);
        bp.connect(windGain);
        windGain.connect(ambientIntensity);
        wind.start();
        windLfo.start();
        ambientNodes.push(wind, windLfo);
    }

    /** Scale ambient warmth with journey progress (0..1). */
    function setProgress(p) {
        if (ambientIntensity && ctx) {
            var target = 0.5 + p * 0.5;
            ambientIntensity.gain.setTargetAtTime(target, ctx.currentTime, 2.0);
        }
    }

    /** One quiet footstep tick. Called by the game on step cadence. */
    function footstep() {
        if (!ctx || muted) return;
        var src = ctx.createBufferSource();
        src.buffer = noiseBuffer(0.05);

        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 320;

        var g = ctx.createGain();
        g.gain.setValueAtTime(0.05, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);

        src.connect(lp); lp.connect(g); g.connect(master);
        src.start();
    }

    /** Gentle rising sweep for a jump. */
    function jump() {
        if (!ensureContext() || muted) return;
        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + 0.14);

        var g = ctx.createGain();
        g.gain.setValueAtTime(0.09, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);

        osc.connect(g); g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
    }

    /** Bell chime for star collection - fundamental + soft third partial. */
    function collect() {
        if (!ensureContext() || muted) return;
        [880, 1318.5].forEach(function (f, i) {
            var osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;

            var g = ctx.createGain();
            var amp = i === 0 ? 0.08 : 0.03;
            g.gain.setValueAtTime(amp, ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);

            osc.connect(g); g.connect(master);
            osc.start();
            osc.stop(ctx.currentTime + 0.55);
        });
    }

    /** Soft descending tone on a fall - melancholy, not punishing. */
    function fall() {
        if (!ensureContext() || muted) return;
        var osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.7);

        var g = ctx.createGain();
        g.gain.setValueAtTime(0.07, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

        osc.connect(g); g.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 0.85);
    }

    /** Mute/unmute the whole mix. */
    function setMuted(m) {
        muted = m;
        if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
    }

    /** Resume the context after a user gesture if the browser suspended it. */
    function unlock() {
        if (ensureContext() && ctx.state === 'suspended') ctx.resume();
    }

    // Public API
    window.GameAudio = {
        startAmbient: startAmbient,
        setProgress: setProgress,
        footstep: footstep,
        jump: jump,
        collect: collect,
        fall: fall,
        setMuted: setMuted,
        unlock: unlock
    };
})();
