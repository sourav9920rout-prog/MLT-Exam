import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { Bell, Copy, Plus, Trash2, Send, Clock } from 'lucide-react';

export interface Notice {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  isPublished: boolean;
}

export default function NoticeBoard({ isAdmin, onNotify }: { isAdmin: boolean, onNotify: (msg: string) => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeContent, setNewNoticeContent] = useState('');
  
  const [noticeToPublish, setNoticeToPublish] = useState<Notice | null>(null);
  const [notifyAdmins, setNotifyAdmins] = useState<{email: string, selected: boolean}[]>([]);
  const [notifyStudents, setNotifyStudents] = useState<{email: string, selected: boolean}[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchNotices();
  }, [isAdmin]);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched: Notice[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (isAdmin || data.isPublished) {
           fetched.push({ id: doc.id, ...data } as Notice);
        }
      });
      setNotices(fetched);
    } catch (error) {
      console.error("Error fetching notices:", error);
    }
    setLoading(false);
  };

  const handleCreateNotice = async () => {
    if (!newNoticeTitle.trim() || !newNoticeContent.trim()) return;
    try {
      await addDoc(collection(db, 'notices'), {
        title: newNoticeTitle,
        content: newNoticeContent,
        createdAt: new Date().toISOString(),
        isPublished: false
      });
      setNewNoticeTitle('');
      setNewNoticeContent('');
      setIsCreating(false);
      fetchNotices();
      onNotify("Notice created successfully!");
    } catch (err) {
      console.error(err);
      onNotify("Error creating notice");
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notices', id));
      setConfirmDeleteId(null);
      fetchNotices();
      onNotify("Notice deleted");
    } catch (err) {
      console.error(err);
      onNotify("Error deleting notice");
    }
  };

  const openPublishModal = async (notice: Notice) => {
    setNoticeToPublish(notice);
    try {
      const adminSnap = await getDocs(collection(db, 'adminEmails'));
      const adminList: any[] = [];
      adminSnap.forEach(d => adminList.push({ email: d.id, selected: true }));
      setNotifyAdmins(adminList);

      const studentSnap = await getDocs(collection(db, 'students'));
      const studentList: any[] = [];
      studentSnap.forEach(d => {
        const data = d.data();
        if (data.email) {
          studentList.push({ email: data.email, selected: true });
        }
      });
      setNotifyStudents(studentList);
    } catch (err) {
        console.error("Failed to load users for notification", err);
    }
  };

  const confirmPublish = async () => {
    if (!noticeToPublish) return;
    setIsPublishing(true);
    try {
      await updateDoc(doc(db, 'notices', noticeToPublish.id), {
        isPublished: true
      });
      
      const pAdmins = notifyAdmins.filter(a => a.selected).map(a => a.email);
      const pStudents = notifyStudents.filter(s => s.selected).map(s => s.email);

      if (pAdmins.length > 0 || pStudents.length > 0) {
        await fetch('/api/admin/notify-notice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            noticeTitle: noticeToPublish.title,
            noticeContent: noticeToPublish.content,
            adminEmails: pAdmins,
            studentEmails: pStudents
          })
        });
      }

      fetchNotices();
      onNotify("Notice published and emails sent!");
    } catch (e) {
      console.error(e);
      onNotify("Error publishing notice");
    } finally {
      setIsPublishing(false);
      setNoticeToPublish(null);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading notices...</div>;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="text-blue-600" /> Notice Board</h2>
        {isAdmin && !isCreating && (
          <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition">
            <Plus size={16} /> New Notice
          </button>
        )}
      </div>

      {isCreating && (
        <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg mb-6 space-y-4">
          <input
            type="text"
            className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            placeholder="Notice Title"
            value={newNoticeTitle}
            onChange={e => setNewNoticeTitle(e.target.value)}
          />
          <textarea
            className="w-full p-2 border border-slate-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none h-32 resize-none"
            placeholder="Notice Content..."
            value={newNoticeContent}
            onChange={e => setNewNoticeContent(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded">Cancel</button>
            <button onClick={handleCreateNotice} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded">Save Notice</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {notices.length === 0 ? (
          <div className="text-center py-12 text-slate-400 font-mono text-sm">No notices available.</div>
        ) : (
          notices.map(notice => (
            <div key={notice.id} className={`p-4 border rounded-lg ${notice.isPublished ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800">{notice.title}</h3>
                <div className="flex items-center gap-2">
                   {!notice.isPublished && isAdmin && (
                     <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Draft</span>
                   )}
                   {isAdmin && (
                     <div className="flex items-center gap-2">
                       {confirmDeleteId === notice.id ? (
                         <div className="flex items-center gap-1">
                           <button onClick={() => handleDeleteNotice(notice.id)} className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-bold transition" title="Confirm Delete">
                             Confirm
                           </button>
                           <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-2 py-1 rounded text-xs font-bold transition" title="Cancel">
                             Cancel
                           </button>
                         </div>
                       ) : (
                         <button onClick={() => setConfirmDeleteId(notice.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded" title="Delete">
                            <Trash2 size={16} />
                         </button>
                       )}
                     </div>
                   )}
                </div>
              </div>
              <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">{notice.content}</p>
              <div className="mt-4 flex items-center justify-between">
                 <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                    <Clock size={12} /> {new Date(notice.createdAt).toLocaleString()}
                 </div>
                 {isAdmin && !notice.isPublished && (
                   <button onClick={() => openPublishModal(notice)} className="flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded text-sm font-bold transition">
                     <Send size={14} /> Publish
                   </button>
                 )}
              </div>
            </div>
          ))
        )}
      </div>

      {noticeToPublish && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Publish Notice: {noticeToPublish.title}</h3>
            <p className="text-sm text-slate-500 mb-6">Select users to notify via email about this notice.</p>
            
            <div className="mb-4">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="font-bold text-slate-700 text-sm">Admins ({notifyAdmins.length})</h4>
                 <div className="flex gap-2 text-xs">
                    <button onClick={() => setNotifyAdmins(prev => prev.map(a => ({...a, selected: true})))} className="text-blue-600 hover:underline">Select All</button>
                    <button onClick={() => setNotifyAdmins(prev => prev.map(a => ({...a, selected: false})))} className="text-slate-600 hover:underline">Deselect All</button>
                 </div>
               </div>
               <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2 text-sm bg-slate-50 space-y-1">
                 {notifyAdmins.length === 0 ? <p className="text-slate-400">No admins found.</p> : notifyAdmins.map((a, i) => (
                    <label key={i} className="flex items-center gap-2">
                       <input type="checkbox" checked={a.selected} onChange={() => setNotifyAdmins(prev => prev.map((x, j) => j === i ? {...x, selected: !x.selected} : x))} />
                       <span>{a.email}</span>
                    </label>
                 ))}
               </div>
            </div>

            <div className="mb-6">
               <div className="flex justify-between items-center mb-2">
                 <h4 className="font-bold text-slate-700 text-sm">Students ({notifyStudents.length})</h4>
                 <div className="flex gap-2 text-xs">
                    <button onClick={() => setNotifyStudents(prev => prev.map(s => ({...s, selected: true})))} className="text-blue-600 hover:underline">Select All</button>
                    <button onClick={() => setNotifyStudents(prev => prev.map(s => ({...s, selected: false})))} className="text-slate-600 hover:underline">Deselect All</button>
                 </div>
               </div>
               <div className="max-h-32 overflow-y-auto border border-slate-200 rounded p-2 text-sm bg-slate-50 space-y-1">
                 {notifyStudents.length === 0 ? <p className="text-slate-400">No students found.</p> : notifyStudents.map((s, i) => (
                    <label key={i} className="flex items-center gap-2">
                       <input type="checkbox" checked={s.selected} onChange={() => setNotifyStudents(prev => prev.map((x, j) => j === i ? {...x, selected: !x.selected} : x))} />
                       <span>{s.email}</span>
                    </label>
                 ))}
               </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button disabled={isPublishing} onClick={() => setNoticeToPublish(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                disabled={isPublishing}
                onClick={confirmPublish}
                className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50"
              >
                {isPublishing ? 'Publishing & Sending...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
