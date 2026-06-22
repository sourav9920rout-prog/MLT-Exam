import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Exam } from '../types.ts';
import { Play, Trash2, Trophy, Eye, EyeOff, GripHorizontal, Radio, Clock, Users } from 'lucide-react';
import { motion } from 'motion/react';
import QuizRunner from './QuizRunner.tsx';
import ResultViewer from './ResultViewer.tsx';
import Leaderboard from './Leaderboard.tsx';

export default function AdminTakeExam({ filterByMockSeries, filterByLiveQuiz }: { filterByMockSeries?: boolean, filterByLiveQuiz?: boolean }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [leaderboardExam, setLeaderboardExam] = useState<Exam | null>(null);

  const [examToDelete, setExamToDelete] = useState<string | null>(null);
  
  const [examToMakeLive, setExamToMakeLive] = useState<Exam | null>(null);
  
  const [notifyAdmins, setNotifyAdmins] = useState<{email: string, selected: boolean}[]>([]);
  const [notifyStudents, setNotifyStudents] = useState<{email: string, selected: boolean}[]>([]);
  const [isSendingEmails, setIsSendingEmails] = useState(false);

  const fetchExams = async () => {
    try {
      const snap = await getDocs(collection(db, 'exams'));
      const examsData: Exam[] = [];
      snap.forEach(doc => examsData.push({ id: doc.id, ...doc.data() } as Exam));
      setExams(examsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const confirmDelete = async () => {
    if (!examToDelete) return;
    try {
      await deleteDoc(doc(db, 'exams', examToDelete));
      fetchExams();
    } catch (err) {
      console.error("Failed to delete", err);
      alert("Error deleting exam: " + String(err));
    } finally {
      setExamToDelete(null);
    }
  };

  const handleToggleVisibility = async (exam: Exam) => {
    if (exam.isHidden) {
      setExamToMakeLive(exam);
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
    } else {
      try {
        await updateDoc(doc(db, 'exams', exam.id), {
          isHidden: true
        });
        fetchExams();
      } catch (err) {
        console.error("Failed to hide exam", err);
        alert("Error hiding exam: " + String(err));
      }
    }
  };

  const confirmMakeLive = async () => {
    if (!examToMakeLive) return;
    setIsSendingEmails(true);
    try {
      await updateDoc(doc(db, 'exams', examToMakeLive.id), {
        isHidden: false
      });
      
      const pAdmins = notifyAdmins.filter(a => a.selected).map(a => a.email);
      const pStudents = notifyStudents.filter(s => s.selected).map(s => s.email);

      if (pAdmins.length > 0 || pStudents.length > 0) {
        await fetch('/api/admin/notify-exam-live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examTitle: examToMakeLive.title,
            adminEmails: pAdmins,
            studentEmails: pStudents
          })
        });
      }

      fetchExams();
    } catch (e) {
      console.error(e);
      alert("Error pushing to live or sending emails");
    } finally {
      setIsSendingEmails(false);
      setExamToMakeLive(null);
    }
  };

  const displayedExams = exams.filter(e => {
    if (filterByLiveQuiz) return e.isLiveQuizMode;
    if (filterByMockSeries) return e.isMockSeries && !e.isLiveQuizMode;
    return !e.isMockSeries && !e.isLiveQuizMode;
  }).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const [draggedExamId, setDraggedExamId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedExamId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedExamId || draggedExamId === targetId) return;
    
    const newExams = [...displayedExams];
    const draggedIdx = newExams.findIndex(x => x.id === draggedExamId);
    const targetIdx = newExams.findIndex(x => x.id === targetId);
    
    if (draggedIdx === -1 || targetIdx === -1) return;

    const [draggedItem] = newExams.splice(draggedIdx, 1);
    newExams.splice(targetIdx, 0, draggedItem);
    
    const updated = newExams.map((ex, idx) => ({ ...ex, order: idx }));
    
    setExams(prev => prev.map(p => {
       const u = updated.find(x => x.id === p.id);
       return u ? u : p;
    }));

    try {
        await Promise.all(updated.map(ex => updateDoc(doc(db, 'exams', ex.id), { order: ex.order })));
    } catch(err) {
        console.error("Failed to save order", err);
    }
  };

  if (result) {
      return (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto p-6">
           <ResultViewer reviewResult={result} onBack={() => { setResult(null); setActiveExam(null); }} />
        </div>
      );
  }

  if (activeExam) {
     return (
       <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
          <QuizRunner 
             exam={activeExam}
             studentId={`admin_test_${Date.now()}`}
             studentName="Admin Tester"
             studentEmail="admin@mltexamportal.com"
             isAdminTesting={true}
             onFinished={(res) => {
                 setResult(res);
             }}
             onCancel={() => setActiveExam(null)}
             onNotify={(msg) => console.log(msg)}
          />
       </div>
     );
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading exams for testing...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Manage & Test Exams</h2>
           <p className="text-sm text-slate-500 mt-1">Take any available exam exactly as a student would, or delete exams so students can no longer access them.</p>
        </div>
      </div>

      {displayedExams.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
            <Play className="text-slate-300 mx-auto mb-3" size={40} />
            <p className="text-slate-500 font-medium">No published exams available.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedExams.map(ex => (
              <motion.div 
                layout
                key={ex.id} 
                draggable
                onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(e, ex.id)}
                onDragOver={handleDragOver}
                onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, ex.id)}
                onDragEnd={() => setDraggedExamId(null)}
                className={`bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between cursor-move hover:border-slate-300 transition ${draggedExamId === ex.id ? 'opacity-50 border-blue-400 border-dashed bg-blue-50' : ''}`}
              >
                <div>
                   <div className="flex justify-between items-start">
                     <div className="flex items-center gap-2">
                       <GripHorizontal size={18} className="text-slate-400" />
                       <h3 className="font-bold text-slate-800">{ex.title}</h3>
                     </div>
                     <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${ex.isHidden ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
                       {ex.isHidden ? 'Hidden' : 'Live'}
                     </span>
                   </div>
                   <p className="text-xs text-slate-500 mt-1">{ex.questionIds.length} Questions • {ex.durationMinutes} Mins</p>
                </div>
                <div className="mt-4 flex flex-col gap-2">
                   <button
                      onClick={() => setActiveExam(ex)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded transition flex items-center justify-center gap-2"
                   >
                      <Play size={16} /> Take Exam
                   </button>
                   <button
                      onClick={() => handleToggleVisibility(ex)}
                      className="w-full py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-sm rounded transition flex items-center justify-center gap-2"
                   >
                      {ex.isHidden ? <><Eye size={16} /> Push to Live</> : <><EyeOff size={16} /> Hide to Students</>}
                   </button>
                   <button
                      onClick={() => setLeaderboardExam(ex)}
                      className="w-full py-2 border border-amber-200 text-amber-600 hover:bg-amber-50 font-bold text-sm rounded transition flex items-center justify-center gap-2"
                   >
                      <Trophy size={16} /> Leaderboard
                   </button>
                   <button
                      onClick={() => setExamToDelete(ex.id)}
                      className="w-full py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm rounded transition flex items-center justify-center gap-2"
                   >
                      <Trash2 size={16} /> Delete Exam
                   </button>
                </div>
              </motion.div>
            ))}
          </div>
      )}

      {leaderboardExam && (
        <Leaderboard 
          examId={leaderboardExam.id} 
          examName={leaderboardExam.title} 
          onClose={() => setLeaderboardExam(null)} 
        />
      )}

      {examToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Examination?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete this exam? Students will no longer have access.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setExamToDelete(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                onClick={confirmDelete}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {examToMakeLive && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Publish Exam: {examToMakeLive.title}</h3>
            <p className="text-sm text-slate-500 mb-6">Select users to notify via email that this exam is now live. (This runs via SMTP 2 independently of other email setup limits)</p>
            
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
              <button disabled={isSendingEmails} onClick={() => setExamToMakeLive(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                disabled={isSendingEmails}
                onClick={confirmMakeLive}
                className="px-5 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm disabled:opacity-50"
              >
                {isSendingEmails ? 'Publishing & Sending...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
