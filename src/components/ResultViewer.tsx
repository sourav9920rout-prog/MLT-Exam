import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ResultViewerProps {
  reviewResult: any;
  onBack: () => void;
}

export default function ResultViewer({ reviewResult, onBack }: ResultViewerProps) {
    if (!reviewResult) return null;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Quiz Analytics: {reviewResult.examName}</h3>
                <p className="text-xs text-slate-550">Review correct options, diagnostic justifications, and AI Clinical guidance</p>
              </div>
              <button
                onClick={onBack}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 cursor-pointer transition"
              >
                Back to Results
              </button>
            </div>

            {/* Score and percentage cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                <span className="text-xs font-mono text-slate-400 font-bold uppercase block">Final Score</span>
                <h4 className="text-2xl font-bold text-slate-900 mt-2">{reviewResult.score} / {reviewResult.totalQuestions}</h4>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                <span className="text-xs font-mono text-slate-400 font-bold uppercase block">Percentage Pass Grade</span>
                <h4 className="text-2xl font-bold text-blue-600 mt-2">{reviewResult.percentage}%</h4>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                <span className="text-xs font-mono text-slate-400 font-bold uppercase block">Evaluation Status</span>
                <span className={`inline-block mt-2 px-3.5 py-1 text-xs font-bold rounded-full ${
                  reviewResult.passed 
                    ? 'bg-emerald-50 text-emerald-800' 
                    : 'bg-rose-50 text-rose-800'
                }`}>
                  {reviewResult.passed ? 'PASSED' : 'FAILED'}
                </span>
              </div>
              <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm text-center">
                <span className="text-xs font-mono text-slate-400 font-bold uppercase block font-medium">Wrong Answers Map</span>
                <h4 className="text-2xl font-bold text-rose-600 mt-2">{reviewResult.incorrectCount} / {reviewResult.totalQuestions}</h4>
              </div>
            </div>

            {/* CLINICAL AI GENERATED INSIGHT REPORT */}
            <div className="bg-blue-600 text-white rounded-xl p-6 md:p-8 space-y-4 shadow-md border border-blue-500">
              <div className="flex items-center gap-2 bg-white/10 max-w-fit px-3 py-1.5 rounded-lg border border-white/10">
                <CheckCircle className="text-amber-300 animate-pulse" size={16} />
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-yellow-100">🤖 AI Diagnostic Tutoring Recommendation</span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-line text-blue-50">
                {reviewResult.aiSummaryTips}
              </div>
            </div>

            {/* Historical answers mapping list */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 md:p-8 shadow-sm space-y-6">
              <h4 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-2">Questions Review Block</h4>
              {reviewResult.questionsList && reviewResult.questionsList.length > 0 ? (
                <div className="divide-y divide-slate-150">
                  {reviewResult.questionsList.map((q: any, idx: number) => {
                    const studentChoiceIdx = reviewResult.answers[q.id];
                    const isCorrect = studentChoiceIdx !== undefined && Number(studentChoiceIdx) === q.correctOptionIndex;

                    return (
                      <div key={q.id} className="py-4 space-y-3">
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-600">Question #{idx + 1}</span>
                        <h5 className="font-medium text-slate-900 leading-relaxed text-sm md:text-base">{q.questionText}</h5>
                        {q.imageUrl && (
                          <div className="flex justify-center mt-2 mb-3">
                              <img src={q.imageUrl} alt="Reference Detail" className="max-w-full h-auto max-h-48 object-contain rounded-lg border border-slate-200" referrerPolicy="no-referrer" />
                          </div>
                        )}
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          {q.options.map((optText: string, oIdx: number) => {
                            const isSelected = studentChoiceIdx === oIdx;
                            const isCorrectKey = q.correctOptionIndex === oIdx;

                            return (
                              <div 
                                key={oIdx}
                                className={`px-3 py-2.5 rounded-lg text-xs leading-5 border flex items-center gap-3 ${
                                  isCorrectKey 
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                                    : isSelected 
                                    ? 'bg-rose-50 border-rose-300 text-rose-800' 
                                    : 'bg-slate-50 border-transparent text-slate-700'
                                }`}
                              >
                                <span className="font-mono uppercase font-bold text-slate-500">
                                  {['A','B','C','D'][oIdx]}:
                                </span>
                                <div className="flex flex-col gap-2">
                                  {optText && <span>{optText}</span>}
                                  {q.optionImageUrls?.[oIdx] && (
                                    <img src={q.optionImageUrls[oIdx]} alt={`Option ${oIdx + 1}`} className="max-w-full h-auto max-h-32 object-contain rounded border border-slate-200" referrerPolicy="no-referrer" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <p className="text-xs text-slate-550 leading-relaxed font-mono bg-slate-100 p-3 rounded-lg mt-3 border border-slate-200">
                          <strong className="text-slate-800">Rationale Guide:</strong> {q.explanation || 'No rationale linked yet.'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 font-mono text-xs">
                  Comprehensive rationale list snapshots are saved upon grading submissions.
                </div>
              )}
            </div>
        </div>
    );
}
