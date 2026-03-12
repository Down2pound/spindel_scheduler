import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, onSnapshot, query } from "firebase/firestore";
import { DOCTORS, Doctor } from "../constants/doctors";
import { TECHNICIANS, Technician } from "../constants/technicians";

export async function initializeConstraints() {
  // Check if constraints already exist in Firestore, if not, seed them from constants
  const docSnap = await getDocs(collection(db, "doctors"));
  if (docSnap.empty) {
    console.log("Seeding doctor constraints to Firestore...");
    for (const [id, data] of Object.entries(DOCTORS)) {
      await setDoc(doc(db, "doctors", id), { ...data, id });
    }
  }

  const techSnap = await getDocs(collection(db, "technicians"));
  if (techSnap.empty) {
    console.log("Seeding technician constraints to Firestore...");
    for (const [id, data] of Object.entries(TECHNICIANS)) {
      await setDoc(doc(db, "technicians", id), { ...data, initials: id });
    }
  }
}

export function subscribeToDoctors(callback: (doctors: Record<string, Doctor>) => void) {
  return onSnapshot(collection(db, "doctors"), (snapshot) => {
    const doctors: Record<string, Doctor> = {};
    snapshot.forEach((doc) => {
      doctors[doc.id] = doc.data() as Doctor;
    });
    callback(doctors);
  });
}

export function subscribeToTechnicians(callback: (techs: Record<string, Technician>) => void) {
  return onSnapshot(collection(db, "technicians"), (snapshot) => {
    const techs: Record<string, Technician> = {};
    snapshot.forEach((doc) => {
      techs[doc.id] = doc.data() as Technician;
    });
    callback(techs);
  });
}

export async function updateDoctorConstraint(id: string, data: Partial<Doctor>) {
  await setDoc(doc(db, "doctors", id), data, { merge: true });
}

export async function updateTechConstraint(id: string, data: Partial<Technician>) {
  await setDoc(doc(db, "technicians", id), data, { merge: true });
}
