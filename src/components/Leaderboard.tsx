import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Trophy, RefreshCw, X, ChevronDown, Clock } from 'lucide-react';

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
        if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
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
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 md:p-4 font-sans max-h-[100dvh] overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-6xl max-h-full overflow-hidden relative">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-amber-100 text-amber-600 p-2 rounded-lg">
               <Trophy size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-800 tracking-tight">Leaderboard</h2>
               <p className="text-xs text-slate-500 font-medium line-clamp-1">{examName}</p>
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

        <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-2 bg-slate-50/50">
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
                   <div key={`m-${r.id}`} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${medalClass}`}>
                         {rank}
                      </div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
                           {r.studentName} {isMe && <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 uppercase tracking-widest font-bold">You</span>}
                         </h4>
                         <p className="text-xs text-slate-500 truncate">{r.studentEmail}</p>
                      </div>
                      <div className="text-right shrink-0 pr-1">
                         <div className="font-bold text-slate-800 text-base tabular-nums leading-none tracking-tight">
                           {Number.isInteger(r.score) ? r.score : (r.score?.toFixed(1) || 0)} <span className="text-[11px] text-slate-400 font-normal">/ {r.maxScore || r.totalQuestions}</span>
                         </div>
                         <div className="text-[10px] text-slate-400 font-mono mt-1">
                           {r.percentage?.toFixed(1)}% | {r.timeTakenSeconds ? `${Math.floor(r.timeTakenSeconds / 60)}m ${Math.floor(r.timeTakenSeconds % 60)}s` : 'N/A'}
                         </div>
                      </div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>

        {/* DESKTOP LIST */}
        <div className="hidden md:flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex-col bg-white">
          <div className="min-w-[800px] flex-1 min-h-0 flex flex-col">
            {/* Header Row */}
            <div className="grid grid-cols-[60px_1.5fr_120px_100px_100px_100px_120px_150px_40px] gap-2 items-center px-4 py-3 border-b border-slate-100 bg-white shrink-0 text-xs font-semibold tracking-wider uppercase text-slate-400">
              <div className="text-center">Rank</div>
              <div>Student</div>
              <div className="text-center">Score</div>
              <div className="text-center text-emerald-500">Correct</div>
              <div className="text-center text-rose-500">Wrong</div>
              <div className="text-center text-slate-400">Skipped</div>
              <div className="text-center">Time</div>
              <div className="text-center">Accuracy</div>
              <div></div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
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
                 <div className="flex flex-col">
                   {results.map((r, i) => {
                     const rank = i + 1;
                     // const isMe = r.studentId === studentId;
                     
                     let bgClass = "bg-white hover:bg-slate-50";
                     if (rank === 1) bgClass = "bg-[#FFFAF0]";
                     else if (rank === 3) bgClass = "bg-[#FFF7ED]";

                     let medalCircle = "bg-transparent text-slate-500 font-bold";
                     if (rank === 1) medalCircle = "bg-[#F59E0B] text-white font-bold";
                     if (rank === 2) medalCircle = "bg-[#64748B] text-white font-bold";
                     if (rank === 3) medalCircle = "bg-[#B45309] text-white font-bold";

                     let avatarBg = "bg-blue-600";
                     if (rank === 1) avatarBg = "bg-purple-600";
                     else if (rank === 2) avatarBg = "bg-blue-500";
                     else if (rank === 3) avatarBg = "bg-emerald-600";
                     else if (rank === 4) avatarBg = "bg-orange-500";
                     else if (rank === 5) avatarBg = "bg-pink-600";
                     else if (rank === 6) avatarBg = "bg-blue-700";
                     else if (rank === 7) avatarBg = "bg-violet-600";
                     else if (rank === 8) avatarBg = "bg-sky-600";
                     
                     const initial = (r.studentName || 'S').charAt(0).toUpperCase();

                     let subtitle = null;
                     if (rank === 1) subtitle = <div className="text-[#D97706] flex items-center gap-1 text-[10px] font-bold mt-0.5 tracking-wide">👑 Top Scorer</div>;
                     else if (rank === 2) subtitle = <div className="text-[#64748B] flex items-center gap-1 text-[10px] font-bold mt-0.5 tracking-wide">🥈 Runner Up</div>;
                     else if (rank === 3) subtitle = <div className="text-[#92400E] flex items-center gap-1 text-[10px] font-bold mt-0.5 tracking-wide">🥉 3rd Place</div>;

                     // Ensure correct calculation of skipped based on total questions vs answered
                     const maxScore = r.maxScore || r.totalQuestions;
                     const correct = r.correctCount || 0;
                     const wrong = r.incorrectCount || 0;
                     const skipped = r.unansweredCount || 0;
                     const answered = correct + wrong;
                     const totalQ = r.totalQuestions || maxScore;

                     const acc = (answered > 0) ? Math.round((correct / answered) * 100) : 0;
                     const timeMins = r.timeTakenSeconds ? Math.floor(r.timeTakenSeconds / 60) : 0;
                     const timeSecs = r.timeTakenSeconds ? Math.floor(r.timeTakenSeconds % 60) : 0;
                     
                     const displayScore = Number.isInteger(r.score) ? r.score : r.score?.toFixed(1);

                     return (
                       <div key={r.id} className={`grid grid-cols-[60px_1.5fr_120px_100px_100px_100px_120px_150px_40px] gap-2 items-center px-4 py-3 border-b border-transparent transition-colors ${bgClass}`}>
                          <div className="flex justify-center">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${medalCircle}`}>
                               {rank}
                             </div>
                          </div>
                          
                          <div className="flex items-center gap-3 min-w-0">
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${avatarBg}`}>
                               {initial}
                             </div>
                             <div className="min-w-0 flex flex-col justify-center">
                               <h4 className="font-bold text-slate-700 text-[13px] tracking-tight truncate leading-tight">
                                 {r.studentName}
                               </h4>
                               {subtitle}
                             </div>
                          </div>

                          <div className="text-center font-bold text-slate-800 text-[14px]">
                             {displayScore || 0}<span className="text-[11px] text-slate-400 font-medium">/{maxScore}</span>
                          </div>

                          <div className="text-center flex items-center justify-center gap-1.5 font-bold text-emerald-500 text-[13px]">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {correct}
                          </div>

                          <div className="text-center flex items-center justify-center gap-1.5 font-bold text-rose-500 text-[13px]">
                             <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {wrong}
                          </div>

                          <div className="text-center flex items-center justify-center gap-1.5 font-bold text-slate-400 text-[13px]">
                             <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {skipped}
                          </div>

                          <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-semibold leading-tight">
                             <Clock size={12} className="text-slate-400 self-start mt-0.5 shrink-0" />
                             <div className="flex flex-col">
                               <span>{timeMins}m</span>
                               <span>{timeSecs}s</span>
                             </div>
                          </div>

                          <div className="flex justify-center flex-col px-4">
                             <div className="flex items-center justify-between w-full h-full gap-3">
                                <span className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden block">
                                   <span className="h-full bg-emerald-500 block rounded-full" style={{ width: `${acc}%` }}></span>
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 w-8 text-right">{acc}%</span>
                             </div>
                          </div>

                          <div className="flex justify-start text-slate-300">
                             <button className="p-1 border border-slate-200 rounded-full hover:bg-slate-100 hover:text-slate-600 transition">
                                <ChevronDown size={14} />
                             </button>
                          </div>
                       </div>
                     );
                   })}
                 </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

