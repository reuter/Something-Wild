/* Something Wild! - rules engine (Spider-Man edition ruleset).
   Pure logic, no DOM. Works in browsers (global SW) and Node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const RULES = { HAND: 3, MAX_TABLEAU: 5, WIN: 3 };
  const COLORS = ['red', 'blue', 'green', 'yellow', 'purple'];
  const COLOR_LABEL = { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow', purple: 'Purple' };

  /* ---- Power cards -------------------------------------------------------
     10 powers, 2 per colour. The rulebook lists the 10 effects but the colour
     of each Power card is only visible on the physical cards, so the colour
     assignment below is an ASSUMPTION - edit the `color` fields to match. */
  const POWERS = [
    { id: 'blue3',      color: 'blue',   kind: 'score', mode: 'blue',
      name: 'Blue Trio',     text: 'With three BLUE cards in play, you may score with them.' },
    { id: 'red3',       color: 'red',    kind: 'score', mode: 'red',
      name: 'Red Trio',      text: 'With three RED cards in play, you may score with them.' },
    { id: 'n268',       color: 'green',  kind: 'score', mode: '268',
      name: '2-6-8',         text: 'With a 2, a 6 and an 8 in play, you may score with them.' },
    { id: 'redwild',    color: 'red',    kind: 'wild',  wild: 'red',
      name: 'Red Is Wild',   text: 'Treat RED cards in play as any NUMBER.' },
    { id: 'threewild',  color: 'blue',   kind: 'wild',  wild: '3',
      name: 'Threes Wild',   text: 'Treat 3s in play as any NUMBER.' },
    { id: 'guesscolor', color: 'purple', kind: 'guess', guess: 'color',
      name: 'Guess a Color', text: 'Guess a COLOR. Discard the top card of the deck. If it matches, play the card.' },
    { id: 'guessnum',   color: 'purple', kind: 'guess', guess: 'number',
      name: 'Guess a Number', text: 'Guess a NUMBER. Discard the top card of the deck. If it matches, play the card.' },
    { id: 'swap',       color: 'yellow', kind: 'swap',
      name: 'Swap',          text: 'Swap a card in play with another player’s card of the same COLOR.' },
    { id: 'seven',      color: 'yellow', kind: 'discard7',
      name: 'Lucky Sevens',  text: 'If you have any 7s in play, play a card from the discard pile.' },
    { id: 'pass',       color: 'green',  kind: 'pass',
      name: 'Pass It On',    text: 'All players pass a card from their hand to the previous player.' },
  ];
  const POWER_BY_ID = {};
  POWERS.forEach(p => (POWER_BY_ID[p.id] = p));

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
  function wildFn(power) {
    if (power && power.kind === 'wild') {
      if (power.wild === 'red') return c => c.color === 'red';
      if (power.wild === '3') return c => c.num === 3;
    }
    return () => false;
  }
  function isSet(cards, wf) {
    const nums = new Set();
    for (const c of cards) if (!wf(c)) nums.add(c.num);
    return nums.size <= 1;
  }
  function isRun(cards, wf) {
    const col = cards[0].color;
    if (!cards.every(c => c.color === col)) return false;
    const fixed = cards.filter(c => !wf(c)).map(c => c.num);
    if (new Set(fixed).size !== fixed.length) return false;
    if (fixed.length === 0) return true;
    const mn = Math.min(...fixed), mx = Math.max(...fixed);
    if (mx - mn > 2) return false;
    return Math.max(1, mx - 2) <= Math.min(7, mn);
  }
  function powerModeMatch(cards, power) {
    if (!power || power.kind !== 'score') return false;
    if (power.mode === 'blue') return cards.every(c => c.color === 'blue');
    if (power.mode === 'red') return cards.every(c => c.color === 'red');
    if (power.mode === '268') {
      const nums = cards.map(c => c.num).sort((a, b) => a - b);
      return nums[0] === 2 && nums[1] === 6 && nums[2] === 8;
    }
    return false;
  }
  /** What kind of score is this triple? returns 'set' | 'run' | 'power' | null */
  function tripleKind(cards, power) {
    const wf = wildFn(power);
    if (isSet(cards, wf)) return 'set';
    if (isRun(cards, wf)) return 'run';
    if (powerModeMatch(cards, power)) return 'power';
    return null;
  }
  const isScoringTriple = (cards, power) => tripleKind(cards, power) !== null;
  /** All scoring triples in a tableau given the Power used this turn (or null). */
  function findTriples(tableau, power) {
    return combos3(tableau).filter(t => isScoringTriple(t, power));
  }

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
        return state.deck.length + state.discard.length > 0 ? { ok: true } : { ok: false, reason: 'No cards left to reveal' };
      case 'swap':
        return swapPairs(state, pi).length ? { ok: true } : { ok: false, reason: 'No matching colors to swap' };
      case 'discard7':
        if (!me.tableau.some(c => c.num === 7)) return { ok: false, reason: 'You have no 7 in play' };
        if (!state.discard.length) return { ok: false, reason: 'Discard pile is empty' };
        return { ok: true };
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
    const powerPile = shuffle(POWERS.slice(), rng);
    const center = powerPile.pop();
    const first = opts.first == null || opts.first === 'random' ? Math.floor(rng() * players.length) : opts.first;
    return { players, deck, discard: [], powerPile, center, mover: null, current: first,
      turnNo: 0, winner: null, rng, turn: null, seed };
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
          let id = await agents[i].choosePassCard(state, i);
          if (!state.players[i].hand.some(c => c.id === id)) id = state.players[i].hand[0].id;
          given[i] = id;
        }
        const cards = given.map((id, i) => removeById(state.players[i].hand, id));
        const moves = [];
        for (let i = 0; i < n; i++) {
          const to = (i - 1 + n) % n;
          state.players[to].hand.push(cards[i]);
          moves.push({ from: i, to, card: cards[i] });
        }
        await emit(hooks, 'pass', { player: pi, moves });
        break;
      }
      case 'discard7': {
        const pile = state.discard.slice();
        let id = await ag.chooseDiscardPick(state, pi, pile);
        if (!pile.some(c => c.id === id)) id = pile[pile.length - 1].id;
        const c = removeById(state.discard, id);
        p.tableau.push(c);
        await emit(hooks, 'discard-pick', { player: pi, card: c });
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
    RULES, COLORS, COLOR_LABEL, POWERS, POWER_BY_ID, ALL_CARDS, CARD_BY_ID,
    cardName, hasMoverSymbol, mulberry32, shuffle, combos3, removeById,
    isSet, isRun, tripleKind, isScoringTriple, findTriples,
    swapPairs, powerFeasibility, usablePowers,
    newGame, drawCard, applyPower, runTurn, playGame,
  };
});
