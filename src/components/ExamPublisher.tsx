import React, { useState, useEffect } from 'react';
import { collection, setDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { BankQuestion, Exam, ExamSection } from '../types.ts';
import { Clock, Award, BookOpen, Layers, CheckCircle } from 'lucide-react';

interface ExamPublisherProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function ExamPublisher({ onNotify }: ExamPublisherProps) {
  const [bankQuestions, setBankQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  // Exam Meta
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [positiveMarks, setPositiveMarks] = useState(1);
  const [negativeMarks, setNegativeMarks] = useState(0.25);
  const [passingPercentage, setPassingPercentage] = useState(50);
  
  // Section Engine Config
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [totalSections, setTotalSections] = useState(5);
  const [questionsPerSection, setQuestionsPerSection] = useState(20);
  const [timePerSection, setTimePerSection] = useState(18);

  // Schedule
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isMockSeries, setIsMockSeries] = useState(false);

  // Generation method
  const [genMethod, setGenMethod] = useState<'manual' | 'auto'>('auto');
  
  // Auto Gen Form (Composition Rules)
  const [compositionRules, setCompositionRules] = useState<{subject: string, difficulty: string, count: number}[]>([]);
  const [draftSubject, setDraftSubject] = useState('Pathology');
  const [draftDifficulty, setDraftDifficulty] = useState('any');
  const [draftCount, setDraftCount] = useState(10);

  // Manual Gen Form
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  useEffect(() => {
    // default 1 week
    const d = new Date();
    d.setDate(d.getDate() + 7);
    setEndDate(d.toISOString().split('T')[0]);

    fetchBank();
  }, []);

  // Sync totalQuestions if section math changes, or vice versa if we wanted to (keeping simple: we just validate them later)
  useEffect(() => {
    setTotalQuestions(totalSections * questionsPerSection);
  }, [totalSections, questionsPerSection]);

  const fetchBank = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'questionBank'));
      const list: BankQuestion[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as BankQuestion));
      setBankQuestions(list);
    } catch (e) {
      onNotify("Error loading question bank", true);
    } finally {
      setLoading(false);
    }
  };

  const subjectCounts = bankQuestions.reduce((acc, q) => {
    const subj = q.subject || 'General';
    acc[subj] = (acc[subj] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueSubjects = Object.keys(subjectCounts).sort();

  const [manualSubjectFilter, setManualSubjectFilter] = useState('all');

  const filteredManualQuestions = manualSubjectFilter === 'all' 
    ? bankQuestions 
    : bankQuestions.filter(q => (q.subject || 'General') === manualSubjectFilter);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) { onNotify('Title is required', true); return; }

    const structuredTotal = totalSections * questionsPerSection;
    if (totalQuestions !== structuredTotal) {
      onNotify(`Mismatch: Total Questions (${totalQuestions}) must equal Sections (${totalSections}) * Questions Per Section (${questionsPerSection}).`, true);
      return;
    }

    let finalQIds: string[] = [];
    
    if (genMethod === 'manual') {
      if (selectedQuestionIds.length !== totalQuestions) {
        onNotify(`Manual Selection Error: You must select exactly ${totalQuestions} questions to match your structure. You have selected ${selectedQuestionIds.length}.`, true); return;
      }
      finalQIds = selectedQuestionIds;
    } else {
      let pool = [...bankQuestions];
      
      let rulesQuestionsCount = compositionRules.reduce((acc, curr) => acc + curr.count, 0);
      if (rulesQuestionsCount !== totalQuestions) {
        onNotify(`Composition Error: The sum of your rules (${rulesQuestionsCount}) must exactly equal the total questions required (${totalQuestions}).`, true);
        return;
      }

      for (let i = 0; i < compositionRules.length; i++) {
        const rule = compositionRules[i];
        let rulePool = pool.filter(q => q.subject === rule.subject && (rule.difficulty === 'any' || q.difficulty === rule.difficulty));
        
        if (rulePool.length < rule.count) {
          onNotify(`Not enough questions in bank for ${rule.subject} (${rule.difficulty}). Found ${rulePool.length}, need ${rule.count}.`, true);
          return;
        }
        
        // Shuffle & Slice
        rulePool = rulePool.sort(() => 0.5 - Math.random());
        const selected = rulePool.slice(0, rule.count);
        finalQIds.push(...selected.map(q => q.id));
        
        // Remove from master pool
        const selectedIds = new Set(selected.map(q => q.id));
        pool = pool.filter(q => !selectedIds.has(q.id));
      }

      // Shuffle final compilation so sections are mixed (or leave them ordered by subjects?)
      // We will shuffle the finalQIds globally
      finalQIds = finalQIds.sort(() => 0.5 - Math.random());
    }

    // Build configured sections
    let sections: ExamSection[] = [];
    let totalDur = 0;

    for (let i = 1; i <= totalSections; i++) {
      sections.push({
        id: `section_${i}`,
        title: `Section ${i}`,
        questionCount: questionsPerSection,
        durationMinutes: timePerSection
      });
      totalDur += timePerSection;
    }

    try {
      const examId = 'exam_' + Date.now() + Math.random().toString(36).substring(2,6);
      
      const examPayload: Exam = {
        id: examId,
        title,
        description,
        positiveMarks: Number(positiveMarks),
        negativeMarks: Number(negativeMarks),
        startDate: new Date(startDate).getTime(),
        endDate: new Date(endDate).getTime(),
        startTime,
        endTime,
        durationMinutes: totalDur,
        passingPercentage: Number(passingPercentage),
        questionIds: finalQIds,
        sections,
        isMockSeries,
        showLeaderboard,
        isHidden: true,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'exams', examId), examPayload);
      onNotify(`Exam "${title}" published with ${finalQIds.length} questions and ${sections.length} sections!`);

      // Reset form core state
      setTitle(''); setDescription('');
      setIsMockSeries(false);
      setSelectedQuestionIds([]);
    } catch (err) {
      console.error(err);
      onNotify("Failed to publish exam", true);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-100">
        <BookOpen className="text-amber-500" size={20} />
        <div>
          <h2 className="text-lg font-bold text-slate-800">Publish Examination</h2>
          <p className="text-xs text-slate-500">Configure parameters, schedules, sections engine, and question generation.</p>
        </div>
      </div>

      <form onSubmit={handlePublish} className="space-y-8">
        
        {/* Core details */}
        <section className="space-y-4">
          <h3 className="font-bold text-sm text-slate-700 bg-slate-50 p-2 rounded">1. Core Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
            <div>
               <label className="block text-xs font-bold text-slate-700 mb-1">Exam Title *</label>
               <input required type="text" value={title} onChange={e=>setTitle(e.target.value)} className="w-full border rounded px-3 py-2 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
               <label className="block text-xs font-bold text-slate-700 mb-1">Passing %</label>
               <input type="number" min="1" max="100" value={passingPercentage} onChange={e=>setPassingPercentage(Number(e.target.value))} className="w-full border rounded px-3 py-2 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div className="md:col-span-2">
               <label className="block text-xs font-bold text-slate-700 mb-1">Description / Instructions</label>
               <textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} className="w-full border rounded px-3 py-2 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
          </div>
        </section>

        {/* Section Engine Structure */}
        <section className="space-y-4">
          <h3 className="font-bold text-sm text-slate-700 bg-slate-50 p-2 rounded">2. Exam Structure Engine</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 px-2">
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Questions</label>
               <input type="number" min="1" max="500" value={totalQuestions} readOnly className="w-full border rounded px-2 py-1.5 text-xs bg-slate-50 text-slate-500 focus:outline-none cursor-not-allowed min-w-0" />
            </div>
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Sections</label>
               <input type="number" min="1" max="50" value={totalSections} onChange={e=>setTotalSections(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-xs focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Questions Per Section</label>
               <input type="number" min="1" max="500" value={questionsPerSection} onChange={e=>setQuestionsPerSection(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-xs focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Time Per Section (Mins)</label>
               <input type="number" min="1" max="600" value={timePerSection} onChange={e=>setTimePerSection(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-xs focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
          </div>
          <div className="bg-emerald-50 text-emerald-800 p-3 rounded text-xs border border-emerald-200 flex items-start gap-2 mx-2">
            <Layers size={14} className="mt-0.5 shrink-0" />
            <p><b>Structure Defined:</b> {totalSections} sections will be generated. Each section has {questionsPerSection} questions with a {timePerSection} minute limit. <b>Total duration: {totalSections * timePerSection} Minutes.</b></p>
          </div>
        </section>

        {/* Schedule & Marking */}
        <section className="space-y-4">
          <h3 className="font-bold text-sm text-slate-700 bg-slate-50 p-2 rounded">3. Schedule & Rules</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 px-2">
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Start Date</label>
               <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} required className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">End Date</label>
               <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} required className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Time Band Start</label>
               <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} required className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
            <div>
               <label className="block text-[11px] font-bold text-slate-700 mb-1">Time Band End</label>
               <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} required className="w-full border rounded px-2 py-1.5 text-xs font-mono focus:border-amber-400 focus:outline-none min-w-0" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-2 mt-4">
            <div>
               <label className="block text-xs font-bold text-emerald-700 mb-1">Positive Marks (+)</label>
               <input type="number" step="0.5" value={positiveMarks} onChange={e=>setPositiveMarks(Number(e.target.value))} className="w-full border rounded px-3 py-2 text-sm bg-emerald-50 focus:outline-none" />
            </div>
            <div>
               <label className="block text-xs font-bold text-rose-700 mb-1">Negative Marks (-)</label>
               <input type="number" step="0.25" value={negativeMarks} onChange={e=>setNegativeMarks(Number(e.target.value))} className="w-full border rounded px-3 py-2 text-sm bg-rose-50 focus:outline-none" />
            </div>
            <div className="flex flex-col justify-end">
               <label className="flex items-center gap-2 cursor-pointer h-full pt-4">
                 <input type="checkbox" checked={showLeaderboard} onChange={e=>setShowLeaderboard(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500" />
                 <span className="text-sm font-bold text-slate-700">Show Leaderboard to Students</span>
               </label>
            </div>
            <div className="flex flex-col justify-end lg:col-span-2">
               <label className="flex items-center gap-2 cursor-pointer h-full pt-4">
                 <input type="checkbox" checked={isMockSeries} onChange={e=>setIsMockSeries(e.target.checked)} className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500" />
                 <span className="text-sm font-bold text-slate-700">Push to 30 Days 30 Mock Test Tab</span>
               </label>
            </div>
          </div>
        </section>

        {/* Question Sourcing */}
        <section className="space-y-4">
          <h3 className="font-bold text-sm text-slate-700 bg-slate-50 p-2 rounded flex justify-between items-center">
            4. Question Sourcing
            <div className="flex bg-white border border-slate-200 rounded overflow-hidden text-xs">
               <button type="button" onClick={()=>setGenMethod('auto')} className={`px-3 py-1 ${genMethod === 'auto' ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>Auto Select from Bank</button>
               <button type="button" onClick={()=>setGenMethod('manual')} className={`px-3 py-1 border-l ${genMethod === 'manual' ? 'bg-amber-100 text-amber-800 font-bold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Manual Select</button>
            </div>
          </h3>

          <div className="px-2">
            {genMethod === 'auto' ? (
              <div className="space-y-4">
                 <p className="text-xs text-slate-500">Add generation rules until you reach the total of {totalQuestions} required questions.</p>
                 <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Subject</label>
                        <select value={draftSubject} onChange={e=>setDraftSubject(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs min-w-0">
                          {uniqueSubjects.map(subj => (
                            <option key={subj} value={subj}>{subj} ({subjectCounts[subj]} Available)</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Difficulty</label>
                        <select value={draftDifficulty} onChange={e=>setDraftDifficulty(e.target.value)} className="w-full border rounded px-2 py-1.5 text-xs min-w-0">
                          <option value="any">Any</option>
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Ques. Count</label>
                        <input type="number" min="1" max={totalQuestions} value={draftCount} onChange={e=>setDraftCount(Number(e.target.value))} className="w-full border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-amber-400 min-w-0" />
                      </div>
                      <div>
                        <button type="button" disabled={compositionRules.reduce((a,c)=>a+c.count, 0) >= totalQuestions} onClick={() => {
                          if (!draftSubject) return onNotify('Please select a subject', true);
                          setCompositionRules(p => [...p, {subject: draftSubject, difficulty: draftDifficulty, count: draftCount}]);
                        }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-1.5 rounded transition disabled:opacity-50 disabled:bg-slate-400">
                          Add Rule
                        </button>
                      </div>
                    </div>
                 </div>

                 {compositionRules.length > 0 && (
                   <div className="mt-4 space-y-2">
                     <p className="text-[11px] font-bold text-slate-700">
                       Configured Rules ({compositionRules.reduce((a,c)=>a+c.count, 0)} / {totalQuestions})
                     </p>
                     <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                       {compositionRules.map((r, i) => (
                         <div key={i} className="flex justify-between items-center text-[11px] bg-white border border-slate-200 px-3 py-1.5 rounded shadow-sm">
                           <span><b>{r.count} Questions</b> • {r.subject} ({r.difficulty})</span>
                           <button 
                             type="button" 
                             onClick={() => setCompositionRules(p => p.filter((_, idx)=>idx!==i))} 
                             className="text-red-500 hover:text-red-700 ml-2 font-bold"
                           >
                             Remove
                           </button>
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2">
                     <p className="text-xs text-slate-500 flex-1">Manually tick exactly the {totalQuestions} questions you want in this paper ({selectedQuestionIds.length} Selected).</p>
                     <select value={manualSubjectFilter} onChange={e=>setManualSubjectFilter(e.target.value)} className="border border-slate-300 rounded px-2 py-1 text-xs outline-none bg-white">
                      <option value="all">All Subjects</option>
                      {uniqueSubjects.map(subj => (
                        <option key={subj} value={subj}>{subj} ({subjectCounts[subj]} Available)</option>
                      ))}
                    </select>
                  </div>
                 <div className="max-h-64 overflow-y-auto border border-slate-200 rounded p-2 space-y-1 bg-slate-50">
                    {filteredManualQuestions.map(q => {
                      const sel = selectedQuestionIds.includes(q.id);
                      return (
                        <label key={q.id} className={`flex items-start gap-2 p-2 rounded cursor-pointer transition border ${sel ? 'bg-amber-50 border-amber-200' : 'bg-white border-transparent hover:border-slate-300'}`}>
                          <input type="checkbox" checked={sel} onChange={() => {
                            if (sel) setSelectedQuestionIds(p => p.filter(id => id !== q.id));
                            else {
                               if (selectedQuestionIds.length >= totalQuestions) {
                                  onNotify(`You can only select up to ${totalQuestions} questions!`, true);
                                  return;
                               }
                               setSelectedQuestionIds(p => [...p, q.id]);
                            }
                          }} className="mt-1" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 line-clamp-1">{q.englishQuestion}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{q.subject} • {q.difficulty}</p>
                          </div>
                        </label>
                      )
                    })}
                 </div>
              </div>
            )}
          </div>
        </section>

        <div className="pt-4 border-t border-slate-100 flex justify-end">
           <button type="submit" className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded flex items-center gap-2 shadow-sm transition transform hover:scale-105 active:scale-95">
              <CheckCircle size={18} /> Publish Live
           </button>
        </div>

      </form>
    </div>
  );
}

