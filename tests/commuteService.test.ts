import assert from 'node:assert/strict';
import { calculateOfficeCommutes, rankOfficesByCommute } from '../src/services/commuteService';

const homeNearDerry = { lat: 42.8806, lng: -71.3273 };
const miles = calculateOfficeCommutes(homeNearDerry);
const ranked = rankOfficesByCommute(homeNearDerry);

assert.ok(miles.Derry < 2, 'Derry should be close to a Derry home pin');
assert.ok(miles.Bedford > miles.Derry, 'Bedford should be farther than Derry from a Derry home pin');
assert.equal(ranked[0], 'Derry');
assert.equal(new Set(ranked).size, ranked.length, 'ranked offices should not duplicate locations');

console.log('commute distance tests passed');
