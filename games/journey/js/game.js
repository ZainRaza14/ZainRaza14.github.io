/* ============================================================
   Journey to the Light - game.js
   The core loop: world rendering, spawning, scoring, difficulty,
   progression toward the light. Boots the whole game.

   Design notes:
   - Delta-time loop, capped at 33ms so tab-switches don't warp physics.
   - Speed increases every 20 seconds of a run.
   - "Perfect" multiplier: pass 10 hazards in a row and score
     accumulates at x2 until the run ends.
   - Progress (0..1 over ~3 minutes) drives the world getting
     brighter: horizon light grows, flowers appear, air fills
     with soft particles, ambient audio warms.
   ============================================================ */

(function () {
    'use strict';

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;          // CSS-pixel viewport
    var SCALE = 1;             // responsive world scale
    var groundY = 0;           // baseline the player runs on

    // ---- run state ----
    var STATE = { MENU: 0, PLAY: 1, PAUSE: 2, OVER: 3 };
    var state = STATE.MENU;

    var score = 0;
    var starsThisRun = 0;
    var runTime = 0;           // seconds in current run
    var baseSpeed = 300;       // world scroll px/s at scale 1
    var speedLevel = 0;        // +1 every 20s
    var streak = 0;            // consecutive hazards passed
    var multiplier = 1;        // 2 when streak >= 10 ("perfect run")
    var progress = 0;          // 0..1 journey to the light (caps at 1)

    var hazardTimer = 0;
    var starTimer = 0;

    var sky = 'night';         // equipped sky theme, set by UI

    // ---- ambient scenery (pooled, all pre-allocated) ----
    var bgStars = [];          // twinkling sky stars
    var airParticles = [];     // soft floating motes (grow with progress)
    var flowers = [];          // ground flowers (appear with progress)
    var hills = [[], []];      // two parallax silhouette layers

    var t = 0;                 // global clock for shader-ish wobbles

    function rand(a, b) { return a + Math.random() * (b - a); }

    // -------------------- layout --------------------

    function resize() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

        // scale the world so the game feels the same on phones and desktops
        SCALE = Math.max(0.7, Math.min(1.25, Math.min(W / 900, H / 600)));
        groundY = H - Math.max(60, H * 0.14);
        Player.state.x = Math.max(70, W * 0.16);

        buildScenery();
    }

    /** Pre-allocate all decorative elements (no allocation during play). */
    function buildScenery() {
        var i;

        bgStars.length = 0;
        var starCount = Math.floor(W * H / 6000);
        for (i = 0; i < starCount; i++) {
            bgStars.push({
                x: Math.random() * W,
                y: Math.random() * groundY * 0.85,
                size: rand(0.4, 1.7),
                tw: rand(0, Math.PI * 2),
                tws: rand(0.4, 1.6),
                depth: rand(0.02, 0.08)  // slow parallax drift
            });
        }

        airParticles.length = 0;
        for (i = 0; i < 60; i++) {
            airParticles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: rand(0.8, 2.4),
                vy: rand(-6, -14),
                vx: rand(-4, 4),
                phase: rand(0, Math.PI * 2)
            });
        }

        flowers.length = 0;
        for (i = 0; i < 26; i++) {
            flowers.push({
                x: rand(0, W * 1.4),
                stem: rand(6, 14),
                hue: Math.random() < 0.5 ? '#ff9aa8' : '#b79df2',
                sway: rand(0, Math.PI * 2)
            });
        }

        // rolling hill silhouettes: arrays of height samples
        for (var l = 0; l < 2; l++) {
            hills[l].length = 0;
            var seg = 24;
            for (i = 0; i <= seg; i++) {
                hills[l].push(rand(0.25, 1));
            }
        }
    }

    // -------------------- run lifecycle --------------------

    function startRun() {
        score = 0;
        starsThisRun = 0;
        runTime = 0;
        speedLevel = 0;
        streak = 0;
        multiplier = 1;
        progress = 0;
        hazardTimer = 1.4;
        starTimer = 2.2;

        Player.reset(groundY, SCALE);
        Obstacles.reset();

        UI.setScore(0);
        UI.setBestHud();
        UI.setStarsHud();
        UI.setMultiplier(false);
        UI.show(null);          // hide all screens, show HUD

        GameAudio.unlock();
        GameAudio.startAmbient();
        state = STATE.PLAY;
    }

    function pauseGame() {
        if (state !== STATE.PLAY) return;
        state = STATE.PAUSE;
        UI.show('pause');
    }

    function resumeGame() {
        if (state !== STATE.PAUSE) return;
        UI.show(null);
        state = STATE.PLAY;
    }

    function quitToMenu() {
        state = STATE.MENU;
        UI.show('menu');
    }

    function endRun() {
        state = STATE.OVER;
        GameAudio.fall();
        UI.runEnded(score, starsThisRun);
    }

    // -------------------- update --------------------

    function currentSpeed() {
        // +12% per 20-second level, scaled for screen size
        return baseSpeed * SCALE * (1 + speedLevel * 0.12);
    }

    function update(dt) {
        t += dt;

        if (state !== STATE.PLAY) return;

        runTime += dt;
        progress = Math.min(1, runTime / 180); // full brightness at ~3 minutes
        GameAudio.setProgress(progress);

        // difficulty step every 20 seconds
        var newLevel = Math.floor(runTime / 20);
        if (newLevel !== speedLevel) speedLevel = newLevel;

        var speed = currentSpeed();
        var speedFactor = speed / (baseSpeed * SCALE);

        // score: distance-based, doubled on a perfect streak
        score += dt * 10 * speedFactor * multiplier;
        UI.setScore(score);

        // player physics + animation
        Player.update(dt, groundY, speedFactor);

        // spawn hazards with a gap that respects the current speed
        hazardTimer -= dt;
        if (hazardTimer <= 0) {
            Obstacles.spawnHazard(W, groundY, SCALE, progress);
            // minimum gap shrinks as speed rises but never becomes unfair
            hazardTimer = rand(1.05, 1.9) * (1 / (0.75 + speedFactor * 0.25));
        }

        // spawn star arcs on their own rhythm
        starTimer -= dt;
        if (starTimer <= 0) {
            Obstacles.spawnStars(W, groundY, SCALE);
            starTimer = rand(3.5, 6);
        }

        // world scroll + pass tracking (streak feeds the multiplier)
        Obstacles.update(dt, speed, function () {
            streak++;
            if (streak >= 10 && multiplier === 1) {
                multiplier = 2;
                UI.setMultiplier(true);
            }
        });

        // star pickups
        var got = Obstacles.collectStars(SCALE);
        if (got > 0) {
            starsThisRun += got;
            score += got * 25 * multiplier;
            GameAudio.collect();
        }

        // collision = the run ends (gently)
        if (Obstacles.hitsPlayer(SCALE)) {
            endRun();
            return;
        }

        // drifting air motes (density handled at draw time via progress)
        if (!window.JourneySettings.reducedMotion) {
            for (var i = 0; i < airParticles.length; i++) {
                var p = airParticles[i];
                p.x += (p.vx - speed * 0.03) * dt;
                p.y += p.vy * dt;
                if (p.y < -10 || p.x < -10) {
                    p.x = rand(0, W + 40);
                    p.y = H + 10;
                }
            }
            // flowers scroll with the ground
            for (var f = 0; f < flowers.length; f++) {
                flowers[f].x -= speed * 0.9 * dt;
                if (flowers[f].x < -20) flowers[f].x = W + rand(0, W * 0.4);
            }
        }
    }

    // -------------------- render --------------------

    /** Sky gradient per theme, brightening with progress. */
    function drawSky() {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        var lift = progress * 0.5; // dawn approaches as she travels

        if (sky === 'aurora') {
            g.addColorStop(0, '#071224');
            g.addColorStop(0.6, '#0b1e2e');
            g.addColorStop(1, '#10303a');
        } else if (sky === 'nebula') {
            g.addColorStop(0, '#0d0a24');
            g.addColorStop(0.6, '#180f33');
            g.addColorStop(1, '#241242');
        } else if (sky === 'crescent') {
            g.addColorStop(0, '#050914');
            g.addColorStop(1, '#101a33');
        } else { // deep night
            g.addColorStop(0, '#04070f');
            g.addColorStop(1, '#0b1226');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // warm dawn wash grows over everything with progress
        if (lift > 0.02) {
            var dawn = ctx.createLinearGradient(0, 0, 0, H);
            dawn.addColorStop(0, 'rgba(255, 190, 120, 0)');
            dawn.addColorStop(1, 'rgba(255, 190, 120, ' + (lift * 0.22) + ')');
            ctx.fillStyle = dawn;
            ctx.fillRect(0, 0, W, H);
        }

        // theme extras
        if (sky === 'aurora') {
            // soft green ribbons
            for (var a = 0; a < 2; a++) {
                ctx.globalAlpha = 0.10 + a * 0.04;
                ctx.fillStyle = '#6fd6a8';
                ctx.beginPath();
                for (var x = 0; x <= W; x += 24) {
                    var y = H * 0.18 + a * 46 + Math.sin(x * 0.008 + t * 0.4 + a * 2) * 26;
                    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.lineTo(W, 0); ctx.lineTo(0, 0);
                ctx.closePath();
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        } else if (sky === 'crescent') {
            // large gentle crescent moon
            var mx = W * 0.78, my = H * 0.2, mr = 34 * SCALE;
            ctx.fillStyle = 'rgba(230, 238, 255, 0.9)';
            ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#101a33';
            ctx.beginPath(); ctx.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.86, 0, Math.PI * 2); ctx.fill();
            var mg = ctx.createRadialGradient(mx, my, mr, mx, my, mr * 4);
            mg.addColorStop(0, 'rgba(180, 205, 255, 0.14)');
            mg.addColorStop(1, 'rgba(180, 205, 255, 0)');
            ctx.fillStyle = mg;
            ctx.beginPath(); ctx.arc(mx, my, mr * 4, 0, Math.PI * 2); ctx.fill();
        } else if (sky === 'nebula') {
            // hazy violet clouds
            for (var n = 0; n < 3; n++) {
                var nx = ((n * 0.37 + 0.15) * W + Math.sin(t * 0.05 + n) * 30);
                var ny = H * (0.12 + n * 0.14);
                var ng = ctx.createRadialGradient(nx, ny, 10, nx, ny, 150 * SCALE);
                ng.addColorStop(0, 'rgba(183, 157, 242, 0.10)');
                ng.addColorStop(1, 'rgba(183, 157, 242, 0)');
                ctx.fillStyle = ng;
                ctx.beginPath(); ctx.arc(nx, ny, 150 * SCALE, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            // deep night: standard soft moon glow top-right
            var gg = ctx.createRadialGradient(W * 0.8, H * 0.16, 6, W * 0.8, H * 0.16, 130 * SCALE);
            gg.addColorStop(0, 'rgba(200, 220, 255, 0.22)');
            gg.addColorStop(1, 'rgba(200, 220, 255, 0)');
            ctx.fillStyle = gg;
            ctx.beginPath(); ctx.arc(W * 0.8, H * 0.16, 130 * SCALE, 0, Math.PI * 2); ctx.fill();
        }
    }

    /** Twinkling sky stars - brighter as the journey progresses. */
    function drawBgStars() {
        var boost = 0.5 + progress * 0.5;
        for (var i = 0; i < bgStars.length; i++) {
            var s = bgStars[i];
            var a = (0.25 + Math.abs(Math.sin(s.tw + t * s.tws)) * 0.75) * boost;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#ffffff';
            var sx = (s.x - t * s.depth * 20) % W;
            if (sx < 0) sx += W;
            ctx.fillRect(sx, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
    }

    /** The destination: an enormous, calm light on the horizon. */
    function drawHorizonLight() {
        var cx = W * 0.86;
        var cy = groundY - 8;
        var base = 60 * SCALE;
        var r = base + progress * W * 0.35;              // grows with progress
        var strength = 0.14 + progress * 0.5;

        var g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
        g.addColorStop(0, 'rgba(255, 236, 190, ' + strength + ')');
        g.addColorStop(0.4, 'rgba(255, 217, 138, ' + strength * 0.5 + ')');
        g.addColorStop(1, 'rgba(255, 217, 138, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // soft golden rays, fanned upward - kept subtle
        if (!window.JourneySettings.reducedMotion) {
            ctx.save();
            ctx.translate(cx, cy);
            for (var i = 0; i < 5; i++) {
                var ang = -Math.PI / 2 + (i - 2) * 0.32 + Math.sin(t * 0.3 + i) * 0.03;
                ctx.rotate(0); // rotation folded into gradient line below
                var len = r * 1.15;
                var rayG = ctx.createLinearGradient(0, 0, Math.cos(ang) * len, Math.sin(ang) * len);
                rayG.addColorStop(0, 'rgba(255, 226, 160, ' + (0.10 + progress * 0.12) + ')');
                rayG.addColorStop(1, 'rgba(255, 226, 160, 0)');
                ctx.fillStyle = rayG;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(ang - 0.05) * len, Math.sin(ang - 0.05) * len);
                ctx.lineTo(Math.cos(ang + 0.05) * len, Math.sin(ang + 0.05) * len);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
    }

    /** Two parallax hill silhouettes behind the ground. */
    function drawHills() {
        for (var l = 0; l < 2; l++) {
            var layer = hills[l];
            var hMax = (l === 0 ? 90 : 50) * SCALE;
            var yBase = groundY - (l === 0 ? 8 : 2);
            var drift = (t * (l === 0 ? 6 : 14)) % W;

            ctx.fillStyle = l === 0 ? 'rgba(10, 16, 34, 0.9)' : 'rgba(7, 11, 24, 0.95)';
            ctx.beginPath();
            ctx.moveTo(0, yBase);
            var seg = layer.length - 1;
            for (var i = 0; i <= seg; i++) {
                var x = (i / seg) * (W + 80) - drift % 80;
                var y = yBase - layer[i] * hMax;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, yBase);
            ctx.closePath();
            ctx.fill();
        }
    }

    /** Ground plane + flowers that bloom as the world brightens. */
    function drawGround() {
        var g = ctx.createLinearGradient(0, groundY, 0, H);
        g.addColorStop(0, '#0c1330');
        g.addColorStop(1, '#060a18');
        ctx.fillStyle = g;
        ctx.fillRect(0, groundY, W, H - groundY);

        // ground line catches the horizon light
        ctx.strokeStyle = 'rgba(255, 217, 138, ' + (0.12 + progress * 0.25) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // flowers appear gradually: count shown scales with progress
        var visible = Math.floor(flowers.length * progress);
        for (var i = 0; i < visible; i++) {
            var f = flowers[i];
            var sway = Math.sin(t * 1.6 + f.sway) * 1.5;
            ctx.strokeStyle = 'rgba(110, 160, 120, 0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(f.x, groundY);
            ctx.lineTo(f.x + sway, groundY - f.stem * SCALE);
            ctx.stroke();
            ctx.fillStyle = f.hue;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(f.x + sway, groundY - f.stem * SCALE, 2.2 * SCALE, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    /** Soft floating motes filling the air as she nears the light. */
    function drawAirParticles() {
        if (window.JourneySettings.reducedMotion) return;
        var visible = Math.floor(airParticles.length * (0.25 + progress * 0.75));
        for (var i = 0; i < visible; i++) {
            var p = airParticles[i];
            var a = 0.10 + Math.abs(Math.sin(t + p.phase)) * 0.22;
            ctx.globalAlpha = a * (0.4 + progress * 0.6);
            ctx.fillStyle = '#ffe9b8';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function render() {
        drawSky();
        drawBgStars();
        drawHorizonLight();
        drawHills();
        drawGround();

        Obstacles.draw(ctx, t, SCALE, progress);
        Player.drawTrail(ctx);
        Player.draw(ctx, t);

        drawAirParticles();
    }

    // -------------------- main loop --------------------

    var last = 0;
    function loop(ts) {
        var dt = Math.min(0.033, (ts - last) / 1000 || 0.016);
        last = ts;
        update(dt);
        render();
        requestAnimationFrame(loop);
    }

    // -------------------- input --------------------

    function onAction() {
        GameAudio.unlock();
        if (state === STATE.PLAY) Player.requestJump();
    }

    window.addEventListener('keydown', function (e) {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            onAction();
        }
        if (e.code === 'Escape' || e.code === 'KeyP') {
            state === STATE.PLAY ? pauseGame() : resumeGame();
        }
    });

    canvas.addEventListener('mousedown', onAction);
    canvas.addEventListener('touchstart', function (e) {
        e.preventDefault();
        onAction();
    }, { passive: false });

    document.getElementById('pause-btn').addEventListener('click', pauseGame);
    window.addEventListener('resize', resize);
    // auto-pause when the tab loses focus - never lose a run unfairly
    document.addEventListener('visibilitychange', function () {
        if (document.hidden && state === STATE.PLAY) pauseGame();
    });

    // -------------------- boot --------------------

    window.Game = {
        setSky: function (s) { sky = s; }
    };

    resize();
    UI.bindButtons(startRun, resumeGame, quitToMenu);
    UI.applyCosmetics();     // load saved cosmetics into player + sky
    UI.setBestHud();
    UI.setStarsHud();
    Player.reset(groundY, SCALE);
    UI.show('menu');
    requestAnimationFrame(loop);
})();
