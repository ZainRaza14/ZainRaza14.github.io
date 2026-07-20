/* ============================================================
   Journey to the Light - player.js  (platformer edition)
   The runner: a modestly dressed girl in a flowing hijab,
   drawn as an elegant near-silhouette with canvas paths.
   Exposes a global `Player`.

   Mario-style movement:
   - left/right acceleration with ground friction
   - variable-height jump (release early = shorter hop)
   - coyote time (jump grace after walking off a ledge)
   - jump buffering (press just before landing still fires)
   All positions are WORLD coordinates; game.js owns the camera.
   ============================================================ */

(function () {
    'use strict';

    // Physics tuning (world units are CSS pixels; scaled by game)
    var GRAVITY = 2350;         // px/s^2
    var JUMP_VELOCITY = -820;   // px/s
    var JUMP_CUT = 0.45;        // velocity multiplier when jump released early
    var MAX_FALL = 1400;
    var RUN_ACCEL = 1500;       // horizontal acceleration
    var RUN_MAX = 285;          // max horizontal speed
    var FRICTION = 1400;        // deceleration with no input
    var AIR_CONTROL = 0.6;      // fraction of accel available mid-air
    var COYOTE = 0.10;          // seconds of jump grace off a ledge
    var BUFFER = 0.12;          // seconds a jump press stays buffered

    var player = {
        x: 0, y: 0,             // world position; y = feet baseline
        vx: 0, vy: 0,
        grounded: true,
        facing: 1,              // 1 right, -1 left
        runPhase: 0,
        scale: 1,
        stepTimer: 0,

        // input intents, set by game.js each frame
        moveDir: 0,             // -1 / 0 / +1
        jumpHeld: false,

        // timers
        coyoteTimer: 0,
        bufferTimer: 0,

        // cosmetics
        hijab: '#cfd8ea',
        outfit: '#1d2740',
        trail: 'none',
        lantern: 'classic',

        trailPool: [],
        trailIndex: 0
    };

    var TRAIL_POOL_SIZE = 36;
    for (var i = 0; i < TRAIL_POOL_SIZE; i++) {
        player.trailPool.push({ x: 0, y: 0, life: 0, seed: Math.random() });
    }

    /** Reset for a new run. */
    function reset(startX, groundY, scale) {
        player.x = startX;
        player.y = groundY;
        player.vx = 0;
        player.vy = 0;
        player.grounded = true;
        player.facing = 1;
        player.runPhase = 0;
        player.scale = scale;
        player.moveDir = 0;
        player.jumpHeld = false;
        player.coyoteTimer = 0;
        player.bufferTimer = 0;
        for (var i = 0; i < player.trailPool.length; i++) player.trailPool[i].life = 0;
    }

    /** Called on jump press: buffered so early presses still fire. */
    function pressJump() {
        player.bufferTimer = BUFFER;
        player.jumpHeld = true;
    }

    /** Called on jump release: cuts velocity for variable jump height. */
    function releaseJump() {
        player.jumpHeld = false;
        if (player.vy < 0) player.vy *= JUMP_CUT;
    }

    function doJump() {
        player.vy = JUMP_VELOCITY * player.scale;
        player.grounded = false;
        player.coyoteTimer = 0;
        player.bufferTimer = 0;
        GameAudio.jump();
    }

    /**
     * Physics update. `solids` = array of {x, y, w} platform tops in
     * world coords (y is the surface). Returns nothing; game.js reads
     * player.y to detect falling into a pit.
     */
    function update(dt, solids) {
        var s = player.scale;

        // ---- horizontal movement ----
        var accel = RUN_ACCEL * s * (player.grounded ? 1 : AIR_CONTROL);
        if (player.moveDir !== 0) {
            player.vx += player.moveDir * accel * dt;
            var max = RUN_MAX * s;
            if (player.vx > max) player.vx = max;
            if (player.vx < -max) player.vx = -max;
            player.facing = player.moveDir;
        } else if (player.grounded) {
            // friction
            if (player.vx > 0) player.vx = Math.max(0, player.vx - FRICTION * s * dt);
            else if (player.vx < 0) player.vx = Math.min(0, player.vx + FRICTION * s * dt);
        }
        player.x += player.vx * dt;
        if (player.x < 20) { player.x = 20; player.vx = 0; } // world's left wall

        // ---- vertical physics ----
        var wasGrounded = player.grounded;
        player.vy += GRAVITY * s * dt;
        if (player.vy > MAX_FALL * s) player.vy = MAX_FALL * s;
        var prevY = player.y;
        player.y += player.vy * dt;

        // land on any solid whose top we crossed this frame (falling only)
        player.grounded = false;
        if (player.vy >= 0) {
            for (var i = 0; i < solids.length; i++) {
                var p = solids[i];
                if (player.x < p.x || player.x > p.x + p.w) continue;
                if (prevY <= p.y + 1 && player.y >= p.y) {
                    player.y = p.y;
                    player.vy = 0;
                    player.grounded = true;
                    break;
                }
            }
        }

        // ---- coyote + buffer ----
        if (player.grounded) player.coyoteTimer = COYOTE;
        else player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
        player.bufferTimer = Math.max(0, player.bufferTimer - dt);

        if (player.bufferTimer > 0 && (player.grounded || player.coyoteTimer > 0)) {
            doJump();
        }

        // ---- animation + footsteps ----
        var speedFrac = Math.abs(player.vx) / (RUN_MAX * s);
        if (player.grounded && speedFrac > 0.05) {
            player.runPhase += dt * 13 * speedFrac;
            player.stepTimer -= dt;
            if (player.stepTimer <= 0) {
                GameAudio.footstep();
                player.stepTimer = 0.34 / Math.max(0.4, speedFrac);
            }
        }

        // ---- trail particles ----
        if (player.trail !== 'none' && !window.JourneySettings.reducedMotion && speedFrac > 0.15) {
            var tp = player.trailPool[player.trailIndex];
            player.trailIndex = (player.trailIndex + 1) % player.trailPool.length;
            tp.x = player.x - player.facing * 8 * s;
            tp.y = player.y - 26 * s + Math.sin(player.runPhase) * 3;
            tp.life = 1;
        }
        for (var k = 0; k < player.trailPool.length; k++) {
            if (player.trailPool[k].life > 0) player.trailPool[k].life -= dt * 1.4;
        }

        // landing puff hook for game.js juice
        return !wasGrounded && player.grounded;
    }

    /** Collision box in world coords (slightly forgiving). */
    function hitbox() {
        var s = player.scale;
        return {
            x: player.x - 9 * s,
            y: player.y - 46 * s,
            w: 18 * s,
            h: 44 * s
        };
    }

    /** Trail, drawn in world space (game translates by camera). */
    function drawTrail(ctx) {
        if (player.trail === 'none') return;
        for (var i = 0; i < player.trailPool.length; i++) {
            var p = player.trailPool[i];
            if (p.life <= 0) continue;
            ctx.globalAlpha = p.life * 0.55;
            if (player.trail === 'stardust') {
                ctx.fillStyle = '#ffd98a';
                var tw = 1 + p.seed * 2;
                ctx.fillRect(p.x - tw / 2, p.y - tw / 2, tw, tw);
            } else if (player.trail === 'petals') {
                ctx.fillStyle = p.seed > 0.5 ? '#ff9aa8' : '#ffc4cd';
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + (1 - p.life) * 14, 2.6, 1.4, p.seed * 6, 0, Math.PI * 2);
                ctx.fill();
            } else { // glow
                ctx.fillStyle = '#ffb46b';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.4 * p.life, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
    }

    /**
     * Draw the girl (world coords). Designed facing right; the whole
     * body is mirrored with scale() when she faces left.
     */
    function draw(ctx, t) {
        var s = player.scale;
        var airborne = !player.grounded;
        var speedFrac = Math.abs(player.vx) / (RUN_MAX * s);
        var bob = airborne ? 0 : Math.abs(Math.sin(player.runPhase)) * 2.2 * s * speedFrac;
        var lean = (airborne ? 0.10 : 0.05 + speedFrac * 0.06);

        ctx.save();
        ctx.translate(player.x, player.y - bob);
        ctx.scale(player.facing, 1);       // mirror for left-facing
        ctx.rotate(lean);

        // ---- legs ----
        var legSwing = airborne ? 0.6 : Math.sin(player.runPhase) * Math.max(0.25, speedFrac);
        ctx.strokeStyle = player.outfit;
        ctx.lineWidth = 3.4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-1 * s, -10 * s);
        ctx.lineTo(-1 * s + legSwing * 7 * s, 0);
        ctx.moveTo(1 * s, -10 * s);
        ctx.lineTo(1 * s - legSwing * 7 * s, 0);
        ctx.stroke();

        // ---- dress ----
        var hemSway = airborne ? 4 * s : Math.sin(player.runPhase * 0.5) * 2.5 * s * speedFrac;
        ctx.fillStyle = player.outfit;
        ctx.beginPath();
        ctx.moveTo(0, -40 * s);
        ctx.bezierCurveTo(-9 * s, -34 * s, -11 * s, -18 * s, -12 * s - hemSway, -6 * s);
        ctx.lineTo(11 * s - hemSway * 0.5, -6 * s);
        ctx.bezierCurveTo(10 * s, -20 * s, 8 * s, -34 * s, 0, -40 * s);
        ctx.closePath();
        ctx.fill();

        // ---- hijab ----
        var flow = airborne ? 1.5 : 1 + speedFrac * 0.4;
        var w1 = Math.sin(t * 6 + 1) * 3 * s * flow;
        var w2 = Math.sin(t * 5) * 5 * s * flow;

        ctx.fillStyle = player.hijab;
        ctx.beginPath();
        ctx.arc(2 * s, -47 * s, 6.4 * s, 0, Math.PI * 2);
        ctx.fill();
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

        // ---- face crescent ----
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

    /** Lantern styles: classic (framed), orb, star. */
    function drawLantern(ctx, lx, ly, s, t) {
        var flicker = 0.7 + Math.sin(t * 11) * 0.3;

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
            for (var i = 0; i < 8; i++) {
                var r = (i % 2 === 0) ? 4.6 * s : 1.8 * s;
                var a = (i / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        } else {
            ctx.strokeStyle = '#c9b89a';
            ctx.lineWidth = 1.3 * s;
            ctx.strokeRect(lx - 3 * s, ly - 4 * s, 6 * s, 8 * s);
            ctx.fillStyle = 'rgba(255, 231, 180, ' + flicker + ')';
            ctx.beginPath();
            ctx.arc(lx, ly, 2.2 * s, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    /** Apply equipped cosmetics. */
    function setCosmetics(c) {
        if (c.hijab) player.hijab = c.hijab;
        if (c.outfit) player.outfit = c.outfit;
        if (c.trail) player.trail = c.trail;
        if (c.lantern) player.lantern = c.lantern;
    }

    window.Player = {
        state: player,
        reset: reset,
        pressJump: pressJump,
        releaseJump: releaseJump,
        update: update,
        hitbox: hitbox,
        draw: draw,
        drawTrail: drawTrail,
        setCosmetics: setCosmetics
    };
})();
