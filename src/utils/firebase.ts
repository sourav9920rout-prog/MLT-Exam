import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Helper to get string and prevent empty strings
const getEnv = (key: string, fallback: string) => {
  const val = import.meta.env[key];
  return (val && val.trim().length > 0) ? val.trim() : fallback;
};

// Fallback to reading from the json if running locally without envs
import localConfig from '../../firebase-applet-config.json';

let firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', localConfig.apiKey),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', localConfig.authDomain),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', localConfig.projectId),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', localConfig.storageBucket),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', localConfig.messagingSenderId),
  appId: getEnv('VITE_FIREBASE_APP_ID', localConfig.appId)
};

console.log("Firebase Client Config loaded:", firebaseConfig);

const app = initializeApp(firebaseConfig);
const firestoreDbId = typeof import.meta !== 'undefined' ? getEnv('VITE_FIREBASE_DATABASE_ID', localConfig.firestoreDatabaseId || "(default)") : "(default)";

export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);

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
