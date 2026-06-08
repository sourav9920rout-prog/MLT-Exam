import dotenv from 'dotenv';
import dns from 'node:dns';

// Force node to prefer IPv4. This resolves the ENETUNREACH error on environments (like Render)
// that lack IPv6 routes but still attempt to connect to dual-stack endpoints (like smtp.gmail.com).
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {
  // Ignore if fallback needed
}

dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './src/utils/firebaseServer.ts';
import { decrypt, encrypt } from './src/utils/crypto.ts';
import { appendResultToGoogleSheet } from './src/utils/googleSheets.ts';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = 3000;

// Dynamic In-Memory Store for OTP Codes (Email -> { otpCode, expiresAt })
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

// Lazy-initialize Gemini AI instance to prevent crash if key is absent
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.warn("GEMINI_API_KEY is not defined. AI explanations will fall back to static text.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key || "MOCK_KEY",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}



// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

/**
 * OTP Verification (SMTP 1)
 * Generates a random 6-digit OTP code valid for 10 minutes,
 * sends it beautifully to the student's email address.
 */
app.post('/api/auth/send-otp', async (req, res) => {
  const { email, type } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required.' });
  }

  // Generate 6-digit pin
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes validity

  otpStore.set(email.toLowerCase(), { otp, expiresAt });

  console.log(`[System: Email bypassed] OTP for ${email} is: ${otp}`);
  return res.json({ 
    success: true, 
    message: 'OTP Code validated (emails disabled). OTP has been logged to console.',
    devOtp: otp 
  });
});

/**
 * Verify OTP PIN
 */
app.post('/api/auth/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP code are required.' });
  }

  const cached = otpStore.get(email.toLowerCase());
  if (!cached) {
    return res.status(400).json({ error: 'No active OTP verification session found.' });
  }

  if (Date.now() > cached.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ error: 'OTP code has already expired. Please request a new verification code.' });
  }

  if (cached.otp !== String(otp).trim()) {
    return res.status(400).json({ error: 'Incorrect OTP pin code. Please try again.' });
  }

  // Clear OTP on successful verify
  otpStore.delete(email.toLowerCase());
  return res.json({ success: true, message: 'Email address verified successfully.' });
});

app.post('/api/admin/test-smtp', async (req, res) => {
  return res.json({ success: true, message: 'SMTP Test successful (Emails bypassed).' });
});

/**
 * Dispatch admin notification and student confirmation upon registering (SMTP 2)
 */
app.post('/api/auth/notify-registration', async (req, res) => {
  return res.json({ success: true, message: 'Notification bypassed.' });
});

/**
 * Handle student status action dispatch emails (SMTP 2)
 * Triggers on Approval, Rejection, Revocation, or Reactivation
 */
app.post('/api/admin/notify-status-update', async (req, res) => {
  return res.json({ success: true, message: 'Notification bypassed.', smtpConfigured: false });
});

/**
 * Dispatch admin notification upon being added as an admin (SMTP 2)
 */
app.post('/api/admin/notify-new-admin', async (req, res) => {
  return res.json({ success: true, message: 'Notification bypassed.', smtpConfigured: false });
});





/**
 * Endpoint to extract questions from a document using Gemini AI.
 * Receives base64 encoded document (PDF, DOCX, TXT) and parses.
 */
app.post('/api/admin/extract-questions', async (req, res) => {
  const { documentBase64, mimeType, languageMode } = req.body;
  if (!documentBase64 || !mimeType) {
    return res.status(400).json({ error: 'Document data required.' });
  }

  try {
    const gClient = getGeminiClient();
    
    // Build prompt based on languageMode
    const hindiInstructions = languageMode === 'english'
      ? `"hindiQuestion": "",
      "hindiOptions": ["", "", "", ""],
      "hindiExplanation": "",`
      : `"hindiQuestion": "string (leave empty string if source text is purely English)",
      "hindiOptions": ["string", "string", "string", "string"],
      "hindiExplanation": "string",`;
      
    const extraInstruction = languageMode === 'english' 
      ? `CRITICAL: You are in English-Only mode. Do NOT translate anything to Hindi. Provide empty strings for all Hindi fields. This saves processing time.`
      : `CRITICAL: You are in Bilingual mode. You MUST provide Hindi translations for the englishQuestion, englishOptions, and englishExplanation fields in the corresponding hindiQuestion, hindiOptions, and hindiExplanation fields.`;

    const extractionPrompt = `You are a strict data extraction assistant. Extract ALL multiple-choice questions from the provided document into a JSON array.
Each question MUST follow this EXACT Schema:
{
  "questions": [
    {
      "englishQuestion": "string",
      "englishOptions": ["string", "string", "string", "string"],
      ${hindiInstructions}
      "correctOptionIndex": number (0-3),
      "englishExplanation": "string",
      "subject": "string (MUST be one of: Pathology, Biochemistry, Microbiology, Blood Bank, Anatomy, Math, English, General Knowledge, Reasoning, Miscellaneous. CRITICAL: If the question is related to Hematology or Histology, categorize it as Pathology.)",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}
${extraInstruction}
Return ONLY the raw JSON object, without markdown formatting blocks like \`\`\`json.`;

    const response = await gClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: {
        parts: [
          { inlineData: { data: documentBase64, mimeType } },
          { text: extractionPrompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const outputText = response.text || "{}";
    const parsedData = JSON.parse(outputText);
    return res.json({ success: true, questions: parsedData.questions || [] });

  } catch (error) {
    console.error('Question extraction error:', error);
    return res.status(500).json({ error: 'Failed to extract questions from document.' });
  }
});

app.post('/api/admin/extract-questions-raw', async (req, res) => {
  const { rawText, languageMode } = req.body;
  if (!rawText) return res.status(400).json({ error: 'No rawText provided.' });

  try {
    const gClient = getGeminiClient();

    // Build prompt based on languageMode
    const hindiInstructions = languageMode === 'english'
      ? `"hindiQuestion": "",
      "hindiOptions": ["", "", "", ""],
      "hindiExplanation": "",`
      : `"hindiQuestion": "string (leave empty string if source text is purely English)",
      "hindiOptions": ["string", "string", "string", "string"],
      "hindiExplanation": "string",`;
      
    const extraInstruction = languageMode === 'english' 
      ? `CRITICAL: You are in English-Only mode. Do NOT translate anything to Hindi. Provide empty strings for all Hindi fields. This saves processing time.`
      : `CRITICAL: You are in Bilingual mode. You MUST provide Hindi translations for the englishQuestion, englishOptions, and englishExplanation fields in the corresponding hindiQuestion, hindiOptions, and hindiExplanation fields.`;

    const extractionPrompt = `You are a Medical Data extraction Assistant. 
Extract all educational quiz/exam questions from the following text and format as JSON.

Text to Extract from:
"${rawText}"

STRICT JSON SCHEMA:
{
  "questions": [
    {
      "englishQuestion": "string",
      "englishOptions": ["string", "string", "string", "string"],
      ${hindiInstructions}
      "correctOptionIndex": number (0-3),
      "englishExplanation": "string",
      "subject": "string (MUST be one of: Pathology, Biochemistry, Microbiology, Blood Bank, Anatomy, Math, English, General Knowledge, Reasoning, Miscellaneous. CRITICAL: If the question is related to Hematology or Histology, categorize it as Pathology.)",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}
${extraInstruction}
Return ONLY the raw JSON object.`;

    const response = await gClient.models.generateContent({
      model: "gemini-3.5-flash",
      contents: extractionPrompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const outputText = response.text || "{}";
    const parsedData = JSON.parse(outputText);
    return res.json({ success: true, questions: parsedData.questions || [] });

  } catch (error) {
    console.error('Question raw extraction error:', error);
    return res.status(500).json({ error: 'Failed to extract questions from raw text.' });
  }
});

/**
 * Evaluate exam completion, run scoring algorithm, trigger Google Sheet append,
 * query Gemini for dynamic analytical explanation summary, and send ONE consolidated email report.
 */
app.post('/api/exams/submit', async (req, res) => {
  console.log(`[Server] /api/exams/submit received request payload keys: ${Object.keys(req.body)}`);
  const { 
    studentId, studentName, studentEmail, examId, examName, answers, questionStates, questionsList, timeTakenSeconds,
    passingPercentage: passedPassingPercentage, positiveMarks: passedPositiveMarks, negativeMarks: passedNegativeMarks
  } = req.body;

  if (!studentId || !examId || !answers || !questionsList) {
    console.error('[Server] Incomplete exam attempt parameters.', { studentId, examId, answers: !!answers, questionsList: !!questionsList });
    return res.status(400).json({ error: 'Incomplete exam attempt parameters submitted.' });
  }
  console.log('[Server] Attempt parameters validated.');

  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  
  // We don't store questionsList in DB anymore to optimize.
  // Instead, we store just the IDs.
  const questionIds: string[] = [];

  questionsList.forEach((q: any) => {
    let selected = answers[q.id];
    let state = questionStates ? questionStates[q.id] : undefined;

    questionIds.push(q.id);

    // If marked for review, do not evaluate
    if (state === 'review_ans' || state === 'review') {
      selected = -1;
    }

    if (selected === undefined || selected === null || selected === -1) {
      unansweredCount++;
    } else if (Number(selected) === q.correctOptionIndex) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  });

  const totalQuestions = questionsList.length;
  
  // Use scores passed from frontend to avoid unauthenticated backend reads
  let positiveMarks = passedPositiveMarks !== undefined ? passedPositiveMarks : 1;
  let negativeMarks = passedNegativeMarks !== undefined ? passedNegativeMarks : 0;
  let passingPercentage = passedPassingPercentage !== undefined ? passedPassingPercentage : 50;

  const score = (correctCount * positiveMarks) - (incorrectCount * negativeMarks);
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const passed = percentage >= passingPercentage;

  // Combine Results model to save on Firestore
  const resultId = `${studentId}_${examId}_${Date.now()}`;
  const resultPayload = {
    id: resultId,
    studentId,
    studentName,
    studentEmail,
    examId,
    examName,
    score,
    totalQuestions,
    percentage,
    passed,
    correctCount,
    incorrectCount,
    unansweredCount,
    answers,
    questionStates,
    questionIds,
    questionsList,
    timeTakenSeconds: timeTakenSeconds || 0,
    submittedAt: new Date().toISOString()
  };

  try {
    // 1. (Frontend will handle saving to Firestore)
    // await setDoc(doc(db, 'results', resultId), resultPayload);

    // 2. Append result row into Google Sheets API reporting
    console.log('[Server] About to append to Google Sheets...');
    await appendResultToGoogleSheet({
      studentName,
      studentEmail,
      examName,
      score,
      totalQuestions,
      percentage,
      passed,
      submittedAt: resultPayload.submittedAt,
      // Pass the new field so the util knows to place it or we can ignore it
      timeTaken: timeTakenSeconds || 0
    });

    // 3. Email dispatch bypassed
    console.log('[Server] Bypassing result email dispatch...');

    return res.json(resultPayload);
  } catch (err) {
    console.error('Failed to register exam results:', err);
    return res.status(500).json({ error: 'Failed result compilation' });
  }
});

/**
 * One-time migration route to map Hematology/Histology subjects to Pathology
 */
app.post('/api/admin/fix-subjects', async (req, res) => {
  try {
    const snap = await getDocs(collection(db, 'questionBank'));
    let updatedCount = 0;
    
    for (const d of snap.docs) {
      const data = d.data();
      const subject = data.subject;
      if (subject === 'Hematology' || subject === 'Histology') {
        await updateDoc(d.ref, { subject: 'Pathology' });
        updatedCount++;
      }
    }
    return res.json({ success: true, updatedCount });
  } catch (err) {
    console.error('Migration error:', err);
    return res.status(500).json({ error: String(err) });
  }
});

app.post('/api/send-email', async (req, res) => {
  return res.json({ success: true, message: 'Email bypassed.' });
});

// ----------------------------------------------------
// VITE DEV SERVER / PRODUCTION SERVING BOOTSTRAP
// ----------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    if (!process.env.VERCEL) {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Do not bind to a port on Vercel, as Vercel handles requests directly.
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
