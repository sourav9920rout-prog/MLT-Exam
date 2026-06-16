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
import { decrypt, encrypt } from './src/utils/crypto.ts';
import { appendResultToGoogleSheet } from './src/utils/googleSheets.ts';
import nodemailer from 'nodemailer';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = 3000;

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

app.post('/api/send-result-email', async (req, res) => {
  try {
    const { studentEmail, studentName, examName, score, maxScore, percentage, htmlReport } = req.body;
    
    if (!studentEmail) {
      return res.status(400).json({ error: 'Missing student email' });
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      secure: true,
      auth: {
        user: process.env.SMTP_EMAIL || 'result.mlt.exams@gmail.com',
        pass: process.env.SMTP_PASSWORD || 'dowqtoxyibzwpsqy'
      }
    });

    const mailOptions = {
      from: `"MLT Exams" <${process.env.SMTP_EMAIL || 'result.mlt.exams@gmail.com'}>`,
      to: studentEmail,
      subject: `Exam Result: ${examName}`,
      html: htmlReport || `
        <h2>Hi ${studentName},</h2>
        <p>Thank you for taking the exam <strong>${examName}</strong>.</p>
        <p>Your Score: <strong>${score} / ${maxScore}</strong> (${percentage.toFixed(2)}%)</p>
        <p>Your detailed answer copy is available on the platform.</p>
        <br>
        <p>Best regards,<br>MLT Exams Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error: any) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
const MAX_RETRIES = 5;
const FALLBACK_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite-preview"
];

async function generateContentWithRetry(client: any, config: any) {
  let lastError;
  let originalModel = config.model;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        const nextModel = FALLBACK_MODELS[(attempt - 2) % FALLBACK_MODELS.length];
        config.model = nextModel;
        console.log(`[AI] Switching to fallback model: ${nextModel}`);
      }
      return await client.models.generateContent(config);
    } catch (error: any) {
      lastError = error;
      const status = error?.status;
      // Retry on 503 (Unavailable), 429 (Too Many Requests), or 500 (Internal Server Error)
      if (status === 503 || status === 429 || status === 500 || error?.message?.includes("503") || error?.message?.includes("429")) {
        console.warn(`[AI] Attempt ${attempt} failed with ${status} on model ${config.model}. Retrying...`);
        if (attempt < MAX_RETRIES) {
          const delay = status === 429 ? 5000 * attempt : 3000 * attempt;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
      }
      throw error;
    }
  }
  throw lastError;
}

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
      "subject": "string (Extract or infer the most appropriate academic or professional subject. E.g., Pathology, Biochemistry, Microbiology, Physics, etc. Categorize Hematology/Histology as Pathology. Use 'Math' instead of 'Mathematics')",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}
${extraInstruction}
Return ONLY the raw JSON object, without markdown formatting blocks like \`\`\`json.`;

    const response = await generateContentWithRetry(gClient, {
      model: "gemini-3.1-flash-lite",
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

    // Chunking logic to avoid AI output token limits
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;
    const lines = rawText.split('\n');
    
    for (const line of lines) {
      currentChunk.push(line);
      currentLength += line.length + 1;
      
      // Split when chunk is roughly 15000 chars and we hit an empty line or a line starting with 'Q'
      if (currentLength > 15000 && (line.trim() === '' || !!line.match(/^Q\d+\./i))) {
        chunks.push(currentChunk.join('\n'));
        currentChunk = [];
        currentLength = 0;
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
    }

    const allQuestions: any[] = [];
    
    // Process sequentially to avoid rate limits
    for (let i = 0; i < chunks.length; i++) {
        // Simple delay to avoid rate limit spikes on Gemini 1.5 free tier (15 RPM)
        if (i > 0) {
            await new Promise(r => setTimeout(r, 4500));
        }

        const chunkText = chunks[i];
        if (!chunkText.trim()) continue;

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
Extract all educational quiz/exam questions from the following text (Part ${i+1}/${chunks.length}) and format as JSON.

Text to Extract from:
"${chunkText}"

STRICT JSON SCHEMA:
{
  "questions": [
    {
      "englishQuestion": "string",
      "englishOptions": ["string", "string", "string", "string"],
      ${hindiInstructions}
      "correctOptionIndex": number (0-3),
      "englishExplanation": "string",
      "subject": "string (Extract or infer the most appropriate academic or professional subject. E.g., Pathology, Biochemistry, Microbiology, Physics, etc. Categorize Hematology/Histology as Pathology. Use 'Math' instead of 'Mathematics')",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}
${extraInstruction}
Return ONLY the raw JSON object.`;

        try {
            const response = await generateContentWithRetry(gClient, {
              model: "gemini-3.1-flash-lite",
              contents: extractionPrompt,
              config: {
                responseMimeType: "application/json"
              }
            });

            const outputText = response.text || "{}";
            const parsedData = JSON.parse(outputText);
            if (parsedData.questions && Array.isArray(parsedData.questions)) {
                allQuestions.push(...parsedData.questions);
            }
        } catch (chunkErr) {
            console.error(`Error processing chunk ${i}:`, chunkErr);
            // continue with next chunk even if one fails
        }
    }

    return res.json({ success: true, questions: allQuestions });

  } catch (error) {
    console.error('Question raw extraction error:', error);
    return res.status(500).json({ error: 'Failed to extract questions from raw text.' });
  }
});

app.post('/api/admin/translate-explain-question', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || (!question.englishQuestion && !question.hindiQuestion)) {
      return res.status(400).json({ error: 'Source question text is required.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'AI capabilities not configured.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const extractionPrompt = `
You are a bilingual (English and Hindi) educational content assistant and subject matter expert.
I am providing you with a partially filled multiple-choice question.

Your task:
1. Translate questions and options into the missing language (English -> Hindi, or Hindi -> English).
2. Improve formatting and correctness if needed.
3. Keep the correctOptionIndex the same (it should be an integer 0, 1, 2, or 3).
4. If 'englishExplanation' or 'hindiExplanation' is missing, generate a clear, concise, accurate explanation in the respective language.
5. Do not modify the image URLs.
6. Ensure the options align perfectly in both languages.

Current Input Data:
${JSON.stringify(question, null, 2)}

Return ONLY a raw JSON object matching this schema exactly, do not wrap in markdown quotes:
{
  "englishQuestion": "string",
  "hindiQuestion": "string",
  "englishOptions": ["string", "string", "string", "string"],
  "hindiOptions": ["string", "string", "string", "string"],
  "correctOptionIndex": number,
  "englishExplanation": "string",
  "hindiExplanation": "string",
  "subject": "string",
  "difficulty": "string"
}`;

    const response = await generateContentWithRetry(ai, {
      model: "gemini-3.1-flash-lite",
      contents: extractionPrompt,
      config: {
        responseMimeType: "application/json",
        temperature: 0.1
      }
    });

    const outputText = response.text || "{}";
    const parsedData = JSON.parse(outputText);
    return res.json({ success: true, question: parsedData });

  } catch (error) {
    console.error('Question translation error:', error);
    return res.status(500).json({ error: 'Failed to translate and explain question.' });
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
 * Auto classify batch
 */
app.post('/api/admin/auto-classify-batch', async (req, res) => {
  try {
    const { questions, subjects } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'Invalid questions payload' });
    }

    const ai = getGeminiClient();
    
    const results = await Promise.all(questions.map(async (q: any) => {
      if (!q.englishQuestion) return { id: q.id, suggestedSubject: null };
      
      const prompt = `Analyze this multiple-choice question and determine the most appropriate subject category.
Question: """${q.englishQuestion}"""
Options: ${JSON.stringify(q.englishOptions || [])}
Explanation: """${q.englishExplanation || ''}"""

Available Subjects:
${subjects.map((s: string) => `- ${s}`).join('\n')}

Rules:
Return ONLY the exact string from the Available Subjects list. Do not explain.`;

      try {
        const response = await generateContentWithRetry(ai, {
           model: 'gemini-3.1-flash-lite',
           contents: prompt,
           config: { temperature: 0.1 }
        });
        
        let aiSubject = (response.text || '').trim();
        if (!subjects.includes(aiSubject)) {
          const matched = subjects.find((s: string) => aiSubject.includes(s));
          if (matched) aiSubject = matched;
        }
        return { id: q.id, suggestedSubject: subjects.includes(aiSubject) ? aiSubject : null };
      } catch (e) {
        console.error('Classification error for question ID', q.id, ':', e);
        return { id: q.id, suggestedSubject: null, error: String(e) };
      }
    }));
    
    return res.json({ success: true, results });
  } catch (err) {
    console.error('Classification error:', err);
    return res.status(500).json({ error: String(err) });
  }
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
