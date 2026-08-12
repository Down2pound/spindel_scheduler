import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Coordinates } from './commuteService';

export interface TechnicianProfile {
  initials: string;
  ownerUid: string;
  homeAddress?: string;
  homePin?: Coordinates;
  officeRanking: string[];
  commuteMiles: Record<string, number>;
  updatedAt?: unknown;
}

export function subscribeToTechnicianProfiles(
  callback: (profiles: Record<string, TechnicianProfile>) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(collection(db, 'technicianProfiles'), (snapshot) => {
    const profiles: Record<string, TechnicianProfile> = {};
    snapshot.forEach((profileDoc) => {
      profiles[profileDoc.id] = profileDoc.data() as TechnicianProfile;
    });
    callback(profiles);
  }, onError);
}

export async function saveTechnicianProfile(profile: TechnicianProfile) {
  await setDoc(doc(db, 'technicianProfiles', profile.initials), profile, { merge: true });
}
