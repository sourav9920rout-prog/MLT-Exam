import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

let firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCfB7yZ6H41hvBmOqeJy18NXUBG7FBPXQc",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "studied-entropy-q07pf.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "studied-entropy-q07pf",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "studied-entropy-q07pf.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "220269475062",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:220269475062:web:894203b6a1ee12b49b28d7"
};

let firestoreDbId = process.env.VITE_FIREBASE_DATABASE_ID || "(default)";

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const localConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    firebaseConfig = {
      apiKey: localConfig.apiKey || firebaseConfig.apiKey,
      authDomain: localConfig.authDomain || firebaseConfig.authDomain,
      projectId: localConfig.projectId || firebaseConfig.projectId,
      storageBucket: localConfig.storageBucket || firebaseConfig.storageBucket,
      messagingSenderId: localConfig.messagingSenderId || firebaseConfig.messagingSenderId,
      appId: localConfig.appId || firebaseConfig.appId
    };
    if (localConfig.firestoreDatabaseId) {
      firestoreDbId = localConfig.firestoreDatabaseId;
    }
  }
} catch (err) {
  console.error("Failed to load firebase-applet-config.json:", err);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);

console.log("Firebase Server initialized with projectId:", firebaseConfig.projectId, "and dbId:", firestoreDbId);

// Server does not need anonymous auth for now.
// signInAnonymously(auth).catch(e => console.error("Server anonymous auth failed:", e));

export { firebaseConfig };
export { app as firebaseApp };
