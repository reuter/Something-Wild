/* Something Wild! - computer opponents.
   Levels: easy, medium, hard, unpredictable. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.SWAI = factory(root.SW);
})(typeof self !== 'undefined' ? self : this, function (SW) {
  'use strict';
  const { COLORS, ALL_CARDS, RULES, findTriples, swapPairs, usablePowers, combos3, isScoringTriple, hasMoverSymbol } = SW;

  const LEVELS = ['easy', 'medium', 'hard', 'unpredictable'];

  /* ---- helpers ---------------------------------------------------------- */
  function pick(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

  function buildCounts(state, me, counting) {
    // uc[color][num] = how many copies we believe are still unseen
    const uc = {};
    COLORS.forEach(c => { uc[c] = {}; for (let n = 1; n <= 9; n++) uc[c][n] = 1; });
    let total = 45;
    if (counting) {
      const seen = new Set();
      state.players[me].hand.forEach(c => seen.add(c.id));
      state.players.forEach(p => p.tableau.forEach(c => seen.add(c.id)));
      state.discard.forEach(c => seen.add(c.id));
      seen.forEach(id => { const c = SW.CARD_BY_ID[id]; uc[c.color][c.num] = 0; });
      total = 45 - seen.size;
    }
    return { uc, total: Math.max(1, total) };
  }

  function pairAvail(a, b, uc) {
    let av = 0;
    if (a.num === b.num) {
      COLORS.forEach(c => { av += uc[c][a.num]; });
    } else if (a.color === b.color) {
      const lo = Math.min(a.num, b.num), hi = Math.max(a.num, b.num), col = a.color;
      if (hi - lo === 1) {
        if (lo - 1 >= 1) av += uc[col][lo - 1];
        if (hi + 1 <= 9) av += uc[col][hi + 1];
      } else if (hi - lo === 2) av += uc[col][lo + 1];
    }
    return av;
  }

  /* How promising is this position? Higher = closer to scoring.
     tab: cards in play, hand: cards held (after playing), held: do we/will we hold the mover */
  function potential(tab, hand, ctx) {
    const { uc, total, modes, useHand, held } = ctx;
    const all = useHand ? tab.concat(hand) : tab.slice();
    const inTab = new Set(tab.map(c => c.id));
    let best = 0;
    const K = [900, 220, 70, 12];
    for (const tr of combos3(all)) {
      const k = tr.reduce((s, c) => s + (inTab.has(c.id) ? 0 : 1), 0);
      if (isScoringTriple(tr, null)) { best = Math.max(best, K[k]); continue; }
      for (const m of modes) {
        if (isScoringTriple(tr, m.power)) best = Math.max(best, K[k] * m.w);
      }
    }
    // near-misses that a draw could finish
    let near = 0;
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const k = (inTab.has(a.id) ? 0 : 1) + (inTab.has(b.id) ? 0 : 1);
        const av = pairAvail(a, b, uc);
        if (!av) continue;
        const p1 = 1 - Math.pow(1 - Math.min(1, av / total), 2);
        near = Math.max(near, [40, 14, 4][k] * p1 * 3);
      }
    }
    // score-mode partials (blue/red trio, 2-6-8)
    for (const m of modes) {
      if (!m.power || m.power.kind !== 'score') continue;
      let cnt = 0;
      if (m.power.mode === 'blue' || m.power.mode === 'red') {
        cnt = all.filter(c => c.color === m.power.mode).length;
      } else {
        const have = new Set(all.filter(c => c.num === 2 || c.num === 6 || c.num === 8).map(c => c.num));
        cnt = have.size;
      }
      if (cnt >= 2) near = Math.max(near, 26 * m.w);
      else if (cnt === 1) near = Math.max(near, 4 * m.w);
    }
    // loose connectivity: reward cards that pair up with something
    let links = 0;
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++)
      if (all[i].num === all[j].num ||
          (all[i].color === all[j].color && Math.abs(all[i].num - all[j].num) <= 2)) links++;
    return best + near + Math.min(links, 6) * 0.8;
  }

  function makeCtx(state, me, skill, handForCenter) {
    const { uc, total } = buildCounts(state, me, skill.counting);
    const p = state.players[me];
    const modes = [{ power: null, w: 1 }];
    const addMode = pw => {
      if (pw && (pw.kind === 'wild' || pw.kind === 'score')) modes.push({ power: pw, w: 1 });
    };
    p.powers.forEach(addMode);
    addMode(state.center);
    return { uc, total, modes, useHand: skill.useHand, held: false, skill };
  }

  function withHeld(ctx, held) {
    const modes = ctx.modes.map((m, i) => (i === 0 ? m : { power: m.power, w: held ? 1 : 0.45 }));
    return { ...ctx, modes, held };
  }

  function moverBonus(state, me, held, hand) {
    let b = 0;
    if (held) b += 22;
    else {
      const cc = state.center && state.center.color;
      if (hand.some(c => c.color === cc || c.num === 1)) b += 7;
    }
    return b;
  }

  /* Evaluate a final tableau: handle overflow trimming (>5 cards) */
  function evalTab(state, me, tab, hand, ctx, held) {
    const c2 = withHeld(ctx, held);
    const bonus = moverBonus(state, me, held, hand);
    if (tab.length <= RULES.MAX_TABLEAU) return potential(tab, hand, c2) + bonus;
    let best = -1e9;
    const drop = tab.length - RULES.MAX_TABLEAU;
    const idxs = [];
    for (let i = 0; i < tab.length; i++) idxs.push(i);
    const subsets = drop === 1 ? idxs.map(i => [i]) : combos2(idxs);
    for (const s of subsets) {
      const kept = tab.filter((_, i) => !s.includes(i));
      best = Math.max(best, potential(kept, hand, c2));
    }
    return best + bonus;
  }
  function combos2(arr) {
    const out = [];
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) out.push([i, j]);
    return out;
  }

  /* Value of finishing with this tableau + the Power used this turn */
  function valueOutcome(state, me, tab, hand, power, held, ctx) {
    const triples = findTriples(tab, power);
    if (triples.length) {
      const p = state.players[me];
      if (p.powers.length + 1 >= RULES.WIN) return 1e7;
      let best = -1e9;
      for (const tr of triples) {
        const ids = new Set(tr.map(c => c.id));
        const left = tab.filter(c => !ids.has(c.id));
        best = Math.max(best, evalTab(state, me, left, hand, ctx, held));
      }
      return 5000 + 1500 * (p.powers.length + 1) + best;
    }
    return evalTab(state, me, tab, hand, ctx, held);
  }

  function oppThreat(state, oi, uc, total) {
    const o = state.players[oi];
    const ctx = { uc, total, modes: [{ power: null, w: 1 }], useHand: false, held: false };
    return potential(o.tableau, [], ctx) + o.powers.length * 120;
  }

  /* ---- Planning for medium/hard ------------------------------------------ */
  function plan(state, me, skill, rng) {
    const p = state.players[me];
    const ctx = makeCtx(state, me, skill);
    const hand = p.hand;
    let best = null;
    for (const card of hand) {
      const newHand = hand.filter(c => c !== card);
      const newTab = p.tableau.concat([card]);
      const matches = state.center && card.color === state.center.color;
      const held = state.mover === me || matches || hasMoverSymbol(card);
      const noise = () => rng() * skill.noise;
      const options = [];
      const baseVal = valueOutcome(state, me, newTab, newHand, null, held, ctx);
      options.push({ kind: 'none', val: baseVal });

      if (held) {
        const usable = usablePowers({ ...state, mover: me, players: state.players.map(pl => (pl === p ? { ...pl, tableau: newTab, hand: newHand } : pl)) }, me);
        for (const u of usable) {
          if (!u.feasible) continue;
          const pw = u.power;
          if (pw.kind === 'wild' || pw.kind === 'score') {
            const v = valueOutcome(state, me, newTab, newHand, pw, held, ctx);
            if (v >= 5000) options.push({ kind: 'power', id: pw.id, val: v });
          } else if (pw.kind === 'swap') {
            const tmpState = { ...state, players: state.players.map(pl => (pl === p ? { ...pl, tableau: newTab } : pl)) };
            for (const pr of swapPairs(tmpState, me)) {
              const mine = newTab.find(c => c.id === pr.mine);
              const theirs = state.players[pr.other].tableau.find(c => c.id === pr.theirs);
              const tab2 = newTab.map(c => (c === mine ? theirs : c));
              let v = valueOutcome(state, me, tab2, newHand, null, held, ctx);
              if (v < 5000 && !skill.risky) continue;
              if (skill.disrupt && v < 5000) {
                const ot = state.players[pr.other].tableau;
                const before = oppThreat(state, pr.other, ctx.uc, ctx.total);
                const after = oppThreat({ ...state, players: state.players.map((pl, i) => (i === pr.other ? { ...pl, tableau: ot.map(c => (c === theirs ? mine : c)) } : pl)) }, pr.other, ctx.uc, ctx.total);
                v += 0.5 * (before - after);
              }
              if (v > baseVal + 0.5) options.push({ kind: 'swap', id: pw.id, pair: pr, val: v });
            }
          } else if (pw.kind === 'discard7' && newTab.some(c => c.num === 7)) {
            for (const d of state.discard) {
              const v = valueOutcome(state, me, newTab.concat([d]), newHand, null, held, ctx);
              if (v < 5000 && !skill.risky) continue;
              if (v > baseVal + 0.5) options.push({ kind: 'pick', id: pw.id, pick: d.id, val: v });
            }
          } else if (pw.kind === 'guess' && skill.risky) {
            // expected value of guessing, using what we know is unseen
            const unseen = ALL_CARDS.filter(c => ctx.uc[c.color][c.num] > 0);
            const pool = unseen.length ? unseen : ALL_CARDS;
            const evFor = pred => {
              const hit = pool.filter(pred);
              if (!hit.length) return -1e9;
              const pHit = hit.length / pool.length;
              const vs = hit.map(c => valueOutcome(state, me, newTab.concat([c]), newHand, null, held, ctx));
              const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
              return pHit * avg + (1 - pHit) * baseVal;
            };
            if (pw.guess === 'color') {
              let bc = null, bv = -1e9;
              COLORS.forEach(col => { const v = evFor(c => c.color === col); if (v > bv) { bv = v; bc = col; } });
              if (bv > baseVal + 0.5) options.push({ kind: 'guess', id: pw.id, color: bc, val: bv });
            } else {
              let bn = null, bv = -1e9;
              for (let n = 1; n <= 9; n++) { const v = evFor(c => c.num === n); if (v > bv) { bv = v; bn = n; } }
              if (bv > baseVal + 0.5) options.push({ kind: 'guess', id: pw.id, number: bn, val: bv });
            }
          }
          // 'pass' is never worth planning around
        }
      }
      for (const o of options) {
        const total = o.val + noise();
        if (!best || total > best.total) best = { total, cardId: card.id, option: o };
      }
    }
    return best;
  }

  /* ---- Agents ------------------------------------------------------------------ */
  function baseAgent(rng) {
    return {
      choosePassCard: (s, i) => pick(s.players[i].hand, rng).id,
      chooseTriple: (s, i, triples) => Math.floor(rng() * triples.length),
      chooseDiscards: (s, i, n) => {
        const t = s.players[i].tableau.slice();
        const out = [];
        while (out.length < n) out.push(t.splice(Math.floor(rng() * t.length), 1)[0].id);
        return out;
      },
    };
  }

  function easyAgent(rng, powerProb) {
    const a = baseAgent(rng);
    const pp = powerProb == null ? 0.3 : powerProb;
    let plan_ = null;
    a.choosePlay = (s, i) => {
      const hand = s.players[i].hand;
      plan_ = { use: rng() < pp };
      return pick(hand, rng).id;
    };
    a.choosePower = (s, i, opts) => {
      if (!plan_ || !plan_.use) return null;
      const f = opts.filter(o => o.feasible);
      return f.length ? { id: pick(f, rng).power.id } : null;
    };
    a.chooseColor = () => pick(COLORS, rng);
    a.chooseNumber = () => 1 + Math.floor(rng() * 9);
    a.chooseSwap = (s, i, pairs) => pick(pairs, rng);
    a.chooseDiscardPick = (s, i, pile) => pick(pile, rng).id;
    return a;
  }

  function thinkingAgent(skill, rng) {
    const a = baseAgent(rng);
    let cur = null;
    const ctxFor = (s, i) => makeCtx(s, i, skill);
    a.choosePlay = (s, i) => { cur = plan(s, i, skill, rng); return cur.cardId; };
    a.choosePower = (s, i, opts) => {
      if (!cur || cur.option.kind === 'none') return null;
      const o = opts.find(x => x.power.id === cur.option.id && x.feasible);
      return o ? { id: o.power.id } : null;
    };
    a.chooseColor = () => (cur && cur.option.color) || pick(COLORS, rng);
    a.chooseNumber = () => (cur && cur.option.number) || 1 + Math.floor(rng() * 9);
    a.chooseSwap = (s, i, pairs) => {
      if (cur && cur.option.pair) {
        const m = pairs.find(p => p.mine === cur.option.pair.mine && p.theirs === cur.option.pair.theirs);
        if (m) return m;
      }
      return pairs[0];
    };
    a.chooseDiscardPick = (s, i, pile) => {
      if (cur && cur.option.pick && pile.some(c => c.id === cur.option.pick)) return cur.option.pick;
      // fall back: best by evaluation
      const p = s.players[i], ctx = ctxFor(s, i);
      let best = null;
      for (const d of pile) {
        const v = valueOutcome(s, i, p.tableau.concat([d]), p.hand, null, true, ctx);
        if (!best || v > best.v) best = { v, id: d.id };
      }
      return best.id;
    };
    a.choosePassCard = (s, i) => {
      // give away the card that hurts least to lose
      const p = s.players[i], ctx = ctxFor(s, i);
      let best = null;
      for (const c of p.hand) {
        const v = evalTab(s, i, p.tableau, p.hand.filter(x => x !== c), ctx, s.mover === i);
        if (!best || v > best.v) best = { v, id: c.id };
      }
      return best.id;
    };
    a.chooseTriple = (s, i, triples) => {
      const p = s.players[i], ctx = ctxFor(s, i);
      let best = null;
      triples.forEach((tr, idx) => {
        const ids = new Set(tr.map(c => c.id));
        const v = evalTab(s, i, p.tableau.filter(c => !ids.has(c.id)), p.hand, ctx, s.mover === i);
        if (!best || v > best.v) best = { v, idx };
      });
      return best.idx;
    };
    a.chooseDiscards = (s, i, n) => {
      const p = s.players[i], ctx = ctxFor(s, i);
      const idxs = p.tableau.map((_, k) => k);
      const subsets = n === 1 ? idxs.map(k => [k]) : n === 2 ? combos2(idxs) : [idxs.slice(0, n)];
      let best = null;
      for (const sub of subsets) {
        const kept = p.tableau.filter((_, k) => !sub.includes(k));
        const v = potential(kept, p.hand, withHeld(ctx, s.mover === i));
        if (!best || v > best.v) best = { v, sub };
      }
      return best.sub.map(k => p.tableau[k].id);
    };
    return a;
  }

  const SKILLS = {
    medium: { useHand: false, counting: false, risky: false, disrupt: false, noise: 6 },
    hard:   { useHand: true,  counting: true,  risky: true,  disrupt: true,  noise: 1 },
  };

  function unpredictableAgent(rng) {
    const styles = {
      hard: thinkingAgent(SKILLS.hard, rng),
      medium: thinkingAgent(SKILLS.medium, rng),
      chaos: easyAgent(rng, 0.9),
      lucky: easyAgent(rng, 0.5),
    };
    const weights = [['hard', 34], ['medium', 26], ['chaos', 22], ['lucky', 18]];
    let mood = 'medium';
    const roll = () => {
      let r = rng() * 100;
      for (const [k, w] of weights) { if ((r -= w) < 0) return k; }
      return 'medium';
    };
    const a = {};
    a.choosePlay = (s, i) => { mood = roll(); return styles[mood].choosePlay(s, i); };
    ['choosePower', 'chooseColor', 'chooseNumber', 'chooseSwap', 'chooseDiscardPick',
     'choosePassCard', 'chooseTriple', 'chooseDiscards'].forEach(m => {
      a[m] = (...args) => styles[mood][m](...args);
    });
    a.mood = () => mood;
    return a;
  }

  /* Easy: mostly random, but now and then spots a sensible play (so a kid can lose to it, occasionally). */
  function easyMixAgent(rng, smartProb) {
    const rand = easyAgent(rng, 0.3);
    const smart = thinkingAgent(SKILLS.medium, rng);
    let cur = rand;
    const a = {};
    a.choosePlay = (s, i) => { cur = rng() < smartProb ? smart : rand; return cur.choosePlay(s, i); };
    ['choosePower', 'chooseColor', 'chooseNumber', 'chooseSwap', 'chooseDiscardPick',
     'choosePassCard', 'chooseTriple', 'chooseDiscards'].forEach(m => {
      a[m] = (...args) => cur[m](...args);
    });
    return a;
  }

  function createAgent(level, rng) {
    rng = rng || Math.random;
    if (level === 'easy') return easyMixAgent(rng, 0.4);
    if (level === 'medium') return thinkingAgent(SKILLS.medium, rng);
    if (level === 'hard') return thinkingAgent(SKILLS.hard, rng);
    if (level === 'unpredictable') return unpredictableAgent(rng);
    throw new Error('unknown level ' + level);
  }

  /* A suggestion for the human player's hint button (uses the Hard brain, no randomness). */
  function suggest(state, me) {
    const best = plan(state, me, { ...SKILLS.hard, noise: 0 }, () => 0.5);
    if (!best) return null;
    const o = best.option;
    let why = 'builds toward a set or run';
    if (o.kind === 'power') why = 'sets up a score with a Power';
    else if (o.kind !== 'none') why = 'sets up a good Power play';
    return { cardId: best.cardId, why, option: o };
  }

  return { LEVELS, createAgent, suggest, _thinkingAgent: thinkingAgent, _SKILLS: SKILLS };
});
