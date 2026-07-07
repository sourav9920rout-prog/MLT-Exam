import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import fs from 'fs';

const localConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(localConfig);
const db = getFirestore(app, localConfig.firestoreDatabaseId || "(default)");

async function main() {
  const q = query(collection(db, "questionBank"), limit(5));
  const snap = await getDocs(q);
  snap.forEach(d => console.log(d.data().subject));
  
  const q2 = query(collection(db, "questionBank"), where("subject", "==", "NCL EXAM"));
  const snap2 = await getDocs(q2);
  console.log(`Found ${snap2.size} NCL EXAM questions`);

  process.exit(0);
}
main();
