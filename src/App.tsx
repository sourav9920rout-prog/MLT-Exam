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
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  getDocs, 
  query, 
  where 
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
  Vote
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AuthScreen from './components/AuthScreen.tsx';
import { StudentProfile } from './types.ts';

// Dynamic Sub-Components
import StudentManager from './components/StudentManager.tsx';
import EmailSettingsPage from './components/EmailSettingsPage.tsx';
import QuestCreator from './components/QuestCreator.tsx';
import QuizRunner from './components/QuizRunner.tsx';
import AdminManager from './components/AdminManager.tsx';

export default function App() {
  // Auth & Roles States
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<'student' | 'admin' | null>(null);
  const [studentStatus, setStudentStatus] = useState<string | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // General Portal Switching States
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [adminTab, setAdminTab] = useState<'students' | 'exams' | 'smtp' | 'admins'>('students');
  const [studentTab, setStudentTab] = useState<'exams' | 'results' | 'profile'>('exams');

  const [showMobilePrompt, setShowMobilePrompt] = useState(false);
  const [mobileInput, setMobileInput] = useState('');

  // Active quiz container
  const [activeExam, setActiveExam] = useState<any | null>(null);
  const [reviewResult, setReviewResult] = useState<any | null>(null);

  // Roster lists for Students
  const [activeExams, setActiveExams] = useState<any[]>([]);
  const [historicalResults, setHistoricalResults] = useState<any[]>([]);

  // Simple clean toast alert system
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);

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
              // Create it back as pending
              const updatedData = { ...data, status: 'pending' as const };
              await updateDoc(doc(db, 'students', user.uid), { status: 'pending' });
              
              // Email dispatch ignored during auto-login context to prevent spam, 
              // but we restore their state
              setStudentProfile(updatedData);
              setStudentStatus('pending');
              setUserRole('student');
            } else {
              setStudentProfile(data);
              setStudentStatus(data.status);
              setUserRole('student');
            }
          } else {
            // Document was completely deleted from Firestore (Permanently Expelled)
            // But user is still logged into Firebase Auth. We must re-create their registration.
            const studentData: StudentProfile = {
              uid: user.uid,
              fullName: user.displayName || 'No Name Provided',
              mobileNumber: 'Not provided',
              email: user.email?.toLowerCase() || '',
              status: 'pending',
              createdAt: new Date().toISOString()
            };
            
            await setDoc(doc(db, 'students', user.uid), studentData);
            
            setUserRole('student');
            setStudentStatus('pending');
            setStudentProfile(studentData);
            
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

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const credentialUser = res.user;

      let isAdminAttempt = false;

      if (credentialUser.email && credentialUser.email.toLowerCase() === 'sourav.9920rout@gmail.com') {
         isAdminAttempt = true;
      } else if (credentialUser.email) {
         const adminEmailSnap = await getDoc(doc(db, 'adminEmails', credentialUser.email.toLowerCase()));
         if (adminEmailSnap.exists()) {
            isAdminAttempt = true;
         }
      }

      if (!credentialUser) {
          throw new Error("Unable to authenticate user");
      }

      if (isAdminAttempt) {
         // Auto write admin document for permissions since email matched VITE vars
         await setDoc(doc(db, 'admins', credentialUser.uid), {
             uid: credentialUser.uid,
             email: credentialUser.email,
             createdAt: new Date().toISOString()
         });

         setUserRole('admin');
         setStudentStatus('approved');
         setCurrentUser(credentialUser);
         showNotification('Admin Authenticated successfully. Heading to controls panel.');
         setAuthLoading(false);
         return;
      }

      // Normal Student authenticates here
      const studentSnap = await getDoc(doc(db, 'students', credentialUser.uid));
      
      if (studentSnap.exists()) {
        const data = studentSnap.data() as StudentProfile;
        
        if (data.status === 'deleted' || data.status === 'rejected') {
          const updatedData = { ...data, status: 'pending' };
          await updateDoc(doc(db, 'students', credentialUser.uid), { status: 'pending' });
          
          try {
            await fetch('/api/auth/notify-registration', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                studentName: updatedData.fullName,
                studentEmail: updatedData.email,
                studentMobile: updatedData.mobileNumber
              })
            });
          } catch (emailErr) {
            console.error('Failed to dispatch registration email:', emailErr);
          }

          setStudentProfile(updatedData as StudentProfile);
          setStudentStatus('pending');
          setUserRole('student');
          setCurrentUser(credentialUser);
          showNotification('New access request submitted successfully.');
        } else {
          setStudentProfile(data);
          setStudentStatus(data.status);
          setUserRole('student');
          setCurrentUser(credentialUser);
          showNotification('Authenticated as Student successfully.');
        }
      } else {
        // Standard user does not have details. Map as pending student
        const adminCheck = await getDoc(doc(db, 'admins', credentialUser.uid));
        if (adminCheck.exists()) {
          setUserRole('admin');
          setStudentStatus('approved');
        } else {
          // Construct Student Profile
          const studentData: StudentProfile = {
            uid: credentialUser.uid,
            fullName: credentialUser.displayName || 'No Name Provided',
            mobileNumber: 'Not provided',
            email: credentialUser.email?.toLowerCase() || '',
            status: 'pending',
            createdAt: new Date().toISOString()
          };

          // Store Student Profile document (status = pending)
          await setDoc(doc(db, 'students', credentialUser.uid), studentData);

          // Save metadata audit profile
          await setDoc(doc(db, 'users', credentialUser.uid), {
            uid: credentialUser.uid,
            email: credentialUser.email?.toLowerCase() || '',
            role: 'student',
            createdAt: new Date().toISOString()
          });

          // Dispatch email notification to student & admin
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
          } catch (emailErr) {
            console.error('Failed to dispatch registration email:', emailErr);
          }

          setStudentProfile(studentData);
          setUserRole('student');
          setStudentStatus('pending');
        }
        setCurrentUser(credentialUser);
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      
      if (error.code === 'auth/popup-closed-by-user') {
        showNotification('Sign in was cancelled. Please try again when you are ready.', true);
        setAuthLoading(false);
        return;
      }
      
      const msg = error.code === 'auth/invalid-credential' 
        ? 'Invalid email or password.' 
        : error.message || 'Authentication rejected. If you are an Admin, please check credentials.';
      showNotification(`SignIn Failed: ${msg}`, true);
    } finally {
      setAuthLoading(false);
    }
  };

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

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-[#1e293b] font-sans antialiased selection:bg-blue-100 selection:text-blue-800">
      
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 md:px-8 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded flex items-center justify-center text-white font-bold shrink-0">
            <span className="text-sm md:text-base tracking-tight hidden md:inline">M</span>
            <BriefcaseMedical size={18} className="animate-pulse md:hidden" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 tracking-tight text-base md:text-lg leading-tight">MLT Portal</h1>
            <p className="text-[10px] md:text-xs text-slate-400 uppercase font-semibold tracking-widest hidden md:block">Examination System</p>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right justify-center">
              <span className="text-xs font-bold truncate leading-tight">{currentUser.displayName || 'Active Member'}</span>
              <span className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                {userRole === 'admin' ? 'Super Admin' : 'Student'}
              </span>
            </div>
            {currentUser.photoURL && (
              <img src={currentUser.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" referrerPolicy="no-referrer" />
            )}
            <button
              onClick={handleSignOut}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors flex items-center justify-center rounded-full hover:bg-slate-100 cursor-pointer"
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
          <div className="max-w-lg mx-auto bg-white border border-slate-200 p-8 rounded-2xl shadow-xl text-center space-y-6 mt-12">
            <div className={`p-4 rounded-full max-w-fit mx-auto ${studentStatus === 'rejected' || studentStatus === 'revoked' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
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

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-500 space-y-1">
              <p>Requested: {currentUser.email}</p>
              <p>Admissions Status: <span className="font-bold uppercase text-amber-600">{studentStatus}</span></p>
            </div>

            <button
              onClick={handleSignOut}
              className="px-6 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 transition text-sm font-semibold cursor-pointer"
            >
              Sign Out & Disconnect
            </button>
          </div>
        ) : userRole === 'admin' ? (
          
          /* 🛡️ ADMINISTRATOR PLATFORM WRAPPER */
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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
              <div className="flex space-x-2 border-b border-slate-200 mt-4 md:mt-0">
                <button
                  onClick={() => setAdminTab('students')}
                  className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                    adminTab === 'students' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Student Management
                </button>
                <button
                  onClick={() => setAdminTab('exams')}
                  className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                    adminTab === 'exams' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Exam Bank
                </button>
                <button
                  onClick={() => setAdminTab('smtp')}
                  className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                    adminTab === 'smtp' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Email Settings
                </button>
                <button
                  onClick={() => setAdminTab('admins')}
                  className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                    adminTab === 'admins' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Global Admins
                </button>
              </div>
            </div>

            {/* TAB VIEWPORTS */}
            <div className="transition-all duration-200">
              {adminTab === 'students' && <StudentManager onNotify={showNotification} />}
              {adminTab === 'exams' && <QuestCreator onNotify={showNotification} />}
              {adminTab === 'smtp' && <EmailSettingsPage onNotify={showNotification} />}
              {adminTab === 'admins' && <AdminManager onNotify={showNotification} />}
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
                  setStudentTab('results'); // switch to review results list
                  fetchAttemptsRoster(); // refresh attempts database list
                }}
                onCancel={() => {
                  setActiveExam(null);
                }}
                onNotify={showNotification}
              />
            ) : reviewResult ? (
              
              /* IMMERSIVE AI DETAILED REVIEW VIEWPORT */
              <div className="space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Quiz Analytics: {reviewResult.examName}</h3>
                    <p className="text-xs text-slate-550">Review correct options, diagnostic justifications, and AI Clinical guidance</p>
                  </div>
                  <button
                    onClick={() => setReviewResult(null)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 cursor-pointer transition"
                  >
                    Back to Results
                  </button>
                </div>

                {/* Score and percentage cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-400 font-bold uppercase block">Final Score</span>
                    <h4 className="text-2xl font-bold text-slate-900 mt-2">{reviewResult.score} / {reviewResult.totalQuestions}</h4>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-400 font-bold uppercase block">Percentage Pass Grade</span>
                    <h4 className="text-2xl font-bold text-blue-600 mt-2">{reviewResult.percentage}%</h4>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-400 font-bold uppercase block">Evaluation Status</span>
                    <span className={`inline-block mt-2 px-3.5 py-1 text-xs font-bold rounded-full ${
                      reviewResult.passed 
                        ? 'bg-emerald-55 text-emerald-800' 
                        : 'bg-rose-55 text-rose-800'
                    }`}>
                      {reviewResult.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                    <span className="text-xs font-mono text-slate-400 font-bold uppercase block font-medium">Wrong Answers Map</span>
                    <h4 className="text-2xl font-bold text-rose-600 mt-2">{reviewResult.incorrectCount} / {reviewResult.totalQuestions}</h4>
                  </div>
                </div>

                {/* CLINICAL AI GENERATED INSIGHT REPORT */}
                <div className="bg-blue-600 text-white rounded-xl p-6 md:p-8 space-y-4 shadow-md border border-blue-500">
                  <div className="flex items-center gap-2 bg-white/10 max-w-fit px-3 py-1.5 rounded-lg border border-white/10">
                    <CheckCircle className="text-amber-300 animate-pulse" size={16} />
                    <span className="text-xs font-mono font-bold tracking-wider uppercase text-yellow-100">🤖 AI Diagnostic Tutoring Recommendation</span>
                  </div>
                  <div className="text-sm leading-relaxed whitespace-pre-line text-blue-50">
                    {reviewResult.aiSummaryTips}
                  </div>
                </div>

                {/* Historical answers mapping list */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm space-y-6">
                  <h4 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">Questions Review Block</h4>
                  {reviewResult.questionsList && reviewResult.questionsList.length > 0 ? (
                    <div className="divide-y divide-slate-150">
                      {reviewResult.questionsList.map((q: any, idx: number) => {
                        const studentChoiceIdx = reviewResult.answers[q.id];
                        const isCorrect = studentChoiceIdx !== undefined && Number(studentChoiceIdx) === q.correctOptionIndex;

                        return (
                          <div key={q.id} className="py-4 space-y-3">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600">Question #{idx + 1}</span>
                            <h5 className="font-medium text-slate-900 leading-relaxed text-sm md:text-base">{q.questionText}</h5>
                            {q.imageUrl && (
                               <div className="flex justify-center mt-2 mb-3">
                                  <img src={q.imageUrl} alt="Reference Detail" className="max-w-full h-auto max-h-48 object-contain rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                               </div>
                            )}
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                              {q.options.map((optText: string, oIdx: number) => {
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
                                      {q.optionImageUrls?.[oIdx] && (
                                        <img src={q.optionImageUrls[oIdx]} alt={`Option ${oIdx + 1}`} className="max-w-full h-auto max-h-32 object-contain rounded border border-slate-200" referrerPolicy="no-referrer" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <p className="text-xs text-slate-550 leading-relaxed font-mono bg-slate-100 p-3 rounded-lg mt-3 border border-slate-200">
                              <strong className="text-slate-800">Rationale Guide:</strong> {q.explanation || 'No rationale linked yet.'}
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
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    {currentUser?.photoURL && (
                      <img src={currentUser.photoURL} alt="User Profile Avatar" className="hidden md:block w-14 h-14 rounded-full border-2 border-slate-200 shadow-sm object-cover" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h3 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Welcome, {currentUser?.displayName || studentProfile?.fullName || 'Student'}</h3>
                      <p className="text-xs text-slate-500">Live evaluations, diagnostic syllabus, and active testing controls</p>
                    </div>
                  </div>

                  {/* Tabs header list */}
                  <div className="flex space-x-2 border-b border-slate-200 mt-4 md:mt-0">
                    <button
                      onClick={() => setStudentTab('exams')}
                      className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                        studentTab === 'exams' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Exam Bank
                    </button>
                    <button
                      onClick={() => setStudentTab('results')}
                      className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                        studentTab === 'results' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      History Results
                    </button>
                    <button
                      onClick={() => setStudentTab('profile')}
                      className={`px-4 py-2 text-sm font-medium transition cursor-pointer -mb-px ${
                        studentTab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Profile
                    </button>
                  </div>
                </div>

                {/* STUDENT RENDERING SUB TABS */}
                <div className="transition-all duration-250">
                  
                  {/* TABS: ELIGIBLE EXAMS LIST */}
                  {studentTab === 'exams' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {activeExams.length === 0 ? (
                        <div className="md:col-span-2 text-center py-16 bg-white border border-slate-200 rounded-2xl p-10 space-y-3 shadow-none">
                          <BookOpen className="mx-auto text-slate-300" size={36} />
                          <p className="text-slate-500 font-mono text-sm leading-relaxed">No medical examinations have been scheduled live currently. Please contact Admissions Office.</p>
                        </div>
                      ) : (
                        activeExams.map((exam) => {
                          const hasAttempted = userRole === 'student' && historicalResults.some(res => res.examId === exam.id);
                          
                          return (
                          <div key={exam.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-between space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-bold text-slate-900 text-base md:text-lg">{exam.title}</h4>
                              <p className="text-slate-600 text-sm leading-relaxed font-normal">{exam.description || 'No additional syllabus mapped.'}</p>
                              <div className="flex gap-4 pt-2 font-mono text-[11px] text-slate-500">
                                <span>⏲️ Speed: {exam.durationMinutes} Minutes</span>
                                <span>🎯 Correct Rate: {exam.passingPercentage}% pass</span>
                                <span>📋 Item Counts: {exam.questionIds?.length || 0} MCQs</span>
                              </div>
                            </div>
                            <div className="flex flex-col space-y-2">
                              <button
                                disabled={hasAttempted}
                                onClick={() => {
                                  if (!hasAttempted) {
                                    setActiveExam(exam);
                                  }
                                }}
                                className={`py-2 rounded-lg text-white font-semibold text-xs transition duration-150 flex items-center justify-center gap-1.5 shadow-sm ${hasAttempted ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'}`}
                              >
                                {hasAttempted ? 'Already Attempted' : <>Launch Examination <ChevronRight size={14} /></>}
                              </button>
                              {hasAttempted && (
                                <p className="text-[10px] text-center text-slate-500 font-medium">You have already submitted this exam. Only one attempt is allowed.</p>
                              )}
                            </div>
                          </div>
                        )})
                      )}
                    </div>
                  )}

                  {/* TABS: COMPLETED RESULTS LIST */}
                  {studentTab === 'results' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                      {historicalResults.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-mono text-sm">
                          Result documents will generate immediately upon complete answers submission.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="border-b border-slate-250 text-slate-400 font-mono text-xs uppercase bg-slate-50/70 p-2">
                                <th className="py-3 px-4 font-normal">Exam Name</th>
                                <th className="py-3 px-4 font-normal">Submission Date</th>
                                <th className="py-3 px-4 font-normal">Percentage Grade</th>
                                <th className="py-3 px-4 font-normal">Results Verdict</th>
                                <th className="py-3 px-4 font-normal text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-150">
                              {historicalResults.map((resItem) => (
                                <tr key={resItem.id} className="hover:bg-slate-50 transition">
                                  <td className="py-4 px-4 font-semibold text-slate-900">{resItem.examName}</td>
                                  <td className="py-4 px-4 font-mono text-xs text-slate-600">
                                    {new Date(resItem.submittedAt).toLocaleDateString()}
                                  </td>
                                  <td className="py-4 px-4 font-bold text-slate-800">{resItem.percentage}% ({resItem.score}/{resItem.totalQuestions})</td>
                                  <td className="py-4 px-4">
                                    <span className={`inline-block px-2.5 py-0.5 text-[10px] font-bold rounded-full ${
                                      resItem.passed ? 'bg-emerald-50 text-emerald-700 font-mono border border-emerald-250' : 'bg-rose-50 text-rose-700 font-mono border border-rose-250'
                                    }`}>
                                      {resItem.passed ? 'Passed 🎉' : 'Failed 📋'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <button
                                      onClick={() => setReviewResult(resItem)}
                                      className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 hover:bg-blue-50 text-blue-600 cursor-pointer flex items-center justify-center gap-1 ml-auto"
                                    >
                                      <Eye size={13} /> View Correction
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TABS: PROFILE EDITING */}
                  {studentTab === 'profile' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6.5 max-w-xl shadow-sm space-y-6">
                      <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                        {currentUser.photoURL ? (
                          <img src={currentUser.photoURL} alt="User Profile Avatar" className="w-16 h-16 rounded-full border-2 border-slate-200 shadow-sm object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center text-slate-400">
                             <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-900 text-md">Identity Details & Security Account</h4>
                          <p className="text-xs text-slate-500 mt-1">Manage your connected Google Account identity</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4 bg-slate-50/70 p-4 border border-slate-150 rounded-xl font-mono text-xs text-slate-600">
                        <p><strong>Email Address:</strong> {currentUser.email} <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1 ml-1.5 font-bold uppercase select-none">Read Only</span></p>
                        <p><strong>Full Name:</strong> {studentProfile?.fullName || currentUser.displayName} <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1 ml-1.5 font-bold uppercase select-none">Read Only</span></p>
                        <p><strong>Verification status:</strong> APPROVED STATUS ACTIVE</p>
                      </div>

                      <div className="space-y-4 pt-2">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Update Mobile Number</label>
                          <input
                            type="text"
                            placeholder="Your mobile phone number"
                            value={mobileInput || (studentProfile?.mobileNumber && studentProfile.mobileNumber !== 'Not provided' ? studentProfile.mobileNumber : '')}
                            onChange={(e) => setMobileInput(e.target.value)}
                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-200"
                          />
                        </div>

                        <button
                          onClick={handleSaveMobileNumber}
                          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-sm"
                        >
                          Save Mobile Number
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="py-6 border-t border-slate-200 text-center text-[10px] md:text-xs text-slate-400 font-mono">
        &copy; {new Date().getFullYear()} MLT Examination Board Portal Services. All security protocols enforced locally.
      </footer>
    </div>
  );
}
