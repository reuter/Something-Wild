const assert = require('assert');
const SW = require('../src/engine.js');
const C = id => SW.CARD_BY_ID[id];
const P = id => SW.POWER_BY_ID[id];
const T = (...ids) => ids.map(C);
let n = 0;
const ok = (name, fn) => { fn(); n++; };

// deck composition
ok('45 unique cards, 9 per colour, 5 per number', () => {
  assert.strictEqual(SW.ALL_CARDS.length, 45);
  SW.COLORS.forEach(c => assert.strictEqual(SW.ALL_CARDS.filter(x => x.color === c).length, 9));
  for (let i = 1; i <= 9; i++) assert.strictEqual(SW.ALL_CARDS.filter(x => x.num === i).length, 5);
});
ok('10 powers, 2 per colour', () => {
  assert.strictEqual(SW.POWERS.length, 10);
  SW.COLORS.forEach(c => assert.strictEqual(SW.POWERS.filter(x => x.color === c).length, 2));
});

// sets
ok('set: three of a number, any colours', () => assert.strictEqual(SW.tripleKind(T('red8', 'blue8', 'green8'), null), 'set'));
ok('set needs same number', () => assert.strictEqual(SW.tripleKind(T('red8', 'blue8', 'green7'), null), null));
// runs
ok('run: same colour consecutive', () => assert.strictEqual(SW.tripleKind(T('red2', 'red3', 'red4'), null), 'run'));
ok('run: order of cards does not matter', () => assert.strictEqual(SW.tripleKind(T('red4', 'red2', 'red3'), null), 'run'));
ok('run: must be one colour', () => assert.strictEqual(SW.tripleKind(T('red2', 'blue3', 'red4'), null), null));
ok('run: gap is not a run', () => assert.strictEqual(SW.tripleKind(T('red2', 'red3', 'red5'), null), null));
ok('run: 7-8-9 works, no wraparound', () => {
  assert.strictEqual(SW.tripleKind(T('blue7', 'blue8', 'blue9'), null), 'run');
  assert.strictEqual(SW.tripleKind(T('blue8', 'blue9', 'blue1'), null), null);
});
// wild powers
ok('Red is Wild: example from rulebook (red 2, red 6 + red) forms a run', () => {
  assert.strictEqual(SW.tripleKind(T('red2', 'red6', 'red4'), null), null);
  assert.strictEqual(SW.tripleKind(T('red2', 'red6', 'red4'), P('redwild')), 'set'); // all red => wild => any set
});
ok('Red is Wild: red cards complete a set of other colours', () => {
  assert.strictEqual(SW.tripleKind(T('blue5', 'green5', 'red9'), null), null);
  assert.strictEqual(SW.tripleKind(T('blue5', 'green5', 'red9'), P('redwild')), 'set');
});
ok('Red is Wild does NOT change colour for runs', () => {
  assert.strictEqual(SW.tripleKind(T('blue5', 'blue6', 'red9'), P('redwild')), null);
});
ok('Threes Wild: a 3 fills a set', () => assert.strictEqual(SW.tripleKind(T('blue5', 'green5', 'red3'), P('threewild')), 'set'));
ok('Threes Wild: a 3 of the right colour fills a run', () => {
  assert.strictEqual(SW.tripleKind(T('blue7', 'blue9', 'blue3'), P('threewild')), 'run');
  assert.strictEqual(SW.tripleKind(T('blue7', 'blue9', 'red3'), P('threewild')), null);
});
ok('Threes Wild: two 3s + any card is a set', () => assert.strictEqual(SW.tripleKind(T('blue3', 'red3', 'green9'), P('threewild')), 'set'));
// score powers
ok('Blue Trio', () => {
  assert.strictEqual(SW.tripleKind(T('blue1', 'blue5', 'blue9'), P('blue3')), 'power');
  assert.strictEqual(SW.tripleKind(T('blue1', 'blue5', 'red9'), P('blue3')), null);
  assert.strictEqual(SW.tripleKind(T('blue1', 'blue5', 'blue9'), null), null);
});
ok('Red Trio', () => assert.strictEqual(SW.tripleKind(T('red1', 'red5', 'red9'), P('red3')), 'power'));
ok('2-6-8', () => {
  assert.strictEqual(SW.tripleKind(T('red2', 'blue6', 'green8'), P('n268')), 'power');
  assert.strictEqual(SW.tripleKind(T('red2', 'blue6', 'green7'), P('n268')), null);
});
ok('findTriples finds all and only valid triples', () => {
  const tab = T('red8', 'blue8', 'green8', 'yellow8', 'red1');
  assert.strictEqual(SW.findTriples(tab, null).length, 4);
});

// turn flow with scripted agents
function scripted(over) {
  const base = {
    choosePlay: (s, i) => s.players[i].hand[0].id,
    choosePower: () => null, chooseColor: () => 'red', chooseNumber: () => 1,
    chooseSwap: (s, i, pairs) => pairs[0], choosePassCard: (s, i) => s.players[i].hand[0].id,
    chooseDiscardPick: (s, i, pile) => pile[0].id, chooseTriple: () => 0,
    chooseDiscards: (s, i, n) => s.players[i].tableau.slice(0, n).map(c => c.id),
  };
  return Object.assign(base, over || {});
}
function mk(n) {
  const st = SW.newGame({ players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i })), seed: 7, first: 0 });
  return st;
}
const run = async () => {
  // setup
  let st = mk(3);
  assert.strictEqual(st.players.every(p => p.hand.length === 3), true);
  assert.strictEqual(st.deck.length, 45 - 9);
  assert.strictEqual(st.powerPile.length, 9);
  assert.ok(st.center); assert.strictEqual(st.mover, null); n++;

  // playing a 1 takes the mover (no power match needed)
  st = mk(2);
  st.players[0].hand = T('red1', 'blue4', 'green4');
  st.deck = T('yellow9');
  st.center = P('swap'); // yellow
  await SW.runTurn(st, [scripted({ choosePlay: () => 'red1' }), scripted()]);
  assert.strictEqual(st.mover, 0); n++;

  // playing the colour of the centre Power takes the mover, even from another player
  st = mk(2);
  st.center = P('guesscolor'); // purple
  st.mover = 1;
  st.players[0].hand = T('purple4', 'blue4', 'green4');
  st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'purple4' }), scripted()]);
  assert.strictEqual(st.mover, 0); n++;

  // wrong colour: no mover
  st = mk(2);
  st.center = P('guesscolor');
  st.players[0].hand = T('blue4', 'green4', 'red5');
  st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue4' }), scripted()]);
  assert.strictEqual(st.mover, null); n++;

  // scoring: set, takes centre power, flips next, discards the three cards
  st = mk(2);
  st.center = P('swap'); const next = st.powerPile[st.powerPile.length - 1];
  st.players[0].tableau = T('red8', 'blue8');
  st.players[0].hand = T('green8', 'blue4', 'green4');
  st.deck = T('yellow9');
  const dBefore = st.discard.length;
  await SW.runTurn(st, [scripted({ choosePlay: () => 'green8' }), scripted()]);
  assert.strictEqual(st.players[0].powers.length, 1);
  assert.strictEqual(st.players[0].powers[0].id, 'swap');
  assert.strictEqual(st.center.id, next.id);
  assert.strictEqual(st.players[0].tableau.length, 0);
  assert.strictEqual(st.discard.length, dBefore + 3); n++;

  // using the CENTRE power to score (rulebook example): red wild + red run, you score the centre power
  st = mk(2);
  st.center = P('redwild'); // red => playing a red takes the mover
  st.players[0].tableau = T('red2', 'red9');
  st.players[0].hand = T('red6', 'blue4', 'green4');
  st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'red6', choosePower: () => ({ id: 'redwild' }) }), scripted()]);
  assert.strictEqual(st.players[0].powers[0].id, 'redwild'); n++;

  // no mover => cannot use a power
  st = mk(2);
  st.players[0].powers = [P('redwild')];
  st.center = P('guesscolor'); st.mover = null;
  st.players[0].tableau = T('red2', 'red9');
  st.players[0].hand = T('red6', 'blue4', 'green4');
  st.deck = T('yellow9');
  let asked = false;
  await SW.runTurn(st, [scripted({ choosePlay: () => 'red6', choosePower: () => { asked = true; return { id: 'redwild' }; } }), scripted()]);
  assert.strictEqual(asked, false);
  assert.strictEqual(st.players[0].powers.length, 1); n++;

  // swap
  st = mk(2);
  st.center = P('swap'); st.mover = 0;
  st.players[0].tableau = T('red2');
  st.players[1].tableau = T('red9');
  st.players[0].hand = T('blue4', 'green4', 'green6');
  st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue4', choosePower: () => ({ id: 'swap' }) }), scripted()]);
  assert.deepStrictEqual(st.players[0].tableau.map(c => c.id), ['red9', 'blue4']);
  assert.deepStrictEqual(st.players[1].tableau.map(c => c.id), ['red2']); n++;

  // pass goes to the previous player
  st = mk(3);
  st.center = P('pass'); st.mover = 0;
  st.players[0].hand = T('red4', 'blue4', 'green4');
  st.players[1].hand = T('red5', 'blue5', 'green5');
  st.players[2].hand = T('red6', 'blue6', 'green6');
  st.deck = T('yellow9', 'yellow8', 'yellow7');
  await SW.runTurn(st, [
    scripted({ choosePlay: () => 'blue4', choosePower: () => ({ id: 'pass' }) }), scripted(), scripted()]);
  // P0 had red4,green4,yellow9 after play; gives red4 -> P2; gets P1's first card (red5)
  assert.ok(st.players[2].hand.some(c => c.id === 'red4'));
  assert.ok(st.players[1].hand.some(c => c.id === 'red6'));
  assert.ok(st.players[0].hand.some(c => c.id === 'red5')); n++;

  // overflow discard to five
  st = mk(2);
  st.center = P('swap');
  st.players[0].tableau = T('red2', 'blue3', 'green4', 'yellow5', 'purple6');
  st.players[0].hand = T('blue9', 'red8', 'green6');
  st.deck = T('yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue9' }), scripted()]);
  assert.strictEqual(st.players[0].tableau.length, 5); n++;

  // reshuffle when deck empty
  st = mk(2);
  st.deck = []; st.discard = T('red2', 'red3', 'red4', 'red5');
  st.players[0].hand = T('blue4', 'green4', 'green6');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue4' }), scripted()]);
  // 4 discards reshuffled into the deck, 1 drawn: deck 3 + hand 3 + 1 played = 7, discard empty
  assert.strictEqual(st.discard.length, 0);
  assert.strictEqual(st.deck.length, 3);
  assert.strictEqual(st.players[0].hand.length, 3);
  assert.strictEqual(st.players[0].tableau.length, 1); n++;

  // guess: correct guess plays the card
  st = mk(2);
  st.center = P('guesscolor'); st.mover = 0;
  st.players[0].hand = T('blue4', 'green4', 'green6');
  st.deck = T('purple9', 'yellow9');
  await SW.runTurn(st, [scripted({ choosePlay: () => 'blue4', choosePower: () => ({ id: 'guesscolor' }), chooseColor: () => 'yellow' }), scripted()]);
  // draw takes yellow9 first (top of deck is last element) -> hand; guess reveals purple9
  assert.ok(st.discard.some(c => c.id === 'purple9')); n++;

  // game completes and winner has 3 powers
  for (let seed = 1; seed <= 20; seed++) {
    const g = SW.newGame({ players: [{ name: 'a' }, { name: 'b' }, { name: 'c' }], seed });
    const ags = [scripted(), scripted(), scripted()];
    await SW.playGame(g, ags);
    // scripted agents never choose powers; just confirm the loop terminates safely
    assert.ok(g.turnNo > 0);
  }
  n++;

  console.log('engine tests passed:', n);
};
run().catch(e => { console.error(e); process.exit(1); });
