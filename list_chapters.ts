
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function listCollections() {
  const chaptersSnap = await getDocs(collection(db, 'chapter_chapters'));
  const chapters = chaptersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log('Chapters:', JSON.stringify(chapters, null, 2));
}

listCollections();
