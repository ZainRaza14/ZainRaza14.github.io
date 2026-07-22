/* ============================================================
   Journey to the Light - game.js  (platformer edition)
   Mario-style side-scroller through a savanna dusk that warms
   into a golden sunrise as the girl travels toward the light.

   Design notes:
   - WORLD coordinates + a camera that eases after the player.
   - Level generation is chunked: ground runs, jumpable pits,
     floating ledges with star arcs, hazards on surfaces, and
     acacia-tree scenery. Generated ahead of the camera,
     pruned behind it. All entity pools are fixed-size.
   - Score = distance traveled (in steps of 10px) x combo tier.
   - Progress (0..1 over ~4000px) drives the sunrise: the sun
     climbs and grows, the sky warms, grass and flowers appear.
   - Falling into a pit or touching a hazard ends the run gently.
   ============================================================ */

(function () {
    'use strict';

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');

    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0;
    var SCALE = 1;
    var groundY = 0;           // default ground height (world y of surface)

    // ---- run state ----
    var STATE = { MENU: 0, PLAY: 1, PAUSE: 2, OVER: 3 };
    var state = STATE.MENU;

    var score = 0;
    var starsThisRun = 0;
    var runTime = 0;
    var streak = 0;
    var multiplier = 1;
    var progress = 0;          // 0..1 sunrise progress by distance
    var newBestShown = false;
    var bestDistShown = 0;

    var camX = 0;              // camera left edge in world coords
    var maxX = 0;              // farthest the player has reached

    var sky = 'night';         // equipped sky theme key (savanna variants)

    // ---- level data (world coords) ----
    var solids = [];           // {x, y, w} platform tops (ground + ledges)
    var trees = [];            // acacia scenery {x, y, size, seed}
    var grass = [];            // grass tufts {x, y, seed}
    var genX = 0;              // generation frontier

    // floating popups (pooled)
    var popups = [];
    for (var _pi = 0; _pi < 8; _pi++) {
        popups.push({ text: '', x: 0, y: 0, life: 0, max: 1, color: '#fff' });
    }

    function spawnPopup(text, x, y, color, seconds) {
        for (var i = 0; i < popups.length; i++) {
            if (popups[i].life <= 0) {
                popups[i].text = text;
                popups[i].x = x;      // world coords unless fixed=true
                popups[i].y = y;
                popups[i].life = seconds;
                popups[i].max = seconds;
                popups[i].color = color;
                return popups[i];
            }
        }
        return null;
    }

    // background stars + air motes (screen-space, pre-allocated)
    var bgStars = [];
    var airParticles = [];
    var t = 0;

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

        SCALE = Math.max(0.7, Math.min(1.25, Math.min(W / 900, H / 600)));
        groundY = H - Math.max(60, H * 0.14);

        bgStars.length = 0;
        var starCount = Math.floor(W * H / 6500);
        for (var i = 0; i < starCount; i++) {
            bgStars.push({
                x: Math.random() * W,
                y: Math.random() * groundY * 0.7,
                size: rand(0.4, 1.7),
                tw: rand(0, Math.PI * 2),
                tws: rand(0.4, 1.6)
            });
        }

        airParticles.length = 0;
        for (var p = 0; p < 50; p++) {
            airParticles.push({
                x: Math.random() * W,
                y: Math.random() * H,
                size: rand(0.8, 2.4),
                vy: rand(-6, -14),
                vx: rand(-4, 4),
                phase: rand(0, Math.PI * 2)
            });
        }
    }

    // -------------------- level generation --------------------

    /**
     * Extend the level to cover camX + 1.5 screens. Chunk types:
     *  - flat run (maybe with a hazard, maybe a star arc)
     *  - pit (jumpable gap)
     *  - ledge (floating platform above ground with stars/hazard)
     *  - tree (acacia scenery on the ground run)
     */
    function generate() {
        while (genX < camX + W * 1.8) {
            var roll = Math.random();
            var runW;

            if (genX < W * 0.8) {
                // opening stretch: safe flat ground to learn controls
                runW = W * 0.9;
                solids.push({ x: genX, y: groundY, w: runW });
                genX += runW;
                continue;
            }

            if (roll < 0.16) {
                // ---- pit ----
                var gap = rand(80, 150) * SCALE;
                genX += gap;
            } else {
                // ---- ground run ----
                runW = rand(260, 520) * SCALE;
                solids.push({ x: genX, y: groundY, w: runW });

                // dress the run
                var deco = Math.random();
                if (deco < 0.5) {
                    Obstacles.addHazardAt(genX + runW * rand(0.35, 0.6), groundY, progress);
                }
                if (deco > 0.35 && deco < 0.75) {
                    Obstacles.addStarsAt(genX + runW * rand(0.4, 0.7), groundY, SCALE, 0, 45);
                }
                if (Math.random() < 0.4) {
                    trees.push({ x: genX + runW * rand(0.1, 0.9), y: groundY, size: rand(0.7, 1.25), seed: Math.random() });
                }
                for (var g = 0; g < 4; g++) {
                    grass.push({ x: genX + runW * Math.random(), y: groundY, seed: Math.random() });
                }

                // ---- optional floating ledge above this run ----
                if (Math.random() < 0.45 && runW > 320 * SCALE) {
                    var lw = rand(110, 190) * SCALE;
                    var lx = genX + runW * rand(0.25, 0.55);
                    var ly = groundY - rand(95, 150) * SCALE;
                    solids.push({ x: lx, y: ly, w: lw });
                    // ledges reward the climb: stars up top, sometimes a hazard
                    Obstacles.addStarsAt(lx + lw / 2, ly, SCALE, 3 + Math.floor(Math.random() * 2), 40);
                    if (Math.random() < 0.25) {
                        Obstacles.addHazardAt(lx + lw * 0.5, ly, progress);
                    }
                }

                genX += runW;
            }
        }

        // prune far-behind geometry/scenery
        var cut = camX - 400;
        var i;
        for (i = solids.length - 1; i >= 0; i--) {
            if (solids[i].x + solids[i].w < cut) solids.splice(i, 1);
        }
        for (i = trees.length - 1; i >= 0; i--) {
            if (trees[i].x < cut) trees.splice(i, 1);
        }
        for (i = grass.length - 1; i >= 0; i--) {
            if (grass[i].x < cut) grass.splice(i, 1);
        }
    }

    // -------------------- run lifecycle --------------------

    function startRun() {
        score = 0;
        starsThisRun = 0;
        runTime = 0;
        streak = 0;
        multiplier = 1;
        progress = 0;
        newBestShown = false;
        camX = 0;
        maxX = 0;
        genX = 0;
        solids.length = 0;
        trees.length = 0;
        grass.length = 0;
        for (var pi = 0; pi < popups.length; pi++) popups[pi].life = 0;

        Obstacles.reset();
        generate();
        Player.reset(Math.max(70, W * 0.16), groundY, SCALE);

        UI.setScore(0);
        UI.setBestHud();
        UI.setStarsHud();
        UI.setMultiplier(1);
        UI.show(null);

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

    function update(dt) {
        t += dt;
        if (state !== STATE.PLAY) return;

        runTime += dt;

        // ---- input intents -> player ----
        Player.state.moveDir = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
        var landed = Player.update(dt, solids);
        if (landed) landPuff();

        // ---- camera eases toward keeping her at 35% of screen ----
        var targetCam = Player.state.x - W * 0.35;
        if (targetCam < 0) targetCam = 0;
        camX += (targetCam - camX) * Math.min(1, dt * 6);

        generate();

        // ---- distance score ----
        if (Player.state.x > maxX) {
            var gained = (Player.state.x - maxX) / 10;
            score += gained * multiplier;
            maxX = Player.state.x;
        }
        UI.setScore(score);
        progress = Math.min(1, maxX / 4000);
        GameAudio.setProgress(progress);

        if (!newBestShown && UI.state.best > 0 && score > UI.state.best) {
            newBestShown = true;
            spawnPopup('new best!', Player.state.x, groundY - 170 * SCALE, '#ffd98a', 1.6);
        }

        // ---- obstacles: passes build the combo ----
        Obstacles.update(dt, camX, Player.state.x, function () {
            streak++;
            if (streak === 5) {
                multiplier = 2;
                UI.setMultiplier(2);
                spawnPopup('combo x2', Player.state.x, groundY - 100 * SCALE, '#ffd98a', 1.1);
            } else if (streak === 15) {
                multiplier = 3;
                UI.setMultiplier(3);
                spawnPopup('combo x3', Player.state.x, groundY - 100 * SCALE, '#ffd98a', 1.1);
            }
        });

        // ---- stars ----
        var got = Obstacles.collectStars(SCALE);
        if (got > 0) {
            starsThisRun += got;
            score += got * 25 * multiplier;
            GameAudio.collect();
            spawnPopup('+' + (got * 25 * multiplier), Player.state.x + 26 * SCALE, Player.state.y - 70 * SCALE, '#ffe9b8', 0.9);
        }

        // ---- death: hazard touch or falling into a pit ----
        if (Obstacles.hitsPlayer(SCALE) || Player.state.y > H + 80) {
            endRun();
            return;
        }

        // ---- ambient particles ----
        if (!window.JourneySettings.reducedMotion) {
            for (var i = 0; i < airParticles.length; i++) {
                var p = airParticles[i];
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                if (p.y < -10) { p.x = Math.random() * W; p.y = H + 10; }
                if (p.x < -10) p.x = W + 10;
                if (p.x > W + 10) p.x = -10;
            }
        }

        for (var pp = 0; pp < popups.length; pp++) {
            if (popups[pp].life > 0) popups[pp].life -= dt;
        }
    }

    /** Small dust puff where she lands - platformer juice. */
    var puffs = [];
    for (var _pf = 0; _pf < 12; _pf++) puffs.push({ x: 0, y: 0, life: 0, vx: 0 });

    function landPuff() {
        if (window.JourneySettings.reducedMotion) return;
        for (var n = 0; n < 4; n++) {
            for (var i = 0; i < puffs.length; i++) {
                if (puffs[i].life <= 0) {
                    puffs[i].x = Player.state.x + rand(-8, 8) * SCALE;
                    puffs[i].y = Player.state.y - 2;
                    puffs[i].vx = rand(-40, 40);
                    puffs[i].life = 0.5;
                    break;
                }
            }
        }
    }

    // -------------------- render: savanna sunrise --------------------

    /**
     * Sky per theme; all are savanna palettes that warm with progress.
     *  night    -> "Dusk":    deep plum to burnt orange horizon
     *  crescent -> "Sunset":  vivid orange-magenta
     *  aurora   -> "Emerald Veld": teal-gold horizon
     *  nebula   -> "Violet Night": magenta-violet
     */
    function drawSky() {
        var g = ctx.createLinearGradient(0, 0, 0, H);
        if (sky === 'crescent') {
            g.addColorStop(0, '#3a1440');
            g.addColorStop(0.5, '#8a2e50');
            g.addColorStop(1, '#e8703a');
        } else if (sky === 'aurora') {
            g.addColorStop(0, '#0e2a35');
            g.addColorStop(0.55, '#1e5548');
            g.addColorStop(1, '#c98a3a');
        } else if (sky === 'nebula') {
            g.addColorStop(0, '#2a1050');
            g.addColorStop(0.55, '#5c2168');
            g.addColorStop(1, '#a84470');
        } else { // 'night' -> Dusk (default)
            g.addColorStop(0, '#2a1438');
            g.addColorStop(0.55, '#6b2650');
            g.addColorStop(1, '#c85a34');
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // sunrise wash strengthens with progress
        var dawn = ctx.createLinearGradient(0, 0, 0, H);
        dawn.addColorStop(0, 'rgba(255, 170, 90, 0)');
        dawn.addColorStop(1, 'rgba(255, 190, 110, ' + (0.10 + progress * 0.30) + ')');
        ctx.fillStyle = dawn;
        ctx.fillRect(0, 0, W, H);
    }

    /** The sun: huge on the horizon, climbing and brightening. */
    function drawSun() {
        var sunX = W * 0.72;
        var sunY = groundY - 30 - progress * H * 0.22;
        var r = (55 + progress * 40) * SCALE;

        var glow = ctx.createRadialGradient(sunX, sunY, r * 0.4, sunX, sunY, r * 4);
        glow.addColorStop(0, 'rgba(255, 200, 120, ' + (0.35 + progress * 0.25) + ')');
        glow.addColorStop(1, 'rgba(255, 170, 90, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r * 4, 0, Math.PI * 2);
        ctx.fill();

        var body = ctx.createRadialGradient(sunX - r * 0.25, sunY - r * 0.25, r * 0.1, sunX, sunY, r);
        body.addColorStop(0, '#fff3d6');
        body.addColorStop(0.6, '#ffd98a');
        body.addColorStop(1, '#ff9d5c');
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(sunX, sunY, r, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawBgStars() {
        // stars fade out as the sun rises
        var vis = 1 - progress * 0.8;
        if (vis <= 0.05) return;
        for (var i = 0; i < bgStars.length; i++) {
            var s = bgStars[i];
            ctx.globalAlpha = (0.2 + Math.abs(Math.sin(s.tw + t * s.tws)) * 0.6) * vis;
            ctx.fillStyle = '#fff2dd';
            ctx.fillRect(s.x, s.y, s.size, s.size);
        }
        ctx.globalAlpha = 1;
    }

    /** Distant savanna horizon bands (parallax, screen-space-ish). */
    function drawHorizon() {
        var bands = [
            { p: 0.15, h: 60, color: 'rgba(90, 40, 70, 0.55)' },
            { p: 0.3, h: 36, color: 'rgba(60, 26, 54, 0.7)' }
        ];
        for (var b = 0; b < bands.length; b++) {
            var band = bands[b];
            var off = (camX * band.p) % (W * 2);
            ctx.fillStyle = band.color;
            ctx.beginPath();
            ctx.moveTo(0, groundY);
            for (var x = 0; x <= W; x += 30) {
                var y = groundY - band.h * SCALE * (0.5 + 0.5 * Math.sin((x + off) * 0.006 + b * 5));
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, groundY);
            ctx.closePath();
            ctx.fill();
        }
    }

    /** Acacia tree: flat wide canopy on a forked trunk (world coords). */
    function drawAcacia(tr) {
        var s = SCALE * tr.size;
        var x = tr.x, y = tr.y;

        ctx.strokeStyle = '#2a1024';
        ctx.lineWidth = 4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 6 * s, y - 40 * s, x + 2 * s, y - 62 * s);
        ctx.stroke();
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(x + 1 * s, y - 40 * s);
        ctx.lineTo(x - 16 * s, y - 58 * s);
        ctx.moveTo(x + 2 * s, y - 50 * s);
        ctx.lineTo(x + 20 * s, y - 60 * s);
        ctx.stroke();

        // flat canopy: three overlapping ellipses
        ctx.fillStyle = '#3a1830';
        ctx.beginPath();
        ctx.ellipse(x + 2 * s, y - 66 * s, 34 * s, 9 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 14 * s, y - 61 * s, 18 * s, 6 * s, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 18 * s, y - 62 * s, 18 * s, 6 * s, 0, 0, Math.PI * 2);
        ctx.fill();

        // sun-kissed rim on the canopy
        ctx.strokeStyle = 'rgba(255, 180, 110, ' + (0.25 + progress * 0.3) + ')';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x + 2 * s, y - 67 * s, 33 * s, 8 * s, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
    }

    /** Solid platforms: warm earth tops with darker faces. */
    function drawSolids() {
        for (var i = 0; i < solids.length; i++) {
            var p = solids[i];
            if (p.x > camX + W + 60 || p.x + p.w < camX - 60) continue;

            var isGround = p.y >= groundY - 1;
            var depth = isGround ? H - p.y + 40 : 16 * SCALE;

            var g = ctx.createLinearGradient(0, p.y, 0, p.y + depth);
            g.addColorStop(0, '#5a2c38');
            g.addColorStop(1, '#2a1226');
            ctx.fillStyle = g;
            ctx.fillRect(p.x, p.y, p.w, depth);

            // sunlit top edge
            ctx.strokeStyle = 'rgba(255, 190, 120, ' + (0.35 + progress * 0.3) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.w, p.y);
            ctx.stroke();
        }
    }

    /** Grass tufts + progress flowers on ground surfaces. */
    function drawGrass() {
        for (var i = 0; i < grass.length; i++) {
            var gr = grass[i];
            if (gr.x > camX + W + 20 || gr.x < camX - 20) continue;
            var sway = Math.sin(t * 1.8 + gr.seed * 9) * 2;
            ctx.strokeStyle = 'rgba(120, 70, 60, 0.8)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (var b = 0; b < 3; b++) {
                ctx.moveTo(gr.x + b * 3, gr.y);
                ctx.lineTo(gr.x + b * 3 + sway + (b - 1) * 2, gr.y - (7 + gr.seed * 6) * SCALE);
            }
            ctx.stroke();

            // flowers bloom with progress
            if (progress > 0.25 && gr.seed > 0.55) {
                ctx.fillStyle = gr.seed > 0.8 ? '#ffb46b' : '#ff8f78';
                ctx.beginPath();
                ctx.arc(gr.x + 3 + sway, gr.y - (9 + gr.seed * 6) * SCALE, 2.2 * SCALE, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawPuffs(dt) {
        for (var i = 0; i < puffs.length; i++) {
            var pf = puffs[i];
            if (pf.life <= 0) continue;
            pf.life -= 0.016;
            pf.x += pf.vx * 0.016;
            ctx.globalAlpha = pf.life;
            ctx.fillStyle = 'rgba(255, 200, 150, 0.6)';
            ctx.beginPath();
            ctx.arc(pf.x, pf.y, 3 * (1 - pf.life) * SCALE + 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawAirParticles() {
        if (window.JourneySettings.reducedMotion) return;
        var visible = Math.floor(airParticles.length * (0.4 + progress * 0.6));
        for (var i = 0; i < visible; i++) {
            var p = airParticles[i];
            ctx.globalAlpha = (0.10 + Math.abs(Math.sin(t + p.phase)) * 0.22) * (0.5 + progress * 0.5);
            ctx.fillStyle = '#ffe9b8';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawPopups() {
        for (var i = 0; i < popups.length; i++) {
            var p = popups[i];
            if (p.life <= 0) continue;
            var frac = p.life / p.max;
            ctx.globalAlpha = Math.min(1, frac * 2);
            ctx.font = '700 ' + Math.round(17 * SCALE) + 'px "Trebuchet MS", "Segoe UI", Tahoma, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 14;
            ctx.fillStyle = p.color;
            ctx.fillText(p.text, p.x, p.y - (1 - frac) * 34);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1;
        }
    }

    function render() {
        // screen-space background
        drawSky();
        drawBgStars();
        drawSun();
        drawHorizon();

        // world-space layer
        ctx.save();
        ctx.translate(-camX, 0);

        for (var tr = 0; tr < trees.length; tr++) {
            if (trees[tr].x > camX - 80 && trees[tr].x < camX + W + 80) drawAcacia(trees[tr]);
        }
        drawSolids();
        drawGrass();
        Obstacles.draw(ctx, t, SCALE, camX, W);
        Player.drawTrail(ctx);
        if (state !== STATE.OVER) Player.draw(ctx, t);
        drawPuffs();
        drawPopups();

        ctx.restore();

        // screen-space foreground
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

    var keys = { left: false, right: false };

    function jumpPress() {
        GameAudio.unlock();
        if (state === STATE.PLAY) Player.pressJump();
    }

    window.addEventListener('keydown', function (e) {
        if (e.repeat) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            e.preventDefault();
            jumpPress();
        }
        if (e.code === 'Escape' || e.code === 'KeyP') {
            state === STATE.PLAY ? pauseGame() : resumeGame();
        }
    });

    window.addEventListener('keyup', function (e) {
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
        if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') Player.releaseJump();
    });

    // touch controls: on-screen buttons (visible via CSS on coarse pointers)
    function bindHold(id, down, up) {
        var elBtn = document.getElementById(id);
        if (!elBtn) return;
        var start = function (e) { e.preventDefault(); down(); };
        var end = function (e) { e.preventDefault(); up(); };
        elBtn.addEventListener('touchstart', start, { passive: false });
        elBtn.addEventListener('touchend', end, { passive: false });
        elBtn.addEventListener('touchcancel', end, { passive: false });
        elBtn.addEventListener('mousedown', down);
        elBtn.addEventListener('mouseup', up);
        elBtn.addEventListener('mouseleave', up);
    }

    bindHold('touch-left', function () { keys.left = true; }, function () { keys.left = false; });
    bindHold('touch-right', function () { keys.right = true; }, function () { keys.right = false; });
    bindHold('touch-jump', jumpPress, function () { Player.releaseJump(); });

    document.getElementById('pause-btn').addEventListener('click', pauseGame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden && state === STATE.PLAY) pauseGame();
    });

    // -------------------- boot --------------------

    window.Game = {
        setSky: function (s) { sky = s; }
    };

    resize();
    UI.bindButtons(startRun, resumeGame, quitToMenu);
    UI.applyCosmetics();
    UI.setBestHud();
    UI.setStarsHud();
    Player.reset(Math.max(70, W * 0.16), groundY, SCALE);
    UI.show('menu');
    requestAnimationFrame(loop);
})();
