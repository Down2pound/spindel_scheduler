import assert from 'node:assert/strict';
import {
  buildRecentTechnicianRoster,
  canonicalizeTechnicianInitials,
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
assert.equal(canonicalizeTechnicianInitials('DS_T'), 'DSJ');

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

const currentRoster = buildRecentTechnicianRoster([
  {
    date: '8/12/26',
    dayName: 'Wednesday',
    locations: {
      Derry: [
        { person: 'DS_T', role: 'Technician', startTime: '', endTime: '', location: 'Derry', isDoctor: false },
        { person: 'JC', role: 'Technician', startTime: '', endTime: '', location: 'Derry', isDoctor: false },
      ],
    },
  },
  {
    date: '7/20/26',
    dayName: 'Monday',
    locations: {
      Derry: [
        { person: 'OLD', role: 'Technician', startTime: '', endTime: '', location: 'Derry', isDoctor: false },
      ],
    },
  },
], {
  DSJ: { fullRefracting: false, refractingNote: 'Does not refract yet' },
}, {
  today: new Date('2026-08-12T12:00:00'),
  doctorIds: ['JC'],
});

assert.deepEqual(Object.keys(currentRoster), ['DSJ', 'JC']);
assert.equal(currentRoster.DSJ.refractingNote, 'Does not refract yet');

console.log('technician roster/request tests passed');
