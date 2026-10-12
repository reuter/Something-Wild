// Ablation experiments to tune the Hard AI against Medium. Not part of the shipped game.
const SW = require('../src/engine.js');
const AI = require('../src/ai.js');
const base = AI._SKILLS.hard;
const variants = {
  'hard (current)': base,
  'no risky powers': { ...base, risky: false },
  'no disruption': { ...base, disrupt: false },
  'no card counting': { ...base, counting: false },
  'no hand lookahead': { ...base, useHand: false },
  'no noise': { ...base, noise: 0 },
  'medium': AI._SKILLS.medium,
};
async function match(skillA, skillB, N) {
  let a = 0, b = 0;
  for (let g = 0; g < N; g++) {
    const seed = 777 + g * 31;
    const swap = g % 2;
    const rng = SW.mulberry32(seed ^ 0xabcdef);
    const mk = s => AI._thinkingAgent(s, rng);
    const agents = swap ? [mk(skillB), mk(skillA)] : [mk(skillA), mk(skillB)];
    const st = SW.newGame({ players: [{ name: 'x' }, { name: 'y' }], seed, first: swap });
    await SW.playGame(st, agents, null, 800);
    if (st.winner == null) continue;
    const aWon = swap ? st.winner === 1 : st.winner === 0;
    aWon ? a++ : b++;
  }
  return `${a}-${b}`;
}
(async () => {
  const N = +process.argv[2] || 300;
  for (const [name, sk] of Object.entries(variants)) {
    console.log(name.padEnd(22), 'vs medium:', await match(sk, AI._SKILLS.medium, N));
  }
})();
