import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';
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


async function getSMTPServerConfig(smtpIndex: 1 | 2 | 3) {
  try {
    // 1. Check for Environment Variables (Priority for Vercel/Production)
    const envHost = process.env[`SMTP${smtpIndex}_HOST`]?.replace(/^["']|["']$/g, '');
    const envPort = process.env[`SMTP${smtpIndex}_PORT`]?.replace(/^["']|["']$/g, '');
    const envUser = process.env[`SMTP${smtpIndex}_USER`]?.replace(/^["']|["']$/g, '');
    const envPass = process.env[`SMTP${smtpIndex}_PASS`]?.replace(/^["']|["']$/g, '');
    const envFromName = process.env[`SMTP${smtpIndex}_FROM_NAME`]?.replace(/^["']|["']$/g, '');
    const envFromEmail = process.env[`SMTP${smtpIndex}_FROM_EMAIL`]?.replace(/^["']|["']$/g, '');

    if (envHost && envUser && envPass) {
      console.log(`[SMTP Debug] Found SMTP${smtpIndex} config from environment variables. Host: ${envHost.trim()}`);
      return {
        host: envHost.trim(),
        port: Number(envPort) || 587,
        username: envUser.trim(),
        password: envPass.replace(/\s+/g, ''), // Strip spaces from generated App Passwords
        fromName: envFromName ? envFromName.trim() : '',
        fromEmail: envFromEmail ? envFromEmail.trim() : envUser.trim()
      };
    }
    console.log(`[SMTP Debug] SMTP${smtpIndex} NOT fully configured from environment variables.`);
    return null;
  } catch (error) {
    console.error(`Error retrieving SMTP config:`, error);
    return null;
  }
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

  try {
    const smtp1 = await getSMTPServerConfig(1);
    if (!smtp1 || !smtp1.host || !smtp1.username || !smtp1.password) {
      // In development, return the code and log it clearly if mail configurations are pending.
      console.log(`[SMTP 1 Pending Setup] OTP for ${email} is: ${otp}`);
      return res.json({ 
        success: true, 
        message: 'OTP Code emitted. (SMTP 1 is not fully configured; OTP has been logged to console.)',
        devOtp: otp // Allow easy student creation during deployment testing
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtp1.host,
      port: smtp1.port,
      secure: smtp1.port === 465,
      family: 4,
      connectionTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: smtp1.username,
        pass: smtp1.password
      }
    } as any);

    let subject = 'Email Verification OTP Code - MLT Portal';
    let intentText = 'You requested an Email Verification OTP to register on the MLT Exam Portal.';
    if (type === 'exam_start') {
      subject = 'Exam Session Authorization OTP - MLT Portal';
      intentText = 'You are attempting to securely launch an examination session on the MLT Exam Portal.';
    }

    const mailOptions = {
      from: `"${smtp1.fromName || 'MLT Portals OTP'}" <${smtp1.fromEmail}>`,
      to: email,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">Verify Your Identity</h2>
          <p>${intentText}</p>
          <div style="background-color: #f1f5f9; padding: 15px 25px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 4px; display: inline-block; color: #2563eb; margin: 20px 0;">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #64748b;">This OTP code is valid for exactly 10 minutes. Please run this verification process immediately.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 25px;" />
          <p style="font-size: 12px; color: #94a3b8;">If you did not request this, please ignore this message.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true, message: 'Verification email sent successfully with OTP code.' });
  } catch (error) {
    console.error('Failed to send SMTP 1 Verification Email:', error);
    // Return explicit error with 200 status so frontend handles it gracefully
    return res.json({ 
      success: false, 
      error: 'SMTP Connection Refused. Please review mail settings logs.',
      devOtp: otp 
    });
  }
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
  let { host, port, username, password, toEmail, smtpIndex } = req.body;
  if (!toEmail) {
    return res.status(400).json({ error: 'Missing recipient email.' });
  }

  // If credentials are empty, try to fetch from existing config
  if (!host || !username || !password) {
     console.log(`[SMTP Test] Credentials missing, fetching existing config for index ${smtpIndex}`);
     const existingConfig = await getSMTPServerConfig(smtpIndex);
     if (existingConfig) {
       console.log(`[SMTP Test] Found existing config: ${existingConfig.host}`);
       host = host || existingConfig.host;
       username = username || existingConfig.username;
       password = password || existingConfig.password;
       port = port || existingConfig.port;
     } else {
       console.log(`[SMTP Test] No existing config found for index ${smtpIndex}`);
       return res.status(400).json({ error: 'Missing SMTP details and no saved configuration found.' });
     }
  } else {
      console.log(`[SMTP Test] Using provided credentials for host: ${host}`);
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user: username, pass: password },
      connectionTimeout: 5000,
      socketTimeout: 5000
    });

    await transporter.verify();
    
    await transporter.sendMail({
      from: username,
      to: toEmail,
      subject: 'SMTP Connection Test',
      text: 'SMTP configuration is working correctly!'
    });
    
    return res.json({ success: true, message: 'Test email sent successfully.' });
  } catch (error: any) {
    console.error('SMTP test failed:', error);
    return res.status(500).json({ success: false, error: `SMTP Debug: Failed for host ${host}, user ${username}. Error: ${error.message}` });
  }
});

/**
 * Dispatch admin notification and student confirmation upon registering (SMTP 2)
 */
app.post('/api/auth/notify-registration', async (req, res) => {
  const { studentName, studentEmail, studentMobile, adminEmailsString } = req.body;
  console.log(`[SMTP 2] Registration notification triggered. Recipient studentEmail: "${studentEmail}", AdminEmails: "${adminEmailsString}"`);
  if (!studentName || !studentEmail) {
    return res.status(400).json({ error: 'Missing details.' });
  }

  try {
    const smtp2 = await getSMTPServerConfig(2);

    if (!smtp2 || !smtp2.host || !smtp2.username || !smtp2.password) {
      console.log(`[SMTP 2 Missing credentials] Registration notifications skipped for: ${studentEmail}`);
      return res.json({ success: true, logged: true });
    }

    const transporter = nodemailer.createTransport({
      host: smtp2.host,
      port: smtp2.port,
      secure: smtp2.port === 465,
      family: 4,
      connectionTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: smtp2.username,
        pass: smtp2.password
      }
    } as any);

    // 1. Admin Email Notification
    if (adminEmailsString) {
      const adminMail = {
        from: `"${smtp2.fromName || 'MLT Registration Manager'}" <${smtp2.fromEmail}>`,
        to: adminEmailsString,
        subject: 'New Student Registration Request Needs Approval',
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2 style="color: #d97706; margin-bottom: 8px;">New Student Signup Request</h2>
            <p>A new student has registered on the platform and is currently marked as <strong>Pending Approval</strong>.</p>
            <div style="background-color: #fcfbeb; border-left: 4px solid #d97706; padding: 15px; margin: 15px 0; border-radius: 4px;">
              <strong>Student details:</strong><br/>
              - Name: ${studentName}<br/>
              - Email: ${studentEmail}<br/>
              - Mobile: ${studentMobile || 'N/A'}<br/>
              - Date: ${new Date().toLocaleDateString()}
            </div>
            <p>Please log in to your Super Admin Dashboard to Approve or Reject this applicant.</p>
          </div>
        `
      };
      console.log(`[SMTP 2] Sending admin email to ${adminMail.to}`);
      await transporter.sendMail(adminMail);
    }

    // 2. Student Email Notification
    const studentMail = {
      from: `"${smtp2.fromName || 'MLT Exam Portal'}" <${smtp2.fromEmail}>`,
      to: studentEmail,
      subject: 'Registration Submitted Successfully - Pending Admin Approval',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">Congratulations, ${studentName}!</h2>
          <p>Your registration profile has been successfully saved.</p>
          <p>Management status: <strong style="color: #d97706;">Pending Admin Approval</strong></p>
          <p>You will receive an automated email notification as soon as your account is activated by our admissions administrators. Thank you for your patience!</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 25px;" />
          <p style="font-size: 11px; color: #94a3b8;">This is an automated administrative notification regarding your account state.</p>
        </div>
      `
    };

    console.log(`[SMTP 2] Sending student confirmation email to ${studentMail.to}`);
    await transporter.sendMail(studentMail);

    return res.json({ success: true });
  } catch (err: any) {
    console.error('Error dispatching registration SMTP 2 notifications:', err);
    return res.json({ success: false, error: err.message || 'Failed dispatch' });
  }
});

/**
 * Handle student status action dispatch emails (SMTP 2)
 * Triggers on Approval, Rejection, Revocation, or Reactivation
 */
app.post('/api/admin/notify-status-update', async (req, res) => {
  const { studentEmail, studentName, actionType } = req.body;
  if (!studentEmail || !actionType) {
    return res.status(400).json({ error: 'Missing required validation fields.' });
  }

  try {
    const smtp2 = await getSMTPServerConfig(2);
    if (!smtp2 || !smtp2.host || !smtp2.username || !smtp2.password) {
      console.log(`[SMTP 2 Pending] Status update notify skipped for: ${studentEmail} (Update: ${actionType})`);
      return res.json({ success: true, smtpConfigured: false });
    }

    const transporter = nodemailer.createTransport({
      host: smtp2.host,
      port: smtp2.port,
      secure: smtp2.port === 465,
      family: 4,
      connectionTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: smtp2.username,
        pass: smtp2.password
      }
    } as any);

    let subject = '';
    let statusText = '';
    let headingColor = '#10b981';
    let contentBody = '';

    if (actionType === 'approve') {
      subject = 'MLT Exam Platform Account Activated!';
      headingColor = '#10b981';
      statusText = 'APPROVED & ACTIVATED';
      contentBody = `<p>Your academic account has been reviewed and approved. You are now permitted to log in, explore scheduled question modules, and launch exams in full real-time mode!</p>
                     <p>Please log/navigate into the exam portal immediately to view scheduled examinations.</p>`;
    } else if (actionType === 'reject') {
      subject = 'Registration Application Status Update';
      headingColor = '#ef4444';
      statusText = 'REJECTED';
      contentBody = `<p>We regret to inform you that your registration application for the online exam portal has been rejected. If you believe this is in error, please contact admissions support.</p>`;
    } else if (actionType === 'revoke') {
      subject = 'Student Portal Membership Suspended';
      headingColor = '#f59e0b';
      statusText = 'REVOKED';
      contentBody = `<p>Your access authorization to the MLT Exam Portal has been temporarily suspended/revoked by an administrator. Active exams and histories are locked.</p>`;
    } else if (actionType === 'reactivate') {
      subject = 'Portal Access Authorization Restored';
      headingColor = '#10b981';
      statusText = 'REACTIVATED';
      contentBody = `<p>Your student membership status has been successfully reactivated. Full quiz, profile, and result dashboard access is fully restored.</p>`;
    }

    const mailOptions = {
      from: `"${smtp2.fromName || 'MLT System Administrator'}" <${smtp2.fromEmail}>`,
      to: studentEmail,
      subject: subject,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: ${headingColor}; margin-bottom: 8px;">Portal Status: ${statusText}</h2>
          <p>Dear ${studentName || 'Student'},</p>
          ${contentBody}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 25px;" />
          <p style="font-size: 11px; color: #64748b;">This message was dispatched securely using MLT System registration administrators SMTP 2 channels.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true, smtpConfigured: true });
  } catch (error: any) {
    console.error('SMTP 2 status email dispatch failed:', error);
    return res.json({ success: false, error: error.message || 'Failed dispatching mail' });
  }
});

/**
 * Dispatch admin notification upon being added as an admin (SMTP 2)
 */
app.post('/api/admin/notify-new-admin', async (req, res) => {
  const { newAdminEmail } = req.body;
  if (!newAdminEmail) {
    return res.status(400).json({ error: 'Missing new admin email.' });
  }

  try {
    const smtp2 = await getSMTPServerConfig(2);
    if (!smtp2 || !smtp2.host || !smtp2.username || !smtp2.password) {
      console.log(`[SMTP 2 Pending] Admin invitation notify skipped for: ${newAdminEmail}`);
      return res.json({ success: true, smtpConfigured: false });
    }

    const transporter = nodemailer.createTransport({
      host: smtp2.host,
      port: smtp2.port,
      secure: smtp2.port === 465,
      family: 4,
      connectionTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: smtp2.username,
        pass: smtp2.password
      }
    } as any);

    const mailOptions = {
      from: `"${smtp2.fromName || 'MLT System Administrator'}" <${smtp2.fromEmail}>`,
      to: newAdminEmail,
      subject: 'Invitation to Join MLT Exam Portal as Administrator',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-bottom: 8px;">Administrator Access Granted</h2>
          <p>Dear Administrator,</p>
          <p>The MLT Exam Portal has requested you to join our platform as an administrator.</p>
          <p>Kindly log into the portal using your Google account (${newAdminEmail}) to access your administrative capabilities.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 25px;" />
          <p style="font-size: 11px; color: #64748b;">This message was dispatched securely using MLT System registration administrators SMTP 2 channels.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return res.json({ success: true, smtpConfigured: true });
  } catch (error: any) {
    console.error('SMTP 2 admin invitation email dispatch failed:', error);
    return res.json({ success: false, error: error.message || 'Failed dispatching mail' });
  }
});



/**
 * Connection Active testing for specific SMTP
 */
app.post('/api/admin/test-smtp', async (req, res) => {
  const { index, host, port, username, password } = req.body;
  if (!host || !username) {
    return res.status(400).json({ error: 'Host and Username are required to test connection.' });
  }

  try {
    const actualPassword = password; // Decrypted or provided directly in test prompt
    const transporter = nodemailer.createTransport({
      host: host,
      port: Number(port),
      secure: Number(port) === 465,
      family: 4,
      connectionTimeout: 5000,
      socketTimeout: 5000,
      auth: {
        user: username,
        pass: actualPassword
      },
      connectTimeout: 5000
    } as any);

    await transporter.verify();
    return res.json({ success: true, status: 'Connected', message: `SMTP Server ${index} connection verified successfully!` });
  } catch (err) {
    console.error(`SMTP Test Error:`, err);
    return res.json({ 
      success: false, 
      status: 'Disconnected',
      error: err instanceof Error ? err.message : String(err)
    });
  }
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

  // Render a detailed prompt to Gemini to inspect student gaps and generate helpful feedback
  let aiSummaryTips = "Take your scheduled time to review reference guides and clarify incorrect areas.";
  
  try {
    const wrongAnswersReport = questionsList
      .filter((q: any) => answers[q.id] !== undefined && answers[q.id] !== -1 && Number(answers[q.id]) !== q.correctOptionIndex)
      .map((q: any) => {
        return `Question: "${q.englishQuestion}" 
        - Student selected: "${answers[q.id] !== -1 ? q.englishOptions[answers[q.id]] : 'Unanswered'}" 
        - Correct Option: "${q.englishOptions[q.correctOptionIndex]}" 
        - Primary explanation: "${q.englishExplanation || ''}"`;
      })
      .slice(0, 5) // Inspect top 5 wrong ones to preserve prompt size bounds
      .join('\n\n');

    if (wrongAnswersReport.length > 0) {
      if (passed) {
        aiSummaryTips = "Good job passing the exam! However, you incorrectly answered some questions. Please review the following concepts to improve your knowledge:\n\n" + 
                        "Review topics related to the questions you missed. Look closely at the correct answers provided and consider why your selection was incorrect.";
      } else {
        aiSummaryTips = "You did not pass the exam. It is highly recommended that you take more time to study the material and understand the underlying concepts.\n\n" + 
                        "Review all the detailed feedback provided for the questions you missed and consult with an instructor or references for further clarification.";
      }
    } else if (unansweredCount === 0) {
      aiSummaryTips = "Sensational work! You achieved a perfect score on this examination. Keep working hard and maintaining this level of academic dedication!";
    }
  } catch (aiErr) {
    console.error('Basic algorithmic feedback failed:', aiErr);
  }

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
    timeTakenSeconds: timeTakenSeconds || 0,
    aiSummaryTips,
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

    // 3. Dispatch completed result email via SMTP 3 (ONE SINGLE EMAIL)
    console.log('[Server] About to dispatch result email...');
    const smtp3 = await getSMTPServerConfig(3);
    if (smtp3 && smtp3.host && smtp3.username && smtp3.password) {
      const transporter = nodemailer.createTransport({
        host: smtp3.host,
        port: smtp3.port,
        secure: smtp3.port === 465,
        family: 4,
      connectionTimeout: 5000,
      socketTimeout: 5000,
        auth: {
          user: smtp3.username,
          pass: smtp3.password
        }
      } as any);

      // Construct Complete Review Answer Check Sheets
      const answerSheetHtml = questionsList.map((q: any, idx: number) => {
        const studentSelect = answers[q.id];
        const studentAnsText = (studentSelect !== undefined && studentSelect !== -1) ? q.englishOptions[studentSelect] : 'Unanswered';
        const correctAnsText = q.englishOptions[q.correctOptionIndex];
        const isCorrect = studentSelect !== undefined && studentSelect !== -1 && Number(studentSelect) === q.correctOptionIndex;

        return `
          <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 0;">
            <p style="font-weight: bold; margin: 0 0 6px 0;">Q${idx + 1}: ${q.englishQuestion}</p>
            <div style="font-size: 13px; margin: 2px 0;">
              - Your Answer: <span style="font-weight: 600; color: ${isCorrect ? '#10b981' : '#ef4444'};">${studentAnsText}</span><br/>
              - Correct Answer: <span style="font-weight: 600; color: #10b981;">${correctAnsText}</span>
            </div>
            <p style="font-size: 12px; color: #475569; margin: 4px 0 0 0; font-style: italic;">
              <strong>Explanation:</strong> ${q.englishExplanation || q.explanation || 'N/A'}
            </p>
          </div>
        `;
      }).join('');

      const mailOptions = {
        from: `"${smtp3.fromName || 'MLT Examination Reports'}" <${smtp3.fromEmail}>`,
        to: studentEmail,
        subject: `Exam Report: ${examName} - ${passed ? 'Passed 🎉' : 'Failed 📋'}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b; max-width: 700px; margin: 0 auto; line-height: 1.5;">
            <div style="border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px;">
              <h2 style="color: #2563eb; margin: 0 0 4px 0;">Official Academic Report</h2>
              <p style="margin: 0; color: #64748b; font-size: 14px;">MLT Exam Portal Diagnostic Service</p>
            </div>

            <p>Dear <strong>${studentName}</strong>,</p>
            <p>You have successfully completed the examination. Your final performance statistics are presented in detail below.</p>

            <!-- Score Summary Cards -->
            <div style="display: flex; gap: 15px; margin: 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
              <div style="flex: 1; text-align: center;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase;">Final Score</span>
                <h3 style="font-size: 24px; color: #1e293b; margin: 4px 0;">${score} / ${totalQuestions * positiveMarks}</h3>
              </div>
              <div style="flex: 1; text-align: center;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase;">Percentage</span>
                <h3 style="font-size: 24px; color: #2563eb; margin: 4px 0;">${percentage}%</h3>
              </div>
              <div style="flex: 1; text-align: center;">
                <span style="font-size: 12px; color: #64748b; text-transform: uppercase;">Result Status</span>
                <h3 style="font-size: 24px; color: ${passed ? '#10b981' : '#ef4444'}; margin: 4px 0;">${passed ? 'PASSED' : 'FAILED'}</h3>
              </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Incorrect Responses:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #ef4444;">${incorrectCount}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 8px 0; color: #64748b;">Unanswered Questions:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #64748b;">${unansweredCount}</td>
              </tr>
            </table>

            <!-- AI DIAGNOSTIC INSIGHTS -->
            <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin-bottom: 30px;">
              <h4 style="margin: 0 0 8px 0; color: #1e3a8a; font-size: 15px;">🤖 AI Clinical Guidance & Tutoring Analysis</h4>
              <div style="font-size: 13.5px; color: #1e40af; white-space: pre-line;">
                ${aiSummaryTips}
              </div>
            </div>

            <!-- COMPLETE ANSWER EVALUATION SHEETS -->
            <h3 style="color: #1e293b; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin: 30px 0 15px 0;">Student Answer & Correction Sheet</h3>
            <div style="margin-bottom: 30px;">
              ${answerSheetHtml}
            </div>

            <hr style="border: none; border-top: 1px solid #cbd5e1; margin-top: 30px;" />
            <p style="font-size: 11px; text-align: center; color: #94a3b8; margin-top: 8px;">
              MLT Online Examination Platform Admin Service 3 - All operations secured locally.
            </p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`Successfully dispatched SMTP 3 results report email to: ${studentEmail}`);
    } else {
      console.log(`[SMTP 3 Pending SMTP configs] Skipped result mail to: ${studentEmail}`);
    }

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
