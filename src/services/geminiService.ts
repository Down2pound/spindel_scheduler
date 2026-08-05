import { GoogleGenAI, Type } from "@google/genai";
import { SheetDaySchedule } from "./sheetService";
import { Doctor } from "../constants/doctors";
import { Technician } from "../constants/technicians";
import { TechnicianProfile } from "./technicianProfileService";
import { buildWeeklyAiContext, compactConstraints, compactProfiles, compactScheduleDay } from "./aiContextService";

const responseCache = new Map<string, string>();
const MAX_CACHE_ENTRIES = 50;

function cacheKey(kind: string, payload: unknown) {
  return `${kind}:${JSON.stringify(payload)}`;
}

function cacheResponse(key: string, value: string) {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, value);
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

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
    updates: Record<string, unknown>;
  };
}

const personActions = new Set<ScheduleAction['action']>(['MOVE', 'ADD', 'REMOVE', 'UPDATE_TIME']);

function unknownAction(reasoning: string): ScheduleAction {
  return {
    action: 'UNKNOWN',
    person: '',
    reasoning,
  };
}

function normalizeScheduleAction(raw: Partial<ScheduleAction>): ScheduleAction {
  const action = raw.action || 'UNKNOWN';
  const reasoning = raw.reasoning || 'No reasoning provided by Gemini.';

  if (personActions.has(action) && !raw.person?.trim()) {
    return unknownAction(`Missing person for ${action}. ${reasoning}`);
  }

  if (action === 'MOVE' && !raw.toLocation?.trim()) {
    return unknownAction(`Missing destination location for MOVE. ${reasoning}`);
  }

  if (action === 'UPDATE_CONSTRAINT') {
    const update = raw.constraintUpdate;
    if (!update?.type || !update.id || !update.updates || Object.keys(update.updates).length === 0) {
      return unknownAction(`Missing constraint update details. ${reasoning}`);
    }
  }

  return {
    ...raw,
    action,
    reasoning,
    person: raw.person?.trim() || '',
    fromLocation: raw.fromLocation?.trim(),
    toLocation: raw.toLocation?.trim(),
    startTime: raw.startTime?.trim(),
    endTime: raw.endTime?.trim(),
    day: raw.day?.trim(),
  } as ScheduleAction;
}

export async function processScheduleCommand(command: string, currentSchedule: SheetDaySchedule, doctors: Record<string, Doctor>, technicians: Record<string, Technician>, technicianProfiles: Record<string, TechnicianProfile> = {}): Promise<ScheduleAction> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Gemini API key is not configured.");
  }

  try {
    const commandContext = {
      command,
      schedule: compactScheduleDay(currentSchedule),
      doctors: compactConstraints(doctors),
      technicians: compactConstraints(technicians),
      profiles: compactProfiles(technicianProfiles),
    };
    const key = cacheKey('command', commandContext);
    const cached = responseCache.get(key);
    if (cached) return normalizeScheduleAction(JSON.parse(cached) as Partial<ScheduleAction>);
    const ai = getGeminiClient();
    const model = "gemini-3-flash-preview";
    const prompt = `
      You are a clinic schedule manager. Interpret the following natural language command and convert it into a structured action.
      
      Current Day: ${currentSchedule.dayName} (${currentSchedule.date})
      
      CONTEXT:
      - Doctors: ${JSON.stringify(commandContext.doctors)}
      - Technicians: ${JSON.stringify(commandContext.technicians)}
      - Technician preferences (rank) and one-way commute (miles): ${JSON.stringify(commandContext.profiles)}
      - Current Schedule (p=person,r=D doctor/T technician,s=start,e=end,x=status): ${JSON.stringify(commandContext.schedule)}

      Command: "${command}"

      Rules:
      - When choosing which technician should move, preserve required staffing and hard constraints first. Then favor the shortest drive, the highest-ranked destination, and the smallest increase from their current commute. Explain that tradeoff in reasoning.
      - MOVE: Moving a person from one location to another in the current schedule. Requires person and toLocation.
      - ADD: Adding a person to a location in the current schedule. Requires person and toLocation.
      - REMOVE: Removing a person from a location in the current schedule. Requires person.
      - UPDATE_TIME: Changing the start or end time for a person in the current schedule. Requires person.
      - UPDATE_CONSTRAINT: Modifying the permanent logic or constraints for a doctor or technician.
        Example: "Doctor SW can no longer work in Derry" -> { action: "UPDATE_CONSTRAINT", constraintUpdate: { type: "DOCTOR", id: "SW", updates: { prohibitedLocations: ["D", ...] } } }
        Example: "Technician BJ is now paired with Dr. Guenena" -> { action: "UPDATE_CONSTRAINT", constraintUpdate: { type: "TECHNICIAN", id: "BJ", updates: { pairedWith: ["MG"] } } }
      
      If the command is ambiguous, missing required details, or impossible, return action "UNKNOWN".
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

    const text = response.text || "{}";
    cacheResponse(key, text);
    return normalizeScheduleAction(JSON.parse(text) as Partial<ScheduleAction>);
  } catch (error) {
    console.error("Gemini Command Error:", error);
    throw error;
  }
}

export async function analyzeSchedule(scheduleData: SheetDaySchedule[], technicianProfiles: Record<string, TechnicianProfile> = {}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "Gemini API key is not configured. Please add it to your secrets.";
  }

  try {
    const weeklyContext = buildWeeklyAiContext(scheduleData, technicianProfiles);
    const key = cacheKey('analysis', weeklyContext);
    const cached = responseCache.get(key);
    if (cached) return cached;
    const ai = getGeminiClient();
    const model = "gemini-3-flash-preview";
    const prompt = `
      You are an expert clinic operations analyst. Analyze the following clinic schedule data for the week.
      Identify:
      1. Staffing gaps (locations with fewer technicians than their target).
      2. Overstaffing (locations with more technicians than needed).
      3. Doctor coverage issues.
      4. Any unusual patterns or potential bottlenecks.
      5. The most logical technician moves, balancing coverage with commute miles and favorite-to-least-favorite office rankings. Never recommend a less comfortable move when an equally qualified, better-scoring option is available.

      Schedule Data:
      ${JSON.stringify(weeklyContext)}

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

    const text = response.text || "No analysis generated.";
    cacheResponse(key, text);
    return text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating analysis: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function chatWithGemini(message: string, scheduleData: SheetDaySchedule[], technicianProfiles: Record<string, TechnicianProfile> = {}): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "Gemini API key is not configured.";
  }

  try {
    const weeklyContext = buildWeeklyAiContext(scheduleData, technicianProfiles);
    const key = cacheKey('chat', { message, weeklyContext });
    const cached = responseCache.get(key);
    if (cached) return cached;
    const ai = getGeminiClient();
    const model = "gemini-3-flash-preview";
    const prompt = `
      You are the Spindel Scheduler Assistant. You have access to the current clinic schedule.
      Answer the user's question based on the schedule data provided.
      
      Schedule Data:
      ${JSON.stringify(weeklyContext)}

      For staffing or move questions, prioritize hard coverage requirements, then minimize commute burden and honor office rankings. State why the suggested person is the most comfortable logical choice.

      User Question: ${message}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
    });

    const text = response.text || "I'm sorry, I couldn't process that request.";
    cacheResponse(key, text);
    return text;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return "Error communicating with Gemini.";
  }
}
