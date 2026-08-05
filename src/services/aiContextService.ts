import { OFFICE_LOCATIONS } from '../constants/locations';
import { Doctor } from '../constants/doctors';
import { Technician } from '../constants/technicians';
import { rankMoveCandidates } from './happyScheduleService';
import { SheetDaySchedule } from './sheetService';
import { TechnicianProfile } from './technicianProfileService';

export function compactConstraints<T extends Doctor | Technician>(items: Record<string, T>) {
  return Object.fromEntries(Object.entries(items).filter(([, value]) => Object.keys(value).length > 0));
}

export function compactScheduleDay(day: SheetDaySchedule) {
  return {
    day: day.dayName,
    date: day.date,
    notes: day.notes || undefined,
    locations: Object.fromEntries(Object.entries(day.locations).map(([location, assignments]) => [
      location,
      assignments.map(assignment => ({
        p: assignment.person,
        r: assignment.isDoctor ? 'D' : 'T',
        s: assignment.startTime || undefined,
        e: assignment.endTime || undefined,
        x: assignment.status || undefined,
      })),
    ])),
  };
}

export function compactProfiles(profiles: Record<string, TechnicianProfile>) {
  return Object.fromEntries(Object.entries(profiles).map(([initials, profile]) => [initials, {
    rank: profile.officeRanking,
    miles: profile.commuteMiles,
  }]));
}

export function buildWeeklyAiContext(scheduleData: SheetDaySchedule[], profiles: Record<string, TechnicianProfile>) {
  const targets = Object.fromEntries(OFFICE_LOCATIONS.map(office => [office.id, office.targetTechs]));
  const moveOptions = scheduleData.flatMap(day => OFFICE_LOCATIONS.flatMap(office => {
    const techCount = (day.locations[office.id] || []).filter(assignment => !assignment.isDoctor).length;
    if (techCount >= office.targetTechs) return [];
    return [{
      day: day.dayName,
      destination: office.id,
      shortage: office.targetTechs - techCount,
      candidates: rankMoveCandidates(day, office.id, profiles).slice(0, 3).map(candidate => ({
        tech: candidate.technician,
        from: candidate.fromLocation,
        score: candidate.score,
        rank: candidate.preferenceRank,
        miles: candidate.destinationMiles,
        added: candidate.addedMiles,
      })),
    }];
  }));

  return {
    targets,
    schedule: scheduleData.map(compactScheduleDay),
    profiles: compactProfiles(profiles),
    moveOptions,
  };
}
