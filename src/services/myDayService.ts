import { SheetAssignment, SheetDaySchedule } from './sheetService';
import { canonicalizeTechnicianInitials } from './technicianRosterService';

export interface MyDaySummary {
  day: SheetDaySchedule;
  locationId: string;
  assignment: SheetAssignment;
  doctors: SheetAssignment[];
  technicians: SheetAssignment[];
  hours: string;
}

const formatHours = (assignment: SheetAssignment) => {
  if (!assignment.startTime && !assignment.endTime) return 'Hours not listed';
  if (!assignment.endTime) return assignment.startTime;
  if (!assignment.startTime) return assignment.endTime;
  return `${assignment.startTime} - ${assignment.endTime}`;
};

export function getMyDaySummary(day: SheetDaySchedule, technicianId: string): MyDaySummary | null {
  const selectedTech = canonicalizeTechnicianInitials(technicianId);
  if (!selectedTech) return null;

  for (const [locationId, assignments] of Object.entries(day.locations)) {
    const assignment = assignments.find(item =>
      !item.isDoctor && canonicalizeTechnicianInitials(item.person) === selectedTech
    );
    if (!assignment) continue;

    return {
      day,
      locationId,
      assignment,
      doctors: assignments.filter(item => item.isDoctor),
      technicians: assignments.filter(item =>
        !item.isDoctor && canonicalizeTechnicianInitials(item.person) !== selectedTech
      ),
      hours: formatHours(assignment),
    };
  }

  return null;
}
