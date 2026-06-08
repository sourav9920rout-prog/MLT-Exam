import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCfB7yZ6H41hvBmOqeJy18NXUBG7FBPXQc",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "mlt-exams.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "mlt-exams",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "mlt-exams.firebasestorage.app",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "220269475062",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:220269475062:web:894203b6a1ee12b49b28d7"
};

const app = initializeApp(firebaseConfig);
const firestoreDbId = process.env.VITE_FIREBASE_DATABASE_ID || "(default)";
export const db = getFirestore(app, firestoreDbId);
export const auth = getAuth(app);
export { firebaseConfig };
export { app as firebaseApp };
