import assert from 'node:assert/strict';
import {
  createScheduleChangeRequest,
  removeTechnicianFromRoster,
  upsertTechnicianInRoster,
} from '../src/services/technicianRosterService';

const roster: Record<string, { fullRefracting: boolean; refractingNote?: string }> = {
  AB: { fullRefracting: true },
  CD: { fullRefracting: false, refractingNote: 'Training with DR' },
};

const added = upsertTechnicianInRoster(roster, {
  initials: ' ef ',
  fullRefracting: false,
  refractingNote: '',
});

assert.equal(added.EF.fullRefracting, false);
assert.equal(added.EF.refractingNote, 'Does not refract yet');
assert.equal(roster.EF, undefined, 'upsert should not mutate the current roster');

const removed = removeTechnicianFromRoster(added, ' cd ');
assert.equal(removed.CD, undefined);
assert.ok(added.CD, 'remove should not mutate the current roster');

const request = createScheduleChangeRequest({
  requester: ' EF ',
  dayName: 'Wednesday',
  details: ' move me later ',
});

assert.equal(request.requester, 'EF');
assert.equal(request.dayName, 'Wednesday');
assert.equal(request.details, 'move me later');
assert.equal(request.status, 'open');
assert.ok(request.id.startsWith('req_'));

console.log('technician roster/request tests passed');
