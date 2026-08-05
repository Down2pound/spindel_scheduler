import assert from 'node:assert/strict';
import { parseLocalScheduleCommand } from '../src/services/localCommandService';

assert.deepEqual(parseLocalScheduleCommand('Move LT from Derry to Windham on Monday'), {
  action: 'MOVE', person: 'LT', fromLocation: 'Derry', toLocation: 'Windham', day: 'Monday',
  reasoning: 'Parsed locally using the strict move-command format.',
});
assert.equal(parseLocalScheduleCommand('Who should cover Windham?'), null);
assert.equal(parseLocalScheduleCommand('Move someone to Windham'), null);
assert.equal(parseLocalScheduleCommand('add ab to Raymond')?.action, 'ADD');
assert.equal(parseLocalScheduleCommand('remove AB from Raymond on Friday')?.day, 'Friday');
console.log('local command parser tests passed');
