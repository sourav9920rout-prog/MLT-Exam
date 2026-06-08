import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Exam } from '../types.ts';
import { Play, Trash2 } from 'lucide-react';
import QuizRunner from './QuizRunner.tsx';
import ResultViewer from './ResultViewer.tsx';

export default function AdminTakeExam() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const [examToDelete, setExamToDelete] = useState<string | null>(null);

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

      {exams.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-300">
            <Play className="text-slate-300 mx-auto mb-3" size={40} />
            <p className="text-slate-500 font-medium">No published exams available.</p>
          </div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map(ex => (
              <div key={ex.id} className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                   <h3 className="font-bold text-slate-800">{ex.title}</h3>
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
                      onClick={() => setExamToDelete(ex.id)}
                      className="w-full py-2 border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm rounded transition flex items-center justify-center gap-2"
                   >
                      <Trash2 size={16} /> Delete Exam
                   </button>
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
