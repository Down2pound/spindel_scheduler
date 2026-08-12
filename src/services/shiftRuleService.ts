import { canonicalizeTechnicianInitials } from './technicianRosterService';

export const SHIFT_RULES_STORAGE_KEY = 'spindelShiftRules';
export const DEFAULT_SHIFT = { startTime: '7:45a', endTime: '4:45p' };

export interface ShiftRule {
  id: string;
  technician: string;
  dayName: string;
  locationId: string;
  startTime: string;
  endTime: string;
}

export function resolveShiftForAssignment({
  person,
  dayName,
  locationId,
  rules,
}: {
  person: string;
  dayName: string;
  locationId: string;
  rules: ShiftRule[];
}) {
  const technician = canonicalizeTechnicianInitials(person);
  const day = dayName.toLowerCase();
  const location = locationId.toLowerCase();
  const rule = rules.find(candidate =>
    canonicalizeTechnicianInitials(candidate.technician) === technician &&
    candidate.dayName.toLowerCase() === day &&
    candidate.locationId.toLowerCase() === location
  );

  return rule
    ? { startTime: rule.startTime || DEFAULT_SHIFT.startTime, endTime: rule.endTime || DEFAULT_SHIFT.endTime }
    : DEFAULT_SHIFT;
}
