import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { MessageSquare, Settings, CheckCircle2, User, RefreshCw, Reply, Send } from 'lucide-react';

export default function AdminQueries({ adminName, adminEmail, onNotify }: any) {
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showConfig, setShowConfig] = useState(false);
  const [adminList, setAdminList] = useState<string[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  const isSuperAdmin = adminEmail === 'sourav.9920rout@gmail.com';

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'queries'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setQueries(list);
      setLoading(false);
    });

    if (isSuperAdmin) {
      loadConfig();
    }
    return () => unsubscribe();
  }, [isSuperAdmin]);

  const loadConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'queryAdmins'));
      if (snap.exists() && snap.data().emails) {
        setAdminList(snap.data().emails);
      } else {
        setAdminList([adminEmail]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      await setDoc(doc(db, 'settings', 'queryAdmins'), { emails: adminList });
      onNotify('Query notification receivers updated.');
    } catch (e) {
      console.error(e);
      onNotify('Failed to save configuration.', true);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSendReply = async (q: any) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      // Update Firestore document
      await updateDoc(doc(db, 'queries', q.id), {
        status: 'resolved',
        reply: replyText,
        repliedBy: adminName,
        repliedAt: Date.now()
      });

      // Send email to student
      await fetch('/api/notify-student-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail: q.studentEmail,
          studentName: q.studentName,
          originalQuery: q.message,
          replyMessage: replyText,
          adminName: adminName
        })
      });

      onNotify('Reply sent successfully.');
      setReplyingTo(null);
      setReplyText('');
    } catch (e) {
      console.error(e);
      onNotify('Failed to send reply.', true);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {isSuperAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowConfig(!showConfig)}>
            <div className="flex items-center gap-3">
              <div className="bg-slate-100 text-slate-600 p-2 rounded-lg">
                <Settings size={20} />
              </div>
              <h3 className="font-bold text-slate-800">Notification Configuration</h3>
            </div>
            <button className="text-sm font-medium text-blue-600 hover:underline">
              {showConfig ? 'Hide' : 'Configure'}
            </button>
          </div>
          
          {showConfig && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-4">
              <p className="text-sm text-slate-500 mb-2">Configure which admin emails receive notifications when a student sends a query.</p>
              
              <div className="flex flex-wrap gap-2">
                {adminList.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-200">
                    <User size={14} />
                    {email}
                    <button 
                      onClick={() => setAdminList(adminList.filter((_, i) => i !== idx))}
                      className="text-blue-400 hover:text-blue-800 ml-1 font-bold"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 max-w-md">
                <input 
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
                />
                <button 
                  onClick={() => {
                    if (newAdminEmail && !adminList.includes(newAdminEmail)) {
                      setAdminList([...adminList, newAdminEmail.toLowerCase()]);
                      setNewAdminEmail('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-900 transition"
                >
                  Add
                </button>
              </div>
              
              <div>
                <button 
                  onClick={handleSaveConfig}
                  disabled={configLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition flex items-center gap-2"
                >
                  {configLoading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Save Configuration
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Queries Requested</h2>
            <p className="text-sm text-slate-500">Manage and reply to student queries.</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-slate-400" /></div>
        ) : queries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm bg-slate-50 rounded-xl border border-slate-100">
            No queries found.
          </div>
        ) : (
          <div className="space-y-4">
            {queries.map(q => (
              <div key={q.id} className="border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-2">
                  <div>
                    <h4 className="font-bold text-slate-800">{q.studentName}</h4>
                    <p className="text-xs text-slate-500">{q.studentEmail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 font-mono">{new Date(q.createdAt).toLocaleString()}</span>
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${q.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {q.status === 'resolved' ? 'RESOLVED' : 'PENDING'}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">{q.message}</p>
                </div>

                {q.status === 'resolved' ? (
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Reply size={16} className="text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-800">Replied by {q.repliedBy}</p>
                    </div>
                    <p className="text-sm text-emerald-900 whitespace-pre-wrap">{q.reply}</p>
                    <p className="text-[10px] text-emerald-500 mt-2">{new Date(q.repliedAt).toLocaleString()}</p>
                  </div>
                ) : replyingTo === q.id ? (
                  <div className="space-y-3">
                    <textarea 
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply to the student..."
                      className="w-full p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm min-h-[100px]"
                    />
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleSendReply(q)}
                        disabled={sendingReply || !replyText.trim()}
                        className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {sendingReply ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                        Send Reply
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setReplyingTo(q.id)}
                    className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition"
                  >
                    <Reply size={16} /> Reply to Student
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
