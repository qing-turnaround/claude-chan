// Holiday dress-up: which holiday, if any, is on today. Halloween and Christmas have fixed dates; Lunar New Year moves,
// so it's listed per year, from a week before New Year's Eve to the Lantern Festival.
const FIXED = [['halloween', '10-24', '11-01'], ['xmas', '12-18', '12-26']];
const CNY = { 2027: ['01-30', '02-20'], 2028: ['01-18', '02-09'], 2029: ['02-05', '02-27'], 2030: ['01-26', '02-17'], 2031: ['01-15', '02-06'] };
const LIST = ['halloween', 'xmas', 'cny'];

function current(d = new Date()) {
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (const [k, a, b] of FIXED) if (md >= a && md <= b) return k;
  const c = CNY[d.getFullYear()];
  if (c && md >= c[0] && md <= c[1]) return 'cny';
  return null;
}

module.exports = { current, LIST };
