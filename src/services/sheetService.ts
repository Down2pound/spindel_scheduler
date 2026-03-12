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

const DOCTOR_IDS = ['DV', 'DS', 'GS', 'MF', 'DR', 'MG', 'BN', 'NL', 'JO', 'JN', 'JC', 'SW', 'Wood', 'GUENENA', 'RAMSEY', 'CHANG', 'V', 'S', 'F', 'G', 'N', 'O', 'J'];

// Helper to determine if a string is a time (e.g. "7:15a", "12:30p")
const isTime = (val: string): boolean => {
  if (!val) return false;
  return /^\d{1,2}(:\d{2})?[ap]?$/i.test(val) || val.toLowerCase().includes('a') || val.toLowerCase().includes('p') || val.includes(':');
};

// Helper to determine if a person is a doctor
const isDoctor = (personId: string, rowIdx: number): boolean => {
  if (!personId) return false;
  const upper = personId.toUpperCase();
  // User specific rule: Red JC = Dr. Chang, Black JC = Technician.
  // Dr. Chang (JC) only works on Thursdays in Derry.
  if (upper === 'JC') return false; // Default to technician for this week as per user request
  if (DOCTOR_IDS.includes(upper)) return true;
  // Also check if it looks like a name (e.g. "Dr. ...")
  if (upper.startsWith('DR.') || upper.startsWith('DR ')) return true;
  return false;
};

export async function fetchSheetData(url: string, gid?: string): Promise<SheetDaySchedule[]> {
  let csvUrl = url;
  if (url.includes('docs.google.com/spreadsheets')) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) {
      csvUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    }
  }

  return new Promise((resolve, reject) => {
    Papa.parse(csvUrl, {
      download: true,
      complete: (results) => {
        const data = results.data as string[][];
        if (!data || data.length < 5) {
          reject(new Error('Invalid sheet data format'));
          return;
        }

        const schedules: SheetDaySchedule[] = [];
        const dayStartCols = [1, 4, 7, 10, 13, 16];
        const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        const locMap: Record<string, string> = {
          'D': 'Derry',
          'LD': 'Londonderry',
          'W': 'Windham',
          'B': 'Bedford',
          'R': 'Raymond'
        };

        const statuses = ['OFF', 'ADMIN', 'SURGERY', 'LASIK', 'BIO', 'VF', 'OCT', 'OUT', 'REQ', 'PREOPS/ADMIN', 'SERUM TEARS', 'MEETING', 'LUNCH'];

        for (let i = 0; i < dayStartCols.length; i++) {
          const col = dayStartCols[i];
          const dayName = data[1]?.[col]?.trim() || dayNames[i];
          const date = data[2]?.[col]?.trim() || '';
          
          const daySchedule: SheetDaySchedule = {
            date,
            dayName,
            locations: {
              'Derry': [], 'Londonderry': [], 'Windham': [], 'Bedford': [], 'Raymond': [], 'Floating': []
            },
            notes: ''
          };

          // Parse rows 3 to 100 to be safe
          for (let row = 3; row < Math.min(data.length, 100); row++) {
            const personId = data[row]?.[0]?.trim();
            if (!personId || personId.toLowerCase() === 'doctor' || personId.toLowerCase() === 'tech') continue;

            if (personId.toLowerCase() === 'notes') {
              daySchedule.notes = data[row]?.[col]?.trim() || '';
              continue;
            }

            const vals = [
              data[row]?.[col]?.trim() || '',
              data[row]?.[col + 1]?.trim() || '',
              data[row]?.[col + 2]?.trim() || ''
            ];

            if (vals.every(v => !v)) continue;

            let location = '';
            let status = '';
            let startTime = '';
            let endTime = '';

            // Identify what's in the columns
            vals.forEach(val => {
              if (!val) return;
              const upper = val.toUpperCase();
              
              if (locMap[upper]) {
                location = locMap[upper];
              } else if (statuses.some(s => upper.includes(s))) {
                status = val;
              } else if (isTime(val)) {
                if (!startTime) startTime = val;
                else if (!endTime) endTime = val;
              } else if (val.length <= 3 && !isTime(val)) {
                // Potential location code not in map or just noise
                if (locMap[upper]) location = locMap[upper];
              }
            });

            // Fallback for location if not explicitly found but status implies one
            if (!location && status) {
              // Check if any part of the status matches a location code
              const parts = status.split('/').map(p => p.trim().toUpperCase());
              parts.forEach(p => {
                if (locMap[p]) location = locMap[p];
              });
            }

            if (startTime || endTime || location || status) {
              const isDoc = isDoctor(personId, row);
              const assignment: SheetAssignment = {
                person: personId,
                role: isDoc ? 'Doctor' : 'Technician',
                startTime,
                endTime,
                location: location || 'Floating',
                isDoctor: isDoc,
                status: status
              };

              const targetLoc = location || 'Floating';
              if (!daySchedule.locations[targetLoc]) {
                daySchedule.locations[targetLoc] = [];
              }
              daySchedule.locations[targetLoc].push(assignment);
            }
          }
          
          schedules.push(daySchedule);
        }

        resolve(schedules);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
