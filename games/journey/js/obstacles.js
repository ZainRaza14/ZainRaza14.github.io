/* ============================================================
   Journey to the Light - obstacles.js
   Symbolic hazards + collectible stars, with object pooling.
   Exposes a global `Obstacles`.

   Every hazard is abstract and environmental. Each type carries
   the name of the struggle it represents; the word floats above
   the hazard so the symbolism reads without preaching.

   VARIETY SYSTEM: every spawned hazard gets
     - a structural `variant` (0..2): each type draws 2-3
       genuinely different silhouettes, not just recolors
     - a size `jitter` (0.85..1.3) baked into its w/h
     - deterministic per-instance randomness via prand(seed, i)
   and past the early game, hazards sometimes arrive as a DUO -
   two spawns a rhythm-jump apart - so the cadence itself varies.

   Adding a new obstacle = add an entry to TYPES with a draw()
   and optional hitbox factory. Nothing else needs to change.
   ============================================================ */

(function () {
    'use strict';

    var POOL_SIZE = 24;       // max simultaneous hazards (pooled, reused)
    var STAR_POOL_SIZE = 32;  // max simultaneous stars

    /** Deterministic pseudo-random in [0,1) from an instance seed. */
    function prand(seed, i) {
        var v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
        return v - Math.floor(v);
    }

    /**
     * Obstacle catalog. All are jumpable (one-button game):
     * heights/widths tuned against the jump arc in game.js.
     * w/h are logical sizes at scale 1 (bounding box, feet-anchored);
     * per-instance jitter rescales them at spawn time.
     */
    var TYPES = [
        {
            key: 'spikes', word: 'Fear', w: 46, h: 26,
            draw: function (ctx, o, t, s) {
                // jagged violet spikes; count and heights differ per instance
                ctx.fillStyle = '#2a1f4d';
                ctx.strokeStyle = 'rgba(180, 155, 255, 0.75)';
                ctx.lineWidth = 1;
                var n = 3 + o.variant;                     // 3..5 teeth
                for (var i = 0; i < n; i++) {
                    var sx = o.x + (i / n) * o.w * s;
                    var sw = (o.w * s) / n;
                    var hh = 0.6 + prand(o.seed, i) * 0.4; // ragged skyline
                    ctx.beginPath();
                    ctx.moveTo(sx, o.baseY);
                    // variant 2 = hooked tips, curving forward
                    if (o.variant === 2) {
                        ctx.quadraticCurveTo(sx + sw * 0.2, o.baseY - o.h * s * hh,
                                             sx + sw * 0.72, o.baseY - o.h * s * hh);
                        ctx.lineTo(sx + sw, o.baseY);
                    } else {
                        ctx.lineTo(sx + sw / 2, o.baseY - o.h * s * hh);
                        ctx.lineTo(sx + sw, o.baseY);
                    }
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
        },
        {
            key: 'crack', word: 'Doubt', w: 58, h: 12,
            draw: function (ctx, o, t, s) {
                // a fissure in the ground; the zigzag path is unique per crack
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
                var joints = 3 + o.variant;               // 3..5 zigzag joints
                for (var i = 1; i <= joints; i++) {
                    var jx = o.x + (i / joints) * o.w * s;
                    var jy = o.baseY + (prand(o.seed, i) - 0.5) * 8 * s;
                    ctx.lineTo(jx, jy);
                }
                ctx.stroke();

                // variant 2: escaping wisps rise from the fissure
                if (o.variant === 2) {
                    ctx.strokeStyle = 'rgba(150, 110, 235, 0.35)';
                    ctx.lineWidth = 1;
                    for (var w = 0; w < 2; w++) {
                        var wx = o.x + o.w * s * (0.3 + w * 0.4);
                        var rise = 10 + Math.sin(t * 2 + o.seed * 7 + w * 3) * 4;
                        ctx.beginPath();
                        ctx.moveTo(wx, o.baseY);
                        ctx.quadraticCurveTo(wx + 4 * s, o.baseY - rise * s * 0.6, wx - 2 * s, o.baseY - rise * s);
                        ctx.stroke();
                    }
                }
            },
            // the danger is falling in: a thin trigger at ground level
            box: function (o, s) { return { x: o.x + 8 * s, y: o.baseY - 4 * s, w: o.w * s - 16 * s, h: 8 * s }; }
        },
        {
            key: 'smoke', word: 'Anxiety', w: 34, h: 52,
            draw: function (ctx, o, t, s) {
                // writhing violet smoke; puff count + lean vary per instance
                var puffs = 3 + o.variant;                 // 3..5 puffs
                var lean = (prand(o.seed, 1) - 0.5) * 14;  // column tilts
                for (var i = 0; i < puffs; i++) {
                    var frac = i / puffs;
                    var yy = o.baseY - frac * o.h * s;
                    var sway = Math.sin(t * 2.2 + o.seed * 10 + i * 1.4) * 6 * s * (0.4 + frac);
                    var r = (13 - i * (8 / puffs)) * s * (0.8 + prand(o.seed, i) * 0.4);
                    var cxp = o.x + o.w * s / 2 + sway + lean * frac * s;
                    var sg = ctx.createRadialGradient(cxp, yy, 1, cxp, yy, r);
                    sg.addColorStop(0, 'rgba(105, 80, 170, 0.8)');
                    sg.addColorStop(1, 'rgba(70, 45, 130, 0)');
                    ctx.fillStyle = sg;
                    ctx.beginPath();
                    ctx.arc(cxp, yy, r, 0, Math.PI * 2);
                    ctx.fill();
                }
            },
            box: function (o, s) { return { x: o.x + 6 * s, y: o.baseY - o.h * s * 0.8, w: o.w * s - 12 * s, h: o.h * s * 0.8 }; }
        },
        {
            key: 'creature', word: 'Despair', w: 34, h: 30,
            draw: function (ctx, o, t, s) {
                // a shadow creature; each variant is a different silhouette
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
                if (o.variant === 1) {
                    // tall hooded figure with drooping horns
                    ctx.beginPath();
                    ctx.ellipse(cx, cy + 2 * s, o.w * s * 0.32, o.h * s * 0.55, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(cx - 5 * s, cy - o.h * s * 0.5);
                    ctx.quadraticCurveTo(cx - 11 * s, cy - o.h * s * 0.75, cx - 8 * s, cy - o.h * s * 0.3);
                    ctx.moveTo(cx + 5 * s, cy - o.h * s * 0.5);
                    ctx.quadraticCurveTo(cx + 11 * s, cy - o.h * s * 0.75, cx + 8 * s, cy - o.h * s * 0.3);
                    ctx.strokeStyle = '#221a4a';
                    ctx.lineWidth = 2.4 * s;
                    ctx.stroke();
                } else if (o.variant === 2) {
                    // low crawling mass with a ridged back
                    ctx.beginPath();
                    ctx.ellipse(cx, cy + 6 * s, o.w * s * 0.52, o.h * s * 0.3, 0, 0, Math.PI * 2);
                    ctx.fill();
                    for (var rdg = 0; rdg < 3; rdg++) {
                        var rx = cx - o.w * s * 0.3 + rdg * o.w * s * 0.3;
                        ctx.beginPath();
                        ctx.arc(rx, cy + 2 * s, 4 * s, Math.PI, 0);
                        ctx.fill();
                    }
                } else {
                    // classic hunched blob
                    ctx.beginPath();
                    ctx.ellipse(cx, cy + 4 * s, o.w * s * 0.42, o.h * s * 0.42, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                // eyes: 2 normally, 3 on the crawler
                ctx.fillStyle = 'rgba(200, 180, 255, 0.95)';
                var eyes = o.variant === 2 ? 3 : 2;
                for (var e = 0; e < eyes; e++) {
                    var ex = cx + (e - (eyes - 1) / 2) * 5 * s;
                    ctx.beginPath();
                    ctx.arc(ex, cy + (o.variant === 2 ? 4 * s : 0), 1.6 * s, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        },
        {
            key: 'thorns', word: 'Anger', w: 40, h: 34,
            draw: function (ctx, o, t, s) {
                // curling thorn tangle; stem count + curl direction vary
                ctx.strokeStyle = '#472a4d';
                ctx.lineWidth = 3 * s;
                ctx.lineCap = 'round';
                var stems = 2 + o.variant;                 // 2..4 stems
                var flip = prand(o.seed, 2) > 0.5 ? 1 : -1;
                for (var i = 0; i < stems; i++) {
                    var bx = o.x + (i + 0.5) * (o.w * s / stems);
                    var curl = (i % 2 ? 10 : -10) * flip;
                    ctx.beginPath();
                    ctx.moveTo(bx, o.baseY);
                    ctx.quadraticCurveTo(
                        bx + curl * s,
                        o.baseY - o.h * s * 0.6,
                        bx + (i % 2 ? -4 : 4) * flip * s,
                        o.baseY - o.h * s * (0.7 + prand(o.seed, i) * 0.3)
                    );
                    ctx.stroke();
                }
                // red glints
                ctx.strokeStyle = 'rgba(255, 110, 110, 0.7)';
                ctx.lineWidth = 1;
                for (var j = 0; j < stems; j++) {
                    var tx = o.x + (j + 0.5) * (o.w * s / stems);
                    ctx.beginPath();
                    ctx.moveTo(tx, o.baseY - o.h * s * 0.5);
                    ctx.lineTo(tx + 5 * s * flip, o.baseY - o.h * s * 0.5 - 4 * s);
                    ctx.stroke();
                }
            }
        },
        {
            key: 'pillar', word: 'Pride', w: 22, h: 56,
            draw: function (ctx, o, t, s) {
                // monolith variants: whole, cracked, or a toppled pair
                function block(bx, by, bw, bh, tilt) {
                    ctx.save();
                    ctx.translate(bx + bw / 2, by + bh);
                    ctx.rotate(tilt || 0);
                    var grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
                    grad.addColorStop(0, '#33427a');
                    grad.addColorStop(1, '#1a2450');
                    ctx.fillStyle = grad;
                    ctx.fillRect(-bw / 2, -bh, bw, bh);
                    ctx.strokeStyle = 'rgba(150, 195, 255, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-bw / 2, -bh, bw, bh);
                    ctx.restore();
                }

                if (o.variant === 1) {
                    // cracked: upper half sits offset and tilted on the lower
                    var half = o.h * s * 0.52;
                    block(o.x, o.baseY - half, o.w * s, half, 0);
                    block(o.x + 3 * s, o.baseY - o.h * s, o.w * s * 0.9, half * 0.9, -0.08);
                } else if (o.variant === 2) {
                    // a fallen stone leaning against a standing one
                    block(o.x, o.baseY - o.h * s * 0.9, o.w * s * 0.7, o.h * s * 0.9, 0);
                    block(o.x + o.w * s * 0.5, o.baseY - o.h * s * 0.45, o.w * s * 0.8, o.h * s * 0.45, 0.28);
                } else {
                    block(o.x, o.baseY - o.h * s, o.w * s, o.h * s, 0);
                }
            }
        },
        {
            key: 'barrier', word: 'Greed', w: 30, h: 40,
            draw: function (ctx, o, t, s) {
                // hovering shard(s) with a gold glint; single, twin, or orbiting
                function shard(cx, cy, w, h, rot) {
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(rot);
                    ctx.fillStyle = '#2a2258';
                    ctx.strokeStyle = 'rgba(255, 205, 90, 0.8)'; // a greedy gold glint
                    ctx.lineWidth = 1.2;
                    ctx.beginPath();
                    ctx.moveTo(0, -h * 0.45);
                    ctx.lineTo(w * 0.4, 0);
                    ctx.lineTo(0, h * 0.45);
                    ctx.lineTo(-w * 0.4, 0);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }

                var hover = Math.sin(t * 2.6 + o.seed * 8) * 4 * s;
                var cx = o.x + o.w * s / 2;
                var cy = o.baseY - o.h * s * 0.55 + hover;
                var wob = Math.sin(t + o.seed * 5) * 0.15;

                if (o.variant === 1) {
                    // twin small shards stacked with a gap
                    shard(cx, cy - o.h * s * 0.22, o.w * s * 0.7, o.h * s * 0.5, wob);
                    shard(cx, cy + o.h * s * 0.26, o.w * s * 0.7, o.h * s * 0.5, -wob);
                } else if (o.variant === 2) {
                    // one shard with two glinting satellites circling it
                    shard(cx, cy, o.w * s, o.h * s, wob);
                    for (var sat = 0; sat < 2; sat++) {
                        var ang = t * 2 + sat * Math.PI + o.seed * 6;
                        var sx = cx + Math.cos(ang) * o.w * s * 0.75;
                        var sy = cy + Math.sin(ang) * o.h * s * 0.35;
                        ctx.fillStyle = 'rgba(255, 205, 90, 0.85)';
                        ctx.beginPath();
                        ctx.arc(sx, sy, 2.2 * s, 0, Math.PI * 2);
                        ctx.fill();
                    }
                } else {
                    shard(cx, cy, o.w * s, o.h * s, wob);
                }
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
        pool.push({ active: false, x: 0, baseY: 0, w: 0, h: 0, type: null, seed: 0, variant: 0, passed: false });
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

    /** Place one hazard at a specific x. Applies variant + size jitter. */
    function place(x, groundY, progress) {
        var o = obtain();
        if (!o) return null;
        // later struggles appear later in the journey
        var maxIndex = Math.min(TYPES.length, 3 + Math.floor(progress * TYPES.length));
        var type = TYPES[Math.floor(Math.random() * maxIndex)];
        var jitter = 0.85 + Math.random() * 0.45;   // 0.85..1.3 size variety

        o.active = true;
        o.type = type;
        o.x = x;
        o.baseY = groundY;
        o.w = type.w * jitter;
        o.h = type.h * jitter;
        o.seed = Math.random();
        o.variant = Math.floor(Math.random() * 3); // structural silhouette
        o.passed = false;
        return o;
    }

    /**
     * Spawn a hazard just off the right edge. Past the early game
     * there is a growing chance of a DUO: a second hazard one
     * rhythm-jump behind the first, so pacing stays surprising.
     */
    function spawnHazard(screenW, groundY, scale, progress) {
        var first = place(screenW + 60, groundY, progress);
        if (first && progress > 0.15 && Math.random() < 0.18 + progress * 0.15) {
            place(screenW + 60 + (200 + Math.random() * 60) * scale, groundY, progress);
        }
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
                onPass(o);      // game counts this toward the combo streak
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

    /** Draw hazards (with their symbolic words) and stars. */
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
