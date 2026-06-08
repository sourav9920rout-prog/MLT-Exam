import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Helper to get string and prevent empty strings
const getEnv = (key: string, fallback: string) => {
  const val = import.meta.env[key];
  return (val && val.trim().length > 0) ? val.trim() : fallback;
};

// User's provided Firebase Project credentials from mlt-exams
// Fallback to reading from the json if running locally without envs
let localConfig: any = {};
try {
  // Try to inline it during build via Vite if the file exists
  // For production environments, environment variables will override it
  localConfig = require('../../firebase-applet-config.json');
} catch(e) {}

let firebaseConfig = {
  apiKey: getEnv('VITE_FIREBASE_API_KEY', localConfig.apiKey || "AIzaSyCfB7yZ6H41hvBmOqeJy18NXUBG7FBPXQc"),
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', localConfig.authDomain || "mlt-exams.firebaseapp.com"),
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID', localConfig.projectId || "mlt-exams"),
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', localConfig.storageBucket || "mlt-exams.firebasestorage.app"),
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', localConfig.messagingSenderId || "220269475062"),
  appId: getEnv('VITE_FIREBASE_APP_ID', localConfig.appId || "1:220269475062:web:894203b6a1ee12b49b28d7")
};

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
