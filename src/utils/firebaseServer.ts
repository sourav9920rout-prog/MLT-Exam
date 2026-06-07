import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Read configuration dynamically
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = null;

try {
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } else {
    // Fallback if not provisioned yet (prevents compile crashes)
    firebaseConfig = {
      apiKey: "MOCK_KEY_FOR_COMPILE",
      authDomain: "mock.firebaseapp.com",
      projectId: "mock-project-id",
      firestoreDatabaseId: "default"
    };
  }
} catch (error) {
  console.error("Failed to load firebase configs:", error);
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig?.firestoreDatabaseId);
export const auth = getAuth(app);
export { firebaseConfig };
export { app as firebaseApp };
