import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, doc, deleteDoc, where } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { RefreshCw, Trash2, Filter, Mail } from 'lucide-react';

interface AdminResultsViewerProps {
  onResendEmail?: (resItem: any) => Promise<void>;
  sendingResultEmail?: string | null;
}

export default function AdminResultsViewer({ onResendEmail, sendingResultEmail }: AdminResultsViewerProps = {}) {
  const [results, setResults] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string>(''); // Default empty to not fetch
  const [selectedResults, setSelectedResults] = useState<string[]>([]);
  const [fetchedExamId, setFetchedExamId] = useState<string>(''); // Keep track of what we've currently loaded

  const fetchExams = async () => {
    try {
      const snap = await getDocs(collection(db, 'exams'));
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      setExams(list);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchResults = async (examIdToFetch: string) => {
    if (!examIdToFetch) {
      setResults([]);
      setFetchedExamId('');
      return;
    }
    setLoading(true);
    try {
      let q = query(collection(db, 'results'));
      if (examIdToFetch !== 'all') {
         q = query(collection(db, 'results'), where('examId', '==', examIdToFetch));
      }
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a,b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      setResults(list);
      setFetchedExamId(examIdToFetch);
      setSelectedResults([]);
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
      const resData = results.find(r => r.id === resultToDelete);
      if (resData && resData.studentId && resData.examId) {
        const attemptId = `attempt_${resData.studentId}_${resData.examId}`;
        try {
           await deleteDoc(doc(db, 'examAttempts', attemptId));
        } catch(e) {}
      }

      await deleteDoc(doc(db, 'results', resultToDelete));
      setSelectedResults(prev => prev.filter(id => id !== resultToDelete));
      fetchResults(fetchedExamId);
    } catch (err) {
      console.error("Failed to delete result", err);
      alert("Error deleting result: " + String(err));
    } finally {
      setResultToDelete(null);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  useEffect(() => {
    fetchResults(selectedExamId);
  }, [selectedExamId]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedResults(results.map(r => r.id));
    } else {
      setSelectedResults([]);
    }
  };

  const handleSelectResult = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedResults(prev => [...prev, id]);
    } else {
      setSelectedResults(prev => prev.filter(i => i !== id));
    }
  };

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const confirmBulkDelete = async () => {
    if (selectedResults.length === 0) return;
    try {
      for (const id of selectedResults) {
        const resData = results.find(r => r.id === id);
        if (resData && resData.studentId && resData.examId) {
          const attemptId = `attempt_${resData.studentId}_${resData.examId}`;
          try {
             await deleteDoc(doc(db, 'examAttempts', attemptId));
          } catch(e) {}
        }
        await deleteDoc(doc(db, 'results', id));
      }
      setSelectedResults([]);
      fetchResults(fetchedExamId);
    } catch (err) {
      console.error("Failed to delete results", err);
      alert("Error deleting results: " + String(err));
    } finally {
      setShowBulkDeleteConfirm(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
           <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Student Results & Outcomes</h2>
           <p className="text-sm text-slate-500 mt-1">Review all submitted exam attempts across all students.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {selectedResults.length > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded flex items-center gap-1.5 transition"
            >
              <Trash2 size={14} /> Delete Selected ({selectedResults.length})
            </button>
          )}
          <div className="relative flex-1 md:w-64">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
               <Filter className="h-4 w-4 text-slate-400" />
             </div>
             <select
               value={selectedExamId}
               onChange={(e) => setSelectedExamId(e.target.value)}
               className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
             >
               <option value="" disabled>Select Exam</option>
               <option value="all">View All Results (May be slow)</option>
               {exams.map(exam => (
                 <option key={exam.id} value={exam.id}>{exam.title || exam.name || exam.id}</option>
               ))}
             </select>
          </div>
          <button onClick={() => fetchResults(selectedExamId)} disabled={!selectedExamId || loading} className={`p-2 border border-slate-200 text-slate-600 rounded hover:bg-slate-50 relative group ${(!selectedExamId || loading) ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <div className="absolute opacity-0 group-hover:opacity-100 transition bottom-full left-1/2 -translate-x-1/2 mb-1 bg-slate-800 text-white text-[10px] px-2 py-1 rounded w-max">Refresh</div>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-medium tracking-wide uppercase text-[10px] border-b border-slate-200">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={results.length > 0 && selectedResults.length === results.length}
                    onChange={handleSelectAll}
                    disabled={results.length === 0}
                  />
                </th>
                <th className="py-3 px-4 font-normal w-12 text-center">S.No</th>
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
              {!fetchedExamId && !loading && (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                     <div className="inline-block p-4 rounded-full bg-slate-50 mb-3"><Filter size={24} className="text-slate-400" /></div>
                     <p className="text-slate-500 font-medium">Select an exam to view results</p>
                     <p className="text-slate-400 text-sm mt-1">This prevents loading too many records at once.</p>
                  </td>
                </tr>
              )}
              {fetchedExamId && results.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-sm italic">
                     {fetchedExamId === 'all' ? 'No results have been submitted yet.' : 'No results found for this specific exam.'}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500 text-sm">
                     <RefreshCw size={20} className="animate-spin mx-auto text-blue-500 mb-2" />
                     Loading results...
                  </td>
                </tr>
              )}
              {!loading && results.map((r, index) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition duration-150">
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedResults.includes(r.id)}
                      onChange={(e) => handleSelectResult(r.id, e.target.checked)}
                    />
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-slate-400 text-center">{index + 1}</td>
                  <td className="py-4 px-4 font-medium text-slate-800">{r.studentName || 'Unknown'}</td>
                  <td className="py-4 px-4 text-slate-500">{r.studentEmail || 'Unknown'}</td>
                  <td className="py-4 px-4 font-semibold text-slate-900">{r.examName || r.examId}</td>
                  <td className="py-4 px-4 text-right tabular-nums font-medium text-slate-700">{Number(r.score || 0).toFixed(1)} / {r.maxScore || r.totalQuestions}</td>
                  <td className="py-4 px-4 text-right tabular-nums">
                     <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${Number(r.percentage || 0) >= 60 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                       {Number(r.percentage || 0).toFixed(1)}%
                     </span>
                  </td>
                  <td className="py-4 px-4 text-slate-500">{new Date(r.submittedAt).toLocaleString()}</td>
                  <td className="py-4 px-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {onResendEmail && (
                        <button
                          onClick={() => onResendEmail(r)}
                          disabled={sendingResultEmail === r.id}
                          className={`p-1.5 rounded transition ${sendingResultEmail === r.id ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          title="Email Result"
                        >
                          <Mail size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => setResultToDelete(r.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                        title="Delete Result"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
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
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Result & Allow Retry?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete this exam result? This will also clear their attempt and allow the student to retake the exam.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setResultToDelete(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                onClick={confirmDelete}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
              >
                Delete & Allow Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete {selectedResults.length} Results?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete the selected exam results? This will allow those students to retake the exam.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                onClick={confirmBulkDelete}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
