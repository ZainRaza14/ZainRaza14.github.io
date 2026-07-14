/* ============================================================
   Journey to the Light - obstacles.js
   Symbolic hazards + collectible stars, with object pooling.
   Exposes a global `Obstacles`.

   Every hazard is abstract and environmental. Each type carries
   the name of the struggle it represents; the word drifts faintly
   above the hazard so the symbolism reads without preaching.

   Adding a new obstacle = add an entry to TYPES with a draw()
   and a hitbox factory. Nothing else needs to change.
   ============================================================ */

(function () {
    'use strict';

    var POOL_SIZE = 24;       // max simultaneous hazards (pooled, reused)
    var STAR_POOL_SIZE = 32;  // max simultaneous stars

    /**
     * Obstacle catalog. All are jumpable (one-button game):
     * heights/widths tuned against jump arc in game.js.
     *  w/h are logical sizes at scale 1 (bounding box, feet-anchored).
     */
    var TYPES = [
        {
            key: 'spikes', word: 'Fear', w: 46, h: 26,
            draw: function (ctx, o, t, s) {
                // jagged dark spikes with a faint violet edge
                ctx.fillStyle = '#2a1f4d';
                ctx.strokeStyle = 'rgba(180, 155, 255, 0.75)';
                ctx.lineWidth = 1;
                var n = 4;
                for (var i = 0; i < n; i++) {
                    var sx = o.x + (i / n) * o.w * s;
                    var sw = (o.w * s) / n;
                    ctx.beginPath();
                    ctx.moveTo(sx, o.baseY);
                    ctx.lineTo(sx + sw / 2, o.baseY - o.h * s * (0.75 + (i % 2) * 0.25));
                    ctx.lineTo(sx + sw, o.baseY);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
        },
        {
            key: 'crack', word: 'Doubt', w: 58, h: 12,
            draw: function (ctx, o, t, s) {
                // a fissure in the ground, glowing faintly from below
                ctx.fillStyle = '#03050e';
                ctx.beginPath();
                ctx.moveTo(o.x, o.baseY);
                ctx.lineTo(o.x + o.w * s * 0.5, o.baseY + 8 * s);
                ctx.lineTo(o.x + o.w * s, o.baseY);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = 'rgba(170, 130, 255, ' + (0.6 + Math.sin(t * 3 + o.seed * 9) * 0.2) + ')';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(o.x, o.baseY);
                ctx.lineTo(o.x + o.w * s * 0.3, o.baseY - 3 * s);
                ctx.lineTo(o.x + o.w * s * 0.55, o.baseY + 2 * s);
                ctx.lineTo(o.x + o.w * s, o.baseY - 1 * s);
                ctx.stroke();
            },
            // the danger is falling in: a thin trigger at ground level
            box: function (o, s) { return { x: o.x + 8 * s, y: o.baseY - 4 * s, w: o.w * s - 16 * s, h: 8 * s }; }
        },
        {
            key: 'smoke', word: 'Anxiety', w: 34, h: 52,
            draw: function (ctx, o, t, s) {
                // a column of dark smoke, writhing slowly
                for (var i = 0; i < 4; i++) {
                    var frac = i / 4;
                    var yy = o.baseY - frac * o.h * s;
                    var sway = Math.sin(t * 2.2 + o.seed * 10 + i * 1.4) * 6 * s * (0.4 + frac);
                    var r = (13 - i * 2) * s;
                    var sg = ctx.createRadialGradient(o.x + o.w * s / 2 + sway, yy, 1, o.x + o.w * s / 2 + sway, yy, r);
                    sg.addColorStop(0, 'rgba(105, 80, 170, 0.8)');
                    sg.addColorStop(1, 'rgba(70, 45, 130, 0)');
                    ctx.fillStyle = sg;
                    ctx.beginPath();
                    ctx.arc(o.x + o.w * s / 2 + sway, yy, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
            box: function (o, s) { return { x: o.x + 6 * s, y: o.baseY - o.h * s * 0.8, w: o.w * s - 12 * s, h: o.h * s * 0.8 }; }
        },
        {
            key: 'creature', word: 'Despair', w: 34, h: 30,
            draw: function (ctx, o, t, s) {
                // a hunched shadow creature with dim eyes; breathes in place
                var breathe = Math.sin(t * 3 + o.seed * 7) * 2 * s;
                var cx = o.x + o.w * s / 2;
                var cy = o.baseY - o.h * s * 0.45 + breathe;
                var cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, o.h * s * 0.8);
                cg.addColorStop(0, 'rgba(85, 75, 145, 0.95)');
                cg.addColorStop(1, 'rgba(40, 32, 80, 0)');
                ctx.fillStyle = cg;
                ctx.beginPath();
                ctx.arc(cx, cy, o.h * s * 0.8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#221a4a';
                ctx.beginPath();
                ctx.ellipse(cx, cy + 4 * s, o.w * s * 0.42, o.h * s * 0.42, 0, 0, Math.PI * 2);
                ctx.fill();
                // dim violet eyes
                ctx.fillStyle = 'rgba(200, 180, 255, 0.95)';
                ctx.beginPath();
                ctx.arc(cx - 4 * s, cy, 1.6 * s, 0, Math.PI * 2);
                ctx.arc(cx + 4 * s, cy, 1.6 * s, 0, Math.PI * 2);
                ctx.fill();
            }
        },
        {
            key: 'thorns', word: 'Anger', w: 40, h: 34,
            draw: function (ctx, o, t, s) {
                // curling thorn tangle
                ctx.strokeStyle = '#472a4d';
                ctx.lineWidth = 3 * s;
                ctx.lineCap = 'round';
                for (var i = 0; i < 3; i++) {
                    var bx = o.x + (i + 0.5) * (o.w * s / 3);
                    ctx.beginPath();
                    ctx.moveTo(bx, o.baseY);
                    ctx.quadraticCurveTo(
                        bx + (i % 2 ? 10 : -10) * s,
                        o.baseY - o.h * s * 0.6,
                        bx + (i % 2 ? -4 : 4) * s,
                        o.baseY - o.h * s * (0.8 + i * 0.08)
                    );
                    ctx.stroke();
                }
                ctx.strokeStyle = 'rgba(255, 110, 110, 0.7)';
                ctx.lineWidth = 1;
                for (var j = 0; j < 3; j++) {
                    var tx = o.x + (j + 0.5) * (o.w * s / 3);
                    ctx.beginPath();
                    ctx.moveTo(tx, o.baseY - o.h * s * 0.5);
                    ctx.lineTo(tx + 5 * s, o.baseY - o.h * s * 0.5 - 4 * s);
                    ctx.stroke();
                }
            }
        },
        {
            key: 'pillar', word: 'Pride', w: 22, h: 56,
            draw: function (ctx, o, t, s) {
                // a tall narrow monolith, cold-lit from the moon side
                var grad = ctx.createLinearGradient(o.x, 0, o.x + o.w * s, 0);
                grad.addColorStop(0, '#33427a');
                grad.addColorStop(1, '#1a2450');
                ctx.fillStyle = grad;
                ctx.fillRect(o.x, o.baseY - o.h * s, o.w * s, o.h * s);
                ctx.strokeStyle = 'rgba(150, 195, 255, 0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(o.x, o.baseY - o.h * s, o.w * s, o.h * s);
            }
        },
        {
            key: 'barrier', word: 'Greed', w: 30, h: 40,
            draw: function (ctx, o, t, s) {
                // a floating dark shard hovering just above the ground
                var hover = Math.sin(t * 2.6 + o.seed * 8) * 4 * s;
                var cx = o.x + o.w * s / 2;
                var cy = o.baseY - o.h * s * 0.55 + hover;
                ctx.save();
                ctx.translate(cx, cy);
                ctx.rotate(Math.sin(t + o.seed * 5) * 0.15);
                ctx.fillStyle = '#2a2258';
                ctx.strokeStyle = 'rgba(255, 205, 90, 0.8)'; // a greedy gold glint
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(0, -o.h * s * 0.45);
                ctx.lineTo(o.w * s * 0.4, 0);
                ctx.lineTo(0, o.h * s * 0.45);
                ctx.lineTo(-o.w * s * 0.4, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            },
            box: function (o, s) {
                return { x: o.x + 4 * s, y: o.baseY - o.h * s * 0.95, w: o.w * s - 8 * s, h: o.h * s * 0.8 };
            }
        }
    ];

    // -------------------- pools --------------------

    var pool = [];       // hazard pool
    var starPool = [];   // collectible star pool

    for (var i = 0; i < POOL_SIZE; i++) {
        pool.push({ active: false, x: 0, baseY: 0, w: 0, h: 0, type: null, seed: 0, passed: false });
    }
    for (var j = 0; j < STAR_POOL_SIZE; j++) {
        starPool.push({ active: false, x: 0, y: 0, seed: 0, collected: 0 });
    }

    /** Deactivate everything (new run). */
    function reset() {
        for (var i = 0; i < pool.length; i++) pool[i].active = false;
        for (var j = 0; j < starPool.length; j++) starPool[j].active = false;
    }

    /** Grab an inactive hazard from the pool; null if exhausted. */
    function obtain() {
        for (var i = 0; i < pool.length; i++) {
            if (!pool[i].active) return pool[i];
        }
        return null;
    }

    /** Spawn a random hazard just off the right edge. */
    function spawnHazard(screenW, groundY, scale, progress) {
        var o = obtain();
        if (!o) return;
        // later struggles appear later in the journey
        var maxIndex = Math.min(TYPES.length, 3 + Math.floor(progress * TYPES.length));
        var type = TYPES[Math.floor(Math.random() * maxIndex)];
        o.active = true;
        o.type = type;
        o.x = screenW + 60;
        o.baseY = groundY;
        o.w = type.w;
        o.h = type.h;
        o.seed = Math.random();
        o.passed = false;
    }

    /** Spawn a small arc of collectible stars off the right edge. */
    function spawnStars(screenW, groundY, scale) {
        var count = 3 + Math.floor(Math.random() * 3);
        var baseX = screenW + 80;
        var high = Math.random() < 0.5; // some arcs require a jump to reach
        for (var c = 0; c < count; c++) {
            var st = null;
            for (var k = 0; k < starPool.length; k++) {
                if (!starPool[k].active) { st = starPool[k]; break; }
            }
            if (!st) return;
            st.active = true;
            st.collected = 0;
            st.seed = Math.random();
            st.x = baseX + c * 34 * scale;
            // gentle arc shape
            var arcLift = Math.sin((c / (count - 1)) * Math.PI) * 30 * scale;
            st.y = groundY - (high ? 95 : 45) * scale - arcLift;
        }
    }

    /** Move everything left; deactivate off-screen; report passes. */
    function update(dt, speed, onPass) {
        var i;
        for (i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (!o.active) continue;
            o.x -= speed * dt;
            if (!o.passed && o.x + o.w < Player.state.x - 20) {
                o.passed = true;
                onPass(o);      // game counts this toward the perfect streak
            }
            if (o.x < -120) o.active = false;
        }
        for (i = 0; i < starPool.length; i++) {
            var st = starPool[i];
            if (!st.active) continue;
            st.x -= speed * dt;
            if (st.collected > 0) {          // brief collection sparkle then release
                st.collected += dt * 4;
                if (st.collected > 1) st.active = false;
            }
            if (st.x < -40) st.active = false;
        }
    }

    /** AABB overlap - the whole game's collision needs are this cheap. */
    function overlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

    /** Check the player's hitbox against all active hazards. */
    function hitsPlayer(scale) {
        var hb = Player.hitbox();
        for (var i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (!o.active) continue;
            var box = o.type.box
                ? o.type.box(o, scale)
                : { x: o.x + 4 * scale, y: o.baseY - o.h * scale, w: o.w * scale - 8 * scale, h: o.h * scale };
            if (overlap(hb, box)) return o;
        }
        return null;
    }

    /** Collect stars the player touches; returns number collected. */
    function collectStars(scale) {
        var hb = Player.hitbox();
        var got = 0;
        for (var i = 0; i < starPool.length; i++) {
            var st = starPool[i];
            if (!st.active || st.collected > 0) continue;
            var box = { x: st.x - 10 * scale, y: st.y - 10 * scale, w: 20 * scale, h: 20 * scale };
            if (overlap(hb, box)) {
                st.collected = 0.001; // start sparkle timer
                got++;
            }
        }
        return got;
    }

    /** Draw hazards (with their faint symbolic words) and stars. */
    function draw(ctx, t, scale, progress) {
        var i;

        for (i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (!o.active) continue;
            o.type.draw(ctx, o, t, scale);

            // the struggle's name floats above the hazard, clearly readable
            ctx.font = '400 italic ' + Math.round(15 * scale) + 'px Lora, Georgia, serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(190, 170, 255, 0.9)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = 'rgba(235, 228, 255, ' + (0.85 + Math.sin(t * 1.5 + o.seed * 9) * 0.15) + ')';
            ctx.fillText(o.type.word, o.x + o.w * scale / 2, o.baseY - o.h * scale - 14 * scale);
            ctx.shadowBlur = 0;
        }

        for (i = 0; i < starPool.length; i++) {
            var st = starPool[i];
            if (!st.active) continue;
            var pulse = 0.7 + Math.sin(t * 3 + st.seed * 10) * 0.3;
            var fade = st.collected > 0 ? 1 - st.collected : 1;
            var lift = st.collected > 0 ? st.collected * 18 : 0;

            ctx.globalAlpha = pulse * fade;
            var g = ctx.createRadialGradient(st.x, st.y - lift, 0, st.x, st.y - lift, 11 * scale);
            g.addColorStop(0, 'rgba(255, 227, 150, 0.9)');
            g.addColorStop(1, 'rgba(255, 217, 138, 0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(st.x, st.y - lift, 11 * scale, 0, Math.PI * 2);
            ctx.fill();

            // four-point star core
            ctx.fillStyle = '#ffe9b8';
            ctx.save();
            ctx.translate(st.x, st.y - lift);
            ctx.rotate(t * 1.2 + st.seed * 6);
            ctx.beginPath();
            for (var k = 0; k < 8; k++) {
                var r = (k % 2 === 0) ? 4.6 * scale : 1.8 * scale;
                var a = (k / 8) * Math.PI * 2;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }

    // Public API
    window.Obstacles = {
        reset: reset,
        spawnHazard: spawnHazard,
        spawnStars: spawnStars,
        update: update,
        hitsPlayer: hitsPlayer,
        collectStars: collectStars,
        draw: draw
    };
})();
