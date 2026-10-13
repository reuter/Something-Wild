// Headless AI-vs-AI simulation: checks games always finish and that the levels differ in strength.
const SW = require('../src/engine.js');
const AI = require('../src/ai.js');

async function oneGame(levels, seed, first, edition) {
  const st = SW.newGame({ players: levels.map((l, i) => ({ name: 'P' + i, level: l })), seed, first, edition });
  const rng = SW.mulberry32(seed ^ 0x9e3779b9);
  const agents = levels.map(l => AI.createAgent(l, rng));
  const counts = { score: 0, powerUse: {}, mover: 0 };
  const hooks = { event: (t, d) => {
    if (t === 'score') counts.score++;
    if (t === 'power-use') counts.powerUse[d.power.id] = (counts.powerUse[d.power.id] || 0) + 1;
    if (t === 'mover') counts.mover++;
  } };
  const t0 = Date.now();
  await SW.playGame(st, agents, hooks, 800);
  // invariants: no card duplicated or lost
  const all = [].concat(st.deck, st.discard, ...st.players.map(p => p.hand), ...st.players.map(p => p.tableau));
  const ids = new Set(all.map(c => c.id));
  if (all.length !== 45 || ids.size !== 45) throw new Error('card conservation broken: ' + all.length + '/' + ids.size);
  const pw = [].concat(st.powerPile, st.center ? [st.center] : [], ...st.players.map(p => p.powers));
  if (pw.length !== 10 || new Set(pw.map(p => p.id)).size !== 10) throw new Error('power conservation broken');
  return { winner: st.winner, turns: st.turnNo, ms: Date.now() - t0, counts };
}

(async () => {
  const N = +process.argv[2] || 150;
  // 1. every combination finishes, and card/power conservation holds
  let stuck = 0, totalTurns = 0, games = 0, maxMs = 0; const powerUse = {};
  const EDS = process.env.EDITION ? [process.env.EDITION] : SW.EDITION_LIST.map(e => e.id);
  for (const ed of EDS) for (const n of [2, 3, 4]) {
    for (let s = 0; s < 40; s++) {
      const lv = Array.from({ length: n }, (_, i) => AI.LEVELS[(s + i) % 4]);
      const r = await oneGame(lv, 1000 + s * 7 + n, 'random', ed);
      games++; totalTurns += r.turns; maxMs = Math.max(maxMs, r.ms);
      if (r.winner == null) stuck++;
      for (const k in r.counts.powerUse) powerUse[k] = (powerUse[k] || 0) + r.counts.powerUse[k];
    }
  }
  console.log(`mixed games: ${games}, unfinished: ${stuck}, avg turns: ${(totalTurns / games).toFixed(1)}, slowest game: ${maxMs}ms`);
  console.log('power usage:', JSON.stringify(powerUse));

  // 2. head-to-head strength: each level vs each other in 2-player games (seats alternated)
  const L = AI.LEVELS;
  const table = {};
  for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
    let wa = 0, wb = 0, none = 0;
    for (let g = 0; g < N; g++) {
      const swap = g % 2;
      const lv = swap ? [L[b], L[a]] : [L[a], L[b]];
      const r = await oneGame(lv, 5000 + g * 13 + a * 3 + b, 'random', process.env.EDITION || undefined);
      if (r.winner == null) none++;
      else { const winLvl = lv[r.winner]; if (winLvl === L[a]) wa++; else wb++; }
    }
    table[`${L[a]} vs ${L[b]}`] = `${wa}-${wb}` + (none ? ` (${none} unfinished)` : '');
  }
  console.log('head-to-head (2 players, ' + N + ' games each):');
  console.log(table);
  // 3. 4-player free-for-all, one of each level
  const wins = { easy: 0, medium: 0, hard: 0, unpredictable: 0 };
  const M = N * 2;
  for (let g = 0; g < M; g++) {
    const order = L.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = (g * 7 + i * 3) % (i + 1); [order[i], order[j]] = [order[j], order[i]]; }
    const r = await oneGame(order, 9000 + g, 'random');
    if (r.winner != null) wins[order[r.winner]]++;
  }
  console.log(`4-player free-for-all (${M} games), wins:`, wins);
})().catch(e => { console.error(e); process.exit(1); });
