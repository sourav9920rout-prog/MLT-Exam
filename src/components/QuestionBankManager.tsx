import React, { useState, useEffect, useRef } from 'react';
import { collection, setDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { BankQuestion } from '../types.ts';
import { Plus, Upload, Search, Trash2, Edit2, X, RefreshCw, Filter, Loader2 } from 'lucide-react';

interface QuestionBankManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function QuestionBankManager({ onNotify }: QuestionBankManagerProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRawTextModalOpen, setIsRawTextModalOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [languageMode, setLanguageMode] = useState<'bilingual'|'english'>('bilingual');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BankQuestion>>({
    englishOptions: ['', '', '', ''],
    hindiOptions: ['', '', '', '']
  });
  const [uploading, setUploading] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'questionBank'));
      const list: BankQuestion[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as BankQuestion));
      setQuestions(list);
    } catch (e) {
      console.error(e);
      onNotify('Failed to retrieve question bank.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Read file to base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = (reader.result as string).split(',')[1];
          if (result) resolve(result);
          else reject(new Error("Could not parse file."));
        };
        reader.onerror = () => reject(new Error("File read error"));
        reader.readAsDataURL(file);
      });

      onNotify("Extracting questions via Gemini AI. This may take a minute...");

      const response = await fetch('/api/admin/extract-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentBase64: base64Data, mimeType: file.type || 'text/plain', languageMode })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !data.questions) {
        throw new Error(data.error || "Failed to extract");
      }

      const extracted = data.questions;
      onNotify(`Extracted ${extracted.length} questions. Saving to database...`);
      
      // Save all to firestore
      for (const q of extracted) {
        const qId = 'qb_' + Date.now() + Math.random().toString(36).substring(2, 6);
        await setDoc(doc(db, 'questionBank', qId), {
          id: qId,
          englishQuestion: q.englishQuestion || "Missing English Context",
          hindiQuestion: q.hindiQuestion || "हिंदी अनुवाद उपलब्ध नहीं है",
          englishOptions: q.englishOptions || ["", "", "", ""],
          hindiOptions: q.hindiOptions || ["", "", "", ""],
          correctOptionIndex: Number(q.correctOptionIndex) || 0,
          englishExplanation: q.englishExplanation || "No explanation provided.",
          hindiExplanation: q.hindiExplanation || "कोई व्याख्या नहीं।",
          subject: q.subject || "Miscellaneous",
          difficulty: q.difficulty || "medium",
          createdAt: Date.now()
        });
      }
      
      onNotify(`Successfully imported ${extracted.length} questions.`);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify('Failed to process document upload.', true);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setUploading(false);
    }
  };

  const handleRawTextSubmit = async () => {
    if (!rawText.trim()) return;
    setUploading(true);
    setIsRawTextModalOpen(false);

    try {
      onNotify("Processing pasted text via AI. This may take a minute...");

      const response = await fetch('/api/admin/extract-questions-raw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText, languageMode })
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !data.questions) {
        throw new Error(data.error || "Failed to extract");
      }

      const extracted = data.questions;
      onNotify(`Extracted ${extracted.length} questions. Saving context...`);
      
      for (const q of extracted) {
        const qId = 'qb_' + Date.now() + Math.random().toString(36).substring(2, 6);
        await setDoc(doc(db, 'questionBank', qId), {
          id: qId,
          englishQuestion: q.englishQuestion || "Missing English Context",
          hindiQuestion: q.hindiQuestion || "हिंदी अनुवाद उपलब्ध नहीं है",
          englishOptions: q.englishOptions || ["", "", "", ""],
          hindiOptions: q.hindiOptions || ["", "", "", ""],
          correctOptionIndex: Number(q.correctOptionIndex) || 0,
          englishExplanation: q.englishExplanation || "No explanation provided.",
          hindiExplanation: q.hindiExplanation || "कोई व्याख्या नहीं।",
          subject: q.subject || "Miscellaneous",
          difficulty: q.difficulty || "medium",
          createdAt: Date.now()
        });
      }
      
      onNotify(`Successfully imported ${extracted.length} pasted questions.`);
      setRawText('');
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify('Failed to process pasted text extraction.', true);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.englishQuestion) {
      onNotify("English Question is required", true);
      return;
    }

    try {
      const qId = editingId || ('qb_' + Date.now() + Math.random().toString(36).substring(2, 6));
      const payload = {
        id: qId,
        englishQuestion: formData.englishQuestion || "",
        hindiQuestion: formData.hindiQuestion || "",
        imageUrl: formData.imageUrl || "",
        optionImageUrls: formData.optionImageUrls || ["", "", "", ""],
        englishOptions: formData.englishOptions || ["", "", "", ""],
        hindiOptions: formData.hindiOptions || ["", "", "", ""],
        correctOptionIndex: Number(formData.correctOptionIndex) || 0,
        englishExplanation: formData.englishExplanation || "",
        hindiExplanation: formData.hindiExplanation || "",
        subject: formData.subject || "Miscellaneous",
        difficulty: formData.difficulty || "medium",
        createdAt: formData.createdAt || Date.now()
      };

      await setDoc(doc(db, 'questionBank', qId), payload);
      onNotify(`Question ${editingId ? 'Updated' : 'Added'} successfully.`);
      setIsModalOpen(false);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify('Error saving question', true);
    }
  };

  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);

  const deleteQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'questionBank', id));
      onNotify("Question deleted.");
      fetchQuestions();
    } catch (err) {
      onNotify("Error deleting question.", true);
    } finally {
      setQuestionToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestionIds.length === 0) return;
    try {
      setLoading(true);
      for (const id of selectedQuestionIds) {
        await deleteDoc(doc(db, 'questionBank', id));
      }
      onNotify(`Successfully deleted ${selectedQuestionIds.length} questions.`);
      setSelectedQuestionIds([]);
      fetchQuestions();
    } catch (err) {
      console.error(err);
      onNotify("Error deleting questions in bulk.", true);
    } finally {
      setLoading(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    const term = searchTerm.toLowerCase();
    const matchTerm = q.englishQuestion?.toLowerCase().includes(term) || q.subject?.toLowerCase().includes(term);
    const matchSub = filterSubject ? q.subject === filterSubject : true;
    const matchDiff = filterDifficulty ? q.difficulty === filterDifficulty : true;
    return matchTerm && matchSub && matchDiff;
  });

  return (
    <div className="space-y-6">
      {uploading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center justify-center space-y-4">
            <Loader2 size={40} className="text-blue-600 animate-spin" />
            <h3 className="text-lg font-bold text-slate-800">Generating Questions</h3>
            <p className="text-sm text-slate-500 text-center">Please wait while the AI processes your document and extracts questions. This may take a few moments...</p>
          </div>
        </div>
      )}
      
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Global Question Bank</h2>
          <p className="text-sm text-slate-500">Manage bilingual questions for examinations. Total: {questions.length}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded px-3 py-1.5 bg-slate-50 mr-2">
             <span className="text-xs font-bold text-slate-500">AI Extractor Mode:</span>
             <select 
                value={languageMode} 
                onChange={(e) => setLanguageMode(e.target.value as 'bilingual'|'english')}
                className="text-xs bg-transparent font-medium text-blue-700 outline-none cursor-pointer"
             >
                <option value="bilingual">Bilingual (Translates English &rarr; Hindi)</option>
                <option value="english">English Only (Faster, Skips Translation)</option>
             </select>
          </div>
          <input 
            type="file" 
            accept=".pdf,.doc,.docx,.txt" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition"
          >
            <Upload size={16} /> {uploading ? 'Processing AI...' : 'Import URL/PDF'}
          </button>
          <button
            onClick={() => setIsRawTextModalOpen(true)}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs transition"
          >
            <Plus size={16} /> Paste Bulk Text
          </button>
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ englishOptions: ['', '', '', ''], hindiOptions: ['', '', '', ''], difficulty: 'medium' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded text-xs transition shadow-sm"
          >
            <Plus size={16} /> Manual Entry
          </button>
          <button
            onClick={async () => {
              if (confirm('Are you sure you want to map Hematology/Histology questions to Pathology?')) {
                const res = await fetch('/api/admin/fix-subjects', { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  onNotify(`Successfully updated ${data.updatedCount} questions.`);
                  fetchQuestions();
                } else {
                  onNotify('Error during migration.', true);
                }
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded text-xs transition shadow-sm"
          >
            <RefreshCw size={16} /> Fix Subjects
          </button>
          {selectedQuestionIds.length > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded text-xs transition shadow-sm"
            >
              <Trash2 size={16} /> Delete Selected ({selectedQuestionIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
          <input 
            type="text"
            placeholder="Search questions or subjects..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded focus:outline-blue-500"
          />
        </div>
        <div>
          <select 
            value={filterSubject} 
            onChange={e => setFilterSubject(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-white text-slate-700"
          >
            <option value="">All Subjects</option>
            <option value="Pathology">Pathology</option>
            <option value="Biochemistry">Biochemistry</option>
            <option value="Microbiology">Microbiology</option>
            <option value="Blood Bank">Blood Bank</option>
            <option value="Anatomy">Anatomy</option>
            <option value="Math">Math</option>
            <option value="English">English</option>
            <option value="General Knowledge">General Knowledge</option>
            <option value="Reasoning">Reasoning</option>
            <option value="Miscellaneous">Miscellaneous</option>
          </select>
        </div>
        <div>
          <select 
            value={filterDifficulty} 
            onChange={e => setFilterDifficulty(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded bg-white text-slate-700"
          >
            <option value="">Any Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border !!border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm font-medium flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin text-blue-500" size={18} /> Loading bank...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">
            No questions found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#f8fafc] text-slate-500 font-bold text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <input 
                      type="checkbox"
                      className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedQuestionIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedQuestionIds(filteredQuestions.map(q => q.id));
                        } else {
                          setSelectedQuestionIds([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4">Question snippet (En)</th>
                  <th className="px-6 py-4">Subject</th>
                  <th className="px-6 py-4">Difficulty</th>
                  <th className="px-6 py-4 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuestions.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="cursor-pointer rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedQuestionIds.includes(q.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionIds(prev => [...prev, q.id]);
                          } else {
                            setSelectedQuestionIds(prev => prev.filter(id => id !== q.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-800 line-clamp-1">{q.englishQuestion}</div>
                      <div className="text-xs text-slate-500 mt-1 line-clamp-1">{q.hindiQuestion}</div>
                      <div className="mt-2 text-[11px] font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded w-fit border border-green-200">
                        {`Ans: Option ${Number(q.correctOptionIndex) + 1} - ${q.englishOptions?.[q.correctOptionIndex] || "N/A"}`}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded font-bold text-[10px]">
                        {q.subject}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded font-bold text-[10px] uppercase ${
                        q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700' : 
                        q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center gap-3">
                      <button onClick={() => { setFormData(q); setEditingId(q.id); setIsModalOpen(true); }} className="text-blue-600 hover:text-blue-800 transition">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => setQuestionToDelete(q.id)} className="text-rose-500 hover:text-rose-700 transition">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isRawTextModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">Paste Bulk Questions</h3>
              <button onClick={() => setIsRawTextModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Paste your raw question text (e.g., 1 to 100 questions with options and explanations) and our AI will extract and format them.
            </p>
            <textarea
              rows={10}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="1. What is the powerhouse of the cell?\n(a) Nucleus (b) Mitochondria (c) Ribosome (d) ER\nExplanation: Mitochondria generates ATP..."
              className="w-full text-sm px-3 py-3 border border-slate-200 rounded-lg focus:outline-blue-500 resize-y mb-4"
            />
            <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center gap-4 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-slate-500">Mode:</span>
                 <select 
                    value={languageMode} 
                    onChange={(e) => setLanguageMode(e.target.value as 'bilingual'|'english')}
                    className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-medium text-blue-700 outline-none cursor-pointer"
                 >
                    <option value="bilingual">Bilingual (Add Hindi Translation)</option>
                    <option value="english">English Only (Faster AI processing)</option>
                 </select>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={() => setIsRawTextModalOpen(false)} className="flex-1 sm:flex-none px-5 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
                <button 
                  type="button" 
                  onClick={handleRawTextSubmit} 
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                  disabled={uploading || !rawText.trim()}
                >
                  {uploading ? 'Processing...' : 'Extract Questions with AI'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex justify-between items-center z-10">
              <h3 className="font-bold text-lg text-slate-800">{editingId ? 'Edit Bank Question' : 'Create Bank Question'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion} className="p-6 space-y-6">
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">Image URL (Optional)</label>
                <input type="url" placeholder="https://example.com/image.jpg" value={formData.imageUrl || ''} onChange={e => setFormData({...formData, imageUrl: e.target.value})} className="w-full text-sm px-3 py-2 border rounded focus:outline-blue-500" />
                <p className="text-[10px] text-slate-400 mt-1">Provide a direct image URL (ends in .png, .jpg). <b>Note: Google Drive share links will not work.</b></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">English Question *</label>
                  <textarea rows={3} required value={formData.englishQuestion} onChange={e => setFormData({...formData, englishQuestion: e.target.value})} className="w-full text-sm px-3 py-2 border rounded focus:outline-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hindi Question</label>
                  <textarea rows={3} value={formData.hindiQuestion} onChange={e => setFormData({...formData, hindiQuestion: e.target.value})} className="w-full text-sm px-3 py-2 border rounded focus:outline-blue-500" />
                </div>
              </div>

              {/* Options Grid */}
              <div className="space-y-4">
                <label className="block text-xs font-bold text-slate-700">Options (En & Hi)</label>
                {[0, 1, 2, 3].map(idx => {
                  const isCorrect = Number(formData.correctOptionIndex) === idx;
                  return (
                  <div key={idx} className={`p-3 rounded-lg border ${isCorrect ? 'border-green-500 bg-green-50 ring-2 ring-green-200' : 'border-slate-200'}`}>
                    <div className="flex flex-col md:flex-row gap-4 mb-2">
                      <input type="text" placeholder={`English Opt ${idx+1}`} value={formData.englishOptions?.[idx] || ''} onChange={e => {
                        const nu = [...(formData.englishOptions || [])]; nu[idx] = e.target.value;
                        setFormData({...formData, englishOptions: nu});
                      }} className="flex-1 text-sm border rounded px-3 py-2 bg-white" required />
                      <input type="text" placeholder={`Hindi Opt ${idx+1}`} value={formData.hindiOptions?.[idx] || ''} onChange={e => {
                        const nu = [...(formData.hindiOptions || [])]; nu[idx] = e.target.value;
                        setFormData({...formData, hindiOptions: nu});
                      }} className="flex-1 text-sm border rounded px-3 py-2 bg-white" />
                    </div>
                    <div>
                      <input type="url" placeholder={`Option ${idx+1} Image URL (Optional)`} value={formData.optionImageUrls?.[idx] || ''} onChange={e => {
                        const nu = [...(formData.optionImageUrls || ['', '', '', ''])]; nu[idx] = e.target.value;
                        setFormData({...formData, optionImageUrls: nu});
                      }} className="w-full text-xs border rounded px-3 py-2 bg-white text-slate-600 focus:outline-blue-500" />
                    </div>
                  </div>
                )})}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Correct Opt Index (0-3)</label>
                  <input type="number" min="0" max="3" required value={formData.correctOptionIndex ?? 0} onChange={e => setFormData({...formData, correctOptionIndex: Number(e.target.value)})} className="w-full border rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Subject</label>
                  <select value={formData.subject || 'Miscellaneous'} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full border rounded px-3 py-2 text-sm">
                    <option value="Pathology">Pathology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Blood Bank">Blood Bank</option>
                    <option value="Anatomy">Anatomy</option>
                    <option value="Math">Math</option>
                    <option value="English">English</option>
                    <option value="General Knowledge">General Knowledge</option>
                    <option value="Reasoning">Reasoning</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Difficulty</label>
                  <select value={formData.difficulty || 'medium'} onChange={e => setFormData({...formData, difficulty: e.target.value as any})} className="w-full border rounded px-3 py-2 text-sm">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">English Explanation</label>
                  <textarea rows={2} value={formData.englishExplanation} onChange={e => setFormData({...formData, englishExplanation: e.target.value})} className="w-full text-sm px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hindi Explanation</label>
                  <textarea rows={2} value={formData.hindiExplanation} onChange={e => setFormData({...formData, hindiExplanation: e.target.value})} className="w-full text-sm px-3 py-2 border rounded" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
                <button type="submit" className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm">Save Question</button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modals */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
            <Trash2 size={48} className="mx-auto text-rose-500 mb-4 opacity-80" />
            <h3 className="font-bold text-lg text-slate-800 mb-2">Delete Selected?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete {selectedQuestionIds.length} questions?</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setShowBulkDeleteConfirm(false)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                onClick={handleBulkDelete}
                disabled={loading}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
              >
                {loading ? 'Deleting...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {questionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
            <Trash2 size={48} className="mx-auto text-rose-500 mb-4 opacity-80" />
            <h3 className="font-bold text-lg text-slate-800 mb-2">Delete Question?</h3>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setQuestionToDelete(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                onClick={() => deleteQuestion(questionToDelete)}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm"
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
