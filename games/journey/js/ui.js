/* ============================================================
   Journey to the Light - ui.js
   HUD updates, screen routing, the cosmetics shop, and the
   local leaderboard. Exposes a global `UI`.

   Persistence (localStorage):
     journey_best        highest score
     journey_stars       star wallet
     journey_owned       JSON: { itemKey: true }
     journey_equipped    JSON: { hijab, outfit, trail, lantern, sky }
     journey_board       JSON: [ { score, date } ] top 5
     journey_settings    JSON: { reducedMotion, muted }
   ============================================================ */

(function () {
    'use strict';

    // -------------------- cosmetics catalog --------------------
    // Adding an item = one line here. `value` feeds Player.setCosmetics
    // or the sky renderer in game.js. Cost is in stars.
    var CATALOG = {
        hijab: {
            label: 'Hijab',
            items: [
                { key: 'hijab_moon',    name: 'Moonlight', value: '#cfd8ea', cost: 0 },
                { key: 'hijab_rose',    name: 'Rose',      value: '#ff9aa8', cost: 30 },
                { key: 'hijab_emerald', name: 'Emerald',   value: '#6fd6a8', cost: 50 },
                { key: 'hijab_gold',    name: 'Gold',      value: '#ffd98a', cost: 80 },
                { key: 'hijab_violet',  name: 'Violet',    value: '#b79df2', cost: 120 }
            ]
        },
        outfit: {
            label: 'Outfit',
            items: [
                { key: 'outfit_midnight', name: 'Midnight',  value: '#1d2740', cost: 0 },
                { key: 'outfit_plum',     name: 'Plum',      value: '#3a2440', cost: 30 },
                { key: 'outfit_teal',     name: 'Deep Teal', value: '#173a3a', cost: 50 },
                { key: 'outfit_wine',     name: 'Wine',      value: '#42222e', cost: 80 }
            ]
        },
        trail: {
            label: 'Trail',
            items: [
                { key: 'trail_none',     name: 'None',     value: 'none',     cost: 0 },
                { key: 'trail_stardust', name: 'Stardust', value: 'stardust', cost: 60 },
                { key: 'trail_petals',   name: 'Petals',   value: 'petals',   cost: 90 },
                { key: 'trail_glow',     name: 'Moonglow', value: 'glow',     cost: 120 }
            ]
        },
        lantern: {
            label: 'Lantern',
            items: [
                { key: 'lantern_classic', name: 'Classic', value: 'classic', cost: 0 },
                { key: 'lantern_orb',     name: 'Orb',     value: 'orb',     cost: 70 },
                { key: 'lantern_star',    name: 'Star',    value: 'star',    cost: 110 }
            ]
        },
        sky: {
            label: 'Sky',
            items: [
                { key: 'sky_night',    name: 'Dusk',         value: 'night',    cost: 0 },
                { key: 'sky_crescent', name: 'Sunset Blaze', value: 'crescent', cost: 60 },
                { key: 'sky_aurora',   name: 'Emerald Veld', value: 'aurora',   cost: 100 },
                { key: 'sky_nebula',   name: 'Violet Night', value: 'nebula',   cost: 150 }
            ]
        }
    };

    // swatch colors for non-color items (trails, lanterns, skies)
    var SWATCH_HINTS = {
        trail_none: '#39415c', trail_stardust: '#ffd98a', trail_petals: '#ff9aa8', trail_glow: '#7fb2ff',
        lantern_classic: '#c9b89a', lantern_orb: '#ffe7b4', lantern_star: '#fff1cc',
        sky_night: '#c85a34', sky_crescent: '#e8703a', sky_aurora: '#1e5548', sky_nebula: '#a84470'
    };

    // -------------------- persisted state --------------------

    function load(key, fallback) {
        try {
            var raw = localStorage.getItem(key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
    }

    function save(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
    }

    var state = {
        best: load('journey_best', 0),
        stars: load('journey_stars', 0),
        owned: load('journey_owned', {}),
        equipped: load('journey_equipped', {
            hijab: 'hijab_moon', outfit: 'outfit_midnight',
            trail: 'trail_none', lantern: 'lantern_classic', sky: 'sky_night'
        }),
        board: load('journey_board', []),
        settings: load('journey_settings', { reducedMotion: false, muted: false })
    };

    // free items are always owned
    Object.keys(CATALOG).forEach(function (cat) {
        CATALOG[cat].items.forEach(function (it) {
            if (it.cost === 0) state.owned[it.key] = true;
        });
    });

    // Global settings object read by player.js / game.js each frame
    window.JourneySettings = state.settings;

    // -------------------- DOM handles --------------------

    var el = {
        hud: document.getElementById('hud'),
        score: document.getElementById('score-value'),
        best: document.getElementById('best-value'),
        stars: document.getElementById('stars-value'),
        mult: document.getElementById('mult-badge'),
        screens: {
            menu: document.getElementById('screen-menu'),
            pause: document.getElementById('screen-pause'),
            over: document.getElementById('screen-over'),
            customize: document.getElementById('screen-customize'),
            leaderboard: document.getElementById('screen-leaderboard')
        },
        overScore: document.getElementById('over-score'),
        overStars: document.getElementById('over-stars'),
        overMessage: document.getElementById('over-message'),
        wallet: document.getElementById('wallet-stars'),
        tabs: document.getElementById('cosmetic-tabs'),
        grid: document.getElementById('shop-grid'),
        boardList: document.getElementById('board-list')
    };

    var activeTab = 'hijab';
    var returnScreen = 'menu'; // where Customize/Leaderboard should go "back" to

    // -------------------- screens --------------------

    /** Show exactly one screen (or none, for gameplay). */
    function show(name) {
        Object.keys(el.screens).forEach(function (k) {
            el.screens[k].classList.toggle('hidden', k !== name);
        });
        el.hud.classList.toggle('hidden', name !== null);
    }

    // -------------------- HUD --------------------

    function setScore(v)   { el.score.textContent = Math.floor(v); }
    function setBestHud()  { el.best.textContent = Math.floor(state.best); }
    function setStarsHud() { el.stars.textContent = state.stars; }
    /** Show the combo tier badge (hidden at x1). */
    function setMultiplier(mult) {
        var on = mult >= 2;
        el.mult.classList.toggle('hidden', !on);
        if (on) el.mult.innerHTML = '&#10022; combo &times;' + mult;
    }

    // -------------------- run lifecycle hooks --------------------

    /** Called by game when a run ends. Handles best score + board. */
    function runEnded(score, starsThisRun) {
        var s = Math.floor(score);
        state.stars += starsThisRun;
        if (s > state.best) state.best = s;

        // local top-5 leaderboard
        state.board.push({ score: s, date: new Date().toISOString().slice(0, 10) });
        state.board.sort(function (a, b) { return b.score - a.score; });
        state.board = state.board.slice(0, 5);

        save('journey_best', state.best);
        save('journey_stars', state.stars);
        save('journey_board', state.board);

        el.overScore.textContent = s;
        el.overStars.textContent = starsThisRun;
        var messages = [
            'Every fall is part of the road.',
            'The light has not moved. Neither has your hope.',
            'Rest tonight. Walk again tomorrow.',
            'She rises every time. So do you.',
            'The night tested you. You are still here.'
        ];
        el.overMessage.textContent = messages[Math.floor(Math.random() * messages.length)];

        setBestHud();
        setStarsHud();
        show('over');
    }

    // -------------------- cosmetics shop --------------------

    function equippedValue(cat) {
        var key = state.equipped[cat];
        var items = CATALOG[cat].items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].key === key) return items[i].value;
        }
        return items[0].value;
    }

    /** Push equipped cosmetics into the player + notify game (sky). */
    function applyCosmetics() {
        Player.setCosmetics({
            hijab: equippedValue('hijab'),
            outfit: equippedValue('outfit'),
            trail: equippedValue('trail'),
            lantern: equippedValue('lantern')
        });
        if (window.Game && Game.setSky) Game.setSky(equippedValue('sky'));
    }

    function renderTabs() {
        el.tabs.innerHTML = '';
        Object.keys(CATALOG).forEach(function (cat) {
            var b = document.createElement('button');
            b.className = 'tab' + (cat === activeTab ? ' active' : '');
            b.textContent = CATALOG[cat].label;
            b.addEventListener('click', function () {
                activeTab = cat;
                renderTabs();
                renderGrid();
            });
            el.tabs.appendChild(b);
        });
    }

    function renderGrid() {
        el.grid.innerHTML = '';
        el.wallet.textContent = state.stars;

        CATALOG[activeTab].items.forEach(function (it) {
            var owned = !!state.owned[it.key];
            var equipped = state.equipped[activeTab] === it.key;

            var card = document.createElement('div');
            card.className = 'shop-item' + (equipped ? ' equipped' : '');

            var swatch = document.createElement('div');
            swatch.className = 'shop-swatch';
            swatch.style.background = /^#/.test(it.value) ? it.value : (SWATCH_HINTS[it.key] || '#888');
            card.appendChild(swatch);

            var name = document.createElement('div');
            name.className = 'shop-name';
            name.textContent = it.name;
            card.appendChild(name);

            var price = document.createElement('div');
            price.className = 'shop-price' + (owned ? ' owned' : '');
            price.innerHTML = equipped ? 'equipped' : owned ? 'owned' : '&#10022; ' + it.cost;
            card.appendChild(price);

            card.addEventListener('click', function () {
                if (owned) {
                    state.equipped[activeTab] = it.key;   // equip
                } else if (state.stars >= it.cost) {
                    state.stars -= it.cost;               // buy + equip
                    state.owned[it.key] = true;
                    state.equipped[activeTab] = it.key;
                    save('journey_stars', state.stars);
                    save('journey_owned', state.owned);
                    GameAudio.collect();
                } else {
                    return; // can't afford - card simply doesn't respond
                }
                save('journey_equipped', state.equipped);
                applyCosmetics();
                setStarsHud();
                renderGrid();
            });

            el.grid.appendChild(card);
        });
    }

    // -------------------- leaderboard --------------------

    function renderBoard() {
        el.boardList.innerHTML = '';
        if (state.board.length === 0) {
            var li = document.createElement('li');
            li.className = 'empty';
            li.textContent = 'No journeys yet. The road is waiting.';
            el.boardList.appendChild(li);
            return;
        }
        state.board.forEach(function (entry, i) {
            var row = document.createElement('li');
            row.innerHTML =
                '<span><span class="rank">' + (i + 1) + '</span>' +
                '<span class="pts">' + entry.score + '</span></span>' +
                '<span class="when">' + entry.date + '</span>';
            el.boardList.appendChild(row);
        });
    }

    // -------------------- wiring --------------------

    function bindButtons(startGame, resumeGame, quitToMenu) {
        document.getElementById('btn-play').addEventListener('click', startGame);
        document.getElementById('btn-again').addEventListener('click', startGame);
        document.getElementById('btn-resume').addEventListener('click', resumeGame);
        document.getElementById('btn-quit').addEventListener('click', quitToMenu);

        document.getElementById('btn-customize').addEventListener('click', function () {
            returnScreen = 'menu'; openCustomize();
        });
        document.getElementById('btn-over-customize').addEventListener('click', function () {
            returnScreen = 'over'; openCustomize();
        });
        document.getElementById('btn-customize-back').addEventListener('click', function () {
            show(returnScreen);
        });

        document.getElementById('btn-leaderboard').addEventListener('click', function () {
            returnScreen = 'menu'; openBoard();
        });
        document.getElementById('btn-over-leaderboard').addEventListener('click', function () {
            returnScreen = 'over'; openBoard();
        });
        document.getElementById('btn-board-back').addEventListener('click', function () {
            show(returnScreen);
        });

        // settings toggles
        var rm = document.getElementById('reduced-motion');
        var mute = document.getElementById('mute-audio');
        rm.checked = state.settings.reducedMotion;
        mute.checked = state.settings.muted;
        GameAudio.setMuted(state.settings.muted);

        rm.addEventListener('change', function () {
            state.settings.reducedMotion = rm.checked;
            save('journey_settings', state.settings);
        });
        mute.addEventListener('change', function () {
            state.settings.muted = mute.checked;
            GameAudio.setMuted(mute.checked);
            save('journey_settings', state.settings);
        });
    }

    function openCustomize() {
        renderTabs();
        renderGrid();
        show('customize');
    }

    function openBoard() {
        renderBoard();
        show('leaderboard');
    }

    // Public API
    window.UI = {
        state: state,
        show: show,
        setScore: setScore,
        setBestHud: setBestHud,
        setStarsHud: setStarsHud,
        setMultiplier: setMultiplier,
        runEnded: runEnded,
        applyCosmetics: applyCosmetics,
        bindButtons: bindButtons
    };
})();
