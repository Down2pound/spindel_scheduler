export interface Doctor {
  name: string;
  fixedSchedule?: { day: string; location: string };
  prohibitedLocations?: string[];
  pairedWith?: string[];
}

export const DOCTORS: Record<string, Doctor> = {
  DR: { 
    name: "Dr. Ramsey", 
    fixedSchedule: { day: "Wednesday", location: "D" },
    prohibitedLocations: ["W", "LD", "R", "B"] 
  },
  JC: { 
    name: "Dr. Chang", 
    fixedSchedule: { day: "Thursday", location: "D" },
    prohibitedLocations: ["W", "LD", "R", "B"] 
  },
  MG: {
    name: "Dr. Guenena",
    prohibitedLocations: ["W", "B"],
    pairedWith: ["BJ"]
  },
  DV: { name: "Dr. V" },
  DS: { name: "Dr. S" },
  GS: { name: "Dr. G" },
  MF: { name: "Dr. F" },
  BN: { name: "Dr. N" },
  NL: { name: "Dr. L" },
  JO: { name: "Dr. O" },
  JN: { name: "Dr. J" },
  SW: { name: "Dr. W (SW)" },
  Wood: { name: "Dr. Wood" },
};
