import { Technician } from '../constants/technicians';

export const SCHEDULE_CHANGE_REQUESTS_STORAGE_KEY = 'spindelScheduleChangeRequests';

export interface TechnicianRosterUpdate {
  initials: string;
  fullRefracting: boolean;
  refractingNote?: string;
}

export interface ScheduleChangeRequestInput {
  requester: string;
  dayName: string;
  details: string;
}

export interface ScheduleChangeRequest {
  id: string;
  requester: string;
  dayName: string;
  details: string;
  status: 'open' | 'done';
  createdAt: string;
}

export function normalizeTechnicianInitials(initials: string) {
  return initials.trim().toUpperCase().replace(/\s+/g, '_');
}

export function upsertTechnicianInRoster(
  roster: Record<string, Technician>,
  update: TechnicianRosterUpdate
): Record<string, Technician> {
  const initials = normalizeTechnicianInitials(update.initials);
  if (!initials) {
    throw new Error('Technician initials are required.');
  }

  const refractingNote = update.fullRefracting
    ? undefined
    : update.refractingNote?.trim() || 'Does not refract yet';

  return {
    ...roster,
    [initials]: {
      ...(roster[initials] || {}),
      fullRefracting: update.fullRefracting,
      ...(refractingNote ? { refractingNote } : {}),
    },
  };
}

export function removeTechnicianFromRoster(
  roster: Record<string, Technician>,
  initials: string
): Record<string, Technician> {
  const normalized = normalizeTechnicianInitials(initials);
  const { [normalized]: _removed, ...remaining } = roster;
  return remaining;
}

export function createScheduleChangeRequest(input: ScheduleChangeRequestInput): ScheduleChangeRequest {
  const requester = normalizeTechnicianInitials(input.requester || 'Admin');
  const details = input.details.trim();
  if (!details) {
    throw new Error('Schedule change details are required.');
  }

  return {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    requester: requester || 'ADMIN',
    dayName: input.dayName,
    details,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
}
