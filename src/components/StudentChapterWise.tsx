import React, { useState, useEffect } from "react";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase.ts";
import { BookOpen, ChevronRight, PlayCircle, Folder } from "lucide-react";
import ChapterQuizRunner from "./ChapterQuizRunner.tsx";

interface StudentChapterWiseProps {
  studentId: string;
  studentName: string;
  studentEmail: string;
  onNotify: (msg: string, err?: boolean) => void;
}

export default function StudentChapterWise({ studentId, studentName, studentEmail, onNotify }: StudentChapterWiseProps) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeSubject, setActiveSubject] = useState<any>(null);
  const [quizChapter, setQuizChapter] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const subSnap = await getDocs(collection(db, 'chapter_subjects'));
      const chSnap = await getDocs(collection(db, 'chapter_chapters'));
      
      const subs = subSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      const chaps = chSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      
      setSubjects(subs);
      setChapters(chaps);
    } catch (e) {
      console.error(e);
      onNotify("Error loading subjects", true);
    }
    setLoading(false);
  };

  if (quizChapter && activeSubject) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-100 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full h-full max-w-6xl max-h-[900px] flex flex-col">
           <ChapterQuizRunner 
             chapter={quizChapter}
             subjectName={activeSubject.name}
             studentId={studentId}
             studentName={studentName}
             studentEmail={studentEmail}
             onFinished={() => setQuizChapter(null)}
             onNotify={onNotify}
           />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-8 sm:p-12 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
         <div className="relative z-10">
           <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Chapter Wise Questions</h1>
           <p className="text-blue-100 max-w-xl text-lg opacity-90 leading-relaxed">
             Practice anytime, anywhere. Select a subject and tackle chapter-specific quizzes to strengthen your weak areas without the pressure of an exam timer.
           </p>
         </div>
      </div>
      
      {loading ? (
         <div className="p-12 text-center text-slate-500 font-mono text-sm border-2 border-dashed border-slate-200 rounded-xl">Loading your library...</div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Subjects List */}
            <div className="md:col-span-1 bg-white border border-slate-200 rounded-xl shadow-sm p-4 h-fit max-h-[80vh] overflow-y-auto">
               <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-2 border-b"><Folder className="text-blue-500" size={20} /> Subjects</h2>
               <div className="space-y-2">
                 {subjects.map(sub => (
                   <div 
                     key={sub.id}
                     onClick={() => setActiveSubject(sub)}
                     className={`p-3 rounded-lg border-2 cursor-pointer transition-all flex justify-between items-center group ${activeSubject?.id === sub.id ? 'border-blue-400 bg-blue-50 text-blue-800 font-bold shadow-sm' : 'border-slate-100 hover:border-slate-300 text-slate-700 bg-slate-50 hover:bg-white'}`}
                   >
                     <span className="truncate">{sub.name}</span>
                     <ChevronRight size={16} className={`transition-transform ${activeSubject?.id === sub.id ? 'text-blue-600 translate-x-1' : 'text-slate-400 group-hover:text-slate-600'}`} />
                   </div>
                 ))}
                 {subjects.length === 0 && (
                   <div className="text-center py-8 text-slate-400 text-sm">No subjects available yet.</div>
                 )}
               </div>
            </div>
            
            {/* Chapters View */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl shadow-sm p-6 h-fit min-h-[400px]">
               {activeSubject ? (
                 <>
                   <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                     <BookOpen className="text-blue-600" /> Chapters inside {activeSubject.name}
                   </h2>
                   
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     {chapters.filter(c => c.subjectId === activeSubject.id).map(chap => (
                       <div key={chap.id} className="p-5 border border-slate-200 rounded-xl bg-gradient-to-br from-white to-slate-50 hover:shadow-md transition group relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100/50 rounded-full blur-2xl -mr-8 -mt-8 group-hover:bg-blue-200/50 transition"></div>
                          
                          <div className="relative z-10">
                            <h3 className="font-bold text-slate-800 text-lg mb-2 mr-6 leading-tight">{chap.name}</h3>
                            
                            <button 
                              onClick={() => setQuizChapter(chap)}
                              className="mt-4 flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition"
                            >
                              <PlayCircle size={16} /> Start Chapter Quiz
                            </button>
                          </div>
                       </div>
                     ))}
                   </div>
                   
                   {chapters.filter(c => c.subjectId === activeSubject.id).length === 0 && (
                     <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-xl mt-4 bg-slate-50">
                       <Folder size={48} className="mx-auto text-slate-300 mb-4" />
                       <p className="text-slate-500 font-medium">No chapters added to this subject yet.</p>
                       <p className="text-sm text-slate-400 mt-1">Check back later for updates.</p>
                     </div>
                   )}
                 </>
               ) : (
                 <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                   <Folder size={64} className="text-slate-200 mb-4" />
                   <h3 className="text-xl font-bold text-slate-400 mb-2">Select a Subject</h3>
                   <p className="text-slate-400 text-sm max-w-xs mx-auto">Choose a subject from the sidebar to view its chapters and start practicing.</p>
                 </div>
               )}
            </div>
            
         </div>
      )}
    </div>
  );
}
