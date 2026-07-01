import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error("Please upload the file to the workspace first.");
    return;
  }

  const rawText = fs.readFileSync(filePath, 'utf-8');
  console.log(`Read ${rawText.length} characters from ${filePath}`);
  
  // We will process the text in chunks to avoid hitting token limits
  const chunkSize = 5000;
  const chunks = [];
  for (let i = 0; i < rawText.length; i += chunkSize) {
    chunks.push(rawText.slice(i, i + chunkSize));
  }

  console.log(`Split into ${chunks.length} chunks. Starting processing...`);

  let totalAdded = 0;

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1} of ${chunks.length}...`);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash',
        contents: `Extract the multiple choice questions from the following text. 
        For each question, provide the English question, English options, English explanation (generate a brief one if missing), 
        and translate all of these into Hindi (Question, Options, Explanation).
        Determine the correct option index (0 to 3).
        
        Return the result STRICTLY as a JSON array of objects with the following schema:
        [
          {
            "englishQuestion": "...",
            "englishOptions": ["...", "...", "...", "..."],
            "hindiQuestion": "...",
            "hindiOptions": ["...", "...", "...", "..."],
            "hindiExplanation": "...",
            "englishExplanation": "...",
            "correctOptionIndex": 0,
            "subject": "1000 Questions Subject",
            "difficulty": "medium"
          }
        ]
        
        Do not include markdown blocks like \`\`\`json, just the raw JSON array.
        
        Text to process:
        ${chunks[i]}
        `
      });

      let jsonText = response.text.trim();
      if (jsonText.startsWith('\`\`\`json')) {
        jsonText = jsonText.replace(/^\`\`\`json/, '').replace(/\`\`\`$/, '').trim();
      }

      const parsedQuestions = JSON.parse(jsonText);
      
      for (const q of parsedQuestions) {
        q.isHidden = false;
        q.createdAt = Date.now();
        await addDoc(collection(db, 'questions'), q);
        totalAdded++;
      }
      
      console.log(`Successfully added ${parsedQuestions.length} questions from chunk ${i + 1}. Total added: ${totalAdded}`);
      
      // Delay to avoid rate limits
      await new Promise(res => setTimeout(res, 3000));
    } catch (e) {
      console.error(`Error processing chunk ${i + 1}:`, e.message);
    }
  }
  
  console.log(`Finished processing. Successfully added ${totalAdded} questions to Firestore.`);
}

// Check if a file path was provided
const fileToProcess = process.argv[2] || 'questions.txt';
processFile(fileToProcess);
