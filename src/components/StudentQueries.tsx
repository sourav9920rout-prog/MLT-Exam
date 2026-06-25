import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Send, RefreshCw, MessageSquare } from 'lucide-react';

export default function StudentQueries({ studentId, studentName, studentEmail, onNotify }: any) {
  const [queries, setQueries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'queries'),
      where('studentId', '==', studentId)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      list.sort((a, b) => b.createdAt - a.createdAt);
      setQueries(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [studentId]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      // Fetch configured admin emails
      const settingsSnap = await getDoc(doc(db, 'settings', 'queryAdmins'));
      let adminEmails = ['sourav.9920rout@gmail.com'];
      if (settingsSnap.exists() && settingsSnap.data().emails) {
        adminEmails = settingsSnap.data().emails;
      }

      // Add to Firestore
      await addDoc(collection(db, 'queries'), {
        studentId,
        studentName,
        studentEmail,
        message: newMessage,
        status: 'pending',
        createdAt: Date.now(),
        reply: null,
        repliedBy: null,
        repliedAt: null
      });

      // Notify admins via backend
      await fetch('/api/notify-admin-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          studentEmail,
          queryMessage: newMessage,
          adminEmails
        })
      });

      setNewMessage('');
      onNotify('Your query has been sent to the admins.');
    } catch (e) {
      console.error(e);
      onNotify('Failed to send query.', true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
        <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
          <MessageSquare size={24} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Message to Admins</h2>
          <p className="text-sm text-slate-500">Ask questions or report issues directly to the administration.</p>
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your query here..."
          className="w-full h-32 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-none text-sm"
        />
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
          >
            {sending ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            Send Message
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="font-bold text-slate-800 mb-4">Your Past Queries</h3>
        {loading ? (
          <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-slate-400" /></div>
        ) : queries.length === 0 ? (
          <div className="text-center p-8 text-slate-500 text-sm bg-slate-50 rounded-lg border border-slate-100">
            You haven't sent any queries yet.
          </div>
        ) : (
          <div className="space-y-4">
            {queries.map(q => (
              <div key={q.id} className="border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-slate-500 font-mono">{new Date(q.createdAt).toLocaleString()}</span>
                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${q.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {q.status === 'resolved' ? 'RESOLVED' : 'PENDING'}
                  </span>
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{q.message}</p>
                {q.status === 'resolved' && (
                  <div className="bg-blue-50 rounded-lg p-3 mt-3 border border-blue-100">
                    <p className="text-xs font-bold text-blue-800 mb-1">Reply from {q.repliedBy}:</p>
                    <p className="text-sm text-blue-900 whitespace-pre-wrap">{q.reply}</p>
                    <p className="text-[10px] text-blue-400 mt-2">{new Date(q.repliedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
