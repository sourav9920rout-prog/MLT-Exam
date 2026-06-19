import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { Star, FileText, User } from 'lucide-react';

export default function AdminFeedbackViewer() {
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFeedbacks(data);
      } catch (error) {
        console.error('Error fetching feedbacks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchFeedbacks();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500">Loading feedbacks...</div>;

  const groupedByExam = feedbacks.reduce((acc, curr) => {
    if (!curr.examId) return acc;
    if (!acc[curr.examId]) {
       acc[curr.examId] = {
         examName: curr.examName || 'Unknown Exam',
         count: 0,
         ux: 0,
         difficulty: 0,
         relevance: 0
       };
    }
    acc[curr.examId].count += 1;
    acc[curr.examId].ux += (curr.ratings?.ux || 0);
    acc[curr.examId].difficulty += (curr.ratings?.difficulty || 0);
    acc[curr.examId].relevance += (curr.ratings?.relevance || 0);
    return acc;
  }, {} as Record<string, any>);

  const examStats = Object.values(groupedByExam).map((stat: any) => ({
     ...stat,
     uxAvg: (stat.ux / stat.count).toFixed(1),
     difficultyAvg: (stat.difficulty / stat.count).toFixed(1),
     relevanceAvg: (stat.relevance / stat.count).toFixed(1),
     overallAvg: ((stat.ux + stat.difficulty + stat.relevance) / (stat.count * 3)).toFixed(1)
  })).sort((a,b) => parseFloat(b.overallAvg) - parseFloat(a.overallAvg));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6"><Star className="text-amber-500" fill="currentColor" /> Exam Ratings Dashboard</h2>
        
        {examStats.length === 0 ? (
           <div className="text-center py-12 text-slate-400 font-mono text-sm">No exam feedback available yet.</div>
        ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {examStats.map((stat: any, i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4 bg-slate-50 shadow-sm flex flex-col justify-between">
                   <h3 className="font-bold text-slate-800 mb-2 truncate text-sm" title={stat.examName}>{stat.examName}</h3>
                   <div className="flex items-center gap-2 mb-3 bg-white p-2 text-center justify-center rounded-md border border-slate-100">
                     <Star size={18} className="text-amber-400 fill-amber-400" />
                     <span className="text-xl font-extrabold text-slate-700">{stat.overallAvg}</span>
                     <span className="text-xs text-slate-400 font-medium">({stat.count} reviews)</span>
                   </div>
                   <div className="space-y-1.5 text-xs text-slate-600 font-medium">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">User Experience</span> 
                        <span className="font-bold text-slate-800">{stat.uxAvg} <span className="text-[10px] text-slate-400">/ 5</span></span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Difficulty</span> 
                        <span className="font-bold text-slate-800">{stat.difficultyAvg} <span className="text-[10px] text-slate-400">/ 5</span></span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Relevance</span> 
                        <span className="font-bold text-slate-800">{stat.relevanceAvg} <span className="text-[10px] text-slate-400">/ 5</span></span>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        )}
        
        <h3 className="text-lg font-bold text-slate-800 mt-8 mb-4 border-b border-slate-100 pb-2">Recent Submissions</h3>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
           {feedbacks.map(fb => (
             <div key={fb.id} className="border border-slate-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-blue-100 hover:bg-slate-50/50 transition-colors">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="bg-slate-100 p-1 rounded-full"><User size={14} className="text-slate-500" /></div>
                    <span className="font-bold text-sm text-slate-700">{fb.studentName || 'Anonymous'}</span>
                    <span className="text-[10px] font-mono text-slate-400 ml-2">{new Date(fb.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
                    <FileText size={12} className="text-blue-400" /> {fb.examName || 'Unknown Exam'}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600 bg-white px-4 py-2.5 rounded-lg border border-slate-100 shadow-sm">
                   <div className="flex flex-col items-center gap-1">
                     <span className="text-amber-500 flex items-center gap-1 font-bold text-sm"><Star size={12} className="fill-amber-500" /> {fb.ratings?.ux || 0}</span>
                     <span className="text-[10px] text-slate-400 uppercase tracking-wider">UX</span>
                   </div>
                   <div className="w-px h-8 bg-slate-100"></div>
                   <div className="flex flex-col items-center gap-1">
                     <span className="text-amber-500 flex items-center gap-1 font-bold text-sm"><Star size={12} className="fill-amber-500" /> {fb.ratings?.difficulty || 0}</span>
                     <span className="text-[10px] text-slate-400 uppercase tracking-wider">Diff</span>
                   </div>
                   <div className="w-px h-8 bg-slate-100"></div>
                   <div className="flex flex-col items-center gap-1">
                     <span className="text-amber-500 flex items-center gap-1 font-bold text-sm"><Star size={12} className="fill-amber-500" /> {fb.ratings?.relevance || 0}</span>
                     <span className="text-[10px] text-slate-400 uppercase tracking-wider">Rel</span>
                   </div>
                </div>
             </div>
           ))}
        </div>
      </div>
    </div>
  );
}
