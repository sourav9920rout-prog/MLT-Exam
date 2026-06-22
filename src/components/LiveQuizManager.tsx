import React, { useState, useEffect } from 'react';
import { collection, setDoc, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { BankQuestion, Exam } from '../types.ts';
import { Radio, Plus, Trash2, Edit2, Play, Users, Clock } from 'lucide-react';
import AdminTakeExam from './AdminTakeExam.tsx';

interface LiveQuizManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function LiveQuizManager({ onNotify }: LiveQuizManagerProps) {
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [liveQuizStartTime, setLiveQuizStartTime] = useState('');
  const [liveQuizTimePerQ, setLiveQuizTimePerQ] = useState(15);
  
  // Selection
  const [sourceType, setSourceType] = useState<'bank' | 'chapter'>('bank');
  const [subjectFilter, setSubjectFilter] = useState('all');
  
  // Chapter Selection State
  const [chapterSubjects, setChapterSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [selectedChapSubjId, setSelectedChapSubjId] = useState<string>('');
  const [selectedChapId, setSelectedChapId] = useState<string>('');
  const [chapterQuestions, setChapterQuestions] = useState<BankQuestion[]>([]);
  const [loadingChapterQs, setLoadingChapterQs] = useState(false);

  const [selectedQuestions, setSelectedQuestions] = useState<BankQuestion[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchBank();
    fetchChapterData();
    const now = new Date();
    // Default to +5 minutes from now for convenience
    now.setMinutes(now.getMinutes() + 5);
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setLiveQuizStartTime(now.toISOString().slice(0, 16));
  }, []);

  const fetchBank = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'questionBank'));
      const list: BankQuestion[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as BankQuestion);
      });
      setBankQuestions(list);
    } catch (e) {
      onNotify("Error loading question bank", true);
    } finally {
      setLoading(false);
    }
  };

  const fetchChapterData = async () => {
    try {
      const subSnap = await getDocs(collection(db, 'chapter_subjects'));
      const chSnap = await getDocs(collection(db, 'chapter_chapters'));
      
      const subs: any[] = [];
      subSnap.forEach(d => subs.push({ id: d.id, ...d.data() }));
      setChapterSubjects(subs);
      
      const chaps: any[] = [];
      chSnap.forEach(d => chaps.push({ id: d.id, ...d.data() }));
      setChapters(chaps);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const fetchChapterQs = async () => {
      if (!selectedChapId) {
        setChapterQuestions([]);
        return;
      }
      setLoadingChapterQs(true);
      try {
        const snap = await getDocs(collection(db, `chapter_chapters/${selectedChapId}/questions`));
        const list: BankQuestion[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() } as BankQuestion));
        setChapterQuestions(list);
      } catch (e) {
         console.error(e);
      } finally {
         setLoadingChapterQs(false);
      }
    };
    fetchChapterQs();
  }, [selectedChapId]);

  const publishLiveQuiz = async () => {
    if (!title) { onNotify('Title is required', true); return; }
    if (!liveQuizStartTime) { onNotify('Start Time is required', true); return; }
    if (selectedQuestions.length === 0) { onNotify('Please select at least 1 question.', true); return; }

    setIsSubmitting(true);
    try {
       const examId = `lq_${Date.now()}`;
       const liveStartTimestamp = new Date(liveQuizStartTime).getTime();

       const payload = {
        id: examId,
        title,
        description,
        positiveMarks: 1,
        negativeMarks: 0,
        passingPercentage: 0,
        totalQuestions: selectedQuestions.length,
        durationMinutes: Math.ceil((selectedQuestions.length * liveQuizTimePerQ) / 60),
        questionIds: selectedQuestions.map(q => q.id),
        embeddedQuestions: selectedQuestions,
        sections: [],
        availability: {
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(liveStartTimestamp + 86400000).toISOString().split('T')[0], // 1 day window
          startTime: '00:00',
          endTime: '23:59',
        },
        isHidden: false,
        isLiveQuizMode: true,
        liveQuizStartTime: liveStartTimestamp,
        liveQuizTimePerQuestion: liveQuizTimePerQ,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'exams', examId), payload);
      onNotify("Live Quiz created successfully!");
      setActiveTab('list');
      // Reset form
      setTitle('');
      setDescription('');
      setSelectedQuestions([]);
    } catch (e) {
      console.error(e);
      onNotify("Error creating live quiz", true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleSelect = (q: BankQuestion) => {
    setSelectedQuestions(prev => {
      if (prev.some(x => x.id === q.id)) {
        return prev.filter(x => x.id !== q.id);
      } else {
        return [...prev, q];
      }
    });
  };

  const uniqueSubjects = Array.from(new Set(bankQuestions.map(q => q.subject || 'General'))).sort();
  const filteredQuestions = subjectFilter === 'all' 
    ? bankQuestions 
    : bankQuestions.filter(q => (q.subject || 'General') === subjectFilter);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
       <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Radio className="text-purple-600 animate-pulse" /> Live Quiz Administration</h3>
       
       <div className="flex gap-4 mb-6 border-b border-slate-200">
         <button onClick={() => setActiveTab('list')} className={`py-2 px-4 border-b-2 font-bold ${activeTab === 'list' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Current Live Quizzes</button>
         <button onClick={() => setActiveTab('create')} className={`py-2 px-4 border-b-2 font-bold ${activeTab === 'create' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Create New Live Quiz</button>
       </div>

       {activeTab === 'list' && (
         <AdminTakeExam filterByLiveQuiz={true} />
       )}

       {activeTab === 'create' && (
         <div className="space-y-6 max-w-4xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Live Quiz Title</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Weekly Live Quiz #1" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full px-3 py-2 border rounded-lg h-24" placeholder="Brief rules or description..." />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1">Start Time (Local)</label>
                     <input type="datetime-local" value={liveQuizStartTime} onChange={e => setLiveQuizStartTime(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500" />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">Time per Question (Seconds) <Clock size={16}/></label>
                     <input type="number" min="5" max="300" value={liveQuizTimePerQ} onChange={e => setLiveQuizTimePerQ(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:border-purple-500" />
                  </div>
                  <div className="p-4 bg-purple-100 rounded-lg text-purple-800 flex items-center justify-between">
                     <div className="font-bold">Total Selection:</div>
                     <div className="text-xl font-black">{selectedQuestions.length} MCQs</div>
                  </div>
                </div>
            </div>

            <div className="bg-white border text-left border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex flex-col gap-3">
                <div className="flex justify-between items-center sm:flex-row flex-col gap-3">
                  <span className="font-bold text-slate-700">Select Questions From:</span>
                  <div className="flex border border-slate-300 rounded-lg overflow-hidden shrink-0">
                    <button onClick={() => setSourceType('bank')} className={`px-4 py-1.5 text-sm font-bold ${sourceType === 'bank' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Question Bank</button>
                    <button onClick={() => setSourceType('chapter')} className={`px-4 py-1.5 text-sm font-bold ${sourceType === 'chapter' ? 'bg-purple-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border-l border-slate-300'}`}>Chapter Quizzes</button>
                  </div>
                </div>
                
                {sourceType === 'bank' && (
                  <div className="flex justify-end mt-2">
                    <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="px-3 py-1.5 rounded-lg border-slate-300 text-sm font-medium">
                      <option value="all">All Subjects</option>
                      {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                
                {sourceType === 'chapter' && (
                  <div className="flex justify-end mt-2 gap-2 flex-wrap">
                    <select value={selectedChapSubjId} onChange={(e) => { setSelectedChapSubjId(e.target.value); setSelectedChapId(''); }} className="px-3 py-1.5 rounded-lg border-slate-300 text-sm font-medium">
                      <option value="">-- Choose Subject --</option>
                      {chapterSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select disabled={!selectedChapSubjId} value={selectedChapId} onChange={(e) => setSelectedChapId(e.target.value)} className="px-3 py-1.5 rounded-lg border-slate-300 text-sm font-medium disabled:opacity-50">
                      <option value="">-- Choose Chapter --</option>
                      {chapters.filter(c => c.subjectId === selectedChapSubjId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="p-4 max-h-80 overflow-y-auto space-y-2 relative">
                 {sourceType === 'bank' ? (
                   loading ? <div className="text-center p-8">Loading bank...</div> : filteredQuestions.map((q) => {
                      const isSelected = selectedQuestions.some(x => x.id === q.id);
                      return (
                        <div key={q.id} onClick={() => toggleSelect(q)} className={`p-4 border rounded-xl cursor-pointer hover:shadow-sm transition select-none flex items-start gap-4 ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                          <input type="checkbox" checked={isSelected} readOnly className="mt-1 w-5 h-5 text-purple-600 rounded bg-slate-100 border-slate-300 focus:ring-purple-500" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 line-clamp-2">{q.englishQuestion}</p>
                            <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 px-2 rounded-sm">{q.subject} • {q.difficulty}</span>
                          </div>
                        </div>
                      );
                   })
                 ) : (
                   !selectedChapId ? <div className="text-center p-8 text-slate-500">Please select a subject and chapter to view questions.</div> : 
                   loadingChapterQs ? <div className="text-center p-8">Loading chapter questions...</div> :
                   chapterQuestions.length === 0 ? <div className="text-center p-8 text-slate-500">No questions found in this chapter.</div> :
                   chapterQuestions.map((q) => {
                      const isSelected = selectedQuestions.some(x => x.id === q.id);
                      return (
                        <div key={q.id} onClick={() => toggleSelect(q)} className={`p-4 border rounded-xl cursor-pointer hover:shadow-sm transition select-none flex items-start gap-4 ${isSelected ? 'border-purple-500 bg-purple-50' : 'border-slate-100 hover:border-slate-300 bg-white'}`}>
                          <input type="checkbox" checked={isSelected} readOnly className="mt-1 w-5 h-5 text-purple-600 rounded bg-slate-100 border-slate-300 focus:ring-purple-500" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 line-clamp-2">{q.englishQuestion}</p>
                            <span className="inline-block mt-2 text-[10px] uppercase tracking-wider font-bold text-slate-500 bg-slate-100 px-2 rounded-sm">{q.subject} • {q.difficulty}</span>
                          </div>
                        </div>
                      );
                   })
                 )}
              </div>
            </div>

            <button disabled={isSubmitting} onClick={publishLiveQuiz} className="w-full py-4 text-center rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold disabled:opacity-50 text-lg flex items-center justify-center gap-2">
              {isSubmitting ? 'Creating Live Quiz...' : <><Plus size={20} /> Build & Publish Live Quiz</>}
            </button>
         </div>
       )}
    </div>
  );
}
