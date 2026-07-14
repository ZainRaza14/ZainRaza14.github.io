/* ============================================================
   Journey to the Light - player.js
   The runner: a modestly dressed girl in a flowing hijab,
   drawn as an elegant near-silhouette with canvas paths.
   Exposes a global `Player`.

   Cosmetics are injected by ui.js/game.js via setCosmetics():
     { hijab, outfit, trail, lantern }  (color strings / style keys)
   ============================================================ */

(function () {
    'use strict';

    // Physics tuning (world units are CSS pixels; scaled by game)
    var GRAVITY = 2350;        // px/s^2
    var JUMP_VELOCITY = -860;  // px/s, negative = up
    var MAX_FALL = 1400;

    var player = {
        x: 0,                  // set by game on layout
        y: 0,                  // feet position (baseline)
        vy: 0,
        grounded: true,
        jumpQueued: false,     // input buffering: press slightly early still jumps
        runPhase: 0,           // drives leg/hijab animation
        scale: 1,              // responsive scaling from game
        stepTimer: 0,          // footstep sound cadence

        // cosmetics (defaults; overwritten from saved equip state)
        hijab: '#cfd8ea',
        outfit: '#1d2740',
        trail: 'none',
        lantern: 'classic',

        // trail particle ring buffer (object pooling: fixed size, reused)
        trailPool: [],
        trailIndex: 0
    };

    var TRAIL_POOL_SIZE = 36;
    for (var i = 0; i < TRAIL_POOL_SIZE; i++) {
        player.trailPool.push({ x: 0, y: 0, life: 0, seed: Math.random() });
    }

    /** Reset for a new run. Called by game.reset(). */
    function reset(groundY, scale) {
        player.y = groundY;
        player.vy = 0;
        player.grounded = true;
        player.jumpQueued = false;
        player.runPhase = 0;
        player.scale = scale;
        for (var i = 0; i < player.trailPool.length; i++) player.trailPool[i].life = 0;
    }

    /** Request a jump. Buffered so a press just before landing still fires. */
    function requestJump() {
        if (player.grounded) {
            player.vy = JUMP_VELOCITY * player.scale;
            player.grounded = false;
            GameAudio.jump();
        } else {
            player.jumpQueued = true; // consume on next landing
        }
    }

    /** Physics + animation update. dt in seconds. */
    function update(dt, groundY, speedFactor) {
        // vertical physics
        if (!player.grounded) {
            player.vy += GRAVITY * player.scale * dt;
            if (player.vy > MAX_FALL * player.scale) player.vy = MAX_FALL * player.scale;
            player.y += player.vy * dt;

            if (player.y >= groundY) {   // landing
                player.y = groundY;
                player.vy = 0;
                player.grounded = true;
                if (player.jumpQueued) { // buffered input fires immediately
                    player.jumpQueued = false;
                    requestJump();
                }
            }
        }

        // run cycle speeds up with the world
        if (player.grounded) {
            player.runPhase += dt * 11 * speedFactor;
            player.stepTimer -= dt;
            if (player.stepTimer <= 0) {
                GameAudio.footstep();
                player.stepTimer = 0.34 / speedFactor;
            }
        }

        // emit trail particles (skipped when trail is 'none' or reduced motion)
        if (player.trail !== 'none' && !window.JourneySettings.reducedMotion) {
            var p = player.trailPool[player.trailIndex];
            player.trailIndex = (player.trailIndex + 1) % player.trailPool.length;
            p.x = player.x - 8 * player.scale;
            p.y = player.y - 26 * player.scale + Math.sin(player.runPhase) * 3;
            p.life = 1;
        }
        for (var i = 0; i < player.trailPool.length; i++) {
            if (player.trailPool[i].life > 0) player.trailPool[i].life -= dt * 1.4;
        }
    }

    /** The player's collision box (slightly forgiving vs. the drawing). */
    function hitbox() {
        var s = player.scale;
        return {
            x: player.x - 9 * s,
            y: player.y - 46 * s,
            w: 18 * s,
            h: 44 * s
        };
    }

    /** Draw trail behind her (varies by equipped trail style). */
    function drawTrail(ctx) {
        if (player.trail === 'none') return;
        for (var i = 0; i < player.trailPool.length; i++) {
            var p = player.trailPool[i];
            if (p.life <= 0) continue;
            var a = p.life * 0.55;
            ctx.globalAlpha = a;

            if (player.trail === 'stardust') {
                ctx.fillStyle = '#ffd98a';
                var tw = 1 + p.seed * 2;
                ctx.fillRect(p.x - tw / 2, p.y - tw / 2, tw, tw);
            } else if (player.trail === 'petals') {
                ctx.fillStyle = p.seed > 0.5 ? '#ff9aa8' : '#ffc4cd';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + (1 - p.life) * 14, 2.6, 1.4, p.seed * 6, 0, Math.PI * 2);
                ctx.fill();
            } else { // 'glow'
                ctx.fillStyle = '#7fb2ff';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.4 * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Draw the girl. She reads as an elegant silhouette:
     * flowing hijab (animated bezier tail), long modest dress,
     * subtle leg movement beneath the hem, and a small lantern.
     */
    function draw(ctx, t) {
        var s = player.scale;
        var x = player.x;
        var y = player.y; // feet baseline

        var airborne = !player.grounded;
        var bob = airborne ? 0 : Math.abs(Math.sin(player.runPhase)) * 2.2 * s;
        var lean = airborne ? 0.10 : 0.05; // slight forward lean

        ctx.save();
        ctx.translate(x, y - bob);
        ctx.rotate(lean);

        // ---- legs: hinted beneath the hem ----
        var legSwing = airborne ? 0.6 : Math.sin(player.runPhase);
        ctx.strokeStyle = player.outfit;
        ctx.lineWidth = 3.4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1 * s, -10 * s);
        ctx.lineTo(-1 * s + legSwing * 7 * s, 0);
        ctx.moveTo(1 * s, -10 * s);
        ctx.lineTo(1 * s - legSwing * 7 * s, 0);
        ctx.stroke();

        // ---- dress: long, modest, flaring gently at the hem ----
        var hemSway = airborne ? 4 * s : Math.sin(player.runPhase * 0.5) * 2.5 * s;
        ctx.fillStyle = player.outfit;
        ctx.beginPath();
        ctx.moveTo(0, -40 * s);                                     // shoulders
        ctx.bezierCurveTo(-9 * s, -34 * s, -11 * s, -18 * s, -12 * s - hemSway, -6 * s); // left side
        ctx.lineTo(11 * s - hemSway * 0.5, -6 * s);                 // hem
        ctx.bezierCurveTo(10 * s, -20 * s, 8 * s, -34 * s, 0, -40 * s); // right side
        ctx.closePath();
        ctx.fill();

        // ---- hijab: frames the face, then flows behind her ----
        var flow = airborne ? 1.5 : 1;
        var w1 = Math.sin(t * 6 + 1) * 3 * s * flow;
        var w2 = Math.sin(t * 5) * 5 * s * flow;

        ctx.fillStyle = player.hijab;
        // head wrap
        ctx.beginPath();
        ctx.arc(2 * s, -47 * s, 6.4 * s, 0, Math.PI * 2);
        ctx.fill();
        // flowing tail (two layered bezier ribbons for depth)
        ctx.beginPath();
        ctx.moveTo(0, -51 * s);
        ctx.bezierCurveTo(-8 * s, -50 * s + w1, -16 * s, -42 * s + w2, -22 * s * flow, -32 * s + w2);
        ctx.bezierCurveTo(-15 * s, -34 * s + w1, -8 * s, -38 * s, -3 * s, -40 * s);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(0, -48 * s);
        ctx.bezierCurveTo(-6 * s, -45 * s + w2, -12 * s, -38 * s + w1, -16 * s * flow, -28 * s + w1);
        ctx.bezierCurveTo(-10 * s, -31 * s, -5 * s, -35 * s, -2 * s, -38 * s);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;

        // ---- face: a small warm crescent, kept abstract ----
        ctx.fillStyle = '#e8ceb8';
        ctx.beginPath();
        ctx.arc(4.4 * s, -46.5 * s, 3.4 * s, -Math.PI * 0.45, Math.PI * 0.55);
        ctx.fill();

        // ---- lantern arm + lantern ----
        ctx.strokeStyle = player.outfit;
        ctx.lineWidth = 2.6 * s;
        ctx.beginPath();
        ctx.moveTo(2 * s, -34 * s);
        ctx.lineTo(11 * s, -26 * s);
        ctx.stroke();
        drawLantern(ctx, 12.5 * s, -24 * s, s, t);

        ctx.restore();
    }

    /** Lantern styles: classic (framed), orb (bare glow), star (pointed). */
    function drawLantern(ctx, lx, ly, s, t) {
        var flicker = 0.7 + Math.sin(t * 11) * 0.3;

        // outer glow shared by all styles
        var g = ctx.createRadialGradient(lx, ly, 1, lx, ly, 22 * s);
        g.addColorStop(0, 'rgba(255, 217, 138, ' + (0.5 * flicker) + ')');
        g.addColorStop(1, 'rgba(255, 217, 138, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(lx, ly, 22 * s, 0, Math.PI * 2);
        ctx.fill();

        if (player.lantern === 'orb') {
            ctx.fillStyle = 'rgba(255, 231, 180, ' + flicker + ')';
            ctx.beginPath();
            ctx.arc(lx, ly, 3.4 * s, 0, Math.PI * 2);
            ctx.fill();
        } else if (player.lantern === 'star') {
            ctx.fillStyle = 'rgba(255, 231, 180, ' + flicker + ')';
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(t * 0.8);
            ctx.beginPath();
            for (var i = 0; i < 8; i++) {  // 4-point star via alternating radii
                var r = (i % 2 === 0) ? 4.6 * s : 1.8 * s;
                var a = (i / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else { // 'classic' - small framed lantern
            ctx.strokeStyle = '#c9b89a';
            ctx.lineWidth = 1.3 * s;
            ctx.strokeRect(lx - 3 * s, ly - 4 * s, 6 * s, 8 * s);
            ctx.fillStyle = 'rgba(255, 231, 180, ' + flicker + ')';
            ctx.beginPath();
            ctx.arc(lx, ly, 2.2 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /** Apply equipped cosmetics (called whenever equipment changes). */
    function setCosmetics(c) {
        if (c.hijab) player.hijab = c.hijab;
        if (c.outfit) player.outfit = c.outfit;
        if (c.trail) player.trail = c.trail;
        if (c.lantern) player.lantern = c.lantern;
    }

    // Public API
    window.Player = {
        state: player,
        reset: reset,
        requestJump: requestJump,
        update: update,
        hitbox: hitbox,
        draw: draw,
        drawTrail: drawTrail,
        setCosmetics: setCosmetics
    };
})();
