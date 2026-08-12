import assert from 'node:assert/strict';
import { DEFAULT_SHIFT, resolveShiftForAssignment } from '../src/services/shiftRuleService';

assert.deepEqual(resolveShiftForAssignment({
  person: 'AB',
  dayName: 'Monday',
  locationId: 'Derry',
  rules: [],
}), DEFAULT_SHIFT);

assert.deepEqual(resolveShiftForAssignment({
  person: 'LT',
  dayName: 'Wednesday',
  locationId: 'Derry',
  rules: [
    { id: '1', technician: 'LT', dayName: 'Wednesday', locationId: 'Derry', startTime: '7:15a', endTime: '7:45p' },
  ],
}), { startTime: '7:15a', endTime: '7:45p' });

assert.deepEqual(resolveShiftForAssignment({
  person: 'LT',
  dayName: 'Thursday',
  locationId: 'Derry',
  rules: [
    { id: '1', technician: 'LT', dayName: 'Wednesday', locationId: 'Derry', startTime: '7:15a', endTime: '7:45p' },
  ],
}), DEFAULT_SHIFT);

console.log('shift rule tests passed');
