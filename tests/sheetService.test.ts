import assert from 'node:assert/strict';
import { parseSheetRows } from '../src/services/sheetService';

const rows: string[][] = [
  ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['', 'Monday', '', '', 'Tuesday', '', '', 'Wednesday', '', '', 'Thursday', '', '', 'Friday', '', '', 'Saturday', '', ''],
  ['', '03/09', '', '', '03/10', '', '', '03/11', '', '', '03/12', '', '', '03/13', '', '', '03/14', '', ''],
  ['Doctor', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['JC', 'D', '', '', 'OFF', '', '', 'D', '', '', 'D', '', '', '', '', '', '', '', ''],
  ['Tech', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
  ['JC', 'LD', '7:45a', '4:45p', 'D', '12:30p', '4:45p', 'REQ', '', '', 'LD', '7:45a', '7:45p', 'OFF', '', '', '', '', ''],
  ['Notes', 'SW late clinic', '', '', '', '', '', '', '', '', '', '', '', 'SERUM TEARS', '', '', '', '', ''],
];

const schedules = parseSheetRows(rows);
const monday = schedules[0];
const tuesday = schedules[1];
const friday = schedules[4];

assert.equal(schedules.length, 6);
assert.equal(monday.notes, 'SW late clinic');
assert.equal(friday.notes, 'SERUM TEARS');

const mondayDoctor = monday.locations.Derry.find(assignment => assignment.person === 'JC' && assignment.isDoctor);
const mondayTech = monday.locations.Londonderry.find(assignment => assignment.person === 'JC' && !assignment.isDoctor);
const tuesdayDoctorOff = tuesday.locations.Off.find(assignment => assignment.person === 'JC' && assignment.isDoctor);
const tuesdayTech = tuesday.locations.Derry.find(assignment => assignment.person === 'JC' && !assignment.isDoctor);

assert.ok(mondayDoctor, 'JC in the Doctor section should parse as a doctor in Derry');
assert.ok(mondayTech, 'JC in the Tech section should parse as a technician in Londonderry');
assert.ok(tuesdayDoctorOff, 'OFF status should route doctors to the Off location');
assert.ok(tuesdayTech, 'Tech section should keep JC as a technician even when JC is also a doctor ID');
assert.equal(tuesdayTech?.startTime, '12:30p');
assert.equal(tuesdayTech?.endTime, '4:45p');

console.log('sheetService parser regression tests passed');
