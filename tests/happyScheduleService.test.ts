import assert from 'node:assert/strict';
import { scoreTechnicianMove } from '../src/services/happyScheduleService';

const favoriteAndClose = scoreTechnicianMove('AA', 'Derry', 'Windham', {
  initials: 'AA', ownerUid: 'test', officeRanking: ['Windham', 'Derry', 'Bedford', 'Raymond', 'Londonderry'],
  commuteMiles: { Derry: 15, Windham: 8 },
});
const dislikedAndFar = scoreTechnicianMove('BB', 'Derry', 'Windham', {
  initials: 'BB', ownerUid: 'test', officeRanking: ['Derry', 'Bedford', 'Raymond', 'Londonderry', 'Windham'],
  commuteMiles: { Derry: 5, Windham: 30 },
});

assert.ok(favoriteAndClose.score > dislikedAndFar.score);
assert.equal(favoriteAndClose.preferenceRank, 1);
assert.equal(favoriteAndClose.addedMiles, -7);
assert.equal(dislikedAndFar.preferenceRank, 5);
console.log('happy schedule scoring tests passed');
