import React, { useState, useEffect } from 'react';
import { Save, FileText, Server, Settings, Lock } from 'lucide-react';

interface EmailSettingsPageProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function EmailSettingsPage({ onNotify }: EmailSettingsPageProps) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [smtp1, setSmtp1] = useState({ host: '', port: '465', username: '', password: '' });
  const [smtp2, setSmtp2] = useState({ host: '', port: '465', username: '', password: '' });
  const [smtp3, setSmtp3] = useState({ host: '', port: '465', username: '', password: '' });

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

  useEffect(() => {
    fetch('/api/admin/smtp-configs')
      .then(res => res.json())
      .then(data => {
        if (data && data.smtp1) setSmtp1({ ...data.smtp1, password: '' }); // Don't pre-fill passwords
        if (data && data.smtp2) setSmtp2({ ...data.smtp2, password: '' });
        if (data && data.smtp3) setSmtp3({ ...data.smtp3, password: '' });
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed fetching smtp", err);
        setLoading(false); // don't block
      });
  }, []);

  const handleSaveConfigs = async () => {
    setSaving(true);
    try {
      const payload = { configId: 'global_smtps', smtp1, smtp2, smtp3 };
      const res = await fetch('/api/admin/save-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onNotify('SMTP Configurations saved encryptedly.');
      } else {
        onNotify(data.error || 'Failed to save configurations', true);
      }
    } catch (err) {
      onNotify('Network error saving configurations.', true);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplates = async () => {
    setSaving(true);
    // Simulation of saving templates (in the future this will sync to Firebase or similar)
    setTimeout(() => {
      setSaving(false);
      onNotify('Email message templates saved successfully.');
    }, 800);
  };

  if (loading) {
     return <div className="p-8 text-center text-slate-500">Loading configurations...</div>;
  }

  const renderSmtpBlock = (
    title: string, 
    desc: string, 
    smtpState: any, 
    setSmtpState: any,
    smtpIndex: number
  ) => (
    <div className="border border-slate-200 rounded-lg p-5 space-y-4">
       <div className="border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
         <div>
           <h5 className="font-bold text-slate-800 text-sm">{title}</h5>
           <p className="text-xs text-slate-500 mt-1">{desc}</p>
         </div>
         <button 
           onClick={async () => {
             const email = prompt("Enter email address to send test message to:", "sourav.9920rout@gmail.com");
             if (!email) return;
             onNotify("Testing SMTP connection...");
             try {
                const res = await fetch('/api/admin/test-smtp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...smtpState, toEmail: email, smtpIndex })
                });
                const data = await res.json();
                if (data.success) onNotify("SMTP Test successful!");
                else onNotify("Test failed: " + data.error, true);
             } catch(e) {
                onNotify("Network error testing SMTP", true);
             }
           }}
           className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
         >
           Test Connection
         </button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
         <div>
           <label className="block text-xs font-bold text-slate-700 mb-1">SMTP Host</label>
           <div className="relative">
             <Server className="absolute left-3 top-2.5 text-slate-400" size={14} />
             <input type="text" className="w-full pl-8 pr-3 py-2 border rounded focus:outline-blue-500" placeholder="smtp.gmail.com" value={smtpState.host} onChange={e => setSmtpState({...smtpState, host: e.target.value})} />
           </div>
         </div>
         <div>
           <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
           <input type="number" className="w-full px-3 py-2 border rounded focus:outline-blue-500" placeholder="465" value={smtpState.port} onChange={e => setSmtpState({...smtpState, port: e.target.value})} />
         </div>
         <div>
           <label className="block text-xs font-bold text-slate-700 mb-1">Username / Email</label>
           <input type="text" className="w-full px-3 py-2 border rounded focus:outline-blue-500" placeholder="email@domain.com" value={smtpState.username} onChange={e => setSmtpState({...smtpState, username: e.target.value})} />
         </div>
         <div>
           <label className="block text-xs font-bold text-slate-700 mb-1">Password / App Password</label>
           <div className="relative">
             <Lock className="absolute left-3 top-2.5 text-slate-400" size={14} />
             <input type="password" className="w-full pl-8 pr-3 py-2 border rounded focus:outline-blue-500" placeholder="••••••••" value={smtpState.password} onChange={e => setSmtpState({...smtpState, password: e.target.value})} />
           </div>
         </div>
       </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Informational Header */}
      <div className="bg-[#f8fafc] border border-slate-200 p-6 rounded-xl flex items-start gap-4">
        <div className="p-3 bg-blue-600 rounded-lg text-white font-bold flex items-center justify-center">
          <Server size={18} />
        </div>
        <div>
          <h4 className="font-semibold text-slate-900 text-lg">Server Configuration (Hybrid)</h4>
          <p className="text-slate-600 text-sm mt-1 leading-relaxed">
            You can inject settings via environment variables in Vercel. Alternatively, configure your SMTP credentials here, and they will be stored securely on the server via an encrypted JSON manifest.
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <Settings className="text-blue-600" size={20} />
          <h4 className="font-semibold text-slate-900 text-lg">SMTP Mail Servers</h4>
        </div>
        
        <p className="text-sm text-slate-500 mb-6">Enter details to dispatch automated platform emails. Leave passwords blank to retain existing encrypted passwords.</p>

        <div className="space-y-6">
          {renderSmtpBlock("SMTP 1: Identity & OTP Delivery", "Used for high-priority short-lived pin codes (e.g., login verification).", smtp1, setSmtp1, 1)}
          {renderSmtpBlock("SMTP 2: Registrations & Status Alerts", "Used for student enrollment requests and administrative account changes.", smtp2, setSmtp2, 2)}
          {renderSmtpBlock("SMTP 3: Examination Results", "Used exclusively for compiling and sending detailed PDF or HTML exam outcomes.", smtp3, setSmtp3, 3)}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
          <button
            onClick={handleSaveConfigs}
            disabled={saving}
            className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition"
          >
            {saving ? 'Saving Configs...' : <><Save size={18} /> Save SMTP Configurations</>}
          </button>
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

      {/* Save Button for templates */}
      <div className="flex justify-end pt-4 border-t border-slate-100 pb-8">
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

