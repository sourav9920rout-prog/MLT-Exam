import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase.ts";
import { BankQuestion } from "../types.ts";
import { CheckCircle, ArrowRight, ArrowLeft, Trophy, XCircle } from "lucide-react";

interface ChapterQuizRunnerProps {
  chapter: any;
  subjectName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  onFinished: () => void;
  onNotify: (msg: string, err?: boolean) => void;
}

export default function ChapterQuizRunner({ chapter, subjectName, studentId, studentName, studentEmail, onFinished, onNotify }: ChapterQuizRunnerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({}); // index -> optionIndex
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  const [score, setScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchQuestions();
  }, [chapter.id]);

  const fetchQuestions = async () => {
    try {
      const snap = await getDocs(collection(db, `chapter_chapters/${chapter.id}/questions`));
      const fetchedQuestions = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankQuestion[];
      
      // Shuffle questions
      for (let i = fetchedQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [fetchedQuestions[i], fetchedQuestions[j]] = [fetchedQuestions[j], fetchedQuestions[i]];
      }
      
      setQuestions(fetchedQuestions);
    } catch (e) {
      console.error(e);
      onNotify("Failed to load questions", true);
    }
    setLoading(false);
  };

  const handleSelectOption = (optIndex: number) => {
    if (isSubmitted || answers[currentIndex] !== undefined) return;
    setAnswers(prev => ({ ...prev, [currentIndex]: optIndex }));
  };

  const calculateResults = async () => {
    setSubmitting(true);
    let correct = 0;
    
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correctOptionIndex) {
        correct++;
      }
    });
    setScore(correct);
    
    try {
      const percentage = (correct / questions.length) * 100;
      await addDoc(collection(db, 'chapter_results'), {
        studentId,
        studentName,
        chapterId: chapter.id,
        chapterName: chapter.name,
        subjectName,
        score: correct,
        total: questions.length,
        percentage,
        answers,
        createdAt: Date.now()
      });
      
      // Also send result email using existing endpoint
      await fetch('/api/send-result-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentEmail,
          studentName,
          examName: `${subjectName} - ${chapter.name}`,
          score: correct,
          maxScore: questions.length,
          percentage: percentage,
          htmlReport: `<p>You completed a chapter quiz for <strong>${subjectName} - ${chapter.name}</strong>.</p><p>You scored <strong>${correct} / ${questions.length}</strong>.</p>`
        })
      });
      
      setIsSubmitted(true);
      onNotify("Quiz submitted successfully!");
    } catch (e) {
      console.error(e);
      onNotify("Error saving result", true);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading quiz...</div>;
  if (!questions.length) return <div className="p-12 text-center text-slate-500">No questions found in this chapter. <button onClick={onFinished} className="block mx-auto mt-4 text-blue-600 underline">Go Back</button></div>;

  const currentQ = questions[currentIndex];

  if (isSubmitted) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 max-w-3xl mx-auto flex flex-col items-center">
        <Trophy size={64} className="text-amber-400 mb-6" />
        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Quiz Completed!</h2>
        <p className="text-lg text-slate-600 mb-8">{subjectName} &rsaquo; {chapter.name}</p>
        
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 w-full flex flex-col items-center">
          <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Your Score</span>
          <span className="text-6xl font-black text-blue-600">{score} <span className="text-2xl text-slate-400">/ {questions.length}</span></span>
          <span className="text-lg font-bold text-slate-500 mt-2">({((score/questions.length)*100).toFixed(1)}%)</span>
        </div>
        
        <button onClick={onFinished} className="mt-8 px-8 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full md:w-auto">
          Return to Chapters
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100 relative">
       {/* Header */}
       <div className="bg-slate-900 text-white p-6 flex justify-between items-center z-10 shadow-md">
          <div>
            <h2 className="text-xl font-bold">{subjectName} - {chapter.name}</h2>
            <div className="text-sm text-slate-400 font-mono mt-1">Question {currentIndex + 1} of {questions.length}</div>
          </div>
          <button onClick={onFinished} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm font-bold bg-slate-800 px-4 py-2 rounded-lg transition">
             Quit
          </button>
       </div>
       
       {/* Question Body */}
       <div className="p-8 flex-1 overflow-y-auto bg-[#fafafa]">
         <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
           <p className="text-xl font-medium text-slate-800 mb-2 leading-relaxed">{currentQ.englishQuestion}</p>
           {currentQ.hindiQuestion && <p className="text-lg text-slate-600 mb-6">{currentQ.hindiQuestion}</p>}
           
           <div className="space-y-3 mt-8">
             {(currentQ.englishOptions || ["", "", "", ""]).map((opt, i) => {
               const hasAnswered = answers[currentIndex] !== undefined;
               const isSelected = answers[currentIndex] === i;
               const isCorrect = currentQ.correctOptionIndex === i;
               
               let optionClass = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
               let textClass = "text-slate-700";
               
               if (hasAnswered) {
                 if (isCorrect) {
                    optionClass = "border-green-500 bg-green-50 shadow-sm";
                    textClass = "text-green-800";
                 } else if (isSelected) {
                    optionClass = "border-red-500 bg-red-50 shadow-sm";
                    textClass = "text-red-800";
                 } else {
                    optionClass = "border-slate-200 bg-white opacity-60";
                 }
               } else if (isSelected) {
                  optionClass = "border-blue-500 bg-blue-50/50 shadow-sm";
                  textClass = "text-blue-800";
               }

               return (
               <button
                 key={i}
                 disabled={hasAnswered}
                 onClick={() => handleSelectOption(i)}
                 className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${optionClass}`}
               >
                 <div>
                   <p className={`font-semibold ${textClass}`}>{opt}</p>
                   {currentQ.hindiOptions[i] && <p className={`mt-1 text-sm ${hasAnswered && (isCorrect || isSelected) ? textClass : 'text-slate-500'}`}>{currentQ.hindiOptions[i]}</p>}
                 </div>
                 <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${hasAnswered && isCorrect ? 'border-green-500 bg-green-500' : hasAnswered && isSelected && !isCorrect ? 'border-red-500 bg-red-500' : isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300 group-hover:border-slate-400'}`}>
                   {hasAnswered && isCorrect && <CheckCircle size={14} className="text-white" />}
                   {hasAnswered && isSelected && !isCorrect && <XCircle size={14} className="text-white" />}
                 </div>
               </button>
             )})}
           </div>
         </div>
         
         {answers[currentIndex] !== undefined && (currentQ.englishExplanation || currentQ.hindiExplanation) && (
           <div className="mt-8 bg-blue-50 border border-blue-100 p-6 rounded-xl shadow-sm">
              <h4 className="font-bold text-blue-900 mb-2">Explanation</h4>
              {currentQ.englishExplanation && <p className="text-slate-700 leading-relaxed mb-2">{currentQ.englishExplanation}</p>}
              {currentQ.hindiExplanation && <p className="text-slate-600 leading-relaxed">{currentQ.hindiExplanation}</p>}
           </div>
         )}
       </div>
       
       {/* Footer */}
       <div className="p-6 bg-white border-t border-slate-100 flex justify-between items-center gap-4 relative z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.03)]">
         <button 
           onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
           disabled={currentIndex === 0}
           className="px-6 py-3 rounded-lg font-bold flex items-center gap-2 border-2 border-slate-200 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50 transition"
         >
           <ArrowLeft size={18} /> Previous
         </button>
         
         <div className="text-sm font-bold text-slate-400">
           {Object.keys(answers).length} / {questions.length} Answered
         </div>
         
         {currentIndex < questions.length - 1 ? (
           <button 
             onClick={() => setCurrentIndex(currentIndex + 1)}
             className="px-8 py-3 bg-slate-900 border-2 border-slate-900 text-white rounded-lg font-bold shadow-lg flex items-center gap-2 hover:bg-slate-800 transition"
           >
             Next <ArrowRight size={18} />
           </button>
         ) : (
           <button 
             onClick={calculateResults}
             disabled={submitting}
             className="px-8 py-3 bg-red-600 border-2 border-red-600 text-white rounded-lg font-bold shadow-[0_4px_15px_rgba(220,38,38,0.3)] hover:bg-red-700 hover:border-red-700 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50"
           >
             {submitting ? 'Finishing...' : 'Finish Quiz'} <CheckCircle size={18} />
           </button>
         )}
       </div>

        {/* Submit Confirmation Modal */}
        {false && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <CheckCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Finish Quiz?</h3>
              <p className="text-slate-600 mb-6 font-medium">Are you sure you want to lock in your answers and submit?</p>
              <div className="flex gap-4 w-full">
                <button 
                  onClick={() => setShowConfirmSubmit(false)} 
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                >
                  Go Back
                </button>
                <button 
                  onClick={calculateResults} 
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition"
                >
                  Yes, Submit
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
