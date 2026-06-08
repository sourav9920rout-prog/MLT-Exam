import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../utils/firebase.ts';
import { StudentProfile } from '../types.ts';

interface AuthScreenProps {
  onLoading: (isLoading: boolean) => void;
  onShowNotification: (msg: string, isErr?: boolean) => void;
  onAuthSuccess: (user: any, role: string, status: string | null, profile: any) => void;
}

export default function AuthScreen({ onLoading, onShowNotification, onAuthSuccess }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Registration States
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  // General auth routine
  const proceedWithUser = async (credentialUser: any, isNewSignup = false) => {
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
       });
       onAuthSuccess(credentialUser, 'admin', 'approved', null);
       onShowNotification('Admin Authenticated successfully.');
       return;
    }

    // Normal Student
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
        } catch (emailErr) {}

        onAuthSuccess(credentialUser, 'student', 'pending', updatedData);
        onShowNotification('New access request submitted successfully.');
      } else {
        onAuthSuccess(credentialUser, 'student', data.status, data);
        onShowNotification('Authenticated successfully.');
      }
    } else {
      // Standard user does not have details mapped
      const adminCheck = await getDoc(doc(db, 'admins', credentialUser.uid));
      if (adminCheck.exists()) {
        onAuthSuccess(credentialUser, 'admin', 'approved', null);
      } else {
        // Construct Student Profile
        const studentData: StudentProfile = {
          uid: credentialUser.uid,
          fullName: isNewSignup && fullName ? fullName : (credentialUser.displayName || 'No Name Provided'),
          mobileNumber: isNewSignup && mobileNumber ? mobileNumber : 'Not provided',
          email: credentialUser.email?.toLowerCase() || '',
          status: 'pending',
          createdAt: new Date().toISOString()
        };

        await setDoc(doc(db, 'students', credentialUser.uid), studentData);
        await setDoc(doc(db, 'users', credentialUser.uid), {
          uid: credentialUser.uid,
          email: credentialUser.email?.toLowerCase() || '',
          role: 'student',
          createdAt: new Date().toISOString()
        });

        fetch('/api/auth/notify-registration', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: studentData.fullName,
            studentEmail: studentData.email,
            studentMobile: studentData.mobileNumber
          })
        }).catch(console.error);

        onAuthSuccess(credentialUser, 'student', 'pending', studentData);
        if (isNewSignup) {
           onShowNotification('Registration submitted! Pending admin approval.');
        } else {
           onShowNotification('Profile initialized as student. Pending approval.');
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

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return onShowNotification('Fill in both fields', true);
    
    onLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      await proceedWithUser(res.user);
    } catch (error: any) {
      onShowNotification('Invalid credentials or account does not exist.', true);
    } finally {
      onLoading(false);
    }
  };

  const handleRequestOTP = async () => {
    if (!email || !email.includes('@')) {
      onShowNotification('Enter a valid email address.', true);
      return;
    }
    if (password.length < 6) {
      onShowNotification('Password must be at least 6 characters.', true);
      return;
    }
    if (!fullName || !mobileNumber) {
      onShowNotification('All profile fields are required.', true);
      return;
    }

    onLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() })
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        onShowNotification('Verification code sent to your email.');
      } else {
        onShowNotification(data.error || 'Failed to send OTP.', true);
      }
    } catch (err) {
      onShowNotification('Network error dispatching OTP.', true);
    } finally {
      onLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode) return onShowNotification('Enter the OTP PIN.', true);
    
    setOtpVerifying(true);
    onLoading(true);
    try {
      // 1. Verify OTP
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), otp: otpCode })
      });
      const data = await res.json();
      
      if (!data.success) {
        onShowNotification(data.error || 'Invalid OTP.', true);
        setOtpVerifying(false);
        onLoading(false);
        return;
      }

      // 2. Register Account
      const authRes = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update basic profile
      try {
        // Just setting a displayName helps sometimes
        // await updateProfile(authRes.user, { displayName: fullName });
      } catch (e) {}

      // 3. Process into DB
      await proceedWithUser(authRes.user, true);

    } catch (error: any) {
      onShowNotification(error.message || 'Account registration failed.', true);
      setOtpVerifying(false);
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden mt-6 md:mt-12">
      <div className="p-6 md:p-8 space-y-6">
        
        <div className="text-center space-y-2">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
            {mode === 'login' ? 'MLT Credentials Portal' : 'Create Student Profile'}
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed px-4">
            {mode === 'login' 
              ? 'Authorized credentialing and certification simulations.' 
              : 'Register for an authorized student examination account.'}
          </p>
        </div>

        {mode === 'login' ? (
          <form className="space-y-4" onSubmit={handleEmailSignIn}>
            <div>
               <label className="block text-xs font-bold text-slate-500 mb-1">Email Address</label>
               <input
                 type="email"
                 required
                 value={email}
                 onChange={e => setEmail(e.target.value)}
                 className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                 placeholder="student@example.com"
               />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
               <input
                 type="password"
                 required
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                 placeholder="••••••••"
               />
            </div>
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition"
            >
              Sign In
            </button>
            <div className="text-center mt-4">
              <span className="text-xs text-slate-500">Don't have an account? </span>
              <button 
                type="button" 
                onClick={() => setMode('register')} 
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Register Here
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            {!otpSent ? (
               <>
                 <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1">Mobile No.</label>
                      <input
                        type="text"
                        required
                        value={mobileNumber}
                        onChange={e => setMobileNumber(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
                        placeholder="1234567890"
                      />
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
                      placeholder="student@example.com"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none text-sm"
                      placeholder="Min 6 characters"
                    />
                 </div>
                 <button 
                   type="button" 
                   onClick={handleRequestOTP}
                   className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition"
                 >
                   Verify Email & Register
                 </button>
               </>
            ) : (
               <>
                 <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
                    <p className="text-sm font-bold text-blue-800">Enter Verification Code</p>
                    <p className="text-xs text-blue-600 mt-1">Sent to {email}</p>
                 </div>
                 <div>
                    <input
                      type="text"
                      className="w-full px-4 py-3 bg-white border border-slate-300 shadow-inner rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono tracking-[0.5em] uppercase"
                      value={otpCode}
                      onChange={e => setOtpCode(e.target.value)}
                      placeholder="XXXXXX"
                      maxLength={6}
                    />
                 </div>
                 <button 
                   type="button" 
                   disabled={otpCode.length < 6 || otpVerifying}
                   onClick={handleVerifyOTP}
                   className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition"
                 >
                   {otpVerifying ? 'Verifying...' : 'Complete Registration'}
                 </button>
                 <div className="text-center">
                   <button 
                     type="button" 
                     onClick={() => setOtpSent(false)} 
                     className="text-xs text-slate-500 hover:text-slate-800 underline"
                   >
                     Wrong email or need another code? Go back
                   </button>
                 </div>
               </>
            )}

            <div className="text-center pt-2">
              <span className="text-xs text-slate-500">Already verified/registered? </span>
              <button 
                type="button" 
                onClick={() => { setMode('login'); setOtpSent(false); }} 
                className="text-xs text-blue-600 font-bold hover:underline"
              >
                Sign In
              </button>
            </div>

          </div>
        )}

        {/* OR DIVIDER */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs pb-1">
            <span className="bg-white px-2 text-slate-400 font-medium tracking-wide">OR</span>
          </div>
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
