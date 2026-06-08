import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function AdminResultsViewer() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchResults = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'results'));
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setResults(list);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const [resultToDelete, setResultToDelete] = useState<string | null>(null);

  const confirmDelete = async () => {
    if (!resultToDelete) return;
    try {
      await deleteDoc(doc(db, 'results', resultToDelete));
      fetchResults();
    } catch (err) {
      console.error("Failed to delete result", err);
      alert("Error deleting result: " + String(err));
    } finally {
      setResultToDelete(null);
    }
  };

  useEffect(() => {
    fetchResults();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Student Results & Outcomes</h2>
           <p className="text-sm text-slate-500 mt-1">Review all submitted exam attempts across all students.</p>
        </div>
        <button onClick={fetchResults} className="p-2 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 relative group">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <div className="absolute opacity-0 group-hover:opacity-100 transition bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[10px] px-2 py-1 rounded">Refresh</div>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-medium tracking-wide uppercase text-[10px] border-b border-slate-200">
                <th className="py-3 px-4 font-normal">Student</th>
                <th className="py-3 px-4 font-normal">Email</th>
                <th className="py-3 px-4 font-normal">Exam Name</th>
                <th className="py-3 px-4 font-normal text-right">Score</th>
                <th className="py-3 px-4 font-normal text-right">Percentage</th>
                <th className="py-3 px-4 font-normal">Submitted At</th>
                <th className="py-3 px-4 font-normal text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-sm italic">No results have been submitted yet.</td>
                </tr>
              )}
              {results.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition duration-150">
                  <td className="py-4 px-4 font-medium text-slate-800">{r.studentName || 'Unknown'}</td>
                  <td className="py-4 px-4 text-slate-500">{r.studentEmail || 'Unknown'}</td>
                  <td className="py-4 px-4 font-semibold text-slate-900">{r.examName || r.examId}</td>
                  <td className="py-4 px-4 text-right tabular-nums font-medium text-slate-700">{r.score?.toFixed(1) || 0} / {r.totalQuestions}</td>
                  <td className="py-4 px-4 text-right tabular-nums">
                     <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${r.percentage >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                       {r.percentage?.toFixed(1) || 0}%
                     </span>
                  </td>
                  <td className="py-4 px-4 text-slate-500">{new Date(r.submittedAt).toLocaleString()}</td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => setResultToDelete(r.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                      title="Delete Result"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {resultToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Student Result?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete this exam result? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setResultToDelete(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
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
