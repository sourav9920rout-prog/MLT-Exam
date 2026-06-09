/**
 * Shared Type Definitions for MLT Exam Portal
 */

export interface UserProfile {
  uid: string;
  email: string;
  role: 'student' | 'admin';
  createdAt: string;
}

export interface StudentProfile {
  uid: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked' | 'deleted';
  createdAt: string;
}

export interface AdminRecord {
  uid: string;
  email: string;
  createdAt: string;
}

export interface BankQuestion {
  id: string; // The doc ID
  englishQuestion: string;
  hindiQuestion: string;
  imageUrl?: string;
  optionImageUrls?: string[];
  englishOptions: string[];
  hindiOptions: string[];
  correctOptionIndex: number; // 0-based
  englishExplanation: string;
  hindiExplanation: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: number;
}

export interface ExamSection {
  id: string;
  title: string;
  questionCount: number;
  durationMinutes: number;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  positiveMarks: number;
  negativeMarks: number;
  startDate: number;
  endDate: number;
  startTime: string; // e.g., "09:00"
  endTime: string;
  durationMinutes: number;
  passingPercentage: number;
  questionIds: string[]; // typically 100 question IDs
  sections: ExamSection[];
  showLeaderboard?: boolean;
  createdAt: string;
}

export interface ExamAttempt {
  id: string;
  studentId: string;
  examId: string;
  answers: { [questionId: string]: number }; // qId -> selectedOptionIndex
  savedStates: { [questionId: string]: 'saved' | 'review' | 'none' };
  status: 'started' | 'submitted' | 'banned';
  currentSectionIndex: number;
  timeRemainingSeconds: number;
  startedAt: string;
  updatedAt: string;
  refreshCount?: number;
}

export interface Result {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  examId: string;
  examName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  answers: { [questionId: string]: number }; // student answers
  // We don't store 100 explanations here. We just store the question IDs and link them back client-side.
  questionIds: string[];
  submittedAt: string;
  timeTakenSeconds: number;
}

export interface SMTPConfig {
  host: string;
  port: number;
  username: string;
  password: ""; // Write-only dummy or secure actual
}

export interface EmailConfigs {
  id: string; // e.g. 'smtp_configs'
  smtp1: SMTPConfig; // OTP Verification Service
  smtp2: SMTPConfig; // Registration Management
  smtp3: SMTPConfig; // Exam Result Service
}
