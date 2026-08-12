export interface Technician {
  fullRefracting: boolean;
  pairedWith?: string | string[];
  aliases?: string[];
  conditionalPairing?: { doctor: string; day: string; location: string }[];
  softConstraints?: { type: string; doctor: string; message: string }[];
  officeRanking?: string[];
  commuteMiles?: Record<string, number>;
  refractingNote?: string;
}

export const TECHNICIANS: Record<string, Technician> = {
  DS_T: { 
    fullRefracting: false, 
    pairedWith: ["DR", "JC"],
    aliases: ["DSJ"],
    refractingNote: "Does not refract yet"
  },
  DSJ: { 
    fullRefracting: false, 
    pairedWith: ["DR", "JC"], 
    aliases: ["DS_T"],
    refractingNote: "Does not refract yet"
  },
  LT: {
    fullRefracting: true,
    conditionalPairing: [
      { doctor: "DR", day: "Wednesday", location: "D" },
      { doctor: "JC", day: "Thursday", location: "D" }
    ]
  },
  HR: {
    fullRefracting: true,
    softConstraints: [
      { 
        type: "avoid_doctor_location", 
        doctor: "MG", 
        message: "Warning: HR and MG should not be at the same location unless no other option exists." 
      }
    ]
  },
  BJ: {
    fullRefracting: false,
    pairedWith: "MG",
    refractingNote: "Does not refract yet"
  }
};
