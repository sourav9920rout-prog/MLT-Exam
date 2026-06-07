import React, { useState } from 'react';
import { Save, FileText, Server } from 'lucide-react';

interface EmailSettingsPageProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function EmailSettingsPage({ onNotify }: EmailSettingsPageProps) {
  const [saving, setSaving] = useState(false);

  // Generalised pre-filled messages
  const [otpMessage, setOtpMessage] = useState(
    `<h2 style="color: #2563eb; margin-bottom: 8px;">Verify Your Email Address</h2>\n<p style="margin-bottom: 15px;">Your One-Time Password for MLT portal verification is:</p>`
  );
  
  const [registrationMessage, setRegistrationMessage] = useState(
    `<h2 style="color: #2563eb; margin-bottom: 8px;">Congratulations!</h2>\n<p style="margin-bottom: 15px;">Your registration application has been successfully submitted to the server for initial review.</p>\n<p>Please wait while your designated administrator reviews and activates your student profile. We will notify you again once your account is un-restricted and live.</p>`
  );

  const [resultMessage, setResultMessage] = useState(
    `<p style="margin-bottom: 15px;">Your recent examination attempt has been successfully evaluated.</p>\n<p>Log in to your student dashboard to review detailed analytics, section comparisons, and correct answers.</p>`
  );

  const handleSaveTemplates = async () => {
    setSaving(true);
    // Simulation of saving templates (in the future this will sync to Firebase or similar)
    setTimeout(() => {
      setSaving(false);
      onNotify('Email message templates saved successfully.');
    }, 800);
  };

  return (
    <div className="space-y-8">
      {/* Informational Header */}
      <div className="bg-[#f8fafc] border border-slate-200 p-6 rounded-xl flex items-start gap-4">
        <div className="p-3 bg-blue-600 rounded-lg text-white font-bold flex items-center justify-center">
          <Server size={18} />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 text-lg">Server Configuration (Vercel)</h4>
          <p className="text-slate-600 text-sm mt-1 leading-relaxed">
            SMTP settings and credentials have been securely offloaded to server environment variables.
          </p>
          <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-700">
            <p className="font-bold mb-2">Required Vercel Environment Variables:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>SMTP1_HOST, SMTP1_PORT, SMTP1_USER, SMTP1_PASS</strong> (OTP Emails)</li>
              <li><strong>SMTP2_HOST, SMTP2_PORT, SMTP2_USER, SMTP2_PASS</strong> (Registration Notices)</li>
              <li><strong>SMTP3_HOST, SMTP3_PORT, SMTP3_USER, SMTP3_PASS</strong> (Exam Results)</li>
            </ul>
            <p className="mt-3 text-slate-500">Optional naming overwrites: SMTP1_FROM_NAME, SMTP1_FROM_EMAIL (e.g. for friendly aliases).</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <FileText className="text-blue-600" size={20} />
          <h4 className="font-semibold text-slate-900 text-lg">Custom Message Templates</h4>
        </div>
        
        <p className="text-sm text-slate-500 mb-6">Customize the HTML content that will be injected into the automated system emails.</p>

        <div className="space-y-6">
          <div className="space-y-2">
            <h5 className="font-semibold text-slate-800 text-sm">1. OTP Verification Message (SMTP 1)</h5>
            <textarea
              className="w-full text-sm font-mono text-slate-700 border border-slate-300 rounded-lg p-3 h-28 focus:outline-blue-500"
              value={otpMessage}
              onChange={(e) => setOtpMessage(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold text-slate-800 text-sm">2. Registration Notice Message (SMTP 2)</h5>
            <textarea
              className="w-full text-sm font-mono text-slate-700 border border-slate-300 rounded-lg p-3 h-32 focus:outline-blue-500"
              value={registrationMessage}
              onChange={(e) => setRegistrationMessage(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <h5 className="font-semibold text-slate-800 text-sm">3. Exam Results Message (SMTP 3)</h5>
            <textarea
              className="w-full text-sm font-mono text-slate-700 border border-slate-300 rounded-lg p-3 h-28 focus:outline-blue-500"
              value={resultMessage}
              onChange={(e) => setResultMessage(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-100">
        <button
          onClick={handleSaveTemplates}
          disabled={saving}
          className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition"
        >
          {saving ? 'Saving Templates...' : <><Save size={18} /> Save Templates</>}
        </button>
      </div>
    </div>
  );
}
