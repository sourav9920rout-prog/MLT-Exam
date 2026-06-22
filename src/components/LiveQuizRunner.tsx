import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebase.ts';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Exam, BankQuestion } from '../types.ts';
import { Clock, CheckCircle, XCircle, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LiveQuizRunnerProps {
  exam: Exam;
  studentId: string;
  studentName: string;
  studentEmail: string;
  onFinished: (result: any) => void;
  onCancel: () => void;
}

export default function LiveQuizRunner({ exam, studentId, studentName, studentEmail, onFinished, onCancel }: LiveQuizRunnerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  
  const [answers, setAnswers] = useState<{ [qId: string]: number }>({});
  const [submitTimes, setSubmitTimes] = useState<{ [qId: string]: number }>({});

  const startT = exam.liveQuizStartTime || Date.now();
  const qTime = exam.liveQuizTimePerQuestion || 15;
  const breakTime = 5;
  const cycleTime = qTime + breakTime;

  useEffect(() => {
    let unmounted = false;
    const fetchQuestions = async () => {
      try {
        const qs: BankQuestion[] = [];
        
        if (exam.embeddedQuestions && exam.embeddedQuestions.length > 0) {
          // Use embedded questions right away (important for Chapter Quizzes)
          const embeddedMap = new Map(exam.embeddedQuestions.map(q => [q.id, q]));
          for (const qid of exam.questionIds) {
             if (embeddedMap.has(qid)) {
               qs.push(embeddedMap.get(qid)!);
             } else {
               const d = await getDoc(doc(db, 'questionBank', qid));
               if (d.exists()) qs.push({ id: d.id, ...d.data() } as BankQuestion);
             }
          }
        } else {
          // Standard fetch
          for (const qid of exam.questionIds) {
             const d = await getDoc(doc(db, 'questionBank', qid));
             if (d.exists()) qs.push({ id: d.id, ...d.data() } as BankQuestion);
          }
        }
        
        if (!unmounted) setQuestions(qs);
      } catch (e) {
        console.error(e);
      } finally {
        if (!unmounted) setLoading(false);
      }
    };
    fetchQuestions();
    
    return () => { unmounted = true; };
  }, [exam.questionIds]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 500);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return <div className="text-center p-12 text-blue-600 font-bold animate-pulse">Loading Live Quiz...</div>;
  }

  if (questions.length === 0) {
    return <div className="text-center p-12 text-slate-500">No questions found.</div>;
  }

  const diff_s = (now - startT) / 1000;
  
  if (diff_s < 0) {
    // Waiting to start
    const waitSeconds = Math.ceil(-diff_s);
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 bg-slate-50">
        <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full border border-slate-200">
           <Radio className="w-16 h-16 text-purple-600 mx-auto mb-4 animate-pulse" />
           <h2 className="text-2xl font-bold text-slate-800 mb-2">Live Quiz Starting Soon</h2>
           <p className="text-slate-500 mb-8">Get ready! The quiz will begin automatically.</p>
           
           <div className="text-6xl font-black text-slate-800 font-mono tracking-tighter">
             {Math.floor(waitSeconds/60)}:{(waitSeconds%60).toString().padStart(2, '0')}
           </div>
           
           <button onClick={onCancel} className="mt-12 text-sm text-slate-400 hover:text-slate-600 font-bold">Leave Waiting Room</button>
        </div>
      </div>
    );
  }

  const currentCycleIdx = Math.floor(diff_s / cycleTime);
  const phaseTime = diff_s % cycleTime;
  const isBreak = phaseTime >= qTime;

  if (currentCycleIdx >= questions.length) {
    // End of quiz, compute and submit
    const computeAndSubmit = async () => {
      const positiveMarks = exam.positiveMarks || 1;
      const negativeMarks = exam.negativeMarks || 0;
      let score = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      
      let timeTakenScore = 0;
      
      for (const q of questions) {
        if (answers[q.id] !== undefined) {
           if (answers[q.id] === q.correctOptionIndex) {
              score += positiveMarks;
              correctCount++;
              // Bonus for quick submission logic could apply here, but simple sum for now
              const submittedInSec = submitTimes[q.id] || qTime;
              const normalized = Math.max(0, qTime - submittedInSec);
              timeTakenScore += normalized * 0.01; // tie breaker
           } else {
              score -= negativeMarks;
              incorrectCount++;
           }
        }
      }
      
      const finalScore = Number((score + timeTakenScore).toFixed(4));
      
      const resId = `res_${Date.now()}_${studentId}`;
      const resPayload = {
        id: resId,
        studentId,
        studentName,
        studentEmail,
        examId: exam.id,
        examName: exam.title,
        score: finalScore,
        maxScore: questions.length * positiveMarks,
        totalQuestions: questions.length,
        percentage: Math.max(0, (score / (questions.length * positiveMarks)) * 100),
        passed: true,
        correctCount,
        incorrectCount,
        unansweredCount: questions.length - Object.keys(answers).length,
        answers,
        questionIds: exam.questionIds,
        submittedAt: new Date().toISOString(),
        timeTakenSeconds: questions.length * cycleTime
      };

      try {
        await setDoc(doc(db, 'results', resId), resPayload);
      } catch (e) {
        console.error("Failed to submit live quiz result", e);
      }
      onFinished(resPayload);
    };

    computeAndSubmit();
    
    return <div className="p-12 text-center text-slate-500 font-bold">Submitting Live Quiz Results...</div>;
  }

  const q = questions[currentCycleIdx];
  const timeLeft = Math.ceil(qTime - phaseTime);
  const selectedIdx = answers[q.id];

  const handleSelect = (idx: number) => {
    if (isBreak) return; // Can't change during break
    setAnswers(prev => {
        if (prev[q.id] !== undefined) return prev; // already answered
        return { ...prev, [q.id]: idx };
    });
    if (!submitTimes[q.id]) {
       setSubmitTimes(prev => ({ ...prev, [q.id]: phaseTime }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col md:flex-row">
       <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full bg-white shadow-2xl overflow-hidden relative">
          
          <div className="bg-purple-700 text-white p-4 flex justify-between items-center z-20 shadow-md">
            <h2 className="font-bold text-lg flex items-center gap-2"><Radio className="w-5 h-5 animate-pulse" /> Live Quiz Mode</h2>
            <div className="flex items-center gap-4">
              <span className="bg-white/20 px-3 py-1 rounded text-sm font-bold tracking-widest">{currentCycleIdx + 1} / {questions.length}</span>
              <button onClick={onCancel} className="text-white/80 hover:text-white px-2 py-1 text-sm font-bold bg-white/10 rounded border border-white/20">Exit</button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden flex flex-col bg-slate-50 p-6">
            <AnimatePresence mode="wait">
              {!isBreak ? (
                 <motion.div 
                   key={`q-${q.id}`}
                   initial={{ opacity: 0, x: 20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: -20 }}
                   className="flex-1 bg-white rounded-xl shadow-lg border border-slate-200 p-8 flex flex-col items-center text-center max-w-2xl mx-auto w-full overflow-y-auto"
                 >
                    <div className="w-20 h-20 mb-6 rounded-full border-4 border-purple-500 flex items-center justify-center text-3xl font-black text-purple-700 shrink-0">
                      {timeLeft}
                    </div>
                    
                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-8 whitespace-pre-wrap">{q.englishQuestion}</h3>
                    
                    <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                      {q.englishOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelect(i)}
                          disabled={answers[q.id] !== undefined}
                          className={`p-4 rounded-xl text-left font-bold transition-all border-2 disabled:cursor-default ${selectedIdx === i ? 'border-purple-600 bg-purple-50 text-purple-800 shadow-md transform scale-[1.02]' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'} ${answers[q.id] !== undefined && selectedIdx !== i ? 'opacity-50' : ''}`}
                        >
                          <span className="inline-block bg-slate-100 text-slate-500 w-8 h-8 text-center leading-8 rounded-lg mr-3 text-sm">{String.fromCharCode(65 + i)}</span>
                          {opt}
                        </button>
                      ))}
                    </div>
                 </motion.div>
              ) : (
                 <motion.div 
                   key={`res-${q.id}`}
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 1.1 }}
                   className="flex-1 flex flex-col items-center justify-center text-center"
                 >
                   {selectedIdx === q.correctOptionIndex ? (
                     <div className="bg-emerald-100 text-emerald-700 p-8 rounded-2xl shadow-xl border border-emerald-200 max-w-md w-full">
                        <CheckCircle size={80} className="mx-auto mb-6 opacity-80" />
                        <h2 className="text-3xl font-black mb-2">Correct!</h2>
                        <p className="font-bold opacity-80">You got it right.</p>
                     </div>
                   ) : (
                     <div className="bg-rose-100 text-rose-700 p-8 rounded-2xl shadow-xl border border-rose-200 max-w-md w-full">
                        <XCircle size={80} className="mx-auto mb-6 opacity-80" />
                        <h2 className="text-3xl font-black mb-2">{selectedIdx === undefined ? 'Time Up!' : 'Incorrect'}</h2>
                        <p className="font-bold opacity-80">Correct Answer was: {String.fromCharCode(65 + q.correctOptionIndex)}</p>
                     </div>
                   )}
                 </motion.div>
              )}
            </AnimatePresence>
          </div>

       </div>
    </div>
  );
}
