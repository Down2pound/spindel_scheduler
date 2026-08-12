import { OFFICE_LOCATIONS } from '../constants/locations';
import { SheetDaySchedule } from './sheetService';
import { TechnicianProfile } from './technicianProfileService';
import { canonicalizeTechnicianInitials } from './technicianRosterService';

export interface MoveRecommendation {
  technician: string;
  fromLocation: string;
  toLocation: string;
  score: number;
  preferenceRank: number | null;
  destinationMiles: number | null;
  addedMiles: number | null;
  reason: string;
}

const DEFAULT_PREFERENCE_SCORE = 20;

export function scoreTechnicianMove(
  technician: string,
  fromLocation: string,
  toLocation: string,
  profile?: TechnicianProfile,
): MoveRecommendation {
  const rankIndex = profile?.officeRanking?.indexOf(toLocation) ?? -1;
  const preferenceRank = rankIndex >= 0 ? rankIndex + 1 : null;
  const preferenceScore = preferenceRank ? Math.max(0, 60 - ((preferenceRank - 1) * 12)) : DEFAULT_PREFERENCE_SCORE;
  const destinationMiles = profile?.commuteMiles?.[toLocation] ?? null;
  const currentMiles = profile?.commuteMiles?.[fromLocation] ?? null;
  const addedMiles = destinationMiles !== null && currentMiles !== null ? destinationMiles - currentMiles : null;
  const commuteScore = destinationMiles === null ? 12 : Math.max(0, 30 - destinationMiles);
  const disruptionScore = addedMiles === null ? 5 : Math.max(0, 10 - Math.max(0, addedMiles));
  const score = Math.round(preferenceScore + commuteScore + disruptionScore);

  const details = [
    preferenceRank ? `#${preferenceRank} office choice` : 'preference not set',
    destinationMiles !== null ? `${destinationMiles} mi each way` : 'drive not set',
  ];
  if (addedMiles !== null) details.push(addedMiles <= 0 ? `${Math.abs(addedMiles)} mi shorter` : `${addedMiles} mi farther`);

  return { technician, fromLocation, toLocation, score, preferenceRank, destinationMiles, addedMiles, reason: details.join(' · ') };
}

export function rankMoveCandidates(
  day: SheetDaySchedule,
  destination: string,
  profiles: Record<string, TechnicianProfile>,
): MoveRecommendation[] {
  const targets = new Map(OFFICE_LOCATIONS.map(office => [office.id, office.targetTechs]));
  const candidates: MoveRecommendation[] = [];

  Object.entries(day.locations).forEach(([fromLocation, assignments]) => {
    if (fromLocation === destination || fromLocation === 'Off' || fromLocation === 'Admin' || fromLocation === 'Surgery') return;
    const techs = assignments.filter(assignment => !assignment.isDoctor);
    const canReleaseStaff = fromLocation === 'Floating' || techs.length > (targets.get(fromLocation) || 0);
    if (!canReleaseStaff) return;

    techs.forEach(assignment => {
      const status = assignment.status?.toUpperCase();
      if (fromLocation === 'Floating' && ['OUT', 'OFF', 'VF', 'BIO', 'REQ'].includes(status || '')) return;
      const technician = canonicalizeTechnicianInitials(assignment.person);
      candidates.push(scoreTechnicianMove(technician, fromLocation, destination, profiles[technician]));
    });
  });

  return candidates.sort((a, b) => b.score - a.score || a.technician.localeCompare(b.technician));
}
