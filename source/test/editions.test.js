// Tests for the Baby Groot and Boba Fett editions (and the generic power machinery).
const assert = require('assert');
const SW = require('../src/engine.js');
const C = id => SW.CARD_BY_ID[id];
const P = id => SW.POWER_BY_ID[id];
const T = (...ids) => ids.map(C);
let n = 0;
const ok = (name, fn) => { fn(); n++; };

ok('three editions, 10 powers each, 2 per colour, unique ids', () => {
  assert.deepStrictEqual(SW.EDITION_LIST.map(e => e.id), ['spiderman', 'groot', 'boba']);
  const seen = new Set();
  SW.EDITION_LIST.forEach(e => {
    assert.strictEqual(e.powers.length, 10, e.id);
    SW.COLORS.forEach(c => assert.strictEqual(e.powers.filter(p => p.color === c).length, 2, e.id + ' ' + c));
    e.powers.forEach(p => { assert.ok(!seen.has(p.id), 'dup id ' + p.id); seen.add(p.id); assert.ok(p.name && p.text && p.kind); });
  });
  assert.strictEqual(SW.ALL_POWERS.length, 30);
});
ok('newGame deals the chosen edition’s powers', () => {
  ['spiderman', 'groot', 'boba'].forEach(id => {
    const st = SW.newGame({ players: [{ name: 'a' }, { name: 'b' }], edition: id, seed: 3 });
    const ids = st.powerPile.concat([st.center]).map(p => p.id).sort();
    assert.deepStrictEqual(ids, SW.EDITIONS[id].powers.map(p => p.id).sort());
    assert.strictEqual(st.edition, id);
  });
  assert.throws(() => SW.newGame({ players: [{ name: 'a' }, { name: 'b' }], edition: 'nope' }));
});

// ---- wild powers
ok('Nines Are Wild (9 = any COLOR): the 9 joins a run of another colour', () => {
  assert.strictEqual(SW.tripleKind(T('red7', 'red8', 'blue9'), null), null);
  assert.strictEqual(SW.tripleKind(T('red7', 'red8', 'blue9'), P('g_ninewild')), 'run');
  assert.strictEqual(SW.tripleKind(T('red7', 'blue8', 'green9'), P('g_ninewild')), null); // two real colours
  assert.strictEqual(SW.tripleKind(T('red6', 'red8', 'blue9'), P('g_ninewild')), null);   // a colour wild does not change the number
});
ok('Green Is Wild (green = any NUMBER)', () => {
  assert.strictEqual(SW.tripleKind(T('green1', 'green7', 'green9'), P('g_greenwild')), 'set'); // any three greens
  assert.strictEqual(SW.tripleKind(T('blue5', 'red5', 'green9'), P('g_greenwild')), 'set');
  assert.strictEqual(SW.tripleKind(T('blue5', 'blue6', 'green1'), P('g_greenwild')), null); // a green card is still green
});
ok('Green Chameleon (green = any COLOR)', () => {
  assert.strictEqual(SW.tripleKind(T('blue4', 'blue5', 'green6'), P('b_greenwild')), 'run');
  assert.strictEqual(SW.tripleKind(T('blue4', 'blue5', 'green3'), P('b_greenwild')), 'run');
  assert.strictEqual(SW.tripleKind(T('blue4', 'blue5', 'green8'), P('b_greenwild')), null);
  assert.strictEqual(SW.tripleKind(T('blue4', 'red5', 'green6'), P('b_greenwild')), null);
});
ok('Blue Is Wild / Ones Are Wild (any NUMBER)', () => {
  assert.strictEqual(SW.tripleKind(T('blue1', 'blue9', 'blue4'), P('b_bluewild')), 'set');
  assert.strictEqual(SW.tripleKind(T('red5', 'green5', 'blue1'), P('b_bluewild')), 'set');
  assert.strictEqual(SW.tripleKind(T('red5', 'red6', 'blue1'), P('b_bluewild')), null);
  assert.strictEqual(SW.tripleKind(T('red5', 'red6', 'red1'), P('b_oneswild')), 'run');
  assert.strictEqual(SW.tripleKind(T('red5', 'blue6', 'green1'), P('b_oneswild')), null);
});

// ---- scoring combos
ok('Sum powers: exactly 12 / exactly 16', () => {
  assert.strictEqual(SW.tripleKind(T('red3', 'blue4', 'green5'), P('g_sum12')), 'power');
  assert.strictEqual(SW.tripleKind(T('red3', 'blue4', 'green6'), P('g_sum12')), null);
  assert.strictEqual(SW.tripleKind(T('red9', 'blue2', 'green1'), P('g_sum12')), 'power');
  assert.strictEqual(SW.tripleKind(T('red7', 'blue4', 'green5'), P('b_sum16')), 'power');
  assert.strictEqual(SW.tripleKind(T('red7', 'blue4', 'green6'), P('b_sum16')), null);
});
ok('3-5-8', () => {
  assert.strictEqual(SW.tripleKind(T('red3', 'blue5', 'green8'), P('g_358')), 'power');
  assert.strictEqual(SW.tripleKind(T('red8', 'red5', 'red3'), P('g_358')), 'power');
  assert.strictEqual(SW.tripleKind(T('red3', 'blue5', 'green7'), P('g_358')), null);
});
ok('Tri-Color: one blue, one green, one red', () => {
  assert.strictEqual(SW.tripleKind(T('blue2', 'green7', 'red5'), P('b_bgr')), 'power');
  assert.strictEqual(SW.tripleKind(T('blue2', 'blue3', 'red5'), P('b_bgr')), null);
  assert.strictEqual(SW.tripleKind(T('blue2', 'green7', 'yellow5'), P('b_bgr')), null);
});
ok('colour trios', () => {
  assert.strictEqual(SW.tripleKind(T('yellow2', 'yellow7', 'yellow9'), P('b_yellow3')), 'power');
  assert.strictEqual(SW.tripleKind(T('yellow2', 'yellow7', 'red9'), P('b_yellow3')), null);
  assert.strictEqual(SW.tripleKind(T('red2', 'red7', 'red9'), P('g_red3')), 'power');
});

// ---- turn flow
function scripted(over) {
  return Object.assign({
    choosePlay: (s, i) => s.players[i].hand[0].id,
    choosePower: () => null, chooseColor: () => 'red', chooseNumber: () => 1,
    chooseSwap: (s, i, pairs) => pairs[0], choosePassCard: (s, i, allowed) => (allowed || s.players[i].hand)[0].id,
    chooseDiscardPick: (s, i, pile) => pile[0].id, chooseTriple: () => 0,
    chooseDiscards: (s, i, k) => s.players[i].tableau.slice(0, k).map(c => c.id),
  }, over || {});
}
const mk = (np, edition) => {
  const st = SW.newGame({ players: Array.from({ length: np }, (_, i) => ({ name: 'P' + i })), edition, seed: 11, first: 0 });
  st.players.forEach(p => { p.hand = []; p.tableau = []; p.powers = []; });
  st.mover = 0;
  return st;
};
const ids = arr => arr.map(c => c.id).sort();

(async () => {
  // Color Sweep: flip red3 -> every other player discards a red card in play (their choice)
  let st = mk(3, 'groot');
  st.center = P('g_sweepcolor');
  st.players[0].hand = T('green2', 'green4'); st.players[0].tableau = T('red9');
  st.players[1].tableau = T('red5', 'blue2', 'red8');
  st.players[2].tableau = T('green1', 'red1');
  st.deck = T('yellow9', 'red3', 'blue7'); // draw blue7, flip red3
  const events = [];
  const picks = [];
  const ag = [scripted({ choosePlay: () => 'green2', choosePower: () => ({ id: 'g_sweepcolor' }) }),
    scripted({ chooseStrip: (s, i, c) => { picks.push(c.slice()); return 'red8'; } }), scripted()];
  await SW.runTurn(st, ag, { event: (t, d) => { events.push(t); } });
  assert.deepStrictEqual(ids(st.players[1].tableau), ['blue2', 'red5']);
  assert.deepStrictEqual(ids(st.players[2].tableau), ['green1']);   // single match: automatic
  assert.deepStrictEqual(ids(st.players[0].tableau), ['green2', 'red9']); // you keep yours
  assert.deepStrictEqual(picks, [['red5', 'red8']]);
  assert.ok(st.discard.some(c => c.id === 'red3') && st.discard.some(c => c.id === 'red8') && st.discard.some(c => c.id === 'red1'));
  assert.ok(events.includes('strip-reveal') && events.includes('strip')); n++;

  // Number Sweep: flip a 5 -> others discard 5s
  st = mk(2, 'groot');
  st.center = P('g_sweepnum');
  st.players[0].hand = T('green2'); st.players[1].tableau = T('red5', 'blue5', 'blue2');
  st.deck = T('yellow9', 'green5', 'blue7');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'green2', choosePower: () => ({ id: 'g_sweepnum' }) }), scripted({ chooseStrip: () => 'blue5' })]);
  assert.deepStrictEqual(ids(st.players[1].tableau), ['blue2', 'red5']); n++;

  // Nothing matches -> nothing happens (and no crash)
  st = mk(2, 'groot');
  st.center = P('g_sweepnum');
  st.players[0].hand = T('green2'); st.players[1].tableau = T('red4');
  st.deck = T('yellow9', 'green5', 'blue7');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'green2', choosePower: () => ({ id: 'g_sweepnum' }) }), scripted()]);
  assert.deepStrictEqual(ids(st.players[1].tableau), ['red4']); n++;

  // Double Time: needs a 2 in play, draws and plays an extra card
  st = mk(2, 'groot');
  st.center = P('g_twos'); // blue
  st.players[0].hand = T('blue3', 'red6'); st.players[0].tableau = T('green2');
  st.deck = T('purple8', 'yellow4', 'red7');
  let usable = SW.usablePowers(st, 0).find(o => o.power.id === 'g_twos');
  assert.strictEqual(usable.feasible, true);
  const extraPlays = [];
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue3', choosePower: () => ({ id: 'g_twos' }), chooseExtraPlay: (s, i) => { extraPlays.push(ids(s.players[i].hand)); return 'yellow4'; } }), scripted()]);
  assert.deepStrictEqual(extraPlays, [['red6', 'red7', 'yellow4']]);
  assert.deepStrictEqual(ids(st.players[0].tableau), ['blue3', 'green2', 'yellow4']);
  assert.strictEqual(st.players[0].hand.length, 2); n++;
  // ...and not feasible without a 2
  st.players[0].tableau = T('green3');
  usable = SW.usablePowers(st, 0).find(o => o.power.id === 'g_twos');
  assert.strictEqual(usable.feasible, false); n++;
  // an extra card can complete a score
  st = mk(2, 'boba');
  st.center = P('b_sixes'); // blue
  st.players[0].hand = T('blue6', 'red2'); st.players[0].tableau = T('green6', 'red6');
  st.deck = T('purple8', 'yellow6', 'red7'); // draw red7 -> hand blue6, red2, red7 ; play blue6 ; extra draws yellow6
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue6', choosePower: () => ({ id: 'b_sixes' }), chooseExtraPlay: () => 'red2' }), scripted()]);
  // blue6 + green6 + red6 is already a set of sixes, scored at the end
  assert.strictEqual(st.players[0].powers.length, 1); n++;

  // Pass the High / Low
  st = mk(2, 'boba');
  st.center = P('b_passhigh');
  st.players[0].hand = T('red1', 'blue9', 'green4'); st.deck = T('yellow5'); // p0 draws yellow5 then plays red1
  st.players[1].hand = T('red2', 'green9', 'blue3');
  let asked = [];
  await SW.runTurn(st, [scripted({ choosePlay: () => 'red1', choosePower: () => ({ id: 'b_passhigh' }) }),
    scripted({ choosePassCard: (s, i, al) => { asked.push(al.length); return al[0].id; } })]);
  assert.deepStrictEqual(ids(st.players[0].hand), ['green4', 'green9', 'yellow5']);
  assert.deepStrictEqual(ids(st.players[1].hand), ['blue3', 'blue9', 'red2']);
  assert.deepStrictEqual(asked, []); n++; // only one highest card each: forced, nobody is asked
  st = mk(2, 'boba');
  st.center = P('b_passlow');
  st.players[0].hand = T('red1', 'blue9', 'green4'); st.deck = T('yellow4');
  st.players[1].hand = T('red8', 'green7', 'blue3');
  asked = [];
  await SW.runTurn(st, [scripted({ choosePlay: () => 'red1', choosePower: () => ({ id: 'b_passlow' }), choosePassCard: (s, i, al) => { asked.push(al.map(c => c.id).sort()); return 'yellow4'; } }),
    scripted()]);
  // p0's lowest are green4/yellow4 (tie): they get to choose; p1's lowest is blue3
  assert.deepStrictEqual(asked, [['green4', 'yellow4']]);
  assert.ok(st.players[1].hand.some(c => c.id === 'yellow4') && !st.players[1].hand.some(c => c.id === 'blue3'));
  assert.ok(st.players[0].hand.some(c => c.id === 'blue3')); n++;
  // an illegal choice is corrected to a legal one
  st = mk(2, 'boba');
  st.center = P('b_passhigh');
  st.players[0].hand = T('red1', 'blue9'); st.deck = T('green9', 'yellow2'); // draws yellow2? top is the last element
  st.players[1].hand = T('red2', 'green9', 'blue3');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'red1', choosePower: () => ({ id: 'b_passhigh' }), choosePassCard: () => 'yellow2' }), scripted({ choosePassCard: () => 'red2' })]);
  assert.ok(st.players[1].hand.some(c => c.id === 'blue9' || c.id === 'green9')); n++;

  // Second Chance: purple in play lets you play from the discard pile
  st = mk(2, 'groot');
  st.center = P('g_purple'); // purple
  st.players[0].hand = T('purple4', 'red2'); st.players[0].tableau = T('green8');
  st.discard = T('red6', 'blue3'); st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'purple4', choosePower: () => ({ id: 'g_purple' }), chooseDiscardPick: () => 'blue3' }), scripted()]);
  assert.ok(st.players[0].tableau.some(c => c.id === 'blue3')); n++;
  st.players[0].tableau = T('green8'); // no purple now
  assert.strictEqual(SW.usablePowers(st, 0).find(o => o.power.id === 'g_purple').feasible, false); n++;

  // Using the center Power to score with colour wilds (Boba, Green Chameleon)
  st = mk(2, 'boba');
  st.center = P('b_greenwild'); // green: playing a green takes the figure
  st.players[0].hand = T('green6', 'red2'); st.players[0].tableau = T('blue4', 'blue5');
  st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'green6', choosePower: () => ({ id: 'b_greenwild' }) }), scripted()]);
  assert.strictEqual(st.players[0].powers[0].id, 'b_greenwild'); n++;

  // Sum-of-12 power scored from the centre
  st = mk(2, 'groot');
  st.center = P('g_sum12'); // yellow
  st.players[0].hand = T('yellow5', 'red2'); st.players[0].tableau = T('red3', 'blue4');
  st.deck = T('green9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'yellow5', choosePower: () => ({ id: 'g_sum12' }) }), scripted()]);
  assert.strictEqual(st.players[0].powers[0].id, 'g_sum12'); n++;

  console.log('edition tests passed: ' + n);
})().catch(e => { console.error(e); process.exit(1); });
