/* Something Wild! - rules engine (Spider-Man, Baby Groot and Boba Fett editions).
   Pure logic, no DOM. Works in browsers (global SW) and Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RULES = { HAND: 3, MAX_TABLEAU: 5, WIN: 3 };
  const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
  const COLOR_LABEL = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', purple: 'Purple' };

  /* ---- Editions & Power cards ---------------------------------------------
     Every edition (Spider-Man, Baby Groot, Boba Fett...) uses the same 45 character cards;
     only the ten Power cards and the little figure (the "Mover") change.
     Each edition has 10 Powers, 2 per colour. The rulebooks list the 10 effects but the colour of
     each Power card is only visible on the physical cards, so wherever the rulebook doesn't show it
     the colour below is an ASSUMPTION - edit the `color` fields to match your cards.

     Power kinds:
       wild        wild:{by:'color'|'num', value, as:'num'|'color'}  cards in play count as any number / any colour
       score       mode:{type:'color3'|'nums'|'sum'|'colors', ...}    an extra way to score three cards
       guess       guess:'color'|'number'                             guess the top card of the deck, play it if right
       strip       by:'color'|'number'                                flip the top card; everyone else discards a match
       swap                                                           swap one of your cards with a same-colour card
       discardplay cond:{num}|{color}                                 play a card from the discard pile
       extra       cond:{num}                                         draw and play an extra card
       pass        pick:'any'|'high'|'low'                            everyone passes a card to the previous player */
  const P = (id, color, name, kind, extra, text) => Object.assign({ id, color, name, kind, text }, extra);
  const SPIDERMAN_POWERS = [
    P('blue3', 'blue', 'Blue Trio', 'score', { mode: { type: 'color3', color: 'blue' } }, 'With three BLUE cards in play, you may score with them.'),
    P('red3', 'red', 'Red Trio', 'score', { mode: { type: 'color3', color: 'red' } }, 'With three RED cards in play, you may score with them.'),
    P('n268', 'green', '2-6-8', 'score', { mode: { type: 'nums', nums: [2, 6, 8] } }, 'With a 2, a 6 and an 8 in play, you may score with them.'),
    P('redwild', 'red', 'Red Is Wild', 'wild', { wild: { by: 'color', value: 'red', as: 'num' } }, 'Treat RED cards in play as any NUMBER.'),
    P('threewild', 'blue', 'Threes Wild', 'wild', { wild: { by: 'num', value: 3, as: 'num' } }, 'Treat 3s in play as any NUMBER.'),
    P('guesscolor', 'purple', 'Guess a Color', 'guess', { guess: 'color' }, 'Guess a COLOR. Discard the top card of the deck. If it matches, play the card.'),
    P('guessnum', 'purple', 'Guess a Number', 'guess', { guess: 'number' }, 'Guess a NUMBER. Discard the top card of the deck. If it matches, play the card.'),
    P('swap', 'yellow', 'Swap', 'swap', {}, 'Swap a card in play with another player’s card of the same COLOR.'),
    P('seven', 'yellow', 'Lucky Sevens', 'discardplay', { cond: { num: 7 } }, 'If you have any 7s in play, play a card from the discard pile.'),
    P('pass', 'green', 'Pass It On', 'pass', { pick: 'any' }, 'All players pass a card from their hand to the previous player.'),
  ];
  const GROOT_POWERS = [
    P('g_sweepcolor', 'red', 'Color Sweep', 'strip', { by: 'color' }, 'Discard the top card of the deck. All other players discard a card in play that matches that card’s COLOR, if possible.'),
    P('g_sweepnum', 'green', 'Number Sweep', 'strip', { by: 'number' }, 'Discard the top card of the deck. All other players discard a card in play that matches that card’s NUMBER, if possible.'),
    P('g_ninewild', 'yellow', 'Nines Are Wild', 'wild', { wild: { by: 'num', value: 9, as: 'color' } }, 'Treat 9s in play as any COLOR.'),
    P('g_greenwild', 'green', 'Green Is Wild', 'wild', { wild: { by: 'color', value: 'green', as: 'num' } }, 'Treat GREEN cards in play as any NUMBER.'),
    P('g_purple', 'purple', 'Second Chance', 'discardplay', { cond: { color: 'purple' } }, 'If you have any PURPLE cards in play, play a card from the discard pile.'),
    P('g_twos', 'blue', 'Double Time', 'extra', { cond: { num: 2 } }, 'If you have any 2s in play, draw and play an extra card.'),
    P('g_red3', 'red', 'Red Trio', 'score', { mode: { type: 'color3', color: 'red' } }, 'With three RED cards in play, you may score with them.'),
    P('g_358', 'blue', '3-5-8', 'score', { mode: { type: 'nums', nums: [3, 5, 8] } }, 'With a 3, a 5 and an 8 in play, you may score with them.'),
    P('g_sum12', 'yellow', 'Twelve Exactly', 'score', { mode: { type: 'sum', total: 12 } }, 'With three cards in play that total exactly 12, you may score with them.'),
    P('g_pass', 'purple', 'Pass It On', 'pass', { pick: 'any' }, 'All players pass a card from their hand to the previous player.'),
  ];
  const BOBA_POWERS = [
    P('b_bluewild', 'blue', 'Blue Is Wild', 'wild', { wild: { by: 'color', value: 'blue', as: 'num' } }, 'Treat BLUE cards in play as any NUMBER.'),
    P('b_greenwild', 'green', 'Green Chameleon', 'wild', { wild: { by: 'color', value: 'green', as: 'color' } }, 'Treat GREEN cards in play as any COLOR.'),
    P('b_oneswild', 'yellow', 'Ones Are Wild', 'wild', { wild: { by: 'num', value: 1, as: 'num' } }, 'Treat 1s in play as any NUMBER.'),
    P('b_swap', 'purple', 'Swap', 'swap', {}, 'Swap one of your cards in play with another player’s card of the same COLOR.'),
    P('b_sixes', 'blue', 'Sixes Bonus', 'extra', { cond: { num: 6 } }, 'If you have any 6s in play, draw and play an extra card.'),
    P('b_sum16', 'green', 'Sweet Sixteen', 'score', { mode: { type: 'sum', total: 16 } }, 'With three cards in play that total exactly 16, you may score with them.'),
    P('b_yellow3', 'yellow', 'Yellow Trio', 'score', { mode: { type: 'color3', color: 'yellow' } }, 'With three YELLOW cards in play, you may score with them.'),
    P('b_bgr', 'red', 'Tri-Color', 'score', { mode: { type: 'colors', colors: ['blue', 'green', 'red'] } }, 'With a BLUE, a GREEN and a RED card in play, you may score with them.'),
    P('b_passhigh', 'red', 'Pass the High', 'pass', { pick: 'high' }, 'All players pass the highest-numbered card from their hand to the previous player.'),
    P('b_passlow', 'purple', 'Pass the Low', 'pass', { pick: 'low' }, 'All players pass the lowest-numbered card from their hand to the previous player.'),
  ];
  const EDITIONS = {
    spiderman: { id: 'spiderman', name: 'Spider-Man', blurb: 'Swing for sets and runs. Guess, swap and pass.', moverWord: 'Mover', powers: SPIDERMAN_POWERS },
    groot: { id: 'groot', name: 'Baby Groot', blurb: 'Sweep rivals’ cards and bend colors.', moverWord: 'Mover', powers: GROOT_POWERS },
    boba: { id: 'boba', name: 'Boba Fett', blurb: 'Wild colors, swaps and sneaky passes.', moverWord: 'Figure', powers: BOBA_POWERS },
  };
  const EDITION_LIST = ['spiderman', 'groot', 'boba'].map(k => EDITIONS[k]);
  const POWERS = SPIDERMAN_POWERS; // default edition (kept for older callers)
  const ALL_POWERS = EDITION_LIST.reduce((a, e) => a.concat(e.powers), []);
  const POWER_BY_ID = {};
  ALL_POWERS.forEach(p => (POWER_BY_ID[p.id] = p));
  const editionOf = state => EDITIONS[(state && state.edition) || 'spiderman'];

  /* ---- Cards ------------------------------------------------------------ */
  const ALL_CARDS = [];
  COLORS.forEach(color => { for (let n = 1; n <= 9; n++) ALL_CARDS.push({ id: color + n, color, num: n }); });
  const CARD_BY_ID = {};
  ALL_CARDS.forEach(c => (CARD_BY_ID[c.id] = c));
  const cardName = c => COLOR_LABEL[c.color] + ' ' + c.num;
  const hasMoverSymbol = c => c.num === 1; // the five 1s carry the "take a mover" symbol

  /* ---- Utilities -------------------------------------------------------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  function combos3(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++)
        for (let k = j + 1; k < arr.length; k++) out.push([arr[i], arr[j], arr[k]]);
    return out;
  }
  function removeById(arr, id) {
    const i = arr.findIndex(c => c.id === id);
    if (i < 0) throw new Error('card not found: ' + id);
    return arr.splice(i, 1)[0];
  }

  /* ---- Scoring logic ----------------------------------------------------- */
  const NEVER = () => false;
  /** Which cards in play does this Power make wild? { num: fn, col: fn } */
  function wildFns(power) {
    const out = { num: NEVER, col: NEVER };
    if (power && power.kind === 'wild') {
      const w = power.wild;
      const f = w.by === 'color' ? c => c.color === w.value : c => c.num === w.value;
      out[w.as === 'color' ? 'col' : 'num'] = f;
    }
    return out;
  }
  function isSet(cards, wn) {
    wn = wn || NEVER;
    const nums = new Set();
    for (const c of cards) if (!wn(c)) nums.add(c.num);
    return nums.size <= 1;
  }
  function isRun(cards, wn, wc) {
    wn = wn || NEVER; wc = wc || NEVER;
    const cols = new Set(cards.filter(c => !wc(c)).map(c => c.color));
    if (cols.size > 1) return false;
    const fixed = cards.filter(c => !wn(c)).map(c => c.num);
    if (new Set(fixed).size !== fixed.length) return false;
    if (fixed.length === 0) return true;
    const mn = Math.min(...fixed), mx = Math.max(...fixed);
    if (mx - mn > 2) return false;
    return Math.max(1, mx - 2) <= Math.min(7, mn);
  }
  function powerModeMatch(cards, power) {
    if (!power || power.kind !== 'score') return false;
    const m = power.mode;
    switch (m.type) {
      case 'color3': return cards.every(c => c.color === m.color);
      case 'nums': {
        const a = cards.map(c => c.num).sort((x, y) => x - y), b = m.nums.slice().sort((x, y) => x - y);
        return a.length === b.length && a.every((v, i) => v === b[i]);
      }
      case 'sum': return cards.reduce((t, c) => t + c.num, 0) === m.total;
      case 'colors': {
        const a = cards.map(c => c.color).sort(), b = m.colors.slice().sort();
        return a.length === b.length && a.every((v, i) => v === b[i]);
      }
      default: return false;
    }
  }
  /** What kind of score is this triple? returns 'set' | 'run' | 'power' | null */
  function tripleKind(cards, power) {
    const w = wildFns(power);
    if (isSet(cards, w.num)) return 'set';
    if (isRun(cards, w.num, w.col)) return 'run';
    if (powerModeMatch(cards, power)) return 'power';
    return null;
  }
  const isScoringTriple = (cards, power) => tripleKind(cards, power) !== null;
  /** All scoring triples in a tableau given the Power used this turn (or null). */
  function findTriples(tableau, power) {
    return combos3(tableau).filter(t => isScoringTriple(t, power));
  }
  /** Does the condition {num} / {color} hold for any card in play? */
  const condMet = (cond, tab) => tab.some(c => (cond.num != null ? c.num === cond.num : c.color === cond.color));
  const condText = cond => (cond.num != null ? `a ${cond.num}` : `a ${COLOR_LABEL[cond.color].toLowerCase()} card`);

  /* ---- Power feasibility ------------------------------------------------- */
  function swapPairs(state, pi) {
    const me = state.players[pi];
    const pairs = [];
    me.tableau.forEach(mine => {
      state.players.forEach((o, oi) => {
        if (oi === pi) return;
        o.tableau.forEach(theirs => {
          if (theirs.color === mine.color) pairs.push({ mine: mine.id, theirs: theirs.id, other: oi });
        });
      });
    });
    return pairs;
  }
  function powerFeasibility(state, pi, power) {
    const me = state.players[pi];
    switch (power.kind) {
      case 'guess':
      case 'strip':
        return state.deck.length + state.discard.length > 0 ? { ok: true } : { ok: false, reason: 'No cards left to reveal' };
      case 'swap':
        return swapPairs(state, pi).length ? { ok: true } : { ok: false, reason: 'No matching colors to swap' };
      case 'discardplay':
        if (!condMet(power.cond, me.tableau)) return { ok: false, reason: `You have no ${condText(power.cond).replace(/^a /, '')} in play` };
        if (!state.discard.length) return { ok: false, reason: 'Discard pile is empty' };
        return { ok: true };
      case 'extra':
        if (!condMet(power.cond, me.tableau)) return { ok: false, reason: `You have no ${condText(power.cond).replace(/^a /, '')} in play` };
        return state.deck.length + state.discard.length > 0 ? { ok: true } : { ok: false, reason: 'No cards left to draw' };
      case 'pass':
        return state.players.every(p => p.hand.length > 0) ? { ok: true } : { ok: false, reason: 'Nobody has cards to pass' };
      default:
        return { ok: true };
    }
  }
  /** Powers the player may use right now (needs the mover). */
  function usablePowers(state, pi) {
    if (state.mover !== pi) return [];
    const me = state.players[pi];
    const list = [];
    me.powers.forEach(p => list.push({ power: p, source: 'own' }));
    if (state.center) list.push({ power: state.center, source: 'center' });
    return list.map(o => {
      const f = powerFeasibility(state, pi, o.power);
      let scores = false;
      if (o.power.kind === 'wild' || o.power.kind === 'score')
        scores = findTriples(me.tableau, o.power).length > 0;
      return { power: o.power, source: o.source, feasible: f.ok, reason: f.reason, scores };
    });
  }

  /* ---- Game setup --------------------------------------------------------- */
  function newGame(opts) {
    const seed = opts.seed != null ? opts.seed : (Math.random() * 4294967296) >>> 0;
    const rng = mulberry32(seed);
    const players = opts.players.map((p, i) => ({
      id: i, name: p.name, human: !!p.human, level: p.level || null,
      hand: [], tableau: [], powers: [],
    }));
    const deck = shuffle(ALL_CARDS.slice(), rng);
    for (let r = 0; r < RULES.HAND; r++) players.forEach(p => p.hand.push(deck.pop()));
    const edition = EDITIONS[opts.edition || 'spiderman'];
    if (!edition) throw new Error('unknown edition ' + opts.edition);
    const powerPile = shuffle(edition.powers.slice(), rng);
    const center = powerPile.pop();
    const first = opts.first == null || opts.first === 'random' ? Math.floor(rng() * players.length) : opts.first;
    return { players, deck, discard: [], powerPile, center, mover: null, current: first,
      turnNo: 0, winner: null, rng, turn: null, seed, edition: edition.id };
  }

  async function emit(hooks, type, data) {
    if (hooks && hooks.event) await hooks.event(type, data || {});
  }
  async function drawCard(state, hooks) {
    if (state.deck.length === 0 && state.discard.length > 0) {
      state.deck = shuffle(state.discard.splice(0), state.rng);
      await emit(hooks, 'reshuffle', {});
    }
    return state.deck.pop() || null;
  }

  /* ---- Power effects -------------------------------------------------------- */
  async function applyPower(state, pi, power, agents, hooks) {
    const p = state.players[pi];
    const ag = agents[pi];
    state.turn.power = power;
    await emit(hooks, 'power-use', { player: pi, power });
    switch (power.kind) {
      case 'wild':
      case 'score':
        break; // takes effect at the scoring step
      case 'guess': {
        const guess = power.guess === 'color' ? await ag.chooseColor(state, pi) : await ag.chooseNumber(state, pi);
        const c = await drawCard(state, hooks);
        if (!c) break;
        const match = power.guess === 'color' ? c.color === guess : c.num === guess;
        if (match) p.tableau.push(c); else state.discard.push(c);
        await emit(hooks, 'guess', { player: pi, type: power.guess, guess, card: c, match });
        break;
      }
      case 'swap': {
        const pairs = swapPairs(state, pi);
        let ch = await ag.chooseSwap(state, pi, pairs);
        if (!ch || !pairs.some(x => x.mine === ch.mine && x.theirs === ch.theirs)) ch = pairs[0];
        const other = state.players[ch.other !== undefined ? ch.other : pairs.find(x => x.theirs === ch.theirs).other];
        const mi = p.tableau.findIndex(c => c.id === ch.mine);
        const oi = other.tableau.findIndex(c => c.id === ch.theirs);
        const mine = p.tableau[mi], theirs = other.tableau[oi];
        p.tableau[mi] = theirs; other.tableau[oi] = mine;
        await emit(hooks, 'swap', { player: pi, other: other.id, mine, theirs });
        break;
      }
      case 'pass': {
        const n = state.players.length;
        const given = [];
        for (let i = 0; i < n; i++) {
          const hand = state.players[i].hand;
          let allowed = hand;
          if (power.pick === 'high' || power.pick === 'low') {
            const t = (power.pick === 'high' ? Math.max : Math.min)(...hand.map(c => c.num));
            allowed = hand.filter(c => c.num === t);
          }
          let id = allowed.length === 1 ? allowed[0].id : await agents[i].choosePassCard(state, i, allowed.slice());
          if (!allowed.some(c => c.id === id)) id = allowed[0].id;
          given[i] = id;
        }
        const cards = given.map((id, i) => removeById(state.players[i].hand, id));
        const moves = [];
        for (let i = 0; i < n; i++) {
          const to = (i - 1 + n) % n;
          state.players[to].hand.push(cards[i]);
          moves.push({ from: i, to, card: cards[i] });
        }
        await emit(hooks, 'pass', { player: pi, moves, pick: power.pick });
        break;
      }
      case 'discardplay': {
        const pile = state.discard.slice();
        let id = await ag.chooseDiscardPick(state, pi, pile);
        if (!pile.some(c => c.id === id)) id = pile[pile.length - 1].id;
        const c = removeById(state.discard, id);
        p.tableau.push(c);
        await emit(hooks, 'discard-pick', { player: pi, card: c });
        break;
      }
      case 'strip': {
        // flip the top card; every other player (in turn order) discards a card in play that matches it
        const c = await drawCard(state, hooks);
        if (!c) break;
        state.discard.push(c);
        await emit(hooks, 'strip-reveal', { player: pi, by: power.by, card: c });
        const n = state.players.length;
        const hits = [];
        for (let k = 1; k < n; k++) {
          const oi = (pi + k) % n, o = state.players[oi];
          const match = o.tableau.filter(x => (power.by === 'color' ? x.color === c.color : x.num === c.num));
          if (!match.length) continue;
          const ag2 = agents[oi];
          let id = match.length === 1 || !ag2.chooseStrip ? match[0].id
            : await ag2.chooseStrip(state, oi, match.map(x => x.id), { by: power.by, card: c, player: pi });
          if (!match.some(x => x.id === id)) id = match[0].id;
          hits.push({ player: oi, card: removeById(o.tableau, id) });
        }
        hits.forEach(h => state.discard.push(h.card));
        await emit(hooks, 'strip', { player: pi, by: power.by, card: c, hits });
        break;
      }
      case 'extra': {
        const c = await drawCard(state, hooks);
        if (c) p.hand.push(c);
        await emit(hooks, 'draw', { player: pi, card: c, extra: true });
        if (!p.hand.length) break;
        let id = await (ag.chooseExtraPlay || ag.choosePlay).call(ag, state, pi);
        if (!p.hand.some(x => x.id === id)) id = p.hand[0].id;
        const played = removeById(p.hand, id);
        p.tableau.push(played);
        await emit(hooks, 'play', { player: pi, card: played, extra: true });
        break;
      }
    }
  }

  /* ---- A full turn ------------------------------------------------------------- */
  async function runTurn(state, agents, hooks) {
    const pi = state.current;
    const p = state.players[pi];
    const ag = agents[pi];
    state.turn = { power: null };
    await emit(hooks, 'turn-start', { player: pi });

    // 1. Draw
    const drawn = await drawCard(state, hooks);
    if (drawn) p.hand.push(drawn);
    await emit(hooks, 'draw', { player: pi, card: drawn });

    // 2. Play
    if (p.hand.length === 0) throw new Error('player has no cards');
    let id = await ag.choosePlay(state, pi);
    if (!p.hand.some(c => c.id === id)) id = p.hand[0].id;
    const played = removeById(p.hand, id);
    p.tableau.push(played);
    await emit(hooks, 'play', { player: pi, card: played });

    // 3. Take the mover
    const matches = state.center && played.color === state.center.color;
    if ((matches || hasMoverSymbol(played)) && state.mover !== pi) {
      const from = state.mover;
      state.mover = pi;
      await emit(hooks, 'mover', { player: pi, from, reason: hasMoverSymbol(played) && !matches ? 'symbol' : 'color' });
    }

    // 4. Use a Power (needs the mover)
    if (state.mover === pi) {
      const opts = usablePowers(state, pi);
      if (opts.some(o => o.feasible)) {
        const choice = await ag.choosePower(state, pi, opts);
        if (choice) {
          const opt = opts.find(o => o.power.id === choice.id && o.feasible);
          if (opt) await applyPower(state, pi, opt.power, agents, hooks);
        }
      }
    } else {
      await emit(hooks, 'no-mover', { player: pi });
    }

    // 5. Score
    const triples = findTriples(p.tableau, state.turn.power);
    if (triples.length) {
      let ti = triples.length === 1 ? 0 : await ag.chooseTriple(state, pi, triples);
      if (!(ti >= 0 && ti < triples.length)) ti = 0;
      const triple = triples[ti];
      const kind = tripleKind(triple, state.turn.power);
      triple.forEach(c => state.discard.push(removeById(p.tableau, c.id)));
      const gained = state.center;
      p.powers.push(gained);
      state.center = state.powerPile.pop() || null;
      await emit(hooks, 'score', { player: pi, cards: triple, kind, power: gained, next: state.center });
      if (p.powers.length >= RULES.WIN) {
        state.winner = pi;
        await emit(hooks, 'win', { player: pi });
        return;
      }
    }

    // 6. Discard down to five
    if (p.tableau.length > RULES.MAX_TABLEAU) {
      const n = p.tableau.length - RULES.MAX_TABLEAU;
      let ids = await ag.chooseDiscards(state, pi, n);
      ids = (ids || []).filter((x, i, a) => a.indexOf(x) === i && p.tableau.some(c => c.id === x)).slice(0, n);
      while (ids.length < n) {
        const extra = p.tableau.find(c => !ids.includes(c.id));
        ids.push(extra.id);
      }
      const gone = ids.map(x => removeById(p.tableau, x));
      gone.forEach(c => state.discard.push(c));
      await emit(hooks, 'discard', { player: pi, cards: gone });
    }

    state.turn = null;
    state.current = (state.current + 1) % state.players.length;
    state.turnNo++;
  }

  async function playGame(state, agents, hooks, maxTurns) {
    const cap = maxTurns || 600;
    while (state.winner == null && state.turnNo < cap) await runTurn(state, agents, hooks);
    return state;
  }

  return {
    RULES, COLORS, COLOR_LABEL, POWERS, ALL_POWERS, EDITIONS, EDITION_LIST, editionOf, POWER_BY_ID, ALL_CARDS, CARD_BY_ID,
    cardName, hasMoverSymbol, mulberry32, shuffle, combos3, removeById,
    isSet, isRun, wildFns, condMet, condText, powerModeMatch, tripleKind, isScoringTriple, findTriples,
    swapPairs, powerFeasibility, usablePowers,
    newGame, drawCard, applyPower, runTurn, playGame,
  };
});
