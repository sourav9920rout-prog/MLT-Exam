import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, setDoc, getDocs, getDoc, query, where, documentId } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Clock, Send, AlertTriangle, RefreshCw, AlertCircle, Save, Flag, XCircle } from 'lucide-react';
import { Exam, BankQuestion, ExamAttempt, ExamSection } from '../types.ts';

interface QuizRunnerProps {
  exam: Exam;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhotoURL?: string | null;
  onFinished: (result: any) => void;
  onCancel: () => void;
  onNotify: (message: string, isError?: boolean) => void;
  isAdminTesting?: boolean;
}

export default function QuizRunner({
  exam,
  studentId,
  studentName,
  studentEmail,
  studentPhotoURL,
  onFinished,
  onCancel,
  onNotify,
  isAdminTesting
}: QuizRunnerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Section Management
  const [sections, setSections] = useState<ExamSection[]>([]);
  const [currentSectionIdx, setCurrentSectionIdx] = useState(0);
  const [sectionTimeLeft, setSectionTimeLeft] = useState(0);
  const [overallTimeTaken, setOverallTimeTaken] = useState(0);
  
  // Question tracking within current section
  const [currentIdx, setCurrentIdx] = useState(0);

  // States
  const [examStarted, setExamStarted] = useState(false);
  const [examLanguage, setExamLanguage] = useState<'english' | 'hindi'>('english');
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [recoveredSession, setRecoveredSession] = useState<{ans: any, states: any, section: number, timeRem: number} | null>(null);

  // answers map: global question ID -> selected option index, or -1 for unset
  const [answers, setAnswers] = useState<{ [qId: string]: number }>({});
  // states map: string -> 'saved' | 'review' | 'none' | 'review_answered'
  const [savedStates, setSavedStates] = useState<{ [qId: string]: 'saved' | 'review' | 'not_visited' | 'not_answered' | 'none' | 'review_answered' }>({});
  
  // Anti-Cheat tracking
  const [violations, setViolations] = useState(0);
  const [banned, setBanned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitModalMessage, setSubmitModalMessage] = useState('');
  
  const timerInterval = useRef<any>(null);
  const autosaveInterval = useRef<any>(null);
  const generalTimer = useRef<any>(null);
  const attemptId = `attempt_${studentId}_${exam.id}`;

  // Calculate question slice for the current section
  const getSectionSlice = () => {
    let startIndex = 0;
    for (let i = 0; i < currentSectionIdx; i++) {
        startIndex += sections[i].questionCount;
    }
    const currentCount = sections[currentSectionIdx]?.questionCount || 0;
    return {
      start: startIndex,
      end: startIndex + currentCount,
      total: currentCount,
      globalStartIndex: startIndex
    };
  };

  // 1. Initial Check & Optional Hydrate
  useEffect(() => {
    const checkRecovery = async () => {
      try {
        const attemptSnap = await getDoc(doc(db, 'examAttempts', attemptId));
        if (attemptSnap.exists()) {
          const attemptData = attemptSnap.data() as ExamAttempt;
          
          if (attemptData.status === 'banned') {
             setBanned(true);
             setLoading(false);
             return;
          }

          if (attemptData.status === 'submitted') {
             onNotify('You have already submitted this exam.', true);
             onCancel();
             return;
          }

          if (attemptData.status === 'started') {
             const currentRefreshes = attemptData.refreshCount || 0;
             if (currentRefreshes >= 5) {
                 await setDoc(doc(db, 'examAttempts', attemptId), { status: 'banned', refreshCount: currentRefreshes + 1 }, { merge: true });
                 onNotify('You have been banned from this exam for refreshing the page too many times.', true);
                 setBanned(true);
                 setLoading(false);
                 return;
             }

             await setDoc(doc(db, 'examAttempts', attemptId), { refreshCount: currentRefreshes + 1 }, { merge: true });

             let localRec: any = null;
             try {
                 const storedRaw = localStorage.getItem(`examSession_${attemptId}`);
                 if (storedRaw) {
                     localRec = JSON.parse(storedRaw);
                 }
             } catch(e) {}

             const ansToUse = localRec?.answers || attemptData.answers || {};
             const statesToUse = localRec?.savedStates || attemptData.savedStates || {};
             const secToUse = localRec?.currentSectionIdx ?? attemptData.currentSectionIndex ?? 0;
             const timeRemToUse = localRec?.sectionTimeLeft ?? attemptData.timeRemainingSeconds ?? 0;

             // We have a recovery, so bypass declaration and OTP
             setRecoveredSession({
                 ans: ansToUse,
                 states: statesToUse,
                 section: secToUse,
                 timeRem: timeRemToUse
             });
             triggerFetchAndStart(ansToUse, statesToUse, secToUse, timeRemToUse);
             return;
          }
        }
        setLoading(false);
      } catch(e) {
        setLoading(false);
      }
    };
    checkRecovery();
  }, [exam]);

  const triggerFetchAndStart = async (recAns?: any, recStates?: any, recSecIdx?: number, recTimeRem?: number) => {
      setLoading(true);
      try {
        // Implement batched fetch for exactly the requested 100 questions using parallel 'in' queries
        const batchedFetch = async (ids: string[]) => {
          const chunkedPromises = [];
          for (let i = 0; i < ids.length; i += 30) {
            const chunk = ids.slice(i, i + 30);
            const q = query(collection(db, 'questionBank'), where(documentId(), 'in', chunk));
            chunkedPromises.push(getDocs(q));
          }
          const snapshots = await Promise.all(chunkedPromises);
          const results: BankQuestion[] = [];
          snapshots.forEach(snaps => {
            snaps.forEach(snap => {
               results.push({ id: snap.id, ...snap.data() } as BankQuestion);
            });
          });
          // Restore exact ordering from ids
          return ids.map(id => results.find(r => r.id === id)).filter(Boolean) as BankQuestion[];
        };

        const rawQuestions = await batchedFetch(exam.questionIds);

        // Calculate sections once
        let actSections = exam.sections;
        if (!actSections || actSections.length === 0) {
            actSections = [{
                id: 'sec1',
                title: 'Assessment',
                questionCount: exam.questionIds.length,
                durationMinutes: exam.durationMinutes
            }];
        }
        setSections(actSections);

        // Seeded PRNG for distinct permutations based on student profile (so layout is deterministic)
        let seed = (studentId + exam.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const prng = () => {
             seed = (seed * 16807) % 2147483647;
             return (seed - 1) / 2147483646;
        };

        // Shuffle within sections
        let myQIds: string[] = [];
        let startIndex = 0;
        for (const sec of actSections) {
             const secIds = exam.questionIds.slice(startIndex, startIndex + sec.questionCount);
             // Fisher-Yates
             for (let i = secIds.length - 1; i > 0; i--) {
                 const j = Math.floor(prng() * (i + 1));
                 [secIds[i], secIds[j]] = [secIds[j], secIds[i]];
             }
             myQIds = myQIds.concat(secIds);
             startIndex += sec.questionCount;
        }

        // Apply distinct permutation logic
        const finalMapped = myQIds
           .map((id) => rawQuestions.find((q) => q.id === id))
           .filter(Boolean) as BankQuestion[];

        setQuestions(finalMapped);

        const initAns: any = {};
        const initStates: any = {};
        finalMapped.forEach(q => {
            initAns[q.id] = -1;
            initStates[q.id] = 'not_visited';
        });

        if (recAns) {
             setAnswers(prev => ({ ...initAns, ...recAns }));
             setSavedStates(prev => ({ ...initStates, ...recStates }));
             setCurrentSectionIdx(recSecIdx ?? 0);
             const fallbackRem = actSections[recSecIdx ?? 0]?.durationMinutes * 60;
             setSectionTimeLeft(recTimeRem ?? fallbackRem);
             onNotify('Previous session auto-save recovered successfully.');
        } else {
             setAnswers(initAns);
             setSavedStates(initStates);
             setCurrentSectionIdx(0);
             setSectionTimeLeft(actSections[0].durationMinutes * 60);
        }

        setExamStarted(true);
      } catch (err) {
        console.error(err);
        onNotify('Error loading exam questions. Please contact admins.', true);
      } finally {
        setLoading(false);
      }
  };

  const handleStartExam = async () => {
      triggerFetchAndStart();
  };

  // 2. Timers
  useEffect(() => {
    if (loading || submitting || !examStarted) return;

    // Track total time taken
    generalTimer.current = setInterval(() => {
        setOverallTimeTaken(prev => prev + 1);
    }, 1000);

    // Track section time
    timerInterval.current = setInterval(() => {
      setSectionTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
        clearInterval(timerInterval.current);
        clearInterval(generalTimer.current);
    }
  }, [loading, submitting, currentSectionIdx, examStarted]);

  // Continuously save to local storage
  useEffect(() => {
     if (examStarted && !submitting && attemptId) {
         try {
             localStorage.setItem(`examSession_${attemptId}`, JSON.stringify({
                 answers,
                 savedStates,
                 currentSectionIdx,
                 sectionTimeLeft,
                 lastUpdated: Date.now()
             }));
         } catch(e) {}
     }
  }, [answers, savedStates, currentSectionIdx, sectionTimeLeft, examStarted, submitting, attemptId]);

  // Track visited state
  useEffect(() => {
    if (!examStarted || questions.length === 0 || loading || submitting) return;
    const qGlobalIdx = getSectionSlice().globalStartIndex + currentIdx;
    const curQ = questions[qGlobalIdx];
    if (curQ && (savedStates[curQ.id] === 'not_visited' || savedStates[curQ.id] === 'none')) {
       setSavedStates(prev => ({...prev, [curQ.id]: 'not_answered'}));
    }
  }, [currentIdx, currentSectionIdx, examStarted, loading, submitting, questions, savedStates]);

  // Handle section auto transition on timeout separately
  useEffect(() => {
    if (examStarted && !loading && !submitting && sectionTimeLeft === 0 && sections.length > 0) {
      clearInterval(timerInterval.current);
      setIsFrozen(true);
      handleSectionEndAuto();
    }
  }, [sectionTimeLeft, examStarted, loading, submitting, sections.length]);

  // 3. Silent Autosave every 15s instead of per-click
  useEffect(() => {
    if (loading || submitting || !examStarted) return;
    autosaveInterval.current = setInterval(() => {
       triggerAutosave();
    }, 15000);

    return () => clearInterval(autosaveInterval.current);
  }, [answers, savedStates, currentSectionIdx, sectionTimeLeft, loading, submitting, examStarted]);

  // 4. Anti-cheat
  useEffect(() => {
    if (loading || submitting || !examStarted) return;

    const handleVisibility = () => {
        if (document.hidden) {
            setViolations(v => v + 1);
            onNotify("Warning: Tab switch or minimization detected! This incident has been logged.", true);
        }
    };
    
    const handleFullscreenChange = () => {
        if (!document.fullscreenElement) {
            setViolations(v => v + 1);
            onNotify("Warning: You exited fullscreen mode! This incident has been logged.", true);
        }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    
    return () => {
        document.removeEventListener("visibilitychange", handleVisibility);
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [loading, submitting, examStarted]);

  useEffect(() => {
    if (violations >= 8 && !submitting && !isFrozen) {
      onNotify("Maximum violations reached. Auto-submitting exam.", true);
      setIsFrozen(true);
      executeQuizSubmission();
    }
  }, [violations, submitting, isFrozen]);

  const triggerAutosave = async () => {
    try {
      const payload: Partial<ExamAttempt> = {
        answers,
        savedStates,
        currentSectionIndex: currentSectionIdx,
        timeRemainingSeconds: sectionTimeLeft,
        status: 'started',
        updatedAt: new Date().toISOString()
      };
      
      const docRef = doc(db, 'examAttempts', attemptId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, {
          id: attemptId,
          studentId,
          examId: exam.id,
          startedAt: new Date().toISOString(),
          refreshCount: 0,
          ...payload
        });
      } else {
        await setDoc(docRef, payload, { merge: true });
      }
    } catch (e) {
      console.warn('Autosave skipped:', e);
    }
  };

  const handleSectionEndAuto = () => {
      console.log(`[QuizRunner] handleSectionEndAuto triggered. currentSectionIdx: ${currentSectionIdx}, sectionsLength: ${sections.length}`);
      onNotify(currentSectionIdx < sections.length - 1 ? `Section time up! Freezing and advancing...` : `Time up! Handing over to evaluation...`, true);
      
      // Auto-save the states for safety
      triggerAutosave();

      if (currentSectionIdx < sections.length - 1) {
          setTimeout(() => {
              const nextSec = currentSectionIdx + 1;
              const nextTime = sections[nextSec].durationMinutes * 60;
              setCurrentSectionIdx(nextSec);
              setCurrentIdx(0);
              setSectionTimeLeft(nextTime);
              setIsFrozen(false);
              
              // Ensure we save the next section immediately so refresh doesn't jump back
              const forceSave = async () => {
                 try {
                     await setDoc(doc(db, 'examAttempts', attemptId), {
                         currentSectionIndex: nextSec,
                         timeRemainingSeconds: nextTime,
                         updatedAt: new Date().toISOString()
                     }, { merge: true });
                 } catch(e) {}
              };
              forceSave();
          }, 3000); // give enough time to read the notification (3s)
      } else {
          // Changed to true flag for onNotify so they know it's auto-submitting
          console.log(`[QuizRunner] Auto-submitting exam.`);
          setSubmitting(true);
          onNotify(`Final section completed successfully. Finalizing exam...`);
          executeQuizSubmission();
      }
  };

  const goNextQuestion = () => {
      if (currentIdx < getSectionSlice().total - 1) {
          setCurrentIdx(currentIdx + 1);
      }
  };

  const handleManualSectionAdvance = () => {
      const confirmed = window.confirm("Caution: You can't go back to the previous section or edit answers once you proceed. Do you want to end this section and start the next section?");
      if (confirmed) {
          triggerAutosave();
          const nextSec = currentSectionIdx + 1;
          const nextTime = sections[nextSec].durationMinutes * 60;
          setCurrentSectionIdx(nextSec);
          setCurrentIdx(0);
          setSectionTimeLeft(nextTime);
          setIsFrozen(false);
          
          const forceSave = async () => {
             try {
                 await setDoc(doc(db, 'examAttempts', attemptId), {
                     currentSectionIndex: nextSec,
                     timeRemainingSeconds: nextTime,
                     updatedAt: new Date().toISOString()
                 }, { merge: true });
             } catch(e) {}
          };
          forceSave();
      }
  };

  const handleSaveAndNext = () => {
      const qGlobalIdx = getSectionSlice().globalStartIndex + currentIdx;
      const qId = questions[qGlobalIdx].id;
      
      const hasAnswer = answers[qId] !== -1 && answers[qId] !== undefined;
      // Mark as saved only if they selected an option
      if (hasAnswer) {
         setSavedStates(prev => ({...prev, [qId]: 'saved'}));
      } else {
         setSavedStates(prev => ({...prev, [qId]: 'not_answered'}));
      }
      
      if (currentIdx === getSectionSlice().total - 1 && currentSectionIdx < sections.length - 1) {
          handleManualSectionAdvance();
      } else {
          goNextQuestion();
      }
  };

  const handleMarkReviewAndNext = () => {
      const qGlobalIdx = getSectionSlice().globalStartIndex + currentIdx;
      const qId = questions[qGlobalIdx].id;
      
      const hasAnswer = answers[qId] !== -1 && answers[qId] !== undefined;
      setSavedStates(prev => ({...prev, [qId]: hasAnswer ? 'review_answered' : 'review'}));
      
      if (currentIdx === getSectionSlice().total - 1 && currentSectionIdx < sections.length - 1) {
          handleManualSectionAdvance();
      } else {
          goNextQuestion();
      }
  };

  const handleClearResponse = () => {
      const qGlobalIdx = getSectionSlice().globalStartIndex + currentIdx;
      const qId = questions[qGlobalIdx].id;
      
      setAnswers(prev => ({...prev, [qId]: -1}));
      setSavedStates(prev => ({...prev, [qId]: 'not_answered'}));
  };

  const handleManualSubmit = () => {
    const totalAns = Object.values(answers).filter(v => v !== -1).length;
    const unansweredCount = questions.length - totalAns;
    let message = 'Are you ready to submit your ENTIRE exam?';
    if (unansweredCount > 0) {
      message = `Warning: You have ${unansweredCount} unanswered questions across all sections. You cannot return. Are you sure you want to grade now?`;
    }

    setSubmitModalMessage(message);
    setShowSubmitModal(true);
  };

  const executeQuizSubmission = async () => {
    console.log(`[QuizRunner] executeQuizSubmission called. submitting: ${submitting}`);
    setSubmitting(true);
    clearInterval(timerInterval.current);
    clearInterval(autosaveInterval.current);
    clearInterval(generalTimer.current);

    try {
      // Force final save so we don't lose anything
      console.log(`[QuizRunner] Triggering final autosave...`);
      await triggerAutosave();

      // Compute results locally for pure-client compatibility (Vercel)
      let correctCount = 0;
      let incorrectCount = 0;
      let unansweredCount = 0;
      const questionIds: string[] = [];

      questions.forEach((q: any) => {
        let selected = answers[q.id];
        let state = savedStates[q.id];

        questionIds.push(q.id);

        if (state === 'review_ans' || state === 'review') {
          selected = -1;
        }

        if (selected === undefined || selected === null || selected === -1) {
          unansweredCount++;
        } else if (Number(selected) === q.correctOptionIndex) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      });

      const totalQuestions = questions.length;
      let positiveMarks = exam.positiveMarks !== undefined ? exam.positiveMarks : 1;
      let negativeMarks = exam.negativeMarks !== undefined ? exam.negativeMarks : 0;
      let passingPercentage = exam.passingPercentage !== undefined ? exam.passingPercentage : 50;

      const maxScore = totalQuestions * positiveMarks;
      const rawScore = (correctCount * positiveMarks) - (incorrectCount * negativeMarks);
      const score = Math.max(0, rawScore); // Prevent negative total score if preferred, or keep it. Let's keep negative if they allow. Actually, mostly tests allow negative. I will just keep rawScore.
      let percentage = Math.round((rawScore / maxScore) * 100);
      percentage = Math.max(0, percentage);
      const passed = percentage >= passingPercentage;

      const resultId = `result_${studentId}_${exam.id}_${Date.now()}`;
      const resultObject = {
        id: resultId,
        studentId,
        studentName,
        studentEmail,
        examId: exam.id,
        examName: exam.title,
        score: parseFloat(rawScore.toFixed(2)),
        maxScore,
        totalQuestions,
        percentage,
        passed,
        correctCount,
        incorrectCount,
        unansweredCount,
        answers,
        questionStates: savedStates,
        questionIds,
        questionsList: questions,
        timeTakenSeconds: overallTimeTaken,
        submittedAt: new Date().toISOString(),
        violations
      };

      try {
        // Save results locally using frontend user credentials
        await setDoc(doc(db, 'results', resultObject.id), resultObject);
        
        const attemptDocRef = doc(db, 'examAttempts', attemptId);
        await setDoc(attemptDocRef, { ...resultObject, status: 'submitted' }, { merge: true });
        
        // Clear local storage for this session
        try {
            localStorage.removeItem(`examSession_${attemptId}`);
        } catch(e) {}
      } catch (dbErr) {
        console.warn('Attempt update skipped:', dbErr);
        // Ensure they still see their score even if they lose connection at the last second
      }

      onNotify('Examination result computed and dispatched successfully!');
      onFinished(resultObject);

      // Attempt to ping the server to trigger Google Sheets append in background (fire-and-forget)
      try {
         fetch('/api/exams/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(resultObject)
         }).catch(e => console.warn('Non-critical background analytics sync failed', e));
      } catch(e) {}
      
    } catch (err: any) {
      console.error('[QuizRunner] Submission error:', err);
      alert('A critical error occurred while submitting: ' + err?.message);
      onNotify('Failed to finalize result computation locally.', true);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) seconds = 0;
    const hh = Math.floor(seconds / 3600);
    const mm = Math.floor((seconds % 3600) / 60);
    const ss = Math.floor(seconds % 60);
    return [
      hh > 0 ? String(hh).padStart(2, '0') : null,
      String(mm).padStart(2, '0'),
      String(ss).padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  const calculateTotalExamTimeLeft = () => {
    let total = sectionTimeLeft;
    for (let i = currentSectionIdx + 1; i < sections.length; i++) {
        total += sections[i].durationMinutes * 60;
    }
    return total;
  };

  const overallTimeLeft = calculateTotalExamTimeLeft();
  const totalExamDurationSeconds = Math.max(1, exam.durationMinutes * 60);
  const timeProgressPercentage = Math.max(0, Math.min(100, ((totalExamDurationSeconds - overallTimeLeft) / totalExamDurationSeconds) * 100));

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <RefreshCw className="animate-spin text-blue-600" size={32} />
        <p className="text-slate-500 font-mono text-sm">Synchronizing examination session protocol and caches...</p>
      </div>
    );
  }

  if (banned) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-lg mx-auto p-8 space-y-4 shadow-sm mt-12">
        <XCircle className="text-red-500 mx-auto" size={48} />
        <h4 className="font-bold text-xl text-slate-900">Access Revoked (Banned)</h4>
        <p className="text-slate-600 font-medium">You have been banned from this exam for refreshing the page too many times (Limit: 5).</p>
        <button onClick={onCancel} className="mt-4 px-5 py-2 text-sm font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 transition cursor-pointer text-slate-800">Return to Dashboard</button>
      </div>
    );
  }

  if (examStarted && questions.length === 0) {
    return (
      <div className="text-center py-16 bg-white border border-slate-200 rounded-xl max-w-lg mx-auto p-8 space-y-4 shadow-sm">
        <AlertTriangle className="text-amber-500 mx-auto" size={40} />
        <h4 className="font-semibold text-slate-900">No Exam Questions Linked</h4>
        <p className="text-slate-600 text-sm">Please connect with administrators to load questions.</p>
        <button onClick={onCancel} className="px-5 py-2 text-sm font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 transition cursor-pointer">Go Back</button>
       </div>
    );
  }

  if (!examStarted) {
      return (
        <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-xl shadow-sm p-8 mt-4 space-y-6 select-none relative overflow-hidden">
            <h2 className="text-2xl font-bold border-b border-slate-100 pb-4">Examination Instructions</h2>
            <div className="text-sm text-slate-700 leading-relaxed space-y-4">
                <p>Welcome to <strong>{exam.title}</strong>.</p>
                <div className="bg-slate-50 p-4 rounded border border-slate-100 grid grid-cols-2 gap-4 font-mono text-xs">
                    <div><strong>Total Duration:</strong> {exam.durationMinutes} Minutes</div>
                    <div><strong>Total Questions:</strong> {exam.questionIds.length} Questions</div>
                    <div><strong>Marking Scheme:</strong> +{exam.positiveMarks} / -{exam.negativeMarks}</div>
                    <div><strong>Passing Ratio:</strong> {exam.passingPercentage}% Minimum</div>
                </div>

                <div className="space-y-2">
                    <h4 className="font-bold">General Guidelines:</h4>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-xs">
                        <li>The examination consists of multiple sections. Each section has a specific time limit.</li>
                        <li>When a section's timer expires, your answers will auto-submit locally and you cannot return to that section.</li>
                        <li>Do NOT refresh the page, switch tabs, or exit fullscreen. The system will track violations.</li>
                        <li>You may mark questions for review if you are unsure about the options.</li>
                    </ul>
                </div>

                <div className="mt-4 p-4 border border-blue-100 bg-blue-50/50 rounded-lg space-y-3">
                    <h4 className="font-bold text-sm text-slate-800">Select Examination Language / परीक्षा की भाषा चुनें</h4>
                    <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="english" checked={examLanguage === 'english'} onChange={() => setExamLanguage('english')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-medium text-slate-700">English</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="hindi" checked={examLanguage === 'hindi'} onChange={() => setExamLanguage('hindi')} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                            <span className="text-sm font-medium text-slate-700">Hindi (हिंदी)</span>
                        </label>
                    </div>
                    <p className="text-xs text-slate-500 italic">This will set your default language for the exam questions.</p>
                </div>
                
                <div className="mt-6 border-t border-slate-200 pt-6">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input type="checkbox" checked={declarationChecked} onChange={(e) => setDeclarationChecked(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600" />
                        <span className="text-xs text-slate-800 font-bold">
                            I have read all instructions. I declare that I am ready to begin the examination and agree to strictly follow all academic testing disciplines.
                        </span>
                    </label>
                </div>
            </div>

            <div className="flex justify-between items-center pt-4">
                <button onClick={onCancel} className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded shadow-sm transition active:scale-95 text-sm">Return Home</button>
                <button 
                  onClick={() => {
                      if (document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen().catch((err) => {
                              console.warn("Fullscreen error", err);
                              onNotify("Note: Fullscreen could not be started automatically. If running in an embedded preview, please open the app in a new tab.", true);
                          });
                      }
                      handleStartExam();
                  }} 
                  disabled={!declarationChecked} 
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow-sm transition active:scale-95 text-sm disabled:opacity-50"
                 >
                    BEGIN EXAMINATION
                </button>
            </div>
        </div>
      )
  }

  const secSlice = getSectionSlice();
  const globalQIdx = secSlice.globalStartIndex + currentIdx;
  const currentQuestion = questions[globalQIdx];

  // Palette counts
  let paletteCountAns = 0;
  let paletteCountNotAns = 0;
  let paletteCountReview = 0;
  let paletteCountReviewAns = 0;
  let paletteCountNotVisited = 0;

  for (let i = secSlice.start; i < secSlice.end; i++) {
     const qid = questions[i].id;
     const state = savedStates[qid];
     if (state === 'saved') paletteCountAns++;
     else if (state === 'review') paletteCountReview++;
     else if (state === 'review_answered') paletteCountReviewAns++;
     else if (state === 'not_visited' || state === 'none') paletteCountNotVisited++;
     else {
        // 'not_answered'
        paletteCountNotAns++;
     }
  }

  return (
    <div className={`fixed inset-0 z-50 w-full h-full bg-slate-100 flex flex-col font-sans select-none overflow-hidden ${(isFrozen || submitting) ? 'pointer-events-none opacity-[0.98]' : ''}`}>
      
      {(isFrozen || submitting) && (
        <div className="fixed inset-0 z-[9999] bg-transparent cursor-not-allowed"></div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2 text-slate-800">
              <AlertTriangle className="text-amber-500" /> Confirm Submission
            </h3>
            <p className="text-slate-600 font-medium">
              {submitModalMessage}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setShowSubmitModal(false);
                  executeQuizSubmission();
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold shadow-sm transition"
              >
                Yes, Submit Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Violations Warning */}
      {violations > 0 && (
         <div className="bg-red-600 text-white text-xs font-bold text-center py-1 z-50">
             Anti-Cheat Violation Detected: Tab/Window switch count - {violations}.
         </div>
      )}

      {/* TOP HEADER: Dark background */}
      <div className="bg-zinc-800 text-white flex justify-between items-center px-4 py-2 shrink-0">
          <div className="font-bold text-sm text-yellow-400">{exam.title}</div>
          <div className="flex items-center gap-4 text-sm font-medium">
             <div className="flex items-center gap-2 bg-zinc-900/80 px-4 py-1 rounded-md border border-zinc-700 shadow-inner">
               <Clock size={14} className={overallTimeLeft < 300 ? "text-red-500 animate-pulse" : "text-emerald-400"} />
               <span className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold">Exam Time Remaining:</span>
               <span className={`font-mono font-bold text-base tracking-tight ${overallTimeLeft < 300 ? "text-red-500 animate-pulse" : "text-white"}`}>
                 {formatTimer(overallTimeLeft)}
               </span>
             </div>
          </div>
      </div>

      {/* GLOBAL TIME PROGRESS BAR */}
      <div className="h-1 w-full bg-zinc-200 shrink-0">
        <div 
           className={`h-full transition-all duration-1000 ease-linear ${timeProgressPercentage > 85 ? 'bg-red-500' : timeProgressPercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
           style={{ width: `${100 - timeProgressPercentage}%` }}
        />
      </div>

      {/* SECOND HEADER: Section Tabs + Timer */}
      <div className="bg-slate-200 border-b border-slate-300 flex justify-between items-center px-1 shrink-0 h-[36px] md:h-[42px] overflow-x-auto">
          <div className="flex h-full items-end gap-1 px-1 md:px-2 min-w-max">
              {sections.map((sec, idx) => (
                  <button key={sec.id} onClick={() => {}} disabled className={`h-[28px] md:h-[34px] px-3 md:px-5 text-xs md:text-sm font-semibold rounded-t-md border-t border-l border-r border-slate-300 flex items-center justify-center gap-1.5 md:gap-2 whitespace-nowrap
                      ${idx === currentSectionIdx ? 'bg-sky-500 text-white border-transparent' : 
                       idx < currentSectionIdx ? 'bg-slate-400 text-white cursor-not-allowed opacity-80' : 
                       'bg-white text-slate-600 hover:bg-slate-100 cursor-not-allowed opacity-60'}`}
                  >
                     <span className="hidden md:inline">{sec.title}</span>
                     <span className="md:hidden">S-{idx + 1}</span>
                     {idx === currentSectionIdx && <span className="hidden md:flex bg-white text-sky-500 rounded-full w-4 h-4 items-center justify-center text-[10px] font-bold">i</span>}
                  </button>
              ))}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2 pr-2 md:pr-4 h-full text-slate-800 shrink-0 sticky right-0 bg-slate-200 pl-2">
             <span className="text-[10px] md:text-xs uppercase tracking-wide font-bold text-slate-500 hidden sm:inline">Section Time Left:</span>
             <span className="text-[10px] uppercase tracking-wide font-bold text-slate-500 sm:hidden">Time:</span>
             <span className={`font-mono font-bold text-sm md:text-base bg-transparent px-1 rounded ${sectionTimeLeft < 60 ? "text-red-600 animate-pulse" : "text-black"}`}>{formatTimer(sectionTimeLeft)}</span>
          </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex flex-col md:flex-row landscape:flex-row flex-1 overflow-hidden">

          {/* LEFT: QUESTION PANEL */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">

             {/* SUB HEADER 2: Q.No and Marks */}
             <div className="flex justify-between items-center bg-white border-b border-slate-200 px-3 md:px-4 py-2 shrink-0">
                <div className="flex items-center gap-6">
                    <span className="font-bold font-sans text-sm text-black">Q.No: <span className="text-lg">{currentIdx + 1}</span></span>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-sm shadow-sm border border-slate-200 rounded px-2 text-black bg-white">
                    <span className="hidden sm:inline">Marks</span>
                    <span className="bg-green-600 text-white px-1.5 rounded-sm text-xs py-px">+{exam.positiveMarks}</span>
                    <span className="text-slate-300">|</span>
                    <span className="bg-red-600 text-white px-1.5 rounded-sm text-xs py-px">-{exam.negativeMarks}</span>
                </div>
             </div>
             
             {/* Question Area */}
             <div className="flex-1 overflow-y-auto px-2.5 md:px-6 py-2.5 md:py-6 pb-[90px] md:pb-20">
                 
                 {currentQuestion.imageUrl && (
                     <div className="mb-5 flex justify-center">
                         <img src={currentQuestion.imageUrl} alt="Question Reference" className="max-w-full h-auto max-h-48 md:max-h-64 object-contain rounded-xl border border-slate-200" referrerPolicy="no-referrer" />
                     </div>
                 )}

                 {examLanguage === 'english' && (
                     <div className="mb-6">
                         <p className="text-[14px] md:text-[15px] font-medium text-slate-900 leading-snug mb-2.5 md:mb-5 whitespace-pre-wrap">
                           {currentQuestion.englishQuestion}
                         </p>
                         <div className="space-y-1.5 md:space-y-4">
                           {(currentQuestion.englishOptions || ["", "", "", ""]).map((opt, oIdx) => {
                              const isSel = answers[currentQuestion.id] === oIdx;
                              return (
                                <label key={oIdx} className="flex items-start gap-2 md:gap-4 cursor-pointer hover:bg-slate-50 transition w-full md:w-fit pr-2 md:pr-4 py-1.5 md:py-1 rounded">
                                   <input type="radio" name={`q_${currentQuestion.id}`} checked={isSel} onChange={() => setAnswers(p => ({...p, [currentQuestion.id]: oIdx}))} className="mt-1 w-4 h-4 text-blue-600 border-slate-400 focus:ring-0 shrink-0" />
                                   <div className="flex flex-col gap-2 flex-1">
                                     {opt && <span className="text-[14px] md:text-[15px] text-slate-800 leading-tight md:leading-normal">{opt}</span>}
                                     {currentQuestion.optionImageUrls?.[oIdx] && (
                                       <img src={currentQuestion.optionImageUrls[oIdx]} alt={`Option ${oIdx + 1}`} className="max-w-full h-auto max-h-32 md:max-h-40 object-contain rounded border border-slate-200 mt-1" referrerPolicy="no-referrer" />
                                     )}
                                   </div>
                                </label>
                              )
                           })}
                         </div>
                     </div>
                 )}

                 {examLanguage === 'hindi' && (
                     <div className="mb-6">
                         <p className="text-[14px] md:text-[15px] font-medium text-slate-900 leading-snug mb-2.5 md:mb-5 block whitespace-pre-wrap">
                           {currentQuestion.hindiQuestion || currentQuestion.englishQuestion}
                         </p>
                         <div className="space-y-1.5 md:space-y-4">
                           {((currentQuestion.hindiOptions && currentQuestion.hindiOptions[0] ? currentQuestion.hindiOptions : currentQuestion.englishOptions) || ["", "", "", ""]).map((opt, oIdx) => {
                              const isSel = answers[currentQuestion.id] === oIdx;
                              return (
                                <label key={oIdx} className="flex items-start gap-2 md:gap-4 cursor-pointer hover:bg-slate-50 transition w-full md:w-fit pr-2 md:pr-4 py-1.5 md:py-1 rounded">
                                   <input type="radio" name={`q_${currentQuestion.id}`} checked={isSel} onChange={() => setAnswers(p => ({...p, [currentQuestion.id]: oIdx}))} className="mt-1 w-4 h-4 text-blue-600 border-slate-400 focus:ring-0 shrink-0" />
                                   <div className="flex flex-col gap-2 flex-1">
                                     {opt && <span className="text-[14px] md:text-[15px] text-slate-800 leading-tight md:leading-normal">{opt}</span>}
                                     {currentQuestion.optionImageUrls?.[oIdx] && (
                                       <img src={currentQuestion.optionImageUrls[oIdx]} alt={`Option ${oIdx + 1}`} className="max-w-full h-auto max-h-32 md:max-h-40 object-contain rounded border border-slate-200 mt-1" referrerPolicy="no-referrer" />
                                     )}
                                   </div>
                                </label>
                              )
                           })}
                         </div>
                     </div>
                 )}

             </div>

             {/* Action Control Bar - Bottom Absolute */}
             <div className="absolute px-2 md:px-4 py-2 bg-white border-t border-slate-300 w-[100%] flex items-center gap-2 bottom-0">
                 <button onClick={handleMarkReviewAndNext} className="flex-1 bg-slate-100 border border-slate-300 text-slate-700 px-1 sm:px-4 py-2 md:py-2.5 text-[10px] md:text-sm font-bold rounded shadow-sm hover:bg-slate-200 transition flex items-center justify-center gap-1 md:gap-1.5 leading-tight">
                    <Flag size={14} className="text-amber-500 shrink-0" />
                    <span className="hidden md:inline">Mark for Review & Next</span>
                    <span className="md:hidden">Review</span>
                 </button>
                 <button onClick={handleClearResponse} className="flex-1 bg-white border border-slate-300 text-slate-700 px-1 sm:px-4 py-2 md:py-2.5 text-[10px] md:text-sm font-bold rounded shadow-sm hover:bg-slate-100 transition flex items-center justify-center gap-1 md:gap-1.5 leading-tight">
                    <XCircle size={14} className="text-slate-400 shrink-0" />
                    <span className="hidden md:inline">Clear Response</span>
                    <span className="md:hidden">Clear</span>
                 </button>
                 <button onClick={handleSaveAndNext} className="flex-[1.2] md:flex-none md:ml-auto bg-sky-600 text-white px-2 sm:px-8 md:px-12 py-2 md:py-2.5 text-[12px] md:text-base font-bold rounded shadow hover:bg-sky-700 transition flex items-center justify-center gap-1.5 leading-tight whitespace-nowrap">
                    <Save size={14} className="shrink-0 md:w-5 md:h-5" /> 
                    <span>{currentIdx === getSectionSlice().total - 1 && currentSectionIdx < sections.length - 1 ? 'End Section & Next' : 'Save & Next'}</span>
                 </button>
             </div>
          </div>

          {/* RIGHT: PALETTE PANEL */}
          <div className="w-full md:w-[300px] landscape:w-[260px] bg-slate-100/80 flex flex-col shrink-0 border-t-[3px] md:border-t-0 md:border-l-[3px] landscape:border-t-0 landscape:border-l-[3px] border-slate-300">
              
              {/* Profile Block */}
              <div className="bg-white border-b border-slate-300 flex items-center gap-2 md:gap-3 py-1.5 md:py-2 px-2 md:px-3 shrink-0 drop-shadow-sm z-10">
                 <div className="w-8 h-8 md:w-12 md:h-12 bg-slate-200 rounded-full flex justify-center items-center overflow-hidden shrink-0 border border-slate-300">
                    {studentPhotoURL ? (
                      <img src={studentPhotoURL} alt={studentName} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                    ) : (
                      <svg className="w-5 h-5 md:w-8 md:h-8 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    )}
                 </div>
                 <div className="min-w-0">
                    <p className="font-bold text-[11px] md:text-sm text-slate-900 truncate leading-tight uppercase font-sans tracking-wide">{studentName}</p>
                 </div>
              </div>

              {/* Status Legend */}
              <div className="p-3 grid grid-cols-2 gap-y-2 gap-x-1 text-[11px] font-sans text-black border-b border-slate-300 bg-sky-50 shadow-inner shrink-0">
                  <div className="flex items-start gap-1">
                      <div className="w-7 h-7 bg-green-600 text-white flex items-center justify-center font-bold relative shrink-0" style={{clipPath: 'polygon(50% 0%, 100% 25%, 100% 100%, 0 100%, 0 25%)'}}>
                         <span className="absolute text-[10px] bottom-0.5">{paletteCountAns}</span>
                      </div> 
                      <span className="leading-tight pt-1">Answered</span>
                  </div>
                  <div className="flex items-start gap-1">
                     <div className="w-7 h-7 bg-red-600 text-white flex items-center justify-center font-bold relative shrink-0" style={{clipPath: 'polygon(0% 0%, 100% 0%, 100% 75%, 50% 100%, 0% 75%)'}}>
                         <span className="absolute text-[10px] top-0.5">{paletteCountNotAns}</span>
                     </div>
                     <span className="leading-tight pt-1">Not Answered</span>
                  </div>
                  <div className="flex items-start gap-1">
                     <div className="w-6 h-6 bg-slate-200 border border-slate-400 text-slate-800 rounded-sm flex justify-center items-center font-bold text-[10px] shrink-0">{paletteCountNotVisited}</div>
                     <span className="leading-tight pt-0.5">Not Visited</span>
                  </div>
                  <div className="flex items-start gap-1">
                     <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex justify-center items-center font-bold text-[10px] shrink-0">{paletteCountReview}</div>
                     <span className="leading-tight pt-0.5">Marked for Review</span>
                  </div>
                  <div className="flex items-start gap-1 col-span-2 mt-1">
                     <div className="w-7 h-7 bg-purple-600 text-white rounded-full flex justify-center items-center font-bold text-[10px] relative shrink-0">
                        {paletteCountReviewAns}
                        <div className="absolute bg-green-500 rounded-full w-2.5 h-2.5 border-[1.5px] border-sky-50 bottom-[-2px] right-[-2px]"></div>
                     </div>
                     <span className="leading-tight pt-0.5 ml-1">Answered & Marked for Review (will NOT be considered for evaluation)</span>
                  </div>
              </div>

              {/* Subject Title blue bar */}
              <div className="bg-[#4a72ad] text-white px-3 py-1.5 font-semibold text-sm shrink-0 border-b border-slate-300">
                  {sections[currentSectionIdx]?.title || 'Standard Section'}
              </div>

              {/* Scrollable Palette Matrix */}
              <div className="flex-1 overflow-y-auto px-2 py-4 bg-[#e4ebf5]">
                 <div className="flex flex-wrap gap-[6px] justify-start pl-1">
                    {Array.from({length: secSlice.total}).map((_, i) => {
                       const gQId = questions[secSlice.globalStartIndex + i].id;
                       const st = savedStates[gQId];
                       
                       let containerClass = "w-11 h-11 flex items-center justify-center font-bold text-[13px] font-sans cursor-pointer transition relative ";
                       let innerClass = "absolute inset-0 flex items-center justify-center shrink-0 w-full h-full text-[13px] ";

                       if (st === 'saved') {
                           containerClass += "text-white";
                           innerClass += "bg-green-600 drop-shadow shadow-green-900";
                       } else if (st === 'review_answered') {
                           containerClass += "text-white";
                           innerClass += "bg-purple-600 rounded-full drop-shadow shadow-purple-900";
                       } else if (st === 'review') {
                           containerClass += "text-white";
                           innerClass += "bg-purple-600 rounded-full drop-shadow shadow-purple-900";
                       } else if (st === 'not_visited' || st === 'none') {
                           containerClass += "text-black";
                           innerClass += "bg-slate-200 border border-slate-400 rounded-md box-border hover:bg-slate-300 drop-shadow";
                       } else {
                           // 'not_answered' (visited)
                           containerClass += "text-white";
                           innerClass += "bg-red-600 drop-shadow shadow-red-900";
                       }
                       
                       if (i === currentIdx) {
                           containerClass += " scale-105 rounded-md ring-2 ring-offset-1 ring-blue-600";
                       }
                       
                       // Polygon shape mappings for the inner div
                       let shapeStyles: any = {};
                       if (st === 'saved') {
                           shapeStyles.clipPath = 'polygon(50% 0%, 100% 25%, 100% 100%, 0 100%, 0 25%)';
                       } else if (st === 'not_answered') {
                           shapeStyles.clipPath = 'polygon(0% 0%, 100% 0%, 100% 75%, 50% 100%, 0% 75%)';
                       }

                       return (
                           <div key={i} onClick={() => setCurrentIdx(i)} className={containerClass}>
                              <div className={innerClass} style={shapeStyles}>
                                  <span className={st === 'saved' ? "mt-1.5" : st === 'not_answered' ? "mb-1" : ""}>{i + 1}</span>
                              </div>
                              {st === 'review_answered' && (
                                  <div className="absolute right-0 bottom-0 bg-green-500 rounded-full w-3.5 h-3.5 border-2 border-[#e4ebf5] z-10 flex items-center justify-center">
                                  </div>
                              )}
                           </div>
                       );
                    })}
                 </div>
              </div>

              {/* Master Submit CTA */}
              <div className="px-2 py-4 bg-sky-50 border-t border-slate-300 shadow-inner flex justify-center shrink-0 z-10">
                  <button onClick={handleManualSubmit} disabled={submitting} className="w-[80%] bg-sky-500 hover:bg-sky-600 text-white shadow-md py-2.5 rounded text-[15px] font-bold tracking-wide active:scale-95 disabled:opacity-50 disabled:bg-slate-400 transition">
                     {submitting ? 'Submitting...' : 'Submit Test'}
                  </button>
              </div>

          </div>

      </div>

    </div>
  );
}
