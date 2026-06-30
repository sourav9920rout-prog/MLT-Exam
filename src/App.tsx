import React, { useState, useEffect } from 'react';
import { 
  signOut, 
  updateProfile, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  addDoc,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { auth, db } from './utils/firebase.ts';
import { 
  LogOut, 
  ShieldCheck, 
  User, 
  BookOpen, 
  Activity, 
  CheckCircle, 
  Lock, 
  ChevronRight, 
  PenTool, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Key, 
  ListOrdered,
  Eye,
  BriefcaseMedical,
  Vote,
  Printer,
  Trophy,
  Calendar,
  Star,
  Mail,
  Heart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AuthScreen from './components/AuthScreen.tsx';
import { StudentProfile } from './types.ts';

// Dynamic Sub-Components
import StudentManager from './components/StudentManager.tsx';
import QuestCreator from './components/QuestCreator.tsx';
import QuizRunner from './components/QuizRunner.tsx';
import AdminManager from './components/AdminManager.tsx';
import AdminResultsViewer from './components/AdminResultsViewer.tsx';
import Leaderboard from './components/Leaderboard.tsx';
import SmartImage from './components/SmartImage.tsx';
import AdminTakeExam from './components/AdminTakeExam.tsx';
import NoticeBoard from './components/NoticeBoard.tsx';
import AdminFeedbackViewer from './components/AdminFeedbackViewer.tsx';
import AdminChapterWise from './components/AdminChapterWise.tsx';
import StudentChapterWise from './components/StudentChapterWise.tsx';
import StudentQueries from './components/StudentQueries.tsx';
import AdminQueries from './components/AdminQueries.tsx';
import SupportTab from './components/SupportTab.tsx';
import NotesManager from './components/NotesManager.tsx';
import MockSeriesLeaderboard from './components/MockSeriesLeaderboard.tsx';

export default function App() {
  // Auth & Roles States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin' | null>(null);
  const [studentStatus, setStudentStatus] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // General Portal Switching States
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [adminTab, setAdminTab] = useState<'students' | 'exams' | 'results' | 'smtp' | 'admins' | 'mock_series' | 'notices' | 'feedback' | 'chapter_wise' | 'queries' | 'notes'>('students');
  const [studentTab, setStudentTab] = useState<'exams' | 'results' | 'profile' | 'mock_series' | 'notices' | 'chapter_wise' | 'queries' | 'support' | 'notes'>('exams');
  const [mobileTabsExpanded, setMobileTabsExpanded] = useState(false);

  const [showMobilePrompt, setShowMobilePrompt] = useState(false);
  const [mobileInput, setMobileInput] = useState('');

  // Active quiz container
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [pendingFeedbackResult, setPendingFeedbackResult] = useState<any | null>(null);
  const [feedbackRatings, setFeedbackRatings] = useState({ ux: 0, difficulty: 0, relevance: 0 });
  const [reviewResult, setReviewResult] = useState<any | null>(null);
  const [leaderboardExam, setLeaderboardExam] = useState<{ id: string, name: string } | null>(null);
  const [showMockLeaderboard, setShowMockLeaderboard] = useState(false);
  const [sendingResultEmail, setSendingResultEmail] = useState<string | null>(null);

  // Roster lists for Students
  const [activeExams, setActiveExams] = useState<any[]>([]);
  const [historicalResults, setHistoricalResults] = useState<any[]>([]);

  // Simple clean toast alert system
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

  const [requireAdminApproval, setRequireAdminApproval] = useState<boolean>(false);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.requireAdminApproval !== undefined) {
          setRequireAdminApproval(data.requireAdminApproval);
        }
      }
    });
    return () => unsubSettings();
  }, []);

  const showNotification = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 5000);
  };

  // Auth Status Watchers
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthLoading(true);
      if (user) {
        setCurrentUser(user);
        
        // 1. Check if they exist as explicitly mapped Admin
        const adminSnap = await getDoc(doc(db, 'admins', user.uid));
        if (adminSnap.exists() || user.email?.toLowerCase() === 'sourav.9920rout@gmail.com') {
          setUserRole('admin');
          setStudentStatus('approved');
        } else {
          // 2. Fetch Student detail profile
          const studentSnap = await getDoc(doc(db, 'students', user.uid));
          if (studentSnap.exists()) {
            const data = studentSnap.data() as StudentProfile;
            if (data.status === 'deleted') {
              // Create it back based on requirements
              const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
              const requireApproval = settingsSnap.exists() ? (settingsSnap.data().requireAdminApproval ?? false) : false;
              const newStatus = requireApproval ? 'pending' : 'approved';
              
              const updatedData: StudentProfile = { ...data, status: newStatus as StudentProfile["status"] };
              await updateDoc(doc(db, 'students', user.uid), { status: newStatus });
              
              // Email dispatch ignored during auto-login context to prevent spam, 
              // but we restore their state
              setStudentProfile(updatedData);
              setStudentStatus(newStatus);
              setUserRole('student');
            } else if (data.status === 'pending') {
              setStudentProfile(data);
              setStudentStatus(data.status);
              setUserRole('student');
            } else {
              setStudentProfile(data);
              setStudentStatus(data.status);
              setUserRole('student');
            }
          } else {
            // Document was completely deleted from Firestore (Permanently Expelled)
            // But user is still logged into Firebase Auth. We must re-create their registration.
            const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
            const requireApproval = settingsSnap.exists() ? (settingsSnap.data().requireAdminApproval ?? false) : false;
            const initialState = requireApproval ? 'pending' : 'approved';
            const studentData: StudentProfile = {
              uid: user.uid,
              fullName: user.displayName || 'No Name Provided',
              mobileNumber: 'Not provided',
              email: user.email?.toLowerCase() || '',
              status: initialState,
              createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'students', user.uid), studentData);
            
            setUserRole('student');
            setStudentStatus(initialState);
            setStudentProfile(studentData);
            
            if (initialState === 'pending') {
              try {
                await fetch('/api/auth/notify-registration', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify({
                     studentName: studentData.fullName,
                     studentEmail: studentData.email,
                     studentMobile: studentData.mobileNumber
                   })
                });
              } catch(e) {}
            }
          }
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
        setStudentStatus(null);
        setStudentProfile(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch student roster maps upon access approvals
  useEffect(() => {
    if (currentUser && userRole === 'student' && studentStatus === 'approved') {
      fetchExamsCatalog();
      fetchAttemptsRoster();
      
      if (studentProfile && (!studentProfile.mobileNumber || studentProfile.mobileNumber === 'Not provided')) {
        setShowMobilePrompt(true);
      }
    }
  }, [currentUser, userRole, studentStatus, studentProfile]);

  const fetchExamsCatalog = async () => {
    try {
      const snap = await getDocs(collection(db, 'exams'));
      const activeList: any[] = [];
      snap.forEach((doc) => {
        activeList.push({ id: doc.id, ...doc.data() });
      });
      setActiveExams(activeList);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttemptsRoster = async () => {
    try {
      let snap;
      if (userRole === 'admin') {
        snap = await getDocs(collection(db, 'results'));
      } else {
        const resultsQuery = query(collection(db, 'results'), where('studentId', '==', currentUser?.uid));
        snap = await getDocs(resultsQuery);
      }
      
      const resultsList: any[] = [];
      snap.forEach((docSnap) => {
        const item = docSnap.data();
        resultsList.push(item);
      });
      // Sort newest submissions first
      resultsList.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setHistoricalResults(resultsList);
    } catch (e) {
      console.error(e);
    }
  };

  // ----------------------------------------------------
  // AUTH ROUTINES OR LOGINS
  // ----------------------------------------------------

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserRole(null);
      setStudentStatus(null);
      setStudentProfile(null);
      setActiveExam(null);
      setReviewResult(null);
      showNotification('Safely disconnected.');
    } catch (e) {
      showNotification('Failed to logout cleanly.', true);
    }
  };

  const handleSaveMobileNumber = async () => {
    if (!currentUser || !mobileInput || mobileInput.length < 5) {
      showNotification('Please enter a valid mobile number.', true);
      return;
    }
    try {
      await updateDoc(doc(db, 'students', currentUser.uid), { mobileNumber: mobileInput });
      if (studentProfile) {
        setStudentProfile({ ...studentProfile, mobileNumber: mobileInput });
      }
      setShowMobilePrompt(false);
      showNotification('Mobile number saved successfully.');
    } catch (e: any) {
      showNotification(e.message || 'Failed to save mobile number.', true);
    }
  };

  const handleResendEmail = async (resItem: any) => {
    setSendingResultEmail(resItem.id);
    try {
      const questions = resItem.questionsList || [];
      const studentEmail = resItem.studentEmail || currentUser?.email || '';
      
      let htmlReport = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">`;
      htmlReport += `<h2 style="color: #2563eb; text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">${resItem.examName} - Results</h2>`;
      htmlReport += `<p>Hi <strong>${resItem.studentName || currentUser?.displayName || 'Student'}</strong>,</p>`;
      htmlReport += `<p>Here is your examination result summary and answer copy.</p>`;
      
      const maxScore = resItem.maxScore || resItem.totalQuestions;
      htmlReport += `<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">`;
      htmlReport += `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Score</td><td style="padding: 8px; border: 1px solid #ddd;">${resItem.score} / ${maxScore}</td></tr>`;
      htmlReport += `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Percentage</td><td style="padding: 8px; border: 1px solid #ddd;">${Number(resItem.percentage).toFixed(2)}%</td></tr>`;
      htmlReport += `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Status</td><td style="padding: 8px; border: 1px solid #ddd; color: ${resItem.passed ? 'green' : 'red'}; font-weight: bold;">${resItem.passed ? 'PASSED' : 'FAILED'}</td></tr>`;
      htmlReport += `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Correct</td><td style="padding: 8px; border: 1px solid #ddd; color: green;">${resItem.correctCount || 0}</td></tr>`;
      htmlReport += `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Incorrect</td><td style="padding: 8px; border: 1px solid #ddd; color: red;">${resItem.incorrectCount || 0}</td></tr>`;
      htmlReport += `<tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Skipped</td><td style="padding: 8px; border: 1px solid #ddd;">${resItem.unansweredCount || 0}</td></tr>`;
      htmlReport += `</table>`;

      htmlReport += `<h3 style="margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">Detailed Answer Copy</h3>`;
      
      questions.forEach((q: any, idx: number) => {
          const userAns = resItem.answers ? resItem.answers[q.id] : undefined;
          const isCorrect = userAns === q.correctOptionIndex;
          const statusColor = isCorrect ? 'green' : (userAns === undefined || userAns === -1 ? '#6b7280' : 'red');
          const statusText = isCorrect ? '✅ Correct' : (userAns === undefined || userAns === -1 ? '⚪ Skipped' : '❌ Incorrect');
          
          htmlReport += `<div style="margin-bottom: 25px; padding: 15px; border: 1px solid #eee; border-radius: 8px;">`;
          htmlReport += `<p style="margin: 0 0 10px 0; font-weight: bold;">Q${idx + 1}. ${q.englishQuestion}</p>`;
          
          if (q.englishOptions && q.englishOptions.length > 0) {
            q.englishOptions.forEach((opt: string, oIdx: number) => {
                let symbol = '⭕';
                let optColor = '#333';
                let optBg = 'transparent';
                if (oIdx === q.correctOptionIndex) {
                    symbol = '✓';
                    optColor = 'green';
                    optBg = '#f0fdf4';
                } else if (oIdx === userAns) {
                    symbol = '✗';
                    optColor = 'red';
                    optBg = '#fef2f2';
                }
                htmlReport += `<div style="padding: 6px; margin: 4px 0; display: flex; align-items: flex-start; color: ${optColor}; background: ${optBg}; border-radius: 4px;">`;
                htmlReport += `<span style="margin-right: 8px;">${symbol}</span><span>${opt}</span>`;
                htmlReport += `</div>`;
            });
          }
          
          htmlReport += `<p style="margin: 10px 0 0 0; color: ${statusColor}; font-weight: bold; font-size: 14px;">${statusText}</p>`;
          if (q.englishExplanation && q.englishExplanation.trim() !== '') {
              htmlReport += `<p style="margin: 10px 0 0 0; font-size: 13px; color: #4b5563; background: #f3f4f6; padding: 10px; border-radius: 4px;"><strong>Explanation:</strong><br/>${q.englishExplanation.replace(/\n/g, '<br/>')}</p>`;
          }
          htmlReport += `</div>`;
      });

      htmlReport += `<p style="text-align: center; font-size: 12px; color: #9ca3af; margin-top: 40px;">This is an automatically generated email from MLT Exams.</p>`;
      htmlReport += `</div>`;

      const response = await fetch('/api/send-result-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              studentEmail,
              studentName: resItem.studentName || currentUser?.displayName || 'Student',
              examName: resItem.examName,
              score: resItem.score,
              maxScore: maxScore,
              percentage: Number(resItem.percentage),
              htmlReport
          })
      });

      if (!response.ok) throw new Error("Failed to dispatch email");
      showNotification("Result email resent successfully!");
    } catch (err: any) {
      console.error(err);
      showNotification(err.message || "Could not resend email. Please try again.", true);
    } finally {
      setSendingResultEmail(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f4f8] text-slate-800 font-sans antialiased selection:bg-blue-200/50 selection:text-blue-900 relative overflow-hidden">
      
      {/* PREMIUM LIGHT MESH BACKGROUND */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 flex items-center justify-center p-0 m-0" aria-hidden="true">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-sky-200/50 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/40 blur-[120px]" />
        <div className="absolute top-[40%] left-[60%] w-[40%] h-[40%] rounded-full bg-violet-200/50 blur-[120px]" />
      </div>

      {/* GLOBAL NOTIFICATION COMPONENT */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3.5 rounded-xl text-xs md:text-sm shadow-xl flex items-center gap-2 border ${
              toast.isError 
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : 'bg-white border-blue-200 text-blue-800'
            }`}
          >
            {toast.isError ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span className="font-semibold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE VERIFICATION PROMPT MODAL */}
      <AnimatePresence>
        {showMobilePrompt && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl border border-slate-200 p-8 max-w-sm w-full shadow-xl space-y-5"
            >
              <div className="mx-auto bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mb-2">
                <User className="text-blue-600" size={24} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-slate-900">Add Mobile Number</h3>
                <p className="text-sm text-slate-500 mt-2">Please provide your mobile number for better communication.</p>
              </div>

              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  placeholder="Enter mobile number"
                  value={mobileInput}
                  onChange={(e) => setMobileInput(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  autoFocus
                />
                
                <button
                  onClick={handleSaveMobileNumber}
                  disabled={mobileInput.length < 5}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Save & Continue
                </button>
                <button
                  onClick={() => setShowMobilePrompt(false)}
                  className="w-full bg-transparent hover:bg-slate-50 text-slate-500 font-bold py-2 rounded-xl transition cursor-pointer text-sm"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SYSTEM NAV HEADER HEADER */}
      <header className="h-16 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between px-6 md:px-8 sticky top-0 z-30 print:hidden relative">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="MLT Achievement Logo" 
            className="w-8 h-8 md:w-10 md:h-10 object-contain shrink-0 rounded shadow-sm" 
            onError={(e) => {
              e.currentTarget.onerror = null;
              // Fallback placeholder if logo.png doesn't exist yet
              e.currentTarget.src = "https://placehold.co/100x100/eff6ff/1d4ed8?text=LOGO&font=Montserrat"; 
            }}
          />
          <div>
            <h1 className="font-bold text-blue-700 tracking-tight text-base md:text-lg leading-tight">MLT Achievement</h1>
            <p className="text-[10px] md:text-xs text-slate-500 font-medium tracking-wide hidden md:block mt-0.5">Building Achievers, Shaping Futures</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right justify-center">
              <span className="text-xs font-bold truncate leading-tight text-slate-900">{currentUser.displayName || 'Active Member'}</span>
              <span className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                {userRole === 'admin' ? 'Super Admin' : 'Student'}
              </span>
            </div>
            {currentUser.photoURL && (
              <img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
            )}
            <button
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center justify-center rounded-full cursor-pointer"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        )}
      </header>

      {/* CORE FRAME LAYOUT SECTION */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-8 h-8 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
            <p className="text-slate-550 font-mono text-xs md:text-sm">Synchronizing core auth portal states...</p>
          </div>
        ) : !currentUser ? (
          
          <AuthScreen 
            onLoading={setAuthLoading} 
            onShowNotification={showNotification} 
            onAuthSuccess={(user, role, status, profile) => {
              setCurrentUser(user);
              setUserRole(role);
              setStudentStatus(status as any);
              if (profile) setStudentProfile(profile);
            }} 
          />
        ) : studentStatus !== 'approved' && userRole !== 'admin' ? (
          
          /* PENDING / REJECTED STATUS SPLASHES */
          <div className="max-w-lg mx-auto bg-white border border-slate-200 p-8 rounded-2xl shadow-sm text-center space-y-6 mt-12 relative z-10">
            <div className={`p-4 rounded-full max-w-fit mx-auto ${studentStatus === 'rejected' || studentStatus === 'revoked' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
              <AlertCircle size={40} className="animate-bounce" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">
                {studentStatus === 'rejected' && 'Registration Application Rejected'}
                {studentStatus === 'revoked' && 'Member Access License Suspended'}
                {studentStatus === 'pending' && 'Application Profile Under Review'}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed px-4">
                {studentStatus === 'rejected' && 'Upon reviewing your details, admission administrators have rejected your platform request. Please establish contact for re-evaluations.'}
                {studentStatus === 'revoked' && 'Your access token has been revoked by administrators. Ongoing exams, historical results, and profiles are read-only.'}
                {studentStatus === 'pending' && 'Thank you for registering on MLT Portal. Your core profile status is currently pending approval. Educational exams are locked until validated.'}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-600 space-y-1">
              <p>Requested: {currentUser.email}</p>
              <p>Admissions Status: <span className="font-bold uppercase text-amber-600">{studentStatus}</span></p>
            </div>

            <button
              onClick={handleSignOut}
              className="px-6 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 shadow-sm transition text-sm font-semibold cursor-pointer text-slate-700"
            >
              Sign Out & Disconnect
            </button>
          </div>
        ) : userRole === 'admin' ? (
          
          /* 🛡️ ADMINISTRATOR PLATFORM WRAPPER */
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
              <div className="flex items-center gap-4">
                {currentUser?.photoURL && (
                  <img src={currentUser.photoURL} alt="Admin Profile" className="hidden md:block w-14 h-14 rounded-full border-2 border-slate-200 shadow-sm object-cover" referrerPolicy="no-referrer" />
                )}
                <div>
                  <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Welcome, {currentUser?.displayName || 'Administrator'}</h3>
                  <p className="text-xs text-slate-500">Super Administrator Dashboard</p>
                </div>
              </div>

              {/* NAV TAB CONTROLS */}
              <div className="flex flex-wrap gap-2 mt-4 md:mt-0 p-1.5 bg-white/70 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-full max-w-full relative z-10">
                <button
                  onClick={() => setAdminTab('students')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'students' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Student Management
                </button>
                <button
                  onClick={() => setAdminTab('exams')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'exams' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-white'
                  }`}
                >
                  Exam Bank
                </button>
                <button
                  onClick={() => setAdminTab('results')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'results' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Results
                </button>
                <button
                  onClick={() => setAdminTab('admins')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'admins' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Global Admins
                </button>
                <button
                  onClick={() => setAdminTab('mock_series')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'mock_series' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  30 Day 30 Mock Test Series
                </button>
                <button
                  onClick={() => setAdminTab('notices')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'notices' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Notice Board
                </button>
                <button
                  onClick={() => setAdminTab('feedback')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'feedback' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Ratings & Feedback
                </button>
                <button
                  onClick={() => setAdminTab('chapter_wise')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'chapter_wise' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Chapter Wise Quizzes
                </button>
                <button
                  onClick={() => setAdminTab('queries')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'queries' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Queries Requested
                </button>
                <button
                  onClick={() => setAdminTab('notes')}
                  className={`px-5 py-2 text-sm font-semibold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                    adminTab === 'notes' 
                      ? 'text-blue-800 bg-white shadow-sm border border-slate-200' 
                      : 'text-slate-600 hover:text-slate-900 border border-transparent hover:bg-slate-50'
                  }`}
                >
                  Study Notes & Drive
                </button>
              </div>
            </div>

            {/* TAB VIEWPORTS */}
            <div className="transition-all duration-200">
              {adminTab === 'students' && <StudentManager onNotify={showNotification} />}
              {adminTab === 'exams' && <QuestCreator onNotify={showNotification} />}
              {adminTab === 'results' && <AdminResultsViewer onResendEmail={handleResendEmail} sendingResultEmail={sendingResultEmail} />}
              {adminTab === 'admins' && <AdminManager onNotify={showNotification} />}
              {adminTab === 'notices' && <NoticeBoard isAdmin={true} onNotify={showNotification} />}
              {adminTab === 'feedback' && <AdminFeedbackViewer />}
              {adminTab === 'chapter_wise' && <AdminChapterWise onNotify={showNotification} />}
              {adminTab === 'queries' && <AdminQueries adminName={currentUser?.displayName || 'Admin'} adminEmail={currentUser?.email || ''} onNotify={showNotification} />}
              {adminTab === 'notes' && <NotesManager isAdmin={true} onNotify={showNotification} />}
              {adminTab === 'mock_series' && (
                <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Calendar className="text-blue-600" /> 30 Day 30 Mock Test Series Administration</h3>
                    <button 
                      onClick={() => setShowMockLeaderboard(true)} 
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg flex items-center gap-2 transition cursor-pointer border border-amber-200"
                    >
                      <Trophy size={16} /> View Overall Leaderboard
                    </button>
                  </div>
                  <AdminTakeExam filterByMockSeries={true} />
                </div>
              )}
            </div>
          </div>
        ) : (
          
          /* 🎓 STUDENT ACTIVE EXAMINATIONS VIEWPORTS */
          <div className="space-y-8">
            
            {activeExam ? (
              
              /* EXAM RUNNING ENVIRONMENT */
              <QuizRunner
                exam={activeExam}
                studentId={currentUser.uid}
                studentName={studentProfile?.fullName || currentUser.displayName || 'Student'}
                studentEmail={currentUser.email || ''}
                studentPhotoURL={currentUser.photoURL}
                onFinished={(res) => {
                  setActiveExam(null);
                  setPendingFeedbackResult(res);
                }}
                onCancel={() => {
                  setActiveExam(null);
                }}
                onNotify={showNotification}
              />
            ) : pendingFeedbackResult ? (
              <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8 relative flex flex-col items-center">
                   <div className="bg-blue-50 text-blue-600 p-4 rounded-full mb-4">
                      <Star size={32} />
                   </div>
                   <h2 className="text-2xl font-bold text-slate-900 text-center">Interview Experience</h2>
                   <p className="text-sm text-slate-500 mb-8 text-center mt-2">
                     Before we display your results, please rate your experience across these parameters.
                   </p>
                   
                   <div className="w-full space-y-6">
                     {[
                       { key: 'ux', label: 'User Experience', desc: 'How would you rate the overall platform?' },
                       { key: 'difficulty', label: 'Difficulty of Questions', desc: 'How appropriate was the difficulty level?' },
                       { key: 'relevance', label: 'Relevance of Questions', desc: 'Alignment of questions with the target role.' }
                     ].map((item) => (
                       <div key={item.key} className="space-y-2">
                         <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                           <span className="font-semibold text-slate-800 text-sm">{item.label}</span>
                           <span className="text-xs text-slate-500 hidden sm:inline">{item.desc}</span>
                         </div>
                         <div className="flex gap-2">
                           {[1, 2, 3, 4, 5].map(star => (
                             <button 
                               key={star} 
                               onClick={() => setFeedbackRatings(prev => ({ ...prev, [item.key]: star }))}
                               className={`p-2 rounded-full transition-all hover:scale-110 ${((feedbackRatings as any)[item.key] || 0) >= star ? 'text-amber-400 bg-amber-50' : 'text-slate-300 hover:text-amber-200'}`}
                             >
                               <Star size={24} fill={((feedbackRatings as any)[item.key] || 0) >= star ? 'currentColor' : 'none'} />
                             </button>
                           ))}
                         </div>
                         <p className="text-[10px] text-slate-400 sm:hidden">{item.desc}</p>
                       </div>
                     ))}
                   </div>
                   
                   <button 
                     disabled={Object.values(feedbackRatings).some(v => v === 0)}
                     onClick={async () => {
                        try {
                          await addDoc(collection(db, 'feedbacks'), {
                             studentId: currentUser.uid,
                             studentName: studentProfile?.fullName || currentUser.displayName,
                             examId: pendingFeedbackResult.examId,
                             examName: pendingFeedbackResult.examName,
                             ratings: feedbackRatings,
                             createdAt: new Date().toISOString()
                          });
                        } catch (e) {
                          console.error('Failed to submit feedback', e);
                        }
                        
                        setReviewResult(pendingFeedbackResult);
                        fetchAttemptsRoster();
                        setPendingFeedbackResult(null);
                        setFeedbackRatings({ ux: 0, difficulty: 0, relevance: 0 });
                     }}
                     className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                     Submit Feedback & View Results
                   </button>
                </div>
              </div>
            ) : reviewResult ? (
              
              /* IMMERSIVE AI DETAILED REVIEW VIEWPORT */
              <div className="space-y-6 relative z-10">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Quiz Analytics: {reviewResult.examName}</h3>
                    <p className="text-xs text-slate-550">Review correct options, diagnostic justifications, and AI Clinical guidance</p>
                  </div>
                  <div className="flex gap-2 items-center print:hidden">
                    <button
                      onClick={() => window.print()}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer flex items-center gap-2 transition"
                    >
                      <Printer size={14} /> Print / Save as PDF
                    </button>
                    <button
                      onClick={() => setReviewResult(null)}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 cursor-pointer transition"
                    >
                      Back to Results
                    </button>
                  </div>
                </div>

                {/* Score and percentage cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white/70 backdrop-blur-md border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-500 font-bold uppercase block">Final Score</span>
                    <h4 className="text-2xl font-bold text-slate-900 mt-2">{reviewResult.score} / {reviewResult.maxScore || reviewResult.totalQuestions}</h4>
                  </div>
                  <div className="bg-white/70 backdrop-blur-md border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-500 font-bold uppercase block">Percentage Pass Grade</span>
                    <h4 className="text-2xl font-bold text-blue-700 mt-2">{reviewResult.percentage}%</h4>
                  </div>
                  <div className="bg-white/70 backdrop-blur-md border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-500 font-bold uppercase block">Evaluation Status</span>
                    <span className={`inline-block mt-2 px-3.5 py-1 text-xs font-bold rounded-full ${
                      reviewResult.passed 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-rose-100 text-rose-700'
                    }`}>
                      {reviewResult.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="bg-white/70 backdrop-blur-md border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-500 font-bold uppercase block font-medium">Wrong Answers Map</span>
                    <h4 className="text-2xl font-bold text-rose-600 mt-2">{reviewResult.incorrectCount} / {reviewResult.totalQuestions}</h4>
                  </div>
                </div>

                {/* Historical answers mapping list */}
                <div className="bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm space-y-6">
                  <h4 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">Questions Review Block</h4>
                  {reviewResult.questionsList && reviewResult.questionsList.length > 0 ? (
                    <div className="divide-y divide-slate-150">
                      {reviewResult.questionsList.map((q: any, idx: number) => {
                        const studentChoiceIdx = reviewResult.answers[q.id];
                        const isCorrect = studentChoiceIdx !== undefined && Number(studentChoiceIdx) === q.correctOptionIndex;

                        return (
                          <div key={q.id} className="py-4 space-y-3">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600">Question #{idx + 1}</span>
                            <h5 className="font-medium text-slate-900 leading-relaxed text-sm md:text-base whitespace-pre-wrap">{q.englishQuestion}</h5>
                            {q.hindiQuestion && <h5 className="font-medium text-slate-800 leading-relaxed text-sm md:text-base mt-2 whitespace-pre-wrap">{q.hindiQuestion}</h5>}
                            {q.imageUrl && (
                               <div className="flex justify-center mt-2 mb-3">
                                  <SmartImage src={q.imageUrl} alt="Reference Detail" className="max-w-full h-auto max-h-48 object-contain rounded-lg border border-slate-200" />
                               </div>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {(q.englishOptions || ["", "", "", ""]).map((optText: string, oIdx: number) => {
                                const isSelected = studentChoiceIdx === oIdx;
                                const isCorrectKey = q.correctOptionIndex === oIdx;

                                return (
                                  <div 
                                    key={oIdx}
                                    className={`px-3 py-2.5 rounded-lg text-xs leading-5 border flex items-center gap-3 ${
                                      isCorrectKey 
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                        : isSelected 
                                        ? 'bg-rose-50 border-rose-300 text-rose-800' 
                                        : 'bg-slate-50 border-transparent text-slate-700'
                                    }`}
                                  >
                                    <span className="font-mono uppercase font-bold text-slate-500">
                                      {['A','B','C','D'][oIdx]}:
                                    </span>
                                    <div className="flex flex-col gap-2">
                                      {optText && <span>{optText}</span>}
                                      {q.hindiOptions?.[oIdx] && <span className="text-slate-600">{q.hindiOptions[oIdx]}</span>}
                                      {q.optionImageUrls?.[oIdx] && (
                                        <SmartImage src={q.optionImageUrls[oIdx]} alt={`Option ${oIdx + 1}`} className="max-w-full h-auto max-h-32 object-contain rounded border border-slate-200" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <p className="text-xs text-slate-550 leading-relaxed font-mono bg-slate-100 p-3 rounded-lg mt-3 border border-slate-200">
                              <strong className="text-slate-800">Rationale Guide:</strong> {q.englishExplanation || q.hindiExplanation || 'No rationale linked yet.'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-slate-400 font-mono text-xs">
                      Comprehensive rationale list snapshots are saved upon grading submissions.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              
              /* STANDARD PROFILE, EXAMS, RESULTS SWITCHER TABS */
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                  <div className="flex items-center gap-4">
                    {currentUser?.photoURL && (
                      <img src={currentUser.photoURL} alt="User Profile Avatar" className="hidden md:block w-14 h-14 rounded-full border-2 border-slate-200 shadow-sm object-cover" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Welcome, {currentUser?.displayName || studentProfile?.fullName || 'Student'}</h3>
                    </div>
                  </div>

                  {/* Tabs header list */}
                  <div className="flex flex-wrap gap-2 mt-4 md:mt-0 p-1.5 bg-white/70 backdrop-blur-md rounded-xl border border-slate-200 shadow-sm overflow-x-auto w-full max-w-full relative z-10 items-center">
                    {/* CORE TABS - ALWAYS VISIBLE */}
                    <button
                      onClick={() => setStudentTab('exams')}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        studentTab === 'exams' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      Exam Bank
                    </button>

                    <button
                      onClick={() => setStudentTab('mock_series')}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        studentTab === 'mock_series' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      30 Day 30 Mock Test Series
                    </button>

                    <button
                      onClick={() => setStudentTab('notes')}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        studentTab === 'notes' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      Study Notes & Drive 📚
                    </button>

                    {/* MOBILE DROPDOWN ARROW TOGGLE - ONLY VISIBLE ON MOBILE */}
                    <button
                      onClick={() => setMobileTabsExpanded(!mobileTabsExpanded)}
                      className="md:hidden flex items-center justify-center p-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-all cursor-pointer border border-slate-200"
                      title="Show All Navigation Tabs"
                    >
                      <span className="text-[11px] font-bold text-slate-500 mr-1 select-none">More</span>
                      <svg 
                        className={`w-4 h-4 transition-transform duration-300 ${mobileTabsExpanded ? 'rotate-180 text-blue-600' : 'rotate-0'}`} 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.5"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* EXPANDABLE / DESKTOP TABS */}
                    <button
                      onClick={() => { setStudentTab('results'); setMobileTabsExpanded(false); }}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        mobileTabsExpanded ? 'block w-full text-left md:w-auto md:text-center' : 'hidden md:block'
                      } ${
                        studentTab === 'results' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      History Results
                    </button>

                    <button
                      onClick={() => { setStudentTab('profile'); setMobileTabsExpanded(false); }}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        mobileTabsExpanded ? 'block w-full text-left md:w-auto md:text-center' : 'hidden md:block'
                      } ${
                        studentTab === 'profile' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      Profile
                    </button>

                    <button
                      onClick={() => { setStudentTab('notices'); setMobileTabsExpanded(false); }}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        mobileTabsExpanded ? 'block w-full text-left md:w-auto md:text-center' : 'hidden md:block'
                      } ${
                        studentTab === 'notices' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      Notice Board
                    </button>

                    <button
                      onClick={() => { setStudentTab('chapter_wise'); setMobileTabsExpanded(false); }}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        mobileTabsExpanded ? 'block w-full text-left md:w-auto md:text-center' : 'hidden md:block'
                      } ${
                        studentTab === 'chapter_wise' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      Chapter Wise Quizzes
                    </button>

                    <button
                      onClick={() => { setStudentTab('queries'); setMobileTabsExpanded(false); }}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        mobileTabsExpanded ? 'block w-full text-left md:w-auto md:text-center' : 'hidden md:block'
                      } ${
                        studentTab === 'queries' 
                      ? 'text-blue-900 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.3)] border border-blue-400/40' 
                      : 'text-slate-600 hover:text-blue-700 border border-transparent hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10'
                      }`}
                    >
                      Message to Admins
                    </button>

                    <button
                      onClick={() => { setStudentTab('support'); setMobileTabsExpanded(false); }}
                      className={`px-5 py-2 text-sm font-bold transition-all duration-300 cursor-pointer rounded-lg relative whitespace-nowrap ${
                        mobileTabsExpanded ? 'block w-full text-left md:w-auto md:text-center' : 'hidden md:block'
                      } shadow-[0_0_15px_rgba(45,212,191,0.5)] animate-pulse hover:animate-none ${
                        studentTab === 'support' 
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-[0_0_20px_rgba(45,212,191,0.8)] border border-transparent' 
                      : 'bg-gradient-to-r from-teal-400 to-emerald-400 text-white hover:from-teal-500 hover:to-emerald-500 border border-transparent hover:shadow-[0_0_20px_rgba(45,212,191,0.8)]'
                      }`}
                    >
                      Support the App 💖
                    </button>
                  </div>
                </div>

                {/* STUDENT RENDERING SUB TABS */}
                <div className="transition-all duration-250">
                  
                  {/* TABS: ELIGIBLE EXAMS LIST */}
                  {studentTab === 'exams' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activeExams.filter(e => !e.isHidden && !e.isMockSeries).length === 0 ? (
                        <div className="md:col-span-2 text-center py-16 bg-white/70 backdrop-blur-md relative z-10 border border-white rounded-2xl p-10 space-y-3 shadow-sm">
                          <BookOpen className="mx-auto text-slate-400" size={36} />
                          <p className="text-slate-500 font-mono text-sm leading-relaxed">No medical examinations have been scheduled live currently. Please contact Admissions Office.</p>
                        </div>
                      ) : (
                        activeExams.filter(e => !e.isHidden && !e.isMockSeries).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((exam, index) => {
                          const hasAttempted = userRole === 'student' && historicalResults.some(res => res.examId === exam.id);
                          
                          return (
                          <div key={exam.id} className="bg-white/70 backdrop-blur-md relative z-10 border border-white rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition">
                            <div className="space-y-2">
                              <div className="flex gap-2 items-center">
                                <h4 className="font-bold text-slate-900 text-base md:text-lg">{index + 1}. {exam.title}</h4>
                                {exam.isMockSeries && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">Mock Series</span>}
                              </div>
                              <details className="mt-2 group">
                                <summary className="text-[11px] font-semibold text-slate-500 cursor-pointer list-none flex items-center hover:text-slate-800 transition-colors select-none [&::-webkit-details-marker]:hidden">
                                  <span className="flex items-center gap-1.5">
                                    <span className="group-open:rotate-90 transition-transform duration-200 text-[10px]">▶</span>
                                    <span className="group-open:hidden">View Details</span>
                                    <span className="hidden group-open:inline">Hide Details</span>
                                  </span>
                                </summary>
                                <div className="mt-3 p-3 bg-white border border-slate-100 rounded-lg">
                                  <p className="text-slate-600 text-sm leading-relaxed font-normal">{exam.description || 'No additional syllabus mapped.'}</p>
                                </div>
                              </details>
                              <div className="flex gap-4 pt-2 font-mono text-[11px] text-slate-500">
                                <span>⏲️ Speed: {exam.durationMinutes} Minutes</span>
                                <span>🎯 Correct Rate: {exam.passingPercentage}% pass</span>
                                <span>📋 Item Counts: {exam.questionIds?.length || 0} MCQs</span>
                              </div>
                            </div>
                            <div className="flex flex-col mt-auto h-full justify-end">
                              {hasAttempted ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    disabled
                                    className="flex-1 py-1.5 rounded-md font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                  >
                                    Attempted
                                  </button>
                                  <button
                                    onClick={() => {
                                      const resItem = historicalResults.find(res => res.examId === exam.id);
                                      if (resItem) setReviewResult(resItem);
                                    }}
                                    className="flex-1 py-1.5 rounded-md font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 shadow-sm cursor-pointer"
                                  >
                                    <Eye size={13} /> View Result
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActiveExam(exam)}
                                  className="w-full py-1.5 rounded-md font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 shadow-[0_2px_10px_rgba(37,99,235,0.2)] bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                >
                                  Launch Examination <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )})
                      )}
                    </div>
                  )}

                  {/* TABS: COMPLETED RESULTS LIST */}
                  {studentTab === 'results' && (
                    <div className="bg-white/70 backdrop-blur-md relative z-10 border border-slate-200 rounded-xl p-6 shadow-sm">
                      {historicalResults.length === 0 ? (
                        <div className="text-center py-12 text-slate-500 font-mono text-sm">
                          Result documents will generate immediately upon complete answers submission.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Desktop Table View */}
                          <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left text-sm border-collapse">
                              <thead>
                                <tr className="border-b border-slate-200 text-slate-500 font-mono text-xs uppercase bg-slate-50/50 p-2">
                                  <th className="py-3 px-4 font-normal">Exam Name</th>
                                  <th className="py-3 px-4 font-normal">Submission Date</th>
                                  <th className="py-3 px-4 font-normal">Percentage Grade</th>
                                  <th className="py-3 px-4 font-normal">Results Verdict</th>
                                  <th className="py-3 px-4 font-normal text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {historicalResults.map((resItem, index) => (
                                  <tr key={resItem.id} className="hover:bg-slate-50 transition">
                                    <td className="py-4 px-4 font-semibold text-slate-900"><span className="text-slate-400 font-mono text-xs mr-2">{index + 1}.</span>{resItem.examName}</td>
                                    <td className="py-4 px-4 font-mono text-xs text-slate-500">
                                      {new Date(resItem.submittedAt).toLocaleDateString()}
                                    </td>
                                    <td className="py-4 px-4 font-bold text-blue-700">{resItem.percentage}% <span className="text-slate-400 text-xs font-normal">({resItem.score}/{resItem.maxScore || resItem.totalQuestions})</span></td>
                                    <td className="py-4 px-4">
                                      <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                        resItem.passed ? 'bg-emerald-100 text-emerald-700 font-mono border border-emerald-200' : 'bg-rose-100 text-rose-700 font-mono border border-rose-200'
                                      }`}>
                                        {resItem.passed ? 'Passed 🎉' : 'Failed 📋'}
                                      </span>
                                    </td>
                                    <td className="py-4 px-4 text-right flex items-center justify-end gap-2 text-nowrap">
                                      {activeExams.find(e => e.id === resItem.examId)?.showLeaderboard && (
                                        <button
                                          onClick={() => setLeaderboardExam({ id: resItem.examId, name: resItem.examName })}
                                          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700 cursor-pointer flex items-center justify-center gap-1 bg-white"
                                        >
                                          <Trophy size={13} /> Leaderboard
                                        </button>
                                      )}
                                      <button
                                        onClick={() => handleResendEmail(resItem)}
                                        disabled={sendingResultEmail === resItem.id}
                                        className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg border ${sendingResultEmail === resItem.id ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed' : 'border-indigo-200 hover:bg-indigo-50 text-indigo-700 cursor-pointer bg-white'} flex items-center justify-center gap-1`}
                                      >
                                        <Mail size={13} /> 
                                        {sendingResultEmail === resItem.id ? 'Sending...' : 'Email Result'}
                                      </button>
                                      <button
                                        onClick={() => setReviewResult(resItem)}
                                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-teal-200 hover:bg-teal-50 text-teal-700 cursor-pointer flex items-center justify-center gap-1 bg-white"
                                      >
                                        <Eye size={13} /> View Correction
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Mobile Cards View */}
                          <div className="md:hidden space-y-3">
                            {historicalResults.map((resItem, index) => (
                              <div key={resItem.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex flex-col gap-3">
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <h4 className="font-semibold text-slate-900 text-sm leading-tight"><span className="text-slate-400 font-mono text-xs mr-1">{index + 1}.</span>{resItem.examName}</h4>
                                    <p className="font-mono text-xs text-slate-500 mt-1.5">{new Date(resItem.submittedAt).toLocaleDateString()}</p>
                                  </div>
                                  <span className={`shrink-0 inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                    resItem.passed ? 'bg-emerald-100 text-emerald-700 font-mono border border-emerald-200' : 'bg-rose-100 text-rose-700 font-mono border border-rose-200'
                                  }`}>
                                    {resItem.passed ? 'Passed 🎉' : 'Failed 📋'}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-sm py-1">
                                  <span className="text-slate-500 font-medium text-xs">Score</span>
                                  <span className="font-bold text-slate-900">{resItem.percentage}% <span className="text-slate-400 font-medium text-xs ml-1">({resItem.score}/{resItem.maxScore || resItem.totalQuestions})</span></span>
                                </div>
                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                  {activeExams.find(e => e.id === resItem.examId)?.showLeaderboard && (
                                    <button
                                      onClick={() => setLeaderboardExam({ id: resItem.examId, name: resItem.examName })}
                                      className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-amber-200 hover:bg-amber-50 text-amber-700 cursor-pointer flex items-center justify-center gap-1.5 bg-white"
                                    >
                                      <Trophy size={13} /> Leaderboard
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleResendEmail(resItem)}
                                    disabled={sendingResultEmail === resItem.id}
                                    className={`flex-1 px-2.5 py-2 text-xs font-semibold rounded-lg border ${sendingResultEmail === resItem.id ? 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed' : 'border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400 cursor-pointer'} flex items-center justify-center gap-1.5 bg-transparent shrink-0`}
                                  >
                                    <Mail size={13} /> {sendingResultEmail === resItem.id ? 'Wait...' : 'Email'}
                                  </button>
                                  <button
                                    onClick={() => setReviewResult(resItem)}
                                    className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg border border-teal-500/30 hover:bg-teal-500/10 text-teal-400 cursor-pointer flex items-center justify-center gap-1.5 bg-transparent"
                                  >
                                    <Eye size={13} /> Review
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TABS: PROFILE EDITING */}
                  {studentTab === 'profile' && (
                    <div className="bg-white/70 backdrop-blur-md relative z-10 border border-slate-200 rounded-xl p-6.5 max-w-xl shadow-sm space-y-6">
                      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                        {currentUser.photoURL ? (
                          <img src={currentUser.photoURL} alt="User Profile Avatar" className="w-16 h-16 rounded-full border-2 border-slate-200 shadow-sm object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 border border-slate-200">
                             <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-900 text-md">Identity Details & Security Account</h4>
                          <p className="text-xs text-slate-500 mt-1">Manage your connected Google Account identity</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4 bg-slate-50 p-4 border border-slate-200 rounded-xl font-mono text-xs text-slate-600">
                        <p><strong className="text-slate-800">Email Address:</strong> {currentUser.email} <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1 ml-1.5 font-bold uppercase select-none">Read Only</span></p>
                        <p><strong className="text-slate-800">Full Name:</strong> {studentProfile?.fullName || currentUser.displayName} <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1 ml-1.5 font-bold uppercase select-none">Read Only</span></p>
                        <p><strong className="text-slate-800">Verification status:</strong> APPROVED STATUS ACTIVE</p>
                      </div>

                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Update Mobile Number</label>
                          <input
                            type="text"
                            placeholder="Your mobile phone number"
                            value={mobileInput || (studentProfile?.mobileNumber && studentProfile.mobileNumber !== 'Not provided' ? studentProfile.mobileNumber : '')}
                            onChange={(e) => setMobileInput(e.target.value)}
                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
                          />
                        </div>

                        <button
                          onClick={handleSaveMobileNumber}
                          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-[0_2px_10px_rgba(37,99,235,0.2)]"
                        >
                          Save Mobile Number
                        </button>
                      </div>
                    </div>
                  )}

                  {/* TABS: MOCK SERIES */}
                  {studentTab === 'mock_series' && (
                    <div className="space-y-4 relative z-10">
                      <div className="flex justify-end mb-2">
                        <button 
                          onClick={() => setShowMockLeaderboard(true)} 
                          className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold text-sm rounded-lg flex items-center gap-2 transition cursor-pointer border border-amber-200 shadow-sm"
                        >
                          <Trophy size={16} /> View Overall Leaderboard
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {activeExams.filter(e => e.isMockSeries && !e.isHidden).length === 0 ? (
                        <div className="md:col-span-2 text-center py-16 bg-white/70 backdrop-blur-md relative z-10 border border-slate-200 rounded-2xl p-10 space-y-3 shadow-sm">
                          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                            <Calendar size={32} />
                          </div>
                          <h3 className="text-xl font-bold text-slate-900">30 Day 30 Mock Test Series</h3>
                          <p className="text-slate-500 font-mono text-sm leading-relaxed">Coming live on 20th June Stay Tuned</p>
                        </div>
                      ) : (
                        activeExams.filter(e => e.isMockSeries && !e.isHidden).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((exam, index) => {
                          const hasAttempted = userRole === 'student' && historicalResults.some(res => res.examId === exam.id);
                          
                          return (
                          <div key={exam.id} className="bg-white/70 backdrop-blur-md relative z-10 border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition">
                            <div className="space-y-2">
                              <div className="flex gap-2 items-center">
                                <h4 className="font-bold text-slate-900 text-base md:text-lg">{index + 1}. {exam.title}</h4>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">Mock Series</span>
                              </div>
                              <details className="mt-2 group">
                                <summary className="text-[11px] font-semibold text-slate-500 cursor-pointer list-none flex items-center hover:text-slate-800 transition-colors select-none [&::-webkit-details-marker]:hidden">
                                  <span className="flex items-center gap-1.5">
                                    <span className="group-open:rotate-90 transition-transform duration-200 text-[10px]">▶</span>
                                    <span className="group-open:hidden">View Details</span>
                                    <span className="hidden group-open:inline">Hide Details</span>
                                  </span>
                                </summary>
                                <div className="mt-3 p-3 bg-white border border-slate-100 rounded-lg">
                                  <p className="text-slate-600 text-sm leading-relaxed font-normal">{exam.description || 'No additional syllabus mapped.'}</p>
                                </div>
                              </details>
                              <div className="flex gap-4 pt-2 font-mono text-[11px] text-slate-500">
                                <span>⏲️ Speed: {exam.durationMinutes} Minutes</span>
                                <span>🎯 Correct Rate: {exam.passingPercentage}% pass</span>
                                <span>📋 Item Counts: {exam.questionIds?.length || 0} MCQs</span>
                              </div>
                            </div>
                            <div className="flex flex-col mt-auto h-full justify-end">
                              {hasAttempted ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    disabled
                                    className="flex-1 py-1.5 rounded-md font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                  >
                                    Attempted
                                  </button>
                                  <button
                                    onClick={() => {
                                      const resItem = historicalResults.find(res => res.examId === exam.id);
                                      if (resItem) setReviewResult(resItem);
                                    }}
                                    className="flex-1 py-1.5 rounded-md font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 bg-white border border-teal-200 text-teal-700 hover:bg-teal-50 shadow-sm cursor-pointer"
                                  >
                                    <Eye size={13} /> View Result
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setActiveExam(exam)}
                                  className="w-full py-1.5 rounded-md font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 shadow-[0_2px_10px_rgba(37,99,235,0.2)] bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                >
                                  Launch Examination <ChevronRight size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        )})
                      )}
                      </div>
                    </div>
                  )}

                  {/* TABS: NOTICES */}
                  {studentTab === 'notices' && <NoticeBoard isAdmin={false} onNotify={showNotification} />}

                  {studentTab === 'chapter_wise' && (
                    <StudentChapterWise 
                      studentId={currentUser.uid}
                      studentName={studentProfile?.fullName || currentUser.displayName || 'Student'}
                      studentEmail={currentUser.email || ''}
                      onNotify={showNotification}
                    />
                  )}

                  {studentTab === 'queries' && (
                    <StudentQueries 
                      studentId={currentUser.uid}
                      studentName={studentProfile?.fullName || currentUser.displayName || 'Student'}
                      studentEmail={currentUser.email || ''}
                      onNotify={showNotification}
                    />
                  )}

                  {studentTab === 'notes' && (
                    <NotesManager 
                      isAdmin={false}
                      onNotify={showNotification}
                    />
                  )}

                  {studentTab === 'support' && <SupportTab />}
                </div>
              </div>
            )}
          </div>
        )}

        {leaderboardExam && (
          <Leaderboard 
            examId={leaderboardExam.id} 
            examName={leaderboardExam.name} 
            studentId={currentUser?.uid}
            onClose={() => setLeaderboardExam(null)} 
          />
        )}

        {showMockLeaderboard && (
          <MockSeriesLeaderboard 
            studentId={currentUser?.uid}
            onClose={() => setShowMockLeaderboard(false)} 
          />
        )}

      </main>

      {/* FOOTER */}
      {!activeExam && (
        <footer className="py-6 border-t border-slate-200 text-center text-[10px] md:text-xs font-mono text-slate-500 print:hidden flex flex-col items-center gap-2 px-4 relative z-10">
          <p className="text-slate-600 mb-1">If you face any problem kindly join our group and tell us:</p>
          <div className="flex flex-wrap justify-center items-center gap-3">
            <a href="https://chat.whatsapp.com/Kpn6wug6PmyBHUqzgqIiym" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-white  border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors shadow-sm text-slate-800">
              <svg viewBox="0 0 24 24" fill="#22c55e" className="w-4 h-4 shrink-0"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
              <span className="font-semibold text-xs text-slate-900 font-sans tracking-tight">MLT Achievement</span>
            </a>
          </div>
        </footer>
      )}
    </div>
  );
}
