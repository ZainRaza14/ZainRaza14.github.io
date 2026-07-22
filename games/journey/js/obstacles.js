/* ============================================================
   Journey to the Light - obstacles.js  (platformer edition)
   Symbolic hazards + collectible stars, with object pooling.
   Exposes a global `Obstacles`.

   All entities live in WORLD coordinates now. game.js places
   hazards and star arcs during level generation (addHazardAt /
   addStarsAt); nothing moves by itself - the camera does.

   VARIETY SYSTEM (unchanged): every hazard gets a structural
   variant (0..2), a size jitter, and deterministic per-instance
   randomness via prand(seed, i).
   ============================================================ */

(function () {
    'use strict';

    var POOL_SIZE = 40;
    var STAR_POOL_SIZE = 48;

    /** Deterministic pseudo-random in [0,1) from an instance seed. */
    function prand(seed, i) {
        var v = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
        return v - Math.floor(v);
    }

    /** Obstacle catalog - identical silhouettes to the runner version,
        but drawn in warm savanna dusk colors. */
    var TYPES = [
        {
            key: 'spikes', word: 'Fear', w: 46, h: 26,
            draw: function (ctx, o, t, s) {
                ctx.fillStyle = '#4a2440';
                ctx.strokeStyle = 'rgba(255, 150, 120, 0.75)';
                ctx.lineWidth = 1;
                var n = 3 + o.variant;
                for (var i = 0; i < n; i++) {
                    var sx = o.x + (i / n) * o.w * s;
                    var sw = (o.w * s) / n;
                    var hh = 0.6 + prand(o.seed, i) * 0.4;
                    ctx.beginPath();
                    ctx.moveTo(sx, o.baseY);
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
                ctx.fillStyle = '#1c0e20';
                ctx.beginPath();
                ctx.moveTo(o.x, o.baseY);
                ctx.lineTo(o.x + o.w * s * 0.5, o.baseY + 8 * s);
                ctx.lineTo(o.x + o.w * s, o.baseY);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = 'rgba(255, 140, 90, ' + (0.6 + Math.sin(t * 3 + o.seed * 9) * 0.2) + ')';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.moveTo(o.x, o.baseY);
                var joints = 3 + o.variant;
                for (var i = 1; i <= joints; i++) {
                    var jx = o.x + (i / joints) * o.w * s;
                    var jy = o.baseY + (prand(o.seed, i) - 0.5) * 8 * s;
                    ctx.lineTo(jx, jy);
                }
                ctx.stroke();

                if (o.variant === 2) {
                    ctx.strokeStyle = 'rgba(255, 160, 110, 0.35)';
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
            box: function (o, s) { return { x: o.x + 8 * s, y: o.baseY - 4 * s, w: o.w * s - 16 * s, h: 8 * s }; }
        },
        {
            key: 'smoke', word: 'Anxiety', w: 34, h: 52,
            draw: function (ctx, o, t, s) {
                var puffs = 3 + o.variant;
                var lean = (prand(o.seed, 1) - 0.5) * 14;
                for (var i = 0; i < puffs; i++) {
                    var frac = i / puffs;
                    var yy = o.baseY - frac * o.h * s;
                    var sway = Math.sin(t * 2.2 + o.seed * 10 + i * 1.4) * 6 * s * (0.4 + frac);
                    var r = (13 - i * (8 / puffs)) * s * (0.8 + prand(o.seed, i) * 0.4);
                    var cxp = o.x + o.w * s / 2 + sway + lean * frac * s;
                    var sg = ctx.createRadialGradient(cxp, yy, 1, cxp, yy, r);
                    sg.addColorStop(0, 'rgba(120, 60, 110, 0.8)');
                    sg.addColorStop(1, 'rgba(80, 35, 90, 0)');
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
                var breathe = Math.sin(t * 3 + o.seed * 7) * 2 * s;
                var cx = o.x + o.w * s / 2;
                var cy = o.baseY - o.h * s * 0.45 + breathe;

                var cg = ctx.createRadialGradient(cx, cy, 2, cx, cy, o.h * s * 0.8);
                cg.addColorStop(0, 'rgba(120, 60, 100, 0.95)');
                cg.addColorStop(1, 'rgba(60, 25, 60, 0)');
                ctx.fillStyle = cg;
                ctx.beginPath();
                ctx.arc(cx, cy, o.h * s * 0.8, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#3a1838';
                if (o.variant === 1) {
                    ctx.beginPath();
                    ctx.ellipse(cx, cy + 2 * s, o.w * s * 0.32, o.h * s * 0.55, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.beginPath();
                    ctx.moveTo(cx - 5 * s, cy - o.h * s * 0.5);
                    ctx.quadraticCurveTo(cx - 11 * s, cy - o.h * s * 0.75, cx - 8 * s, cy - o.h * s * 0.3);
                    ctx.moveTo(cx + 5 * s, cy - o.h * s * 0.5);
                    ctx.quadraticCurveTo(cx + 11 * s, cy - o.h * s * 0.75, cx + 8 * s, cy - o.h * s * 0.3);
                    ctx.strokeStyle = '#3a1838';
                    ctx.lineWidth = 2.4 * s;
                    ctx.stroke();
                } else if (o.variant === 2) {
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
                    ctx.beginPath();
                    ctx.ellipse(cx, cy + 4 * s, o.w * s * 0.42, o.h * s * 0.42, 0, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.fillStyle = 'rgba(255, 200, 160, 0.95)';
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
                ctx.strokeStyle = '#5c2438';
                ctx.lineWidth = 3 * s;
                ctx.lineCap = 'round';
                var stems = 2 + o.variant;
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
                ctx.strokeStyle = 'rgba(255, 120, 100, 0.75)';
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
                function block(bx, by, bw, bh, tilt) {
                    ctx.save();
                    ctx.translate(bx + bw / 2, by + bh);
                    ctx.rotate(tilt || 0);
                    var grad = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
                    grad.addColorStop(0, '#7a4632');
                    grad.addColorStop(1, '#4a2820');
                    ctx.fillStyle = grad;
                    ctx.fillRect(-bw / 2, -bh, bw, bh);
                    ctx.strokeStyle = 'rgba(255, 190, 140, 0.5)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(-bw / 2, -bh, bw, bh);
                    ctx.restore();
                }

                if (o.variant === 1) {
                    var half = o.h * s * 0.52;
                    block(o.x, o.baseY - half, o.w * s, half, 0);
                    block(o.x + 3 * s, o.baseY - o.h * s, o.w * s * 0.9, half * 0.9, -0.08);
                } else if (o.variant === 2) {
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
                function shard(cx, cy, w, h, rot) {
                    ctx.save();
                    ctx.translate(cx, cy);
                    ctx.rotate(rot);
                    ctx.fillStyle = '#502a48';
                    ctx.strokeStyle = 'rgba(255, 205, 90, 0.85)';
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
                    shard(cx, cy - o.h * s * 0.22, o.w * s * 0.7, o.h * s * 0.5, wob);
                    shard(cx, cy + o.h * s * 0.26, o.w * s * 0.7, o.h * s * 0.5, -wob);
                } else if (o.variant === 2) {
                    shard(cx, cy, o.w * s, o.h * s, wob);
                    for (var sat = 0; sat < 2; sat++) {
                        var ang = t * 2 + sat * Math.PI + o.seed * 6;
                        var sx = cx + Math.cos(ang) * o.w * s * 0.75;
                        var sy = cy + Math.sin(ang) * o.h * s * 0.35;
                        ctx.fillStyle = 'rgba(255, 205, 90, 0.9)';
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

    var pool = [];
    var starPool = [];

    for (var i = 0; i < POOL_SIZE; i++) {
        pool.push({ active: false, x: 0, baseY: 0, w: 0, h: 0, type: null, seed: 0, variant: 0, passed: false });
    }
    for (var j = 0; j < STAR_POOL_SIZE; j++) {
        starPool.push({ active: false, x: 0, y: 0, seed: 0, collected: 0 });
    }

    function reset() {
        for (var i = 0; i < pool.length; i++) pool[i].active = false;
        for (var j = 0; j < starPool.length; j++) starPool[j].active = false;
    }

    function obtain() {
        for (var i = 0; i < pool.length; i++) {
            if (!pool[i].active) return pool[i];
        }
        return null;
    }

    /** Place a hazard at world x on a surface with top = baseY. */
    function addHazardAt(x, baseY, progress) {
        var o = obtain();
        if (!o) return null;
        var maxIndex = Math.min(TYPES.length, 3 + Math.floor(progress * TYPES.length));
        var type = TYPES[Math.floor(Math.random() * maxIndex)];
        var jitter = 0.85 + Math.random() * 0.45;

        o.active = true;
        o.type = type;
        o.x = x;
        o.baseY = baseY;
        o.w = type.w * jitter;
        o.h = type.h * jitter;
        o.seed = Math.random();
        o.variant = Math.floor(Math.random() * 3);
        o.passed = false;
        return o;
    }

    /** Place an arc of stars centred at world x, above surface baseY. */
    function addStarsAt(x, baseY, scale, count, lift) {
        count = count || 3 + Math.floor(Math.random() * 3);
        for (var c = 0; c < count; c++) {
            var st = null;
            for (var k = 0; k < starPool.length; k++) {
                if (!starPool[k].active) { st = starPool[k]; break; }
            }
            if (!st) return;
            st.active = true;
            st.collected = 0;
            st.seed = Math.random();
            st.x = x + (c - (count - 1) / 2) * 34 * scale;
            var arcLift = Math.sin((c / Math.max(1, count - 1)) * Math.PI) * 26 * scale;
            st.y = baseY - (lift || 45) * scale - arcLift;
        }
    }

    /** Pass detection + star sparkle timers + pruning behind camera. */
    function update(dt, camX, playerX, onPass) {
        var i;
        for (i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (!o.active) continue;
            if (!o.passed && o.x + o.w < playerX - 20) {
                o.passed = true;
                onPass(o);
            }
            if (o.x + o.w * 2 < camX - 200) o.active = false;
        }
        for (i = 0; i < starPool.length; i++) {
            var st = starPool[i];
            if (!st.active) continue;
            if (st.collected > 0) {
                st.collected += dt * 4;
                if (st.collected > 1) st.active = false;
            }
            if (st.x < camX - 200) st.active = false;
        }
    }

    function overlap(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    }

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

    function collectStars(scale) {
        var hb = Player.hitbox();
        var got = 0;
        for (var i = 0; i < starPool.length; i++) {
            var st = starPool[i];
            if (!st.active || st.collected > 0) continue;
            var box = { x: st.x - 12 * scale, y: st.y - 12 * scale, w: 24 * scale, h: 24 * scale };
            if (overlap(hb, box)) {
                st.collected = 0.001;
                got++;
            }
        }
        return got;
    }

    /** Draw (world coords; game translates by camera). */
    function draw(ctx, t, scale, camX, viewW) {
        var i;

        for (i = 0; i < pool.length; i++) {
            var o = pool[i];
            if (!o.active) continue;
            if (o.x > camX + viewW + 100 || o.x + o.w * 2 < camX - 100) continue; // cull

            o.type.draw(ctx, o, t, scale);

            ctx.font = '400 italic ' + Math.round(15 * scale) + 'px "Trebuchet MS", "Segoe UI", Tahoma, sans-serif';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(255, 190, 150, 0.9)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = 'rgba(255, 240, 225, ' + (0.85 + Math.sin(t * 1.5 + o.seed * 9) * 0.15) + ')';
            ctx.fillText(o.type.word, o.x + o.w * scale / 2, o.baseY - o.h * scale - 14 * scale);
            ctx.shadowBlur = 0;
        }

        for (i = 0; i < starPool.length; i++) {
            var st = starPool[i];
            if (!st.active) continue;
            if (st.x > camX + viewW + 60 || st.x < camX - 60) continue;

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

    window.Obstacles = {
        reset: reset,
        addHazardAt: addHazardAt,
        addStarsAt: addStarsAt,
        update: update,
        hitsPlayer: hitsPlayer,
        collectStars: collectStars,
        draw: draw
    };
})();
