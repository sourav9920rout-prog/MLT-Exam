import { google } from 'googleapis';

/**
 * Appends an exam result row to a Google Sheet.
 * Fails gracefully if environment credentials are not present.
 */
export async function appendResultToGoogleSheet(data: {
  studentName: string;
  studentEmail: string;
  mobile?: string;
  examName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  timeTaken?: number;
  submittedAt: string;
}) {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Handle new lines in private key which is common for environment variables
  const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!serviceAccountEmail || !privateKeyRaw || !sheetId) {
    console.warn('Google Sheets configuration missing. Skipping Sheet append.');
    return { success: false, reason: 'Credentials not configured' };
  }

  try {
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Format: Timestamp, Name, Email, Mobile, Exam, Score, Percentage, Result, Time Taken
    const values = [
      [
        data.submittedAt,
        data.studentName,
        data.studentEmail,
        data.mobile || 'N/A',
        data.examName,
        data.score,
        `${data.percentage}%`,
        data.passed ? 'PASSED' : 'FAILED',
        data.timeTaken ? `${Math.floor(data.timeTaken / 60)}m ${data.timeTaken % 60}s` : 'N/A'
      ]
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    console.log('Successfully appended result row to Google Sheet.');
    return { success: true };
  } catch (error) {
    console.error('Failed to append to Google Sheet:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
