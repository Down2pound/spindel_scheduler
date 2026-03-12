import { GoogleGenAI, Type } from "@google/genai";
import { SheetDaySchedule } from "./sheetService";
import { Doctor } from "../constants/doctors";
import { Technician } from "../constants/technicians";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ScheduleAction {
  action: 'MOVE' | 'ADD' | 'REMOVE' | 'UPDATE_TIME' | 'UPDATE_CONSTRAINT' | 'UNKNOWN';
  person: string;
  fromLocation?: string;
  toLocation?: string;
  startTime?: string;
  endTime?: string;
  day?: string;
  reasoning: string;
  constraintUpdate?: {
    type: 'DOCTOR' | 'TECHNICIAN';
    id: string;
    updates: any;
  };
}

export async function processScheduleCommand(command: string, currentSchedule: SheetDaySchedule, doctors: Record<string, Doctor>, technicians: Record<string, Technician>): Promise<ScheduleAction> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
      You are a clinic schedule manager. Interpret the following natural language command and convert it into a structured action.
      
      Current Day: ${currentSchedule.dayName} (${currentSchedule.date})
      
      CONTEXT:
      - Doctors: ${JSON.stringify(doctors)}
      - Technicians: ${JSON.stringify(technicians)}
      - Current Schedule: ${JSON.stringify(currentSchedule.locations)}

      Command: "${command}"

      Rules:
      - MOVE: Moving a person from one location to another in the current schedule.
      - ADD: Adding a person to a location in the current schedule.
      - REMOVE: Removing a person from a location in the current schedule.
      - UPDATE_TIME: Changing the start or end time for a person in the current schedule.
      - UPDATE_CONSTRAINT: Modifying the permanent logic or constraints for a doctor or technician.
        Example: "Doctor SW can no longer work in Derry" -> { action: "UPDATE_CONSTRAINT", constraintUpdate: { type: "DOCTOR", id: "SW", updates: { prohibitedLocations: ["D", ...] } } }
        Example: "Technician BJ is now paired with Dr. Guenena" -> { action: "UPDATE_CONSTRAINT", constraintUpdate: { type: "TECHNICIAN", id: "BJ", updates: { pairedWith: ["MG"] } } }
      
      If the command is ambiguous or impossible, return action "UNKNOWN".
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            action: { type: Type.STRING, enum: ['MOVE', 'ADD', 'REMOVE', 'UPDATE_TIME', 'UPDATE_CONSTRAINT', 'UNKNOWN'] },
            person: { type: Type.STRING },
            fromLocation: { type: Type.STRING },
            toLocation: { type: Type.STRING },
            startTime: { type: Type.STRING },
            endTime: { type: Type.STRING },
            day: { type: Type.STRING },
            reasoning: { type: Type.STRING },
            constraintUpdate: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['DOCTOR', 'TECHNICIAN'] },
                id: { type: Type.STRING },
                updates: { type: Type.OBJECT }
              }
            }
          },
          required: ['action', 'reasoning']
        }
      }
    });

    return JSON.parse(response.text || "{}") as ScheduleAction;
  } catch (error) {
    console.error("Gemini Command Error:", error);
    throw error;
  }
}

export async function analyzeSchedule(scheduleData: SheetDaySchedule[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "Gemini API key is not configured. Please add it to your secrets.";
  }

  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
      You are an expert clinic operations analyst. Analyze the following clinic schedule data for the week.
      Identify:
      1. Staffing gaps (locations with fewer technicians than their target).
      2. Overstaffing (locations with more technicians than needed).
      3. Doctor coverage issues.
      4. Any unusual patterns or potential bottlenecks.

      Schedule Data:
      ${JSON.stringify(scheduleData, null, 2)}

      Provide a concise, professional summary with actionable insights. Use a technical, data-driven tone.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topP: 0.95,
        topK: 40,
      },
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating analysis: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function chatWithGemini(message: string, scheduleData: SheetDaySchedule[]): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "Gemini API key is not configured.";
  }

  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
      You are the Spindel Scheduler Assistant. You have access to the current clinic schedule.
      Answer the user's question based on the schedule data provided.
      
      Schedule Data:
      ${JSON.stringify(scheduleData, null, 2)}

      User Question: ${message}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    return response.text || "I'm sorry, I couldn't process that request.";
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Error communicating with Gemini.";
  }
}
