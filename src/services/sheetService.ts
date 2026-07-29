import Papa from 'papaparse';

export interface SheetAssignment {
  person: string;
  role: string;
  startTime: string;
  endTime: string;
  location: string;
  isDoctor: boolean;
  status?: string;
}

export interface SheetDaySchedule {
  date: string;
  dayName: string;
  locations: Record<string, SheetAssignment[]>;
  notes?: string;
}

type RoleHint = 'Doctor' | 'Technician' | null;

const DOCTOR_IDS = new Set([
  'DV', 'DS', 'GS', 'MF', 'DR', 'MG', 'BN', 'NL', 'JO', 'JN', 'JC', 'SW', 'WOOD',
  'GUENENA', 'RAMSEY', 'CHANG', 'V', 'S', 'F', 'G', 'N', 'O', 'J'
]);

const LOCATION_CODES: Record<string, string> = {
  D: 'Derry',
  LD: 'Londonderry',
  W: 'Windham',
  B: 'Bedford',
  R: 'Raymond',
  S: 'Surgery',
};

const OFF_STATUSES = new Set(['OFF']);
const FLOATING_STATUSES = new Set([
  'ADMIN', 'ADM', 'LASIK', 'BIO', 'VF', 'OCT', 'OUT', 'REQ', 'PREOPS',
  'PREOPS/ADMIN', 'SERUM TEARS', 'MEETING', 'LUNCH', 'FLOAT', 'FLOATING'
]);

const DAY_START_COLS = [1, 4, 7, 10, 13, 16];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const normalize = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizeCode = (value: string): string => normalize(value).toUpperCase();

const isTime = (value: string): boolean => {
  const val = normalize(value).toLowerCase();
  return /^(?:\d{1,2})(?::\d{2})?\s*(?:a|am|p|pm)?$/.test(val);
};

const getRoleSection = (value: string): RoleHint | undefined => {
  const label = normalizeCode(value);
  if (/^(DOCTOR|DOCTORS|MD|MDS)$/.test(label)) return 'Doctor';
  if (/^(TECH|TECHS|TECHNICIAN|TECHNICIANS)$/.test(label)) return 'Technician';
  return undefined;
};

const inferRole = (personId: string, roleHint: RoleHint): RoleHint => {
  if (roleHint) return roleHint;
  const upper = normalizeCode(personId);
  if (upper.startsWith('DR.') || upper.startsWith('DR ')) return 'Doctor';
  return DOCTOR_IDS.has(upper) ? 'Doctor' : 'Technician';
};

const resolveLocationFromStatus = (status: string): string => {
  const upperStatus = normalizeCode(status);
  const parts = upperStatus.split(/[\s/,]+/).filter(Boolean);

  if (parts.some(part => OFF_STATUSES.has(part))) return 'Off';
  if (FLOATING_STATUSES.has(upperStatus) || parts.some(part => FLOATING_STATUSES.has(part))) return 'Floating';

  for (const part of parts) {
    if (LOCATION_CODES[part]) return LOCATION_CODES[part];
  }
  return '';
};

const defaultLocations = (): Record<string, SheetAssignment[]> => ({
  Derry: [],
  Londonderry: [],
  Windham: [],
  Bedford: [],
  Raymond: [],
  Surgery: [],
  Off: [],
  Floating: [],
});

export function parseSheetRows(data: string[][]): SheetDaySchedule[] {
  if (!data || data.length < 5) {
    throw new Error('Invalid sheet data format');
  }

  const schedules: SheetDaySchedule[] = [];
  let roleHint: RoleHint = null;

  for (let i = 0; i < DAY_START_COLS.length; i++) {
    const col = DAY_START_COLS[i];
    const dayName = normalize(data[1]?.[col] || '') || DAY_NAMES[i];
    const date = normalize(data[2]?.[col] || '');

    const daySchedule: SheetDaySchedule = {
      date,
      dayName,
      locations: defaultLocations(),
      notes: '',
    };

    roleHint = null;

    for (let row = 3; row < Math.min(data.length, 100); row++) {
      const personId = normalize(data[row]?.[0] || '');
      if (!personId) continue;

      const section = getRoleSection(personId);
      if (section !== undefined) {
        roleHint = section;
        continue;
      }

      if (normalizeCode(personId) === 'NOTES') {
        daySchedule.notes = normalize(data[row]?.[col] || '');
        continue;
      }

      const vals = [
        normalize(data[row]?.[col] || ''),
        normalize(data[row]?.[col + 1] || ''),
        normalize(data[row]?.[col + 2] || ''),
      ];

      if (vals.every(v => !v)) continue;

      let location = '';
      let status = '';
      let startTime = '';
      let endTime = '';

      for (const val of vals) {
        if (!val) continue;
        const upper = normalizeCode(val);

        if (LOCATION_CODES[upper]) {
          location = LOCATION_CODES[upper];
        } else if (isTime(val)) {
          if (!startTime) startTime = val;
          else if (!endTime) endTime = val;
        } else {
          status = status ? `${status} / ${val}` : val;
        }
      }

      if (!location && status) {
        location = resolveLocationFromStatus(status);
      }

      if (startTime || endTime || location || status) {
        const role = inferRole(personId, roleHint);
        const assignment: SheetAssignment = {
          person: personId,
          role: role || 'Technician',
          startTime,
          endTime,
          location: location || 'Floating',
          isDoctor: role === 'Doctor',
          status,
        };

        const targetLoc = assignment.location;
        if (!daySchedule.locations[targetLoc]) {
          daySchedule.locations[targetLoc] = [];
        }
        daySchedule.locations[targetLoc].push(assignment);
      }
    }

    schedules.push(daySchedule);
  }

  return schedules;
}

export async function fetchSheetData(url: string, gid?: string): Promise<SheetDaySchedule[]> {
  let csvUrl = url;
  if (url.includes('docs.google.com/spreadsheets')) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    }
  }

  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(csvUrl, {
      download: true,
      skipEmptyLines: false,
      complete: (results) => {
        try {
          resolve(parseSheetRows(results.data));
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}
