import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { Trophy, RefreshCw, X, Clock, Calendar, BarChart2 } from 'lucide-react';
import { Exam, Result } from '../types';

interface MockSeriesLeaderboardProps {
  onClose: () => void;
  studentId?: string; // If passed, highlight this student
}

interface AggregatedResult {
  studentId: string;
  studentName: string;
  studentEmail: string;
  totalScore: number;
  totalMaxScore: number;
  examsAttempted: number;
  totalTimeTakenSeconds: number;
  totalCorrect: number;
  totalWrong: number;
  totalSkipped: number;
}

export default function MockSeriesLeaderboard({ onClose, studentId }: MockSeriesLeaderboardProps) {
  const [aggregatedResults, setAggregatedResults] = useState<AggregatedResult[]>([]);
  const [totalMockExams, setTotalMockExams] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch all mock series exams
      const examsQuery = query(collection(db, 'exams'), where('isMockSeries', '==', true));
      const examsSnap = await getDocs(examsQuery);
      const mockExams: Exam[] = [];
      examsSnap.forEach(doc => {
        const data = doc.data() as Exam;
        if (!data.isHidden) {
          mockExams.push(data);
        }
      });
      
      setTotalMockExams(mockExams.length);
      const mockExamIds = mockExams.map(e => e.id);

      if (mockExamIds.length === 0) {
        setAggregatedResults([]);
        setLoading(false);
        return;
      }

      // Fetch all results. 
      // Firestore 'in' query supports max 10 items. We might have more than 10 mock exams.
      // So fetch all results and filter in memory.
      const resultsQuery = query(collection(db, 'results'));
      const resultsSnap = await getDocs(resultsQuery);
      const allResults: Result[] = [];
      resultsSnap.forEach(doc => {
        allResults.push({ id: doc.id, ...doc.data() } as Result);
      });

      const mockResults = allResults.filter(r => mockExamIds.includes(r.examId));

      // Aggregate by studentId
      const aggMap = new Map<string, AggregatedResult>();

      for (const r of mockResults) {
        if (!aggMap.has(r.studentId)) {
          aggMap.set(r.studentId, {
            studentId: r.studentId,
            studentName: r.studentName || 'Unknown Student',
            studentEmail: r.studentEmail || '',
            totalScore: 0,
            totalMaxScore: 0,
            examsAttempted: 0,
            totalTimeTakenSeconds: 0,
            totalCorrect: 0,
            totalWrong: 0,
            totalSkipped: 0,
          });
        }
        
        const st = aggMap.get(r.studentId)!;
        st.totalScore += (r.score || 0);
        st.totalMaxScore += (r.maxScore || r.totalQuestions || 0);
        st.examsAttempted += 1;
        st.totalTimeTakenSeconds += (r.timeTakenSeconds || 0);
        st.totalCorrect += (r.correctCount || 0);
        st.totalWrong += (r.incorrectCount || 0);
        st.totalSkipped += (r.unansweredCount || 0);
      }

      const list = Array.from(aggMap.values());
      
      // Sort by total score (desc), examsAttempted (desc), timeTakenSeconds (asc)
      list.sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        if (b.examsAttempted !== a.examsAttempted) return b.examsAttempted - a.examsAttempted;
        return a.totalTimeTakenSeconds - b.totalTimeTakenSeconds;
      });
      
      setAggregatedResults(list);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-2 md:p-4 font-sans max-h-[100dvh] overflow-hidden">
      <div className="bg-white rounded-xl shadow-2xl flex flex-col w-full max-w-6xl max-h-full overflow-hidden relative">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
               <Trophy size={20} />
             </div>
             <div>
               <h2 className="text-xl font-bold text-slate-800 tracking-tight">Mock Series Leaderboard</h2>
               <p className="text-xs text-slate-500 font-medium line-clamp-1">30 Day 30 Mock Test Series Ranking</p>
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

        {/* MOBILE VIEW */}
        <div className="md:hidden overflow-y-auto flex-1 p-3 space-y-2 bg-slate-50/50">
          {loading ? (
             <div className="flex justify-center items-center h-48">
               <RefreshCw className="animate-spin text-slate-300" size={32} />
             </div>
          ) : aggregatedResults.length === 0 ? (
             <div className="text-center py-16">
               <Trophy size={48} className="mx-auto text-slate-200 mb-4" />
               <h3 className="text-lg font-bold text-slate-500">No Participants Yet</h3>
               <p className="text-sm text-slate-400">Be the first to complete a mock exam!</p>
             </div>
          ) : (
             <div className="space-y-2">
               {aggregatedResults.map((r, i) => {
                 const rank = i + 1;
                 const isMe = r.studentId === studentId;
                 
                 let medalClass = "bg-slate-200 text-slate-600";
                 if (rank === 1) medalClass = "bg-[#FFD700] text-yellow-900 shadow-md shadow-yellow-200";
                 if (rank === 2) medalClass = "bg-[#C0C0C0] text-slate-800 shadow-md shadow-slate-200";
                 if (rank === 3) medalClass = "bg-[#CD7F32] text-orange-950 shadow-md shadow-orange-200";
                 
                 return (
                   <div key={`m-${r.studentId}`} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isMe ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${medalClass}`}>
                         {rank}
                      </div>
                      <div className="flex-1 min-w-0">
                         <h4 className="font-bold text-slate-800 text-sm truncate flex items-center gap-2">
                           {r.studentName} {isMe && <span className="px-2 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 uppercase tracking-widest font-bold">You</span>}
                         </h4>
                         <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                           <Calendar size={10} /> Attempted: {r.examsAttempted}/{totalMockExams}
                         </p>
                      </div>
                      <div className="text-right shrink-0 pr-1">
                         <div className="font-bold text-slate-800 text-base tabular-nums leading-none tracking-tight">
                           {Number.isInteger(r.totalScore) ? Number(r.totalScore) : Number(r.totalScore).toFixed(1)} <span className="text-[11px] text-slate-400 font-normal">pts</span>
                         </div>
                      </div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>

        {/* DESKTOP VIEW */}
        <div className="hidden md:flex flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex-col bg-white">
          <div className="min-w-[800px] flex-1 min-h-0 flex flex-col">
            {/* Header Row */}
            <div className="grid grid-cols-[60px_1.5fr_120px_120px_100px_100px_100px_120px_100px] gap-2 items-center px-4 py-3 border-b border-slate-100 bg-white shrink-0 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
              <div className="text-center">Rank</div>
              <div>Student</div>
              <div className="text-center">Exams Attempted</div>
              <div className="text-center">Total Score</div>
              <div className="text-center text-emerald-500">Correct</div>
              <div className="text-center text-rose-500">Wrong</div>
              <div className="text-center text-slate-400">Skipped</div>
              <div className="text-center">Total Time</div>
              <div className="text-center">Accuracy</div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                 <div className="flex justify-center items-center h-48">
                   <RefreshCw className="animate-spin text-slate-300" size={32} />
                 </div>
              ) : aggregatedResults.length === 0 ? (
                 <div className="text-center py-16">
                   <Trophy size={48} className="mx-auto text-slate-200 mb-4" />
                   <h3 className="text-lg font-bold text-slate-500">No Participants Yet</h3>
                   <p className="text-sm text-slate-400">Be the first to complete a mock exam!</p>
                 </div>
              ) : (
                 <div className="flex flex-col">
                   {aggregatedResults.map((r, i) => {
                     const rank = i + 1;
                     
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

                     const answered = r.totalCorrect + r.totalWrong;
                     const acc = (answered > 0) ? Math.round((r.totalCorrect / answered) * 100) : 0;
                     const timeMins = r.totalTimeTakenSeconds ? Math.floor(r.totalTimeTakenSeconds / 60) : 0;
                     const timeSecs = r.totalTimeTakenSeconds ? Math.floor(r.totalTimeTakenSeconds % 60) : 0;
                     
                     const displayScore = Number.isInteger(r.totalScore) ? Number(r.totalScore) : Number(r.totalScore).toFixed(1);

                     return (
                       <div key={r.studentId} className={`grid grid-cols-[60px_1.5fr_120px_120px_100px_100px_100px_120px_100px] gap-2 items-center px-4 py-3 border-b border-transparent transition-colors ${bgClass}`}>
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
                             <span className="text-blue-600">{r.examsAttempted}</span><span className="text-[11px] text-slate-400 font-medium">/{totalMockExams}</span>
                          </div>

                          <div className="text-center font-bold text-slate-800 text-[14px]">
                             {displayScore} <span className="text-[11px] text-slate-400 font-normal">pts</span>
                          </div>

                          <div className="text-center flex items-center justify-center gap-1.5 font-bold text-emerald-500 text-[13px]">
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> {r.totalCorrect}
                          </div>

                          <div className="text-center flex items-center justify-center gap-1.5 font-bold text-rose-500 text-[13px]">
                             <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> {r.totalWrong}
                          </div>

                          <div className="text-center flex items-center justify-center gap-1.5 font-bold text-slate-400 text-[13px]">
                             <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> {r.totalSkipped}
                          </div>

                          <div className="flex items-center justify-center gap-1.5 text-slate-500 text-[11px] font-semibold leading-tight">
                             <Clock size={12} className="text-slate-400 self-start mt-0.5 shrink-0" />
                             <div className="flex flex-col text-left">
                               <span>{timeMins}m</span>
                               <span>{timeSecs}s</span>
                             </div>
                          </div>

                          <div className="flex justify-center flex-col px-4">
                             <div className="flex items-center justify-center w-full h-full gap-2">
                                <BarChart2 size={14} className="text-slate-400" />
                                <span className="text-[12px] font-bold text-slate-600">{acc}%</span>
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
      </div>
    </div>
  );
}
