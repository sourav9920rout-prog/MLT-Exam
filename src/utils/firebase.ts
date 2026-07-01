import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Helper to get string and prevent empty strings
const getEnvValue = (val: string | undefined, fallback: string) => {
  return (val && val.trim().length > 0) ? val.trim() : fallback;
};

// Fallback to reading from the json if running locally without envs
import localConfig from '../../firebase-applet-config.json';

let firebaseConfig = {
  apiKey: getEnvValue(import.meta.env.VITE_FIREBASE_API_KEY, localConfig.apiKey),
  authDomain: getEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN, localConfig.authDomain),
  projectId: getEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID, localConfig.projectId),
  storageBucket: getEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET, localConfig.storageBucket),
  messagingSenderId: getEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, localConfig.messagingSenderId),
  appId: getEnvValue(import.meta.env.VITE_FIREBASE_APP_ID, localConfig.appId)
};

console.log("Firebase Client Config loaded:", firebaseConfig);

const app = initializeApp(firebaseConfig);
const firestoreDbId = typeof import.meta !== 'undefined' ? getEnvValue(import.meta.env.VITE_FIREBASE_DATABASE_ID, localConfig.firestoreDatabaseId || "(default)") : "(default)";

export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Connectivity validation check required by core guideline
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration state or internet status.");
    }
  }
}
testConnection();
