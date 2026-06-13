import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase.ts';
import { StudentProfile } from '../types.ts';

interface AuthScreenProps {
  onLoading: (isLoading: boolean) => void;
  onShowNotification: (msg: string, isErr?: boolean) => void;
  onAuthSuccess: (user: any, role: string, status: string | null, profile: any) => void;
}

export default function AuthScreen({ onLoading, onShowNotification, onAuthSuccess }: AuthScreenProps) {
  
  const proceedWithUser = async (credentialUser: any) => {
    let isAdminAttempt = false;

    if (credentialUser.email && credentialUser.email.toLowerCase() === 'sourav.9920rout@gmail.com') {
       isAdminAttempt = true;
    } else if (credentialUser.email) {
       const adminEmailSnap = await getDoc(doc(db, 'adminEmails', credentialUser.email.toLowerCase()));
       if (adminEmailSnap.exists()) {
          isAdminAttempt = true;
       }
    }

    if (isAdminAttempt) {
       await setDoc(doc(db, 'admins', credentialUser.uid), {
           uid: credentialUser.uid,
           email: credentialUser.email,
           createdAt: new Date().toISOString()
       }, { merge: true });
       onAuthSuccess(credentialUser, 'admin', 'approved', null);
       onShowNotification('Admin Authenticated successfully.');
       return;
    }

    // Normal Student/User
    const studentSnap = await getDoc(doc(db, 'students', credentialUser.uid));
    
    if (studentSnap.exists()) {
      const data = studentSnap.data() as StudentProfile;
      onAuthSuccess(credentialUser, 'student', data.status || 'pending', data);
      onShowNotification('Authenticated successfully.');
    } else {
      // New User or Admin
      const adminCheck = await getDoc(doc(db, 'admins', credentialUser.uid));
      if (adminCheck.exists()) {
        onAuthSuccess(credentialUser, 'admin', 'approved', null);
      } else {
        const reqSnap = await getDoc(doc(db, 'settings', 'general'));
        const requireApp = reqSnap.exists() ? (reqSnap.data().requireAdminApproval ?? true) : true;
        const initialState = requireApp ? 'pending' : 'approved';

        // Construct Student Profile
        const studentData: StudentProfile = {
          uid: credentialUser.uid,
          fullName: credentialUser.displayName || 'No Name Provided',
          mobileNumber: 'Not provided',
          email: credentialUser.email?.toLowerCase() || '',
          status: initialState,
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'students', credentialUser.uid), studentData);
        await setDoc(doc(db, 'users', credentialUser.uid), {
          uid: credentialUser.uid,
          email: credentialUser.email?.toLowerCase() || '',
          role: 'student',
          createdAt: new Date().toISOString()
        });

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
          } catch (e) {}
        }

        onAuthSuccess(credentialUser, 'student', initialState, studentData);
        if (initialState === 'pending') {
          onShowNotification('Registration submitted! Pending admin approval.');
        } else {
          onShowNotification('Authenticated as Student successfully.');
        }
      }
    }
  };

  const handleGoogleSignIn = async () => {
    onLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      await proceedWithUser(res.user);
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        onShowNotification(error.message || 'Google Auth Failed', true);
      }
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mt-6 md:mt-12">
      <div className="p-6 md:p-8 space-y-6">
        
        <div className="text-center space-y-2">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            MLT Credentials Portal
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed px-4">
            Authorized credentialing and certification simulations.
          </p>
        </div>

        {/* GOOGLE SIGN IN BUTTON */}
        <div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl cursor-pointer transition-colors shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

      </div>
    </div>
  );
}
