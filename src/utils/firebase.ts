import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import aiStudioConfig from '../../firebase-applet-config.json';

// Use standard environment variables on Vercel, fallback to AI Studio auto-config if they aren't set
const firebaseConfig = import.meta.env.VITE_FIREBASE_API_KEY ? {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
} : aiStudioConfig;

const app = initializeApp(firebaseConfig);
const firestoreDbId = import.meta.env.VITE_FIREBASE_API_KEY 
  ? (import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)")
  : (aiStudioConfig as any).firestoreDatabaseId;
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
