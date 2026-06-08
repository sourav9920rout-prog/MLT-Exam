import dotenv from 'dotenv';
dotenv.config();

import { collection, getDocs, updateDoc } from 'firebase/firestore';
import { db } from './src/utils/firebaseServer.ts';

async function run() {
  console.log('Fetching questions for mapping...');
  const snap = await getDocs(collection(db, 'questionBank'));
  const docs = snap.docs;
  
  let changed = 0;

  for (const d of docs) {
    const data = d.data();
    const currentSubject = data.subject || '';
    const subjectLower = currentSubject.toLowerCase().trim();
    let newSubject = currentSubject;

    if (subjectLower === 'haematology' || subjectLower === 'hematology') {
      newSubject = 'Pathology';
    } else if (subjectLower === 'serology' || subjectLower === 'parasitology' || subjectLower === 'immunology') {
      newSubject = 'Microbiology';
    } else if (subjectLower === 'physiology') {
      newSubject = 'Anatomy';
    } else if (subjectLower === 'biostatistics' || subjectLower === 'clinical biochemistry') {
      newSubject = 'Biochemistry';
    }

    if (newSubject !== currentSubject) {
      console.log(`Updating ${currentSubject} -> ${newSubject}`);
      await updateDoc(d.ref, { subject: newSubject });
      changed++;
    }
  }

  console.log(`\n--- SUMMARY ---`);
  console.log(`Total questions updated: ${changed}`);
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
