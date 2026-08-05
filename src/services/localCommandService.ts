import type { ScheduleAction } from './geminiService';

const token = '([A-Za-z][A-Za-z0-9_-]*)';
const location = '([A-Za-z]+)';
const day = '(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
const knownLocations = new Set(['derry', 'londonderry', 'windham', 'bedford', 'raymond', 'surgery', 'off', 'admin', 'floating']);
const genericPeople = new Set(['someone', 'somebody', 'anyone', 'technician', 'tech', 'person']);

function isSpecificPerson(value: string) {
  return !genericPeople.has(value.toLowerCase()) && value.length <= 6;
}

function isKnownLocation(value?: string) {
  return !value || knownLocations.has(value.toLowerCase());
}

export function parseLocalScheduleCommand(input: string): ScheduleAction | null {
  const command = input.trim();
  let match = command.match(new RegExp(`^move\\s+${token}(?:\\s+from\\s+${location})?\\s+to\\s+${location}(?:\\s+on\\s+${day})?$`, 'i'));
  if (match && isSpecificPerson(match[1]) && isKnownLocation(match[2]) && isKnownLocation(match[3])) return {
    action: 'MOVE', person: match[1].toUpperCase(), fromLocation: match[2], toLocation: match[3], day: match[4],
    reasoning: 'Parsed locally using the strict move-command format.',
  };

  match = command.match(new RegExp(`^add\\s+${token}\\s+to\\s+${location}(?:\\s+on\\s+${day})?$`, 'i'));
  if (match && isSpecificPerson(match[1]) && isKnownLocation(match[2])) return {
    action: 'ADD', person: match[1].toUpperCase(), toLocation: match[2], day: match[3],
    reasoning: 'Parsed locally using the strict add-command format.',
  };

  match = command.match(new RegExp(`^remove\\s+${token}(?:\\s+from\\s+${location})?(?:\\s+on\\s+${day})?$`, 'i'));
  if (match && isSpecificPerson(match[1]) && isKnownLocation(match[2])) return {
    action: 'REMOVE', person: match[1].toUpperCase(), fromLocation: match[2], day: match[3],
    reasoning: 'Parsed locally using the strict remove-command format.',
  };

  return null;
}
