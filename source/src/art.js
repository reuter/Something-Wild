/* Something Wild! - procedural art.
   Original "vinyl figure" style characters (big heads, black bead eyes) drawn as SVG,
   plus icons for the Power cards. No external assets, so it works offline. */
(function (root, factory) {
  root.SWART = factory(root.SW);
})(typeof self !== 'undefined' ? self : this, function (SW) {
  'use strict';
  const { COLORS } = SW;

  const PAL = {
    red:    { c: '#e8404e', d: '#a8212c', l: '#ff9aa0' },
    blue:   { c: '#1f7fd1', d: '#14518a', l: '#8cc4f2' },
    green:  { c: '#16a58a', d: '#0c6b59', l: '#7fdcc8' },
    yellow: { c: '#f5b01c', d: '#9a6a00', l: '#ffe08a' },
    purple: { c: '#7b4cc0', d: '#4d2a85', l: '#c4a6ee' },
  };
  const NAMES = {
    red:    ['Ember', 'Rally', 'Cinder', 'Dash', 'Ruby', 'Crimson', 'Flare', 'Rocket', 'Cherry'],
    blue:   ['Azure', 'Skye', 'Tide', 'Frost', 'Cobalt', 'Wave', 'Indigo', 'Jet', 'Sapphire'],
    green:  ['Sprout', 'Fern', 'Jade', 'Moss', 'Clover', 'Viper', 'Lime', 'Ivy', 'Emerald'],
    yellow: ['Spark', 'Sunny', 'Amber', 'Bolt', 'Goldie', 'Honey', 'Zap', 'Beam', 'Nova'],
    purple: ['Violet', 'Plum', 'Shade', 'Orchid', 'Mystic', 'Twilight', 'Grape', 'Lilac', 'Phantom'],
  };
  const SKIN = ['#f6d2b0', '#e9b98f', '#c98e63', '#9a6642', '#6e4529', '#fbe0c8'];
  const HAIR = ['#2b1b12', '#5b3a1e', '#e6b34a', '#c9402b', '#3a3a46', '#e9e9ef'];

  const charName = c => NAMES[c.color][c.num - 1];

  function emblem(color, a) {
    switch (color) {
      case 'red':    return `<path d="M50 92 C57 99 59 104 55 110 C53 114 47 114 45 110 C41 105 47 102 50 92Z" fill="${a}"/>`;
      case 'blue':   return `<path d="M39 104 Q44.5 96 50 104 T61 104" stroke="${a}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      case 'green':  return `<path d="M41 111 Q41 93 59 93 Q59 111 41 111Z" fill="${a}"/>`;
      case 'yellow': return `<path d="M53 91 L41 106 L50 106 L46 119 L60 102 L51 102Z" fill="${a}"/>`;
      default:       return `<path d="M50 92 L53.5 100 L62 101 L55.5 107 L57.5 115 L50 110.5 L42.5 115 L44.5 107 L38 101 L46.5 100Z" fill="${a}"/>`;
    }
  }

  const FIG = {};
  function figureSVG(color, num) {
    const key = color + num;
    if (FIG[key]) return FIG[key];
    const p = PAL[color];
    const ci = COLORS.indexOf(color);
    const skin = SKIN[(num * 3 + ci) % SKIN.length];
    const hair = HAIR[(num + ci * 2) % HAIR.length];
    const suit = p.d, acc = p.l;
    let back = '', front = '';
    switch (num) {
      case 1: // hood
        back = `<path d="M11 64 Q8 12 50 10 Q92 12 89 64 Q81 33 50 31 Q19 33 11 64Z" fill="${suit}"/><path d="M11 64 Q6 88 22 92 L27 70Z M89 64 Q94 88 78 92 L73 70Z" fill="${suit}"/>`;
        break;
      case 2: // spiky hair
        back = `<path d="M17 42 L11 20 L27 29 L33 7 L46 24 L58 5 L66 24 L83 11 L83 36 Q50 22 17 42Z" fill="${hair}"/>`;
        break;
      case 3: // bun
        back = `<circle cx="78" cy="15" r="10" fill="${hair}"/><path d="M17 44 Q17 12 50 12 Q83 12 83 44 Q70 27 50 27 Q30 27 17 44Z" fill="${hair}"/><rect x="70" y="20" width="14" height="5" rx="2" fill="${acc}" transform="rotate(-25 77 22)"/>`;
        break;
      case 4: // headband
        back = `<path d="M17 44 Q17 12 50 12 Q83 12 83 44 Q70 27 50 27 Q30 27 17 44Z" fill="${hair}"/>`;
        front = `<rect x="17" y="29" width="66" height="9" fill="${acc}"/><path d="M50 27.5 L52.2 32 L57 32.6 L53.5 35.8 L54.4 40.5 L50 38.2 L45.6 40.5 L46.5 35.8 L43 32.6 L47.8 32Z" fill="#fff"/>`;
        break;
      case 5: // beanie
        back = `<path d="M18 40 Q18 6 50 6 Q82 6 82 40Z" fill="${suit}"/><circle cx="50" cy="6" r="6.5" fill="#fff"/>`;
        front = `<rect x="15" y="35" width="70" height="10" rx="5" fill="${acc}"/>`;
        break;
      case 6: // goggles
        back = `<path d="M17 44 Q17 12 50 12 Q83 12 83 44 Q70 27 50 27 Q30 27 17 44Z" fill="${hair}"/>`;
        front = `<rect x="14" y="50" width="72" height="7" fill="#2f2f38"/><circle cx="37" cy="56" r="13" fill="rgba(255,255,255,.28)" stroke="#2f2f38" stroke-width="4.5"/><circle cx="63" cy="56" r="13" fill="rgba(255,255,255,.28)" stroke="#2f2f38" stroke-width="4.5"/>`;
        break;
      case 7: // mohawk
        back = `<path d="M40 24 L44 3 L50 15 L56 3 L60 24Z" fill="${acc}"/>`;
        break;
      case 8: // mask
        front = `<path d="M17 44 Q50 36 83 44 L83 69 Q50 77 17 69Z" fill="${suit}"/><ellipse cx="37" cy="57" rx="11" ry="12" fill="#fff"/><ellipse cx="63" cy="57" rx="11" ry="12" fill="#fff"/>`;
        break;
      default: // crown
        back = `<path d="M17 44 Q17 20 50 20 Q83 20 83 44 Q70 31 50 31 Q30 31 17 44Z" fill="${hair}"/>`;
        front = `<path d="M25 26 L29 4 L40 16 L50 1 L60 16 L71 4 L75 26Z" fill="#f6c22d" stroke="#b9860b" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="19" r="2.6" fill="#e8404e"/><circle cx="35" cy="21" r="2" fill="#1f7fd1"/><circle cx="65" cy="21" r="2" fill="#16a58a"/>`;
    }
    const eyeY = num === 8 ? 57 : 56;
    const eyes = `<ellipse cx="37" cy="${eyeY}" rx="6" ry="8" fill="#17171c"/><ellipse cx="63" cy="${eyeY}" rx="6" ry="8" fill="#17171c"/>` +
      `<circle cx="39.2" cy="${eyeY - 3}" r="2.2" fill="#fff"/><circle cx="65.2" cy="${eyeY - 3}" r="2.2" fill="#fff"/><circle cx="35.5" cy="${eyeY + 3}" r="1.1" fill="#fff"/><circle cx="61.5" cy="${eyeY + 3}" r="1.1" fill="#fff"/>`;
    const m = num % 3;
    const mouth = m === 0 ? `<path d="M43 71 Q50 77 57 71" stroke="#6b2d1f" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
      : m === 1 ? `<path d="M43 70 Q50 80 57 70Z" fill="#6b2d1f"/><path d="M46 73 Q50 76 54 73" fill="#e8747c"/>`
      : `<ellipse cx="50" cy="73" rx="3.4" ry="3" fill="#6b2d1f"/>`;
    const svg = `<svg viewBox="0 0 100 124" preserveAspectRatio="xMidYMax meet" aria-hidden="true">` +
      `<ellipse cx="50" cy="121" rx="34" ry="4.5" fill="rgba(0,0,0,.2)"/>` +
      `<path d="M20 124 L25 88 Q50 77 75 88 L80 124 Z" fill="${suit}"/>` +
      `<ellipse cx="22" cy="100" rx="7.5" ry="11" fill="${suit}"/><ellipse cx="78" cy="100" rx="7.5" ry="11" fill="${suit}"/>` +
      emblem(color, acc) +
      `<ellipse cx="50" cy="85" rx="30" ry="5.5" fill="rgba(0,0,0,.2)"/>` +
      `<rect x="16" y="19" width="68" height="64" rx="27" fill="${skin}"/>` +
      back + eyes +
      `<circle cx="27" cy="68" r="5" fill="#ff7b86" opacity=".28"/><circle cx="73" cy="68" r="5" fill="#ff7b86" opacity=".28"/>` +
      mouth + front + `</svg>`;
    FIG[key] = svg;
    return svg;
  }

  /* little round head for the opponents' avatars */
  function avatarSVG(i) {
    const color = COLORS[(i * 2 + 1) % COLORS.length];
    const p = PAL[color];
    const skin = SKIN[(i * 2 + 1) % SKIN.length];
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="48" fill="${p.c}"/>` +
      `<rect x="20" y="24" width="60" height="56" rx="24" fill="${skin}"/>` +
      `<path d="M16 50 Q14 8 50 8 Q86 8 84 50 Q76 28 50 27 Q24 28 16 50Z" fill="${p.d}"/>` +
      `<ellipse cx="38" cy="54" rx="5.5" ry="7.5" fill="#17171c"/><ellipse cx="62" cy="54" rx="5.5" ry="7.5" fill="#17171c"/>` +
      `<circle cx="40" cy="51" r="2" fill="#fff"/><circle cx="64" cy="51" r="2" fill="#fff"/>` +
      `<path d="M43 68 Q50 74 57 68" stroke="#6b2d1f" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  }

  /* the Mover: a golden hero figure with a star mask */
  function moverSVG() {
    return `<svg viewBox="0 0 100 130" aria-hidden="true">` +
      `<ellipse cx="50" cy="123" rx="36" ry="6" fill="#222"/><ellipse cx="50" cy="119" rx="36" ry="6" fill="#444"/>` +
      `<path d="M22 118 L27 90 Q50 80 73 90 L78 118 Z" fill="#23304a"/>` +
      `<ellipse cx="23" cy="102" rx="7.5" ry="11" fill="#23304a"/><ellipse cx="77" cy="102" rx="7.5" ry="11" fill="#23304a"/>` +
      `<path d="M50 93 L53.5 101 L62 102 L55.5 108 L57.5 116 L50 111.5 L42.5 116 L44.5 108 L38 102 L46.5 101Z" fill="#f6c22d"/>` +
      `<ellipse cx="50" cy="87" rx="30" ry="5.5" fill="rgba(0,0,0,.25)"/>` +
      `<rect x="16" y="21" width="68" height="64" rx="27" fill="#f6c22d"/>` +
      `<path d="M16 50 Q50 38 84 50 L84 70 Q50 80 16 70Z" fill="#23304a"/>` +
      `<path d="M50 16 L55 26 L66 27 L58 34 L60 45 L50 39 L40 45 L42 34 L34 27 L45 26Z" fill="#fff" opacity=".0"/>` +
      `<ellipse cx="37" cy="60" rx="11" ry="12" fill="#fff"/><ellipse cx="63" cy="60" rx="11" ry="12" fill="#fff"/>` +
      `<ellipse cx="37" cy="60" rx="6" ry="8" fill="#17171c"/><ellipse cx="63" cy="60" rx="6" ry="8" fill="#17171c"/>` +
      `<circle cx="39.2" cy="57" r="2.2" fill="#fff"/><circle cx="65.2" cy="57" r="2.2" fill="#fff"/>` +
      `<path d="M50 9 L53 17 L61.5 17.5 L55 23 L57 31 L50 26.5 L43 31 L45 23 L38.5 17.5 L47 17Z" fill="#e8404e"/>` +
      `<path d="M43 74 Q50 80 57 74" stroke="#6b2d1f" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`;
  }

  /* the grey "take a mover" silhouette printed on the 1 cards */
  function moverSymbolSVG() {
    return `<svg viewBox="0 0 30 40" aria-hidden="true"><circle cx="15" cy="12" r="9.5" fill="#9aa3ad"/>` +
      `<path d="M3 39 Q5 22 15 22 Q25 22 27 39Z" fill="#9aa3ad"/>` +
      `<text x="15" y="16.5" text-anchor="middle" font-size="13" font-weight="900" fill="#fff" font-family="Arial,sans-serif">?</text></svg>`;
  }

  /* ---- Power icons (viewBox 0 0 72 44) ---------------------------------- */
  const miniCard = (x, y, fill, label, rot) =>
    `<g transform="rotate(${rot || 0} ${x + 7} ${y + 10})"><rect x="${x}" y="${y}" width="14" height="20" rx="2.5" fill="${fill}" stroke="#fff" stroke-width="1.5"/>` +
    (label ? `<text x="${x + 7}" y="${y + 14.5}" text-anchor="middle" font-size="10" font-weight="900" fill="#fff" font-family="Arial,sans-serif">${label}</text>` : '') + `</g>`;
  const trophy = (x, y) =>
    `<g transform="translate(${x} ${y})"><path d="M-8 -9 H8 V0 Q8 7 0 7 Q-8 7 -8 0Z" fill="#aab2bd"/><path d="M-8 -6 H-13 Q-13 2 -7 3 M8 -6 H13 Q13 2 7 3" stroke="#aab2bd" stroke-width="2.4" fill="none"/><rect x="-2" y="6" width="4" height="6" fill="#aab2bd"/><rect x="-7" y="11" width="14" height="4" rx="1.5" fill="#aab2bd"/></g>`;
  const numBox = (x, y, t) =>
    `<rect x="${x}" y="${y}" width="15" height="20" rx="2.5" fill="#17171c"/><text x="${x + 7.5}" y="${y + 15}" text-anchor="middle" font-size="14" font-weight="900" fill="#fff" font-family="Arial,sans-serif">${t}</text>`;
  const qBox = (x, y) =>
    `<rect x="${x}" y="${y}" width="15" height="20" rx="2.5" fill="#fff" stroke="#17171c" stroke-width="2"/><text x="${x + 7.5}" y="${y + 15.5}" text-anchor="middle" font-size="14" font-weight="900" fill="#17171c" font-family="Arial,sans-serif">?</text>`;
  const playArrow = (x, y) => `<circle cx="${x}" cy="${y}" r="10" fill="#aab2bd"/><path d="M${x - 3} ${y - 5.5} L${x + 6} ${y} L${x - 3} ${y + 5.5}Z" fill="#fff"/>`;
  const cloud = (x, y, inner) =>
    `<g transform="translate(${x} ${y})"><path d="M4 22 Q-4 22 -2 14 Q-4 6 5 6 Q8 -2 17 2 Q24 -4 30 3 Q39 2 38 11 Q44 17 36 22Z" fill="#e9ecf2" stroke="#aab2bd" stroke-width="1.5"/>${inner}</g>`;

  function powerIcon(id) {
    let g = '';
    switch (id) {
      case 'blue3':  g = miniCard(8, 10, PAL.blue.c, '', -14) + miniCard(17, 8, PAL.blue.c, '', 0) + miniCard(26, 10, PAL.blue.c, '', 14) + trophy(55, 17); break;
      case 'red3':   g = miniCard(8, 10, PAL.red.c, '', -14) + miniCard(17, 8, PAL.red.c, '', 0) + miniCard(26, 10, PAL.red.c, '', 14) + trophy(55, 17); break;
      case 'n268':   g = numBox(4, 10, '2') + numBox(21, 10, '6') + numBox(38, 10, '8') + trophy(63, 17); break;
      case 'redwild': g = miniCard(10, 10, PAL.red.c, '', 0) + `<text x="36" y="26" text-anchor="middle" font-size="18" font-weight="900" fill="#17171c" font-family="Arial,sans-serif">=</text>` + qBox(46, 10); break;
      case 'threewild': g = numBox(10, 10, '3') + `<text x="36" y="26" text-anchor="middle" font-size="18" font-weight="900" fill="#17171c" font-family="Arial,sans-serif">=</text>` + qBox(46, 10); break;
      case 'guesscolor':
        g = cloud(2, 5, `<rect x="8" y="9" width="5" height="9" fill="${PAL.red.c}"/><rect x="14" y="9" width="5" height="9" fill="${PAL.yellow.c}"/><rect x="20" y="9" width="5" height="9" fill="${PAL.green.c}"/><rect x="26" y="9" width="5" height="9" fill="${PAL.blue.c}"/>`) + playArrow(60, 22); break;
      case 'guessnum':
        g = cloud(2, 5, `<text x="20" y="19" text-anchor="middle" font-size="14" font-weight="900" fill="#17171c" font-family="Arial,sans-serif">#?</text>`) + playArrow(60, 22); break;
      case 'swap':
        g = miniCard(6, 14, PAL.purple.c, '', -8) + miniCard(50, 14, PAL.green.c, '', 8) + `<path d="M24 14 Q36 2 48 12 M44 8 L48 12 L43 15" stroke="#17171c" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M48 32 Q36 44 24 34 M28 38 L24 34 L29 31" stroke="#17171c" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; break;
      case 'seven':
        g = numBox(6, 10, '7') + miniCard(26, 12, '#9aa3ad', '', -8) + miniCard(32, 12, '#7d8793', '', 0) + playArrow(60, 22); break;
      case 'pass':
        g = miniCard(8, 16, PAL.yellow.c, '', -10) + miniCard(48, 16, PAL.blue.c, '', 10) + `<path d="M22 12 Q36 -2 50 12 M45 6 L50 12 L43 14" stroke="#17171c" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`; break;
      default: g = '';
    }
    return `<svg viewBox="0 0 72 44" aria-hidden="true">${g}</svg>`;
  }

  return { PAL, NAMES, charName, figureSVG, avatarSVG, moverSVG, moverSymbolSVG, powerIcon };
});
