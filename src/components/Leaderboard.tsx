import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Trophy, ArrowLeft, RefreshCw, X } from 'lucide-react';

interface LeaderboardProps {
  examId: string;
  examName: string;
  onClose: () => void;
  studentId?: string; // If passed, highlight this student
}

export default function Leaderboard({ examId, examName, onClose, studentId }: LeaderboardProps) {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'results'), where('examId', '==', examId));
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      
      // Sort by score (desc), then by timeTakenSeconds (asc), then by submittedAt (asc)
      list.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.timeTakenSeconds !== b.timeTakenSeconds) return (a.timeTakenSeconds || 999999) - (b.timeTakenSeconds || 999999);
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime();
      });
      
      setResults(list);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [examId]);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-3xl max-h-[85vh] overflow-hidden relative">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
               <Trophy size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-800">Leaderboard</h2>
               <p className="text-xs text-slate-500 font-mono line-clamp-1">{examName}</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchLeaderboard} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2 md:p-6 bg-slate-50/50">
          {loading ? (
             <div className="flex justify-center items-center h-48">
               <RefreshCw className="animate-spin text-slate-300" size={32} />
             </div>
          ) : results.length === 0 ? (
             <div className="text-center py-16">
               <Trophy size={48} className="mx-auto text-slate-200 mb-4" />
               <h3 className="text-lg font-bold text-slate-500">No Participants Yet</h3>
               <p className="text-sm text-slate-400">Be the first to complete this exam!</p>
             </div>
          ) : (
             <div className="space-y-2">
               {results.map((r, i) => {
                 const rank = i + 1;
                 const isMe = r.studentId === studentId;
                 
                 let medalClass = "bg-slate-200 text-slate-600";
                 if (rank === 1) medalClass = "bg-[#FFD700] text-yellow-900 shadow-md shadow-yellow-200";
                 if (rank === 2) medalClass = "bg-[#C0C0C0] text-slate-800 shadow-md shadow-slate-200";
                 if (rank === 3) medalClass = "bg-[#CD7F32] text-orange-950 shadow-md shadow-orange-200";
                 
                 return (
                   <div key={r.id} className={`flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl border transition-all ${isMe ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                      <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base shrink-0 ${medalClass}`}>
                         {rank}
                      </div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-slate-800 text-sm md:text-base truncate flex items-center gap-2">
                           {r.studentName} {isMe && <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 uppercase tracking-widest font-bold">You</span>}
                         </h4>
                         <p className="text-xs text-slate-500 truncate">{r.studentEmail}</p>
                      </div>
                      <div className="text-right shrink-0 pr-2">
                         <div className="font-bold text-slate-800 text-base md:text-xl tabular-nums leading-none tracking-tight">
                           {r.score?.toFixed(1) || 0}
                         </div>
                         <div className="text-[10px] md:text-xs text-slate-400 font-mono mt-1">
                           {r.percentage?.toFixed(1)}% | {r.timeTakenSeconds ? `${Math.floor(r.timeTakenSeconds / 60)}m ${r.timeTakenSeconds % 60}s` : 'N/A'}
                         </div>
                      </div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
