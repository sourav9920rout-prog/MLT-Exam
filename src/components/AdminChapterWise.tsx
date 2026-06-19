import React, { useState, useEffect } from "react";
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../utils/firebase.ts";
import { Plus, Trash2, ChevronRight, FileText, Upload, RefreshCw, X, Edit2 } from "lucide-react";
import { BankQuestion } from "../types.ts";

export default function AdminChapterWise({ onNotify }: { onNotify: (msg: string, isError?: boolean) => void }) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  
  const [activeSubject, setActiveSubject] = useState<any>(null);
  const [activeChapter, setActiveChapter] = useState<any>(null);
  
  const [promptConfig, setPromptConfig] = useState<{ title: string; onSubmit: (val: string) => void } | null>(null);
  const [promptInput, setPromptInput] = useState("");
  
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; onConfirm: () => void } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isRawTextModalOpen, setIsRawTextModalOpen] = useState(false);
  const [rawTextValue, setRawTextValue] = useState("");
  const [uploadingRaw, setUploadingRaw] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, []);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'chapter_subjects'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
      onNotify("Error fetching subjects", true);
    }
    setLoading(false);
  };

  const fetchChapters = async (subjectId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, 'chapter_chapters'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setChapters(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter((c: any) => c.subjectId === subjectId));
    } catch (e) {
      console.error(e);
      onNotify("Error fetching chapters", true);
    }
    setLoading(false);
  };

  const fetchQuestions = async (chapterId: string) => {
    setLoading(true);
    try {
      const q = query(collection(db, `chapter_chapters/${chapterId}/questions`), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setQuestions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as BankQuestion[]);
    } catch (e) {
      console.error(e);
      onNotify("Error fetching questions", true);
    }
    setLoading(false);
  };

  const addSubject = async () => {
    setPromptInput("");
    setPromptConfig({
      title: "Subject Name:",
      onSubmit: async (name) => {
        try {
          await addDoc(collection(db, 'chapter_subjects'), {
            name: name.trim(),
            createdAt: Date.now()
          });
          fetchSubjects();
          onNotify("Subject added");
        } catch (e) {
          onNotify("Error adding subject", true);
        }
      }
    });
  };

  const deleteSubject = async (id: string, e: any) => {
    e.stopPropagation();
    setConfirmConfig({
      title: "Delete this subject? This might leave orphaned chapters.",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'chapter_subjects', id));
          fetchSubjects();
          if (activeSubject?.id === id) {
            setActiveSubject(null);
            setActiveChapter(null);
          }
          setConfirmConfig(null);
        } catch (e) {
          onNotify("Error deleting subject", true);
        }
      }
    });
  };

  const addChapter = async () => {
    if (!activeSubject) return;
    setPromptInput("");
    setPromptConfig({
      title: "Chapter Name:",
      onSubmit: async (name) => {
        try {
          await addDoc(collection(db, 'chapter_chapters'), {
            subjectId: activeSubject.id,
            name: name.trim(),
            createdAt: Date.now()
          });
          fetchChapters(activeSubject.id);
          onNotify("Chapter added");
        } catch (e) {
          onNotify("Error adding chapter", true);
        }
      }
    });
  };

  const deleteChapter = async (id: string, e: any) => {
    e.stopPropagation();
    setConfirmConfig({
      title: "Delete this chapter along with ALL its questions?",
      onConfirm: async () => {
        try {
          const qSnap = await getDocs(collection(db, `chapter_chapters/${id}/questions`));
          const batch = writeBatch(db);
          qSnap.forEach(doc => {
            batch.delete(doc.ref);
          });
          batch.delete(doc(db, 'chapter_chapters', id));
          await batch.commit();
          
          fetchChapters(activeSubject.id);
          if (activeChapter?.id === id) setActiveChapter(null);
          setConfirmConfig(null);
          onNotify("Chapter deleted");
        } catch(err) {
          onNotify("Error deleting chapter", true);
        }
      }
    });
  };
  
  const handleRawTextSubmit = async () => {
    if (!rawTextValue.trim() || !activeChapter) {
      return onNotify("Please enter raw text", true);
    }
    setUploadingRaw(true);
    try {
      // Chunky upload
      const textChunks = [];
      let currentChunk = "";
      
      // Process lines, breaking any overly long lines
      const processedLines = [];
      const lines = rawTextValue.split("\n");
      for (const line of lines) {
        if (line.length > 3000) {
          let remaining = line;
          while (remaining.length > 0) {
            processedLines.push(remaining.substring(0, 3000));
            remaining = remaining.substring(3000);
          }
        } else {
          processedLines.push(line);
        }
      }

      for (const line of processedLines) {
        if (currentChunk.length + line.length > 3000) {
          if (currentChunk) textChunks.push(currentChunk);
          currentChunk = line + "\n";
        } else {
          currentChunk += line + "\n";
        }
      }
      if (currentChunk) textChunks.push(currentChunk);

      let totalAdded = 0;
      for (let i = 0; i < textChunks.length; i++) {
        onNotify(`Processing chunk ${i+1}/${textChunks.length}...`);
        const response = await fetch("/api/admin/extract-questions-raw", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText: textChunks[i], languageMode: 'bilingual' }),
        });
        
        let data;
        try {
          data = await response.json();
        } catch (e) {
          console.error("Non-JSON response from server", e);
          onNotify(`Chunk ${i+1} failed: Server returned an invalid response.`, true);
          continue;
        }

        if (!response.ok) {
           console.error("Server error", data);
           onNotify(`Chunk ${i+1} failed: ${data.error || 'Unknown error'}`, true);
           continue;
        }

        if (data.questions && data.questions.length > 0) {
          const batch = writeBatch(db);
          for (const q of data.questions) {
            const docId = `CQ_${Date.now()}_${Math.random().toString(36).substring(2,9)}`;
            batch.set(doc(db, `chapter_chapters/${activeChapter.id}/questions`, docId), {
              id: docId,
              englishQuestion: q.englishQuestion || "",
              hindiQuestion: q.hindiQuestion || "",
              englishOptions: q.englishOptions || ["", "", "", ""],
              hindiOptions: q.hindiOptions || ["", "", "", ""],
              correctOptionIndex: q.correctOptionIndex ?? 0,
              englishExplanation: q.englishExplanation || "",
              hindiExplanation: q.hindiExplanation || "",
              subject: activeSubject.name,
              chapterId: activeChapter.id,
              difficulty: q.difficulty || "medium",
              createdAt: Date.now()
            });
            totalAdded++;
          }
          await batch.commit();
        }
      }
      
      onNotify(`Successfully extracted and saved ${totalAdded} questions!`);
      setRawTextValue("");
      setIsRawTextModalOpen(false);
      fetchQuestions(activeChapter.id);
    } catch (err) {
      console.error(err);
      onNotify("Extraction failed", true);
    }
    setUploadingRaw(false);
  };
  
  const deleteQuestion = async (id: string) => {
    setConfirmConfig({
      title: "Delete question?",
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, `chapter_chapters/${activeChapter.id}/questions`, id));
          fetchQuestions(activeChapter.id);
          setConfirmConfig(null);
          onNotify("Question deleted");
        } catch (err) {
          onNotify("Error deleting", true);
        }
      }
    });
  };

  const deleteAllQuestions = async () => {
    if (!activeChapter) return;
    setConfirmConfig({
      title: "Delete ALL questions in this chapter?",
      onConfirm: async () => {
        setLoading(true);
        try {
          const qSnap = await getDocs(collection(db, `chapter_chapters/${activeChapter.id}/questions`));
          const batch = writeBatch(db);
          qSnap.docs.forEach(d => {
            batch.delete(doc(db, `chapter_chapters/${activeChapter.id}/questions`, d.id));
          });
          await batch.commit();
          fetchQuestions(activeChapter.id);
          setConfirmConfig(null);
          onNotify("All questions deleted");
        } catch (err) {
          console.error(err);
          onNotify("Error deleting questions", true);
        }
        setLoading(false);
      }
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-6">
      
      {/* Subjects Sidebar */}
      <div className="w-full md:w-1/4 flex flex-col border-r border-slate-100 pr-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-800">Subjects</h2>
          <button onClick={addSubject} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"><Plus size={16} /></button>
        </div>
        <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
          {subjects.map(s => (
            <div 
              key={s.id} 
              onClick={() => { setActiveSubject(s); setActiveChapter(null); fetchChapters(s.id); }}
              className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition ${activeSubject?.id === s.id ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700'}`}
            >
              <span className="truncate">{s.name}</span>
              <button onClick={(e) => deleteSubject(s.id, e)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
            </div>
          ))}
          {subjects.length === 0 && !loading && <div className="text-xs text-slate-400 p-2">No subjects found.</div>}
        </div>
      </div>
      
      {/* Chapters Column */}
      <div className="w-full md:w-1/4 flex flex-col border-r border-slate-100 pr-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-800">Chapters</h2>
          {activeSubject && (
            <button onClick={addChapter} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"><Plus size={16} /></button>
          )}
        </div>
        {!activeSubject ? (
          <div className="text-xs text-slate-400 p-2 mt-4 text-center border border-dashed rounded py-8">Select a subject first</div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
            <div className="text-xs font-bold text-blue-500 mb-2 px-1 uppercase tracking-wider">{activeSubject.name}</div>
            {chapters.map(c => (
              <div 
                key={c.id} 
                onClick={() => { setActiveChapter(c); fetchQuestions(c.id); }}
                className={`flex justify-between items-center p-3 rounded-lg border cursor-pointer transition ${activeChapter?.id === c.id ? 'bg-blue-50 border-blue-200 text-blue-700 font-medium' : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700'}`}
              >
                <span className="truncate text-sm">{c.name}</span>
                <button onClick={(e) => deleteChapter(c.id, e)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
            {chapters.length === 0 && !loading && <div className="text-xs text-slate-400 p-2">No chapters found.</div>}
          </div>
        )}
      </div>
      
      {/* Questions Manage Column */}
      <div className="w-full md:w-2/4 flex flex-col pl-2">
         {activeChapter && activeSubject ? (
           <>
             <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800 flex items-center gap-2">Questions <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{questions.length} total</span></h2>
                  <div className="text-xs text-slate-500 mt-1">{activeSubject.name} &rsaquo; {activeChapter.name}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => fetchQuestions(activeChapter.id)} className="p-2 border rounded-lg text-slate-600 hover:bg-slate-50 transition"><RefreshCw size={14} /></button>
                  <button onClick={() => setIsRawTextModalOpen(true)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs hover:bg-blue-700 transition">
                    <Plus size={14} /> Bulk Paste</button>{questions.length > 0 && (<button onClick={deleteAllQuestions} className='flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-600 border border-red-200 rounded-lg font-bold text-xs hover:bg-red-200 transition'><Trash2 size={14} /> Delete All</button>)}</div>
             </div>
             
             <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
                {questions.map((q, idx) => (
                  <div key={q.id} className="p-4 border rounded-xl border-slate-100 shadow-sm bg-slate-50 hover:border-slate-300 transition">
                     <div className="flex justify-between items-start mb-2">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Q {idx+1}</span>
                       <button onClick={() => deleteQuestion(q.id)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                     </div>
                     <p className="text-sm text-slate-800 font-medium mb-1">{q.englishQuestion}</p>
                     <p className="text-sm text-slate-600 mb-3">{q.hindiQuestion}</p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                       {q.englishOptions.map((opt, i) => (
                         <div key={i} className={`p-2 rounded border ${i === q.correctOptionIndex ? 'bg-green-100 border-green-300 text-green-800 font-bold' : 'bg-white border-slate-200 text-slate-600'}`}>
                           {opt} | {q.hindiOptions[i]}
                         </div>
                       ))}
                     </div>
                  </div>
                ))}
                {questions.length === 0 && !loading && (
                   <div className="text-center py-12 text-slate-500 font-mono text-sm border-2 border-dashed rounded-xl border-slate-200">No questions added yet.</div>
                )}
             </div>
           </>
         ) : (
           <div className="flex items-center justify-center h-full min-h-[300px] text-slate-400 font-mono text-sm border-2 border-dashed border-slate-200 rounded-xl">
             Select a chapter to manage questions
           </div>
         )}
      </div>

       {/* Bulk Upload Modal */}
       {isRawTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col p-6 max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">
                Paste Bulk Questions for <span className="text-blue-600">{activeChapter?.name}</span>
              </h3>
              <button
                onClick={() => setIsRawTextModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4 bg-blue-50 border border-blue-100 p-3 rounded-lg">
              Paste your raw question text below. The AI will extract the questions, options, and correct answers automatically. Include the answers in the text.
            </p>

            <textarea
              value={rawTextValue}
              onChange={(e) => setRawTextValue(e.target.value)}
              className="flex-1 w-full p-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono whitespace-pre-wrap min-h-[300px]"
              placeholder={`1. What is the normal range of Hemoglobin in an adult male?\nA) 10-12 g/dL\n...`}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsRawTextModalOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRawTextSubmit}
                disabled={uploadingRaw || !rawTextValue.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 hover:shadow-lg transition disabled:opacity-50"
              >
                {uploadingRaw ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Upload size={18} />
                    Extract & Save
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Generic Prompt Modal */}
       {promptConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 relative">
            <button onClick={() => setPromptConfig(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={18} /></button>
            <h3 className="text-lg font-bold text-slate-800 mb-4">{promptConfig.title}</h3>
            <input 
              type="text" 
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none mb-6"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && promptInput.trim()) {
                  promptConfig.onSubmit(promptInput);
                  setPromptConfig(null);
                  setPromptInput("");
                }
              }}
            />
            <div className="flex justify-end gap-3">
                <button onClick={() => setPromptConfig(null)} className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition">Cancel</button>
                <button 
                  onClick={() => {
                    promptConfig.onSubmit(promptInput);
                    setPromptConfig(null);
                    setPromptInput("");
                  }} 
                  disabled={!promptInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Save
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Generic Confirm Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 relative flex flex-col items-center text-center">
             <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-4">
                <Trash2 size={24} />
             </div>
             <h3 className="text-lg font-bold text-slate-800 mb-2">Confirm Deletion</h3>
             <p className="text-sm text-slate-600 mb-6">{confirmConfig.title}</p>
             <div className="flex justify-center gap-3 w-full">
                <button onClick={() => setConfirmConfig(null)} className="flex-1 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition">Cancel</button>
                <button 
                  onClick={() => confirmConfig.onConfirm()} 
                  className="flex-1 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition"
                >
                  Delete
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
