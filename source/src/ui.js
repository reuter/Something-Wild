/* Something Wild! - user interface. Player 0 is the human; everyone else is a computer opponent. */
(function () {
  'use strict';
  const SW = window.SW, AI = window.SWAI, ART = window.SWART;
  const { COLORS, COLOR_LABEL, POWERS, cardName } = SW;
  const LEVEL_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard', unpredictable: 'Unpredictable' };
  const LEVEL_SHORT = { easy: 'Easy', medium: 'Med', hard: 'Hard', unpredictable: '???' };
  const BOT_NAMES = ['Pixel', 'Gadget', 'Rascal'];
  const ABORT = { abort: true };
  const $ = (s, el) => (el || document).querySelector(s);

  /* ---------- settings ---------- */
  const DEFAULTS = { players: 3, levels: ['medium', 'hard', 'medium'], speed: 'normal', first: 'random' };
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('sw-settings') || 'null');
      if (s && s.players >= 2 && s.players <= 4 && Array.isArray(s.levels)) return Object.assign({}, DEFAULTS, s);
    } catch (e) { /* storage unavailable */ }
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function saveSettings() { try { localStorage.setItem('sw-settings', JSON.stringify(U.settings)); } catch (e) { /* ignore */ } }

  const U = {
    screen: 'setup', settings: loadSettings(), state: null, agents: null, token: 0,
    ask: null, status: '', log: [], fresh: new Set(), hint: null, sheetRes: null, sheetDismiss: false,
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const scale = () => (U.settings.speed === 'fast' ? 0.35 : 1);

  /* ---------- HTML builders ---------- */
  function cardHTML(c, o) {
    o = o || {};
    const cls = ['card', 'c-' + c.color];
    if (o.size) cls.push(o.size);
    if (U.fresh.has(c.id)) cls.push('fresh');
    const a = U.ask;
    if (a && a.ids && a.ids.indexOf(c.id) >= 0) cls.push('selectable');
    if (a && a.chosen === c.id) cls.push('picked');
    if (U.hint === c.id) cls.push('hinted');
    if (o.hand && a && a.dragPlay && a.ids.indexOf(c.id) >= 0) cls.push('draggable');
    return `<div class="${cls.join(' ')}" data-card="${c.id}" role="img" aria-label="${cardName(c)}">` +
      `<div class="num">${c.num}</div>` +
      (c.num === 1 ? `<div class="msym" title="Take a Mover">${ART.moverSymbolSVG()}</div>` : '') +
      `<div class="art">${ART.figureSVG(c.color, c.num)}</div><div class="nm" data-n="${c.num}">${ART.charName(c)}</div></div>`;
  }
  const staticCard = (c, size) => { const f = U.fresh; U.fresh = new Set(); const a = U.ask; U.ask = null; const h = U.hint; U.hint = null; const r = cardHTML(c, { size }); U.fresh = f; U.ask = a; U.hint = h; return r; };
  const backHTML = size => `<div class="card back ${size || ''}"></div>`;
  function powerHTML(p, o) {
    o = o || {};
    return `<div class="pcard c-${p.color} ${o.size || ''} ${o.disabled ? 'disabled' : ''}" data-power="${p.id}">` +
      `<div class="ptop">${p.name}</div><div class="pico">${ART.powerIcon(p.id)}</div><div class="ptxt">${p.text}</div></div>`;
  }
  const chipHTML = p => `<button class="pchip c-${p.color}" data-act="power:${p.id}" aria-label="${p.name}">${ART.powerIcon(p.id)}</button>`;
  const pipsHTML = p => `<div class="pips" aria-label="${p.powers.length} of 3 Powers">` +
    [0, 1, 2].map(i => `<span class="pip ${i < p.powers.length ? 'on' : ''}"></span>`).join('') + '</div>';
  const moverChip = () => `<div class="moverchip" title="Has the Mover">${ART.moverSVG()}</div>`;

  function oppHTML(p) {
    const s = U.state;
    const active = s.current === p.id && s.winner == null;
    return `<div class="opp ${active ? 'active' : ''}">` +
      `<div class="h1"><div class="av">${ART.avatarSVG(p.id)}</div><b class="who">${p.name}</b>${s.mover === p.id ? moverChip() : ''}</div>` +
      `<div class="h2"><span class="lvl ${p.level}">${LEVEL_SHORT[p.level]}</span>` +
      `<span class="handcount"><span class="mb"></span>${p.hand.length}</span>${pipsHTML(p)}</div>` +
      `<div class="tabrow ${p.tableau.length ? '' : 'empty'}">${p.tableau.map(c => cardHTML(c, { size: 'sm' })).join('')}</div>` +
      `<div class="chips">${p.powers.map(chipHTML).join('')}</div></div>`;
  }

  function centerHTML() {
    const s = U.state;
    const top = s.discard.length ? staticCard(s.discard[s.discard.length - 1], '') : '<div class="card empty"></div>';
    const holder = s.mover == null ? 'Up for grabs' : (s.mover === 0 ? 'You have it' : s.players[s.mover].name + ' has it');
    return `<div class="center">` +
      `<div class="row">` +
      `<div class="pile">${backHTML('')}<span class="count">Deck ${s.deck.length}</span></div>` +
      `<button class="pile discard" data-act="discard" aria-label="Look through the discard pile">${top}<span class="count">Discard ${s.discard.length}</span></button>` +
      `<div class="centerpower">${s.center ? powerHTML(s.center, { size: 'big' }) : ''}` +
      (s.center ? `<span class="hint c-${s.center.color}"><i class="dot"></i>Play ${COLOR_LABEL[s.center.color]} or a 1 to grab the Mover</span>` : '') + `</div>` +
      `<div class="moverbox ${s.mover != null ? 'held' : ''}"><div class="tok">${ART.moverSVG()}</div>${holder}</div>` +
      `</div>` +
      `<div class="ticker">${U.log.slice(-2).map(m => `<div>${m}</div>`).join('')}</div></div>`;
  }

  function meHTML() {
    const s = U.state, me = s.players[0];
    const active = s.current === 0 && s.winner == null;
    return `<div class="me ${active ? 'active' : ''}">` +
      `<div class="head"><b class="who">You</b>${s.mover === 0 ? moverChip() : ''}<div class="chips">${me.powers.map(chipHTML).join('')}</div>${pipsHTML(me)}</div>` +
      `<div class="tabrow ${me.tableau.length ? '' : 'empty'}">${me.tableau.map(c => cardHTML(c, { size: 'md' })).join('')}</div></div>` +
      `<div class="hand">${me.hand.map(c => cardHTML(c, { hand: true })).join('')}</div>`;
  }

  function promptHTML() {
    const a = U.ask;
    if (a) {
      const btns = (a.buttons || []).map(b =>
        `<button class="pbtn ${b.primary ? 'primary' : ''}" data-btn="${b.id}" ${b.needsChoice && a.chosen == null ? 'disabled' : ''}>${b.label}</button>`).join('');
      return `<div class="promptbar"><div class="msg">${a.text}${a.sub ? `<small>${a.sub}</small>` : ''}</div>${btns}</div>`;
    }
    if (U.state && U.state.winner != null) {
      const w = U.state.players[U.state.winner];
      return `<div class="promptbar over"><div class="msg">Game over: ${w.human ? 'you win!' : w.name + ' wins'}</div>` +
        `<button class="pbtn" data-act="menu-setup">Menu</button><button class="pbtn primary" data-act="again">Play again</button></div>`;
    }
    return `<div class="promptbar"><div class="msg ${U.status ? 'dots' : ''}">${U.status || ''}</div></div>`;
  }

  function topbar() {
    return `<div class="topbar"><div class="logo">Something <b>Wild!</b></div>` +
      `<button class="iconbtn" data-act="rules">Rules</button>` +
      (U.screen === 'game' ? `<button class="iconbtn" data-act="menu" aria-label="Menu">&#9776;</button>` : '') + `</div>`;
  }

  function setupHTML() {
    const st = U.settings;
    const seg = (items, cur, prefix) => `<div class="seg">${items.map(([v, l]) =>
      `<button data-set="${prefix}:${v}" aria-pressed="${String(cur) === String(v)}">${l}</button>`).join('')}</div>`;
    const fan = [['red', 6], ['blue', 3], ['purple', 9], ['yellow', 5], ['green', 8]].map(([c, n]) => staticCard(SW.CARD_BY_ID[c + n], '')).join('');
    let opp = '';
    for (let i = 0; i < st.players - 1; i++) {
      opp += `<div class="opp-row"><div class="av">${ART.avatarSVG(i + 1)}</div><div class="nm">${BOT_NAMES[i]}</div>` +
        `<div class="seg">${AI.LEVELS.map(l => `<button data-set="level:${i}:${l}" aria-pressed="${st.levels[i] === l}">${LEVEL_LABEL[l]}</button>`).join('')}</div></div>`;
    }
    return topbar() + `<div class="setup">` +
      `<div class="hero"><h1><span>Something</span><em>Wild!</em></h1><div class="fan">${fan}</div>` +
      `<p>Beat the computer to three Powers.<br>Works offline.</p></div>` +
      `<div class="panel"><h3>Players</h3>${seg([[2, '2'], [3, '3'], [4, '4']], st.players, 'players')}</div>` +
      `<div class="panel"><h3>Opponents</h3>${opp}</div>` +
      `<div class="panel"><h3>Who goes first?</h3>${seg([['random', 'Random'], ['you', 'Me']], st.first, 'first')}` +
      `<h3 style="margin-top:14px">Computer speed</h3>${seg([['normal', 'Normal'], ['fast', 'Fast']], st.speed, 'speed')}</div>` +
      `<button class="bigbtn" data-act="start">Play!</button>` +
      `<div class="fine"><button class="linkbtn" data-act="rules">How to play</button></div></div>`;
  }

  function render() {
    const root = $('#app');
    const y = window.scrollY;
    if (U.screen === 'setup') {
      root.innerHTML = setupHTML();
    } else {
      const s = U.state;
      root.innerHTML = topbar() + `<div class="game">` +
        `<div class="opps" style="--n:${s.players.length - 1}">${s.players.slice(1).map(oppHTML).join('')}</div>` +
        centerHTML() + meHTML() + promptHTML() + `</div>`;
    }
    U.fresh.clear();
    window.scrollTo(0, y);
  }

  /* ---------- sheets ---------- */
  function openSheet(html, o) {
    o = o || {};
    return new Promise(res => {
      const peek = o.peek ? '<button class="peekbtn" data-peek>\uD83D\uDC40 Peek at table</button>' : '';
      $('#overlay').innerHTML = `<div class="scrim ${o.modal ? 'center-modal' : ''}" data-scrim><div class="sheet" role="dialog" aria-modal="true">${peek}${html}</div></div>`;
      U.sheetRes = res; U.sheetDismiss = !!o.dismiss;
    });
  }
  function closeSheet(v) {
    $('#overlay').innerHTML = '';
    const r = U.sheetRes; U.sheetRes = null; U.sheetDismiss = false;
    if (r) r(v);
  }

  function rulesHTML() {
    return `<div class="rules"><h2>How to play</h2>` +
      `<p><b>Goal:</b> be the first to score <b>three Powers</b>.</p>` +
      `<p>You score a Power by getting <b>three cards in front of you</b> that make a <b>set</b> (same number, any colors) or a <b>run</b> (same color, numbers in order, like Blue 4-5-6). Scoring is automatic.</p>` +
      `<h4>Your turn</h4><ol>` +
      `<li><b>Draw</b> a card.</li><li><b>Play</b> one card from your hand face up in front of you.</li>` +
      `<li><b>Take the Mover</b> if the card you played is the same color as the Power in the center, or is a <b>1</b> (it has the Mover symbol). You keep it until someone else takes it.</li>` +
      `<li><b>Use a Power</b> &mdash; only if you have the Mover. Pick one you have scored, or the one in the center. It lasts until the end of your turn.</li>` +
      `<li><b>Score</b> if you have a set or run. Discard those three cards and take the Power from the center.</li>` +
      `<li><b>Discard</b> down to five cards in front of you.</li></ol>` +
      `<p>You don't need the Mover to score &mdash; only to use Powers. If the deck runs out, the discard pile is shuffled.</p>` +
      `<h4>The ten Powers</h4><div class="pgrid">${POWERS.map(p => powerHTML(p)).join('')}</div>` +
      `<button class="skipbtn" data-res="close">Got it</button></div>`;
  }

  /* ---------- inline questions ---------- */
  function ask(cfg) {
    return new Promise(res => {
      U.ask = Object.assign({ chosen: null }, cfg, { res });
      U.status = '';
      render();
    });
  }
  function resolveAsk(result) {
    const a = U.ask; if (!a) return;
    U.ask = null; U.hint = null;
    render();
    a.res(result);
  }

  /* ---------- the human player ---------- */
  const human = {
    async choosePlay(state, i) {
      const hand = state.players[i].hand;
      for (;;) {
        const r = await ask({
          text: 'Your turn: play a card', sub: 'Drag a card to your play area, or tap it and press Play.',
          ids: hand.map(c => c.id), chosen: U.hintChosen || null, dragPlay: true,
          buttons: [{ id: 'hint', label: '💡 Hint' }, { id: 'ok', label: 'Play', primary: true, needsChoice: true }],
        });
        if (r.button === 'ok' && r.id) { U.hintChosen = null; return r.id; }
      }
    },
    async choosePower(state, i, opts) {
      const html = `<h2>Use a Power?</h2><p class="sub">You have the Mover. Use one Power this turn, or skip.</p><div class="plist">` +
        opts.map(o => `<button class="popt" data-res="use:${o.power.id}" ${o.feasible ? '' : 'disabled'}>${powerHTML(o.power)}` +
          `<div class="info"><b>${o.power.name}</b>${o.power.text}` +
          (o.source === 'center' ? '<br><i>In the center &mdash; you take it if you score.</i>' : '') +
          (o.scores ? '<br><span class="star">&#9733; Lets you score right now!</span>' : '') +
          (!o.feasible ? `<br><span class="why">${o.reason}</span>` : '') + `</div></button>`).join('') +
        `</div><button class="skipbtn" data-res="skip">No Power this turn</button>`;
      const r = await openSheet(html, { peek: true });
      return r && r.indexOf('use:') === 0 ? { id: r.slice(4) } : null;
    },
    async chooseColor() {
      const r = await openSheet(`<h2>Guess a color</h2><p class="sub">The top card of the deck is revealed. If it matches, you play it.</p>` +
        `<div class="colorgrid">${COLORS.map(c => `<button class="c-${c}" data-res="${c}">${COLOR_LABEL[c]}</button>`).join('')}</div>`, { peek: true });
      return r;
    },
    async chooseNumber() {
      const r = await openSheet(`<h2>Guess a number</h2><p class="sub">The top card of the deck is revealed. If it matches, you play it.</p>` +
        `<div class="numgrid">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-res="${n}">${n}</button>`).join('')}</div>`, { peek: true });
      return parseInt(r, 10);
    },
    async chooseSwap(state, i, pairs) {
      const mineIds = pairs.map(p => p.mine).filter((x, k, a) => a.indexOf(x) === k);
      const r1 = await ask({ text: 'Swap: pick YOUR card to give away', sub: 'Highlighted cards have a same-color card on the table.', ids: mineIds, auto: true, buttons: [] });
      const options = pairs.filter(p => p.mine === r1.id);
      const r2 = await ask({ text: 'Now pick the card you want', sub: 'It must be the same color as the one you give.', ids: options.map(p => p.theirs), auto: true, buttons: [{ id: 'back', label: 'Back' }] });
      if (r2.button === 'back') return human.chooseSwap(state, i, pairs);
      return options.find(p => p.theirs === r2.id) || options[0];
    },
    async choosePassCard(state, i) {
      const n = state.players.length;
      const prev = state.players[(i - 1 + n) % n];
      const r = await ask({ text: `Pass It On: pick a card to give ${prev.name}`, sub: 'Everyone passes one card to the previous player.', ids: state.players[i].hand.map(c => c.id), buttons: [{ id: 'ok', label: 'Pass', primary: true, needsChoice: true }] });
      return r.id;
    },
    async chooseDiscardPick(state, i, pile) {
      const r = await openSheet(`<h2>Play from the discard pile</h2><p class="sub">Pick any card to play in front of you.</p><div class="cardrow">` +
        pile.map(c => `<button style="border:0;background:none;padding:0" data-res="${c.id}">${staticCard(c, '')}</button>`).join('') + `</div>`, { peek: true });
      return r;
    },
    async chooseTriple(state, i, triples) {
      const r = await openSheet(`<h2>Which cards do you score with?</h2><p class="sub">You have more than one way to score.</p>` +
        triples.map((t, k) => `<button class="tripleopt" data-res="${k}">${t.map(c => staticCard(c, '')).join('')}<span class="lbl">${SW.tripleKind(t, state.turn.power) === 'run' ? 'Run' : SW.tripleKind(t, state.turn.power) === 'set' ? 'Set' : 'Power'}</span></button>`).join(''), { peek: true });
      return parseInt(r, 10);
    },
    async chooseDiscards(state, i, n) {
      const chosen = [];
      for (let k = 0; k < n; k++) {
        const left = state.players[i].tableau.filter(c => chosen.indexOf(c.id) < 0);
        const r = await ask({ text: `Over five cards: discard ${n - k} more`, sub: 'Tap the card to discard, then press Discard.', ids: left.map(c => c.id), buttons: [{ id: 'ok', label: 'Discard', primary: true, needsChoice: true }] });
        chosen.push(r.id);
      }
      return chosen;
    },
  };

  /* ---------- game flow ---------- */
  function pushLog(m) { U.log.push(m); if (U.log.length > 40) U.log.shift(); }
  function showBanner(text, sub) {
    const b = $('#banner');
    b.innerHTML = `<div class="banner"><div class="b">${text}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
    clearTimeout(showBanner.t);
    showBanner.t = setTimeout(() => { b.innerHTML = ''; }, 2000 * Math.max(.5, scale()));
  }

  function makeHooks(token) {
    return {
      event: async (type, d) => {
        if (U.token !== token) throw ABORT;
        const s = U.state, P = i => s.players[i], who = i => (i === 0 ? 'You' : P(i).name);
        const verb = (i, a, b) => (i === 0 ? a : b);
        let ms = 0;
        switch (type) {
          case 'turn-start':
            U.status = d.player === 0 ? '' : `${P(d.player).name} is playing`;
            ms = d.player === 0 ? 0 : 400;
            break;
          case 'draw':
            if (d.player === 0 && d.card) { U.fresh.add(d.card.id); pushLog(`You drew ${cardName(d.card)}`); }
            break;
          case 'play':
            U.fresh.add(d.card.id);
            pushLog(`${who(d.player)} ${verb(d.player, 'play', 'plays')} ${cardName(d.card)}`);
            ms = d.player === 0 ? 350 : 850;
            break;
          case 'mover':
            pushLog(`${who(d.player)} ${verb(d.player, 'grab', 'grabs')} the Mover!`);
            ms = 700;
            break;
          case 'no-mover':
            if (d.player === 0) { pushLog('No Mover, so no Power this turn'); ms = 450; }
            break;
          case 'power-use':
            pushLog(`${who(d.player)} ${verb(d.player, 'use', 'uses')} ${d.power.name}`);
            ms = 900;
            break;
          case 'guess': {
            const g = d.type === 'color' ? COLOR_LABEL[d.guess] : d.guess;
            pushLog(`${who(d.player)} ${verb(d.player, 'guess', 'guesses')} ${g}. Flipped ${cardName(d.card)}: ${d.match ? 'a match, played!' : 'no match'}`);
            if (d.match) U.fresh.add(d.card.id);
            ms = 1400;
            break;
          }
          case 'swap':
            U.fresh.add(d.mine.id); U.fresh.add(d.theirs.id);
            pushLog(`${who(d.player)} ${verb(d.player, 'swap', 'swaps')} ${cardName(d.mine)} for ${who(d.other)}${d.other === 0 ? 'r' : '’s'} ${cardName(d.theirs)}`);
            ms = 1200;
            break;
          case 'pass': {
            const got = d.moves.find(m => m.to === 0);
            pushLog('Everyone passed a card to the previous player' + (got ? `. You got ${cardName(got.card)}` : ''));
            if (got) U.fresh.add(got.card.id);
            ms = 1300;
            break;
          }
          case 'discard-pick':
            U.fresh.add(d.card.id);
            pushLog(`${who(d.player)} ${verb(d.player, 'play', 'plays')} ${cardName(d.card)} from the discard pile`);
            ms = 900;
            break;
          case 'score': {
            const k = d.kind === 'run' ? 'RUN!' : d.kind === 'set' ? 'SET!' : 'POWER!';
            pushLog(`${who(d.player)} scored ${d.kind === 'power' ? 'with a Power' : 'a ' + d.kind}: ${d.cards.map(cardName).join(', ')}`);
            showBanner(d.player === 0 ? k : `${P(d.player).name}: ${k}`, `${who(d.player)} ${verb(d.player, 'get', 'gets')} ${d.power.name}`);
            if (d.player === 0 && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) { /* ignore */ } }
            ms = 1900;
            break;
          }
          case 'discard':
            pushLog(`${who(d.player)} ${verb(d.player, 'discard', 'discards')} ${d.cards.map(cardName).join(', ')}`);
            ms = d.player === 0 ? 300 : 700;
            break;
          case 'reshuffle':
            pushLog('The deck ran out: discard pile shuffled into a new deck');
            ms = 900;
            break;
          case 'win':
            showBanner(d.player === 0 ? 'YOU WIN!' : `${P(d.player).name} WINS!`, 'Three Powers scored');
            break;
          default: break;
        }
        render();
        if (ms) await sleep(ms * scale());
        if (U.token !== token) throw ABORT;
      },
    };
  }

  async function startGame() {
    const token = ++U.token;
    closeSheet();
    const st = U.settings;
    const players = [{ name: 'You', human: true }];
    for (let i = 0; i < st.players - 1; i++) players.push({ name: BOT_NAMES[i], level: st.levels[i] });
    U.state = SW.newGame({ players, first: st.first === 'you' ? 0 : 'random' });
    U.agents = players.map(p => (p.human ? human : AI.createAgent(p.level, Math.random)));
    U.screen = 'game'; U.ask = null; U.hint = null; U.hintChosen = null; U.log = []; U.fresh = new Set();
    const first = U.state.players[U.state.current];
    pushLog(`${first.human ? 'You go' : first.name + ' goes'} first. Tip: tap or hold any Power to see what it does.`);
    U.status = '';
    render();
    const hooks = makeHooks(token);
    try {
      await sleep(600 * scale());
      while (U.state.winner == null && U.token === token) {
        await SW.runTurn(U.state, U.agents, hooks);
        render();
      }
      if (U.token === token) await gameOver(token);
    } catch (e) {
      if (e !== ABORT) { console.error(e); U.status = 'Something went wrong. Open the menu to start a new game.'; render(); }
    }
  }

  async function gameOver(token) {
    const s = U.state, w = s.players[s.winner];
    U.status = ''; render();
    await sleep(900);
    if (U.token !== token) return;
    const you = w.human;
    const r = await openSheet(`<div class="win"><div class="trophy">${you ? '🏆' : '🤖'}</div>` +
      `<h2>${you ? 'You win!' : w.name + ' wins!'}</h2>` +
      `<p class="sub">${you ? 'Three Powers scored. Nicely done!' : 'They scored three Powers first. Rematch?'}</p>` +
      `<div class="row"><button class="skipbtn" data-res="menu">Menu</button><button class="pbtn primary" data-res="again" style="flex:1">Play again</button></div>` +
      `<button class="linkbtn" data-res="close" style="margin-top:8px">Look at the table</button></div>`, { modal: true, dismiss: true });
    if (r === 'again') startGame();
    else if (r === 'menu') toSetup();
  }

  function toSetup() {
    U.token++; closeSheet(); U.ask = null; U.screen = 'setup'; U.state = null; U.status = '';
    render();
  }

  /* ---------- events ---------- */
  function handleAct(act) {
    if (act === 'start' || act === 'again') return startGame();
    if (act === 'menu-setup') return toSetup();
    if (act === 'rules') return void openSheet(rulesHTML(), { dismiss: true });
    if (act === 'menu') {
      return void openSheet(`<h2>Menu</h2><div class="plist" style="margin-top:10px">` +
        `<button class="skipbtn" style="margin:0" data-res="close">Back to game</button>` +
        `<button class="skipbtn" style="margin:0" data-res="rules">How to play</button>` +
        `<button class="skipbtn" style="margin:0" data-res="restart">Restart this game</button>` +
        `<button class="skipbtn" style="margin:0" data-res="quit">Quit to setup</button></div>`, { dismiss: true })
        .then(r => { if (r === 'rules') handleAct('rules'); else if (r === 'restart') startGame(); else if (r === 'quit') toSetup(); });
    }
    if (act === 'discard') {
      const s = U.state; if (!s) return;
      return void openSheet(`<h2>Discard pile (${s.discard.length})</h2><p class="sub">Most recent last.</p><div class="cardrow">` +
        (s.discard.length ? s.discard.map(c => staticCard(c, '')).join('') : '<p class="sub">Empty</p>') + `</div><button class="skipbtn" data-res="close">Close</button>`, { dismiss: true });
    }
    if (act.indexOf('power:') === 0) {
      const p = SW.POWER_BY_ID[act.slice(6)];
      return void openSheet(`<div style="display:flex;justify-content:center">${powerHTML(p, { size: 'big' })}</div><p class="sub" style="text-align:center;margin-top:10px">${p.text}</p><button class="skipbtn" data-res="close">Close</button>`, { dismiss: true, modal: true });
    }
  }

  function onAppClick(e) {
    if (dragJustEnded) return;
    // A decision sheet is waiting (the player is peeking at the table): don't open other sheets over it.
    // Powers can still be explained with the little tooltip.
    if (U.sheetRes) {
      const pel = e.target.closest(POWER_SEL);
      if (pel) { showTip(powerIdOf(pel), pel.getBoundingClientRect()); hideTip(2500); }
      return;
    }
    const set = e.target.closest('[data-set]');
    if (set) {
      const [k, a, b] = set.dataset.set.split(':');
      const st = U.settings;
      if (k === 'players') st.players = +a;
      else if (k === 'level') st.levels[+a] = b;
      else if (k === 'first') st.first = a;
      else if (k === 'speed') st.speed = a;
      saveSettings(); render(); return;
    }
    const btn = e.target.closest('[data-btn]');
    if (btn && U.ask) {
      if (btn.disabled) return;
      if (btn.dataset.btn === 'hint') {
        const sug = AI.suggest(U.state, 0);
        if (sug) {
          U.hint = sug.cardId; U.ask.chosen = sug.cardId;
          U.ask.sub = `Hint: ${cardName(SW.CARD_BY_ID[sug.cardId])} ${sug.why}.`;
          render();
        }
        return;
      }
      resolveAsk({ button: btn.dataset.btn, id: U.ask.chosen });
      return;
    }
    if (lpFired) { lpFired = false; return; }
    const act = e.target.closest('[data-act]');
    if (act) { handleAct(act.dataset.act); return; }
    const pw = e.target.closest('[data-power]');
    if (pw) { handleAct('power:' + pw.dataset.power); return; }
    const card = e.target.closest('[data-card]');
    if (card && U.ask && U.ask.ids && U.ask.ids.indexOf(card.dataset.card) >= 0) {
      if (U.ask.auto) { resolveAsk({ id: card.dataset.card }); return; }
      U.ask.chosen = card.dataset.card; U.hint = null; render();
    }
  }

  /* ---------- Power explanations: long-press (touch) or hover (mouse) ---------- */
  const POWER_SEL = '[data-power],[data-act^="power:"]';
  let lpTimer = null, lpFired = false, lpStart = null, tipTimer = null;
  const powerIdOf = el => el.dataset.power || (el.dataset.act || '').slice(6);
  function showTip(id, rect) {
    const p = SW.POWER_BY_ID[id]; if (!p) return;
    let tip = $('#tip');
    if (!tip) { tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip); }
    tip.innerHTML = `<b>${p.name}</b>${p.text}`;
    tip.style.display = 'block';
    const w = Math.min(240, window.innerWidth - 16);
    tip.style.width = w + 'px';
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2));
    tip.style.left = left + 'px';
    const h = tip.offsetHeight;
    tip.style.top = (rect.top - h - 10 < 8 ? rect.bottom + 10 : rect.top - h - 10) + 'px';
    clearTimeout(tipTimer);
  }
  function hideTip(delay) {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => { const t = $('#tip'); if (t) t.style.display = 'none'; }, delay || 0);
  }
  function wirePowerHelp(app) {
    app.addEventListener('pointerdown', e => {
      const t = e.target.closest(POWER_SEL);
      clearTimeout(lpTimer);
      if (!t || e.pointerType === 'mouse') return;
      const id = powerIdOf(t), rect = t.getBoundingClientRect();
      lpStart = { x: e.clientX, y: e.clientY };
      lpFired = false;
      lpTimer = setTimeout(() => { lpFired = true; showTip(id, rect); if (navigator.vibrate) { try { navigator.vibrate(15); } catch (x) { /* ignore */ } } }, 420);
    });
    app.addEventListener('pointermove', e => {
      if (lpStart && Math.hypot(e.clientX - lpStart.x, e.clientY - lpStart.y) > 10) { clearTimeout(lpTimer); lpStart = null; }
    });
    ['pointerup', 'pointercancel'].forEach(ev => app.addEventListener(ev, () => {
      clearTimeout(lpTimer); lpStart = null;
      if (lpFired) hideTip(1600);
      setTimeout(() => { lpFired = false; }, 350);
    }));
    app.addEventListener('pointerover', e => {
      if (e.pointerType !== 'mouse') return;
      const t = e.target.closest(POWER_SEL);
      if (t) showTip(powerIdOf(t), t.getBoundingClientRect());
    });
    app.addEventListener('pointerout', e => {
      if (e.pointerType === 'mouse' && e.target.closest(POWER_SEL)) hideTip(0);
    });
    app.addEventListener('contextmenu', e => { if (e.target.closest(POWER_SEL)) e.preventDefault(); });
  }

  /* ---------- drag a card from your hand into your play area ---------- */
  let drag = null, dragJustEnded = false;
  const dropBox = () => {
    const me = $('.me'); if (!me) return null;
    const r = me.getBoundingClientRect();
    return { l: r.left - 10, r: r.right + 10, t: r.top - 10, b: r.bottom + 10 };
  };
  const overDrop = (x, y) => { const b = dropBox(); return !!b && x >= b.l && x <= b.r && y >= b.t && y <= b.b; };
  function wireDrag(app) {
    app.addEventListener('pointerdown', e => {
      const a = U.ask;
      if (!a || !a.dragPlay || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const card = e.target.closest('.hand .card[data-card]');
      if (!card || a.ids.indexOf(card.dataset.card) < 0) return;
      const r = card.getBoundingClientRect();
      drag = { id: card.dataset.card, el: card, sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, rect: r, ghost: null, started: false };
    });
    window.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
        drag.started = true;
        const g = drag.el.cloneNode(true);
        ['selectable', 'picked', 'hinted', 'fresh', 'draggable'].forEach(c => g.classList.remove(c));
        g.classList.add('ghost');
        g.style.width = drag.rect.width + 'px';
        g.style.setProperty('--cw', drag.rect.width + 'px');
        document.body.appendChild(g);
        drag.ghost = g;
        drag.el.classList.add('dragging');
        const me = $('.me'); if (me) me.classList.add('drop-ready');
      }
      drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
      drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
      const me = $('.me'); if (me) me.classList.toggle('drop-over', overDrop(e.clientX, e.clientY));
    }, { passive: true });
    const end = e => {
      if (!drag) return;
      const d = drag; drag = null;
      const me = $('.me'); if (me) me.classList.remove('drop-ready', 'drop-over');
      if (!d.started) return; // a plain tap: the click handler selects the card
      dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 350);
      const ok = e.type === 'pointerup' && overDrop(e.clientX, e.clientY) && U.ask && U.ask.dragPlay && U.ask.ids.indexOf(d.id) >= 0;
      if (ok) { d.ghost.remove(); resolveAsk({ button: 'ok', id: d.id }); return; }
      const g = d.ghost; // not dropped on the play area: slide back to the hand
      g.classList.add('returning');
      g.style.left = d.rect.left + 'px'; g.style.top = d.rect.top + 'px'; g.style.transform = 'none';
      setTimeout(() => { g.remove(); d.el.classList.remove('dragging'); }, 190);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function setPeek(on) {
    const scrim = $('#overlay .scrim'); if (!scrim) return;
    scrim.classList.toggle('peeking', on);
    let bar = $('#overlay .peekbar');
    if (on && !bar) {
      bar = document.createElement('div'); bar.className = 'peekbar';
      bar.innerHTML = '<span>Looking at the table</span><button class="pbtn primary" data-unpeek>Back to decision</button>';
      $('#overlay').appendChild(bar);
    } else if (!on && bar) bar.remove();
  }

  function onOverlayClick(e) {
    if (e.target.closest('[data-peek]')) { setPeek(true); return; }
    if (e.target.closest('[data-unpeek]')) { setPeek(false); return; }
    const t = e.target.closest('[data-res]');
    if (t && !t.disabled) { closeSheet(t.dataset.res); return; }
    if (e.target.matches('[data-scrim]') && U.sheetDismiss) closeSheet('close');
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('#app').addEventListener('click', onAppClick);
    wirePowerHelp($('#app'));
    wireDrag($('#app'));
    $('#overlay').addEventListener('click', onOverlayClick);
    render();
  });

  window.SWUI = { U, render, startGame, human }; // exposed for testing
})();
