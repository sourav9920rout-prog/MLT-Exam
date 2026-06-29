import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebase';
import { 
  BookOpen, Plus, Trash2, Edit, ExternalLink, Eye, Download, Search, 
  X, FileText, Folder, Check, Clock, ChevronRight, AlertCircle, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Error handling helper in strict compliance with the firebase-integration skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface NoteItem {
  id: string;
  title: string;
  description: string;
  driveLink: string;
  subject: string;
  chapter?: string;
  createdAt: string;
  updatedAt?: string;
}

const SYLLABUS_SUBJECTS = [
  "Biochemistry",
  "Microbiology",
  "Pathology / Haematology / Blood Banking",
  "General Intelligence & Reasoning",
  "General Awareness",
  "Quantitative Aptitude",
  "English Language"
];

// Robust parsing utility to turn a sharing link into an embeddable direct-view preview link
export function getGoogleDriveEmbedUrl(url: string): { embedUrl: string | null; isFolder: boolean; downloadUrl: string | null } {
  if (!url) return { embedUrl: null, isFolder: false, downloadUrl: null };
  const trimmedUrl = url.trim();

  try {
    // 1. Google Drive Folder Link
    const folderMatch = trimmedUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/) || trimmedUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (trimmedUrl.includes('/drive/folders/') && folderMatch) {
      const folderId = folderMatch[1];
      return {
        embedUrl: `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`,
        isFolder: true,
        downloadUrl: trimmedUrl,
      };
    }
    
    // 2. Google Drive File Link
    const fileMatch = trimmedUrl.match(/\/file\/d\/([a-zA-Z0-9-_]+)/) || trimmedUrl.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (fileMatch) {
      const fileId = fileMatch[1];
      return {
        embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
        isFolder: false,
        downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      };
    }
    
    // Fallback if it contains google drive but doesn't match above regexes
    if (trimmedUrl.includes('drive.google.com')) {
      return {
        embedUrl: trimmedUrl,
        isFolder: false,
        downloadUrl: trimmedUrl,
      };
    }
  } catch (error) {
    console.error("Error parsing Google Drive link:", error);
  }
  
  return { embedUrl: trimmedUrl, isFolder: false, downloadUrl: trimmedUrl };
}

export default function NotesManager({ isAdmin, onNotify }: { isAdmin: boolean; onNotify: (msg: string) => void }) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Searching & Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  
  // Modal/Form States
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteItem | null>(null);
  const [selectedNoteForPreview, setSelectedNoteForPreview] = useState<NoteItem | null>(null);
  
  // Form input fields
  const [noteTitle, setNoteTitle] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [noteDriveLink, setNoteDriveLink] = useState('');
  const [noteSubject, setNoteSubject] = useState(SYLLABUS_SUBJECTS[0]);
  const [noteChapter, setNoteChapter] = useState('');

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'notes'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const fetched: NoteItem[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as NoteItem);
      });
      setNotes(fetched);
    } catch (error) {
      console.error("Error fetching notes:", error);
      try {
        handleFirestoreError(error, OperationType.LIST, 'notes');
      } catch (err) {
        onNotify("Error loading study materials");
      }
    }
    setLoading(false);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    
    if (!noteTitle.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!noteDriveLink.trim()) {
      setFormError('Google Drive sharing link is required');
      return;
    }
    if (!noteDriveLink.includes('drive.google.com')) {
      setFormError('Please enter a valid Google Drive URL');
      return;
    }

    try {
      const noteData = {
        title: noteTitle.trim(),
        description: noteDescription.trim(),
        driveLink: noteDriveLink.trim(),
        subject: noteSubject,
        chapter: noteChapter.trim() || undefined,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'notes'), noteData);
      
      resetForm();
      setIsCreating(false);
      fetchNotes();
      onNotify("Note added successfully!");
    } catch (err) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.CREATE, 'notes');
      } catch (e) {
        onNotify("Failed to save note");
      }
    }
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    setFormError('');

    if (!noteTitle.trim()) {
      setFormError('Title is required');
      return;
    }
    if (!noteDriveLink.trim()) {
      setFormError('Google Drive sharing link is required');
      return;
    }
    if (!noteDriveLink.includes('drive.google.com')) {
      setFormError('Please enter a valid Google Drive URL');
      return;
    }

    try {
      const noteDocRef = doc(db, 'notes', editingNote.id);
      const updatedData = {
        title: noteTitle.trim(),
        description: noteDescription.trim(),
        driveLink: noteDriveLink.trim(),
        subject: noteSubject,
        chapter: noteChapter.trim() || '',
        updatedAt: new Date().toISOString()
      };

      await updateDoc(noteDocRef, updatedData);
      
      resetForm();
      setEditingNote(null);
      fetchNotes();
      onNotify("Note updated successfully!");
    } catch (err) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.UPDATE, `notes/${editingNote.id}`);
      } catch (e) {
        onNotify("Failed to update note");
      }
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notes', id));
      setConfirmDeleteId(null);
      if (selectedNoteForPreview?.id === id) {
        setSelectedNoteForPreview(null);
      }
      fetchNotes();
      onNotify("Note deleted successfully");
    } catch (err) {
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `notes/${id}`);
      } catch (e) {
        onNotify("Failed to delete note");
      }
    }
  };

  const startEdit = (note: NoteItem) => {
    setEditingNote(note);
    setNoteTitle(note.title);
    setNoteDescription(note.description || '');
    setNoteDriveLink(note.driveLink);
    setNoteSubject(note.subject);
    setNoteChapter(note.chapter || '');
    setIsCreating(false);
  };

  const resetForm = () => {
    setNoteTitle('');
    setNoteDescription('');
    setNoteDriveLink('');
    setNoteSubject(SYLLABUS_SUBJECTS[0]);
    setNoteChapter('');
    setFormError('');
  };

  // Filter notes based on subject and search query
  const filteredNotes = notes.filter(note => {
    const matchesSubject = selectedSubject === 'All' || note.subject === selectedSubject;
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.description && note.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (note.chapter && note.chapter.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="bg-white/70 backdrop-blur-md border border-slate-200 rounded-xl p-6 shadow-sm min-h-[500px]">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-extrabold flex items-center gap-2 text-slate-800">
            <BookOpen className="text-blue-600" /> 
            Study Notes & Materials
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Access compiled study materials, PDFs, and folders directly from Google Drive.
          </p>
        </div>
        
        {isAdmin && !isCreating && !editingNote && (
          <button 
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-bold transition shadow-[0_2px_10px_rgba(37,99,235,0.2)] cursor-pointer"
          >
            <Plus size={16} /> Add Study Material
          </button>
        )}
      </div>

      {/* CREATE / EDIT FORM */}
      {(isCreating || editingNote) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6 space-y-4"
        >
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm uppercase tracking-wider">
              {editingNote ? <Edit size={16} className="text-amber-600" /> : <Plus size={16} className="text-blue-600" />}
              {editingNote ? 'Edit Study Material' : 'Add New Study Material'}
            </h3>
            <button 
              onClick={() => { setIsCreating(false); setEditingNote(null); resetForm(); }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={editingNote ? handleUpdateNote : handleCreateNote} className="space-y-4">
            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg flex items-center gap-2 text-sm font-medium">
                <AlertCircle size={16} />
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                  placeholder="e.g., Clinical Biochemistry Lecture Notes"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Subject / Domain Category *</label>
                <select
                  value={noteSubject}
                  onChange={(e) => setNoteSubject(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors"
                >
                  {SYLLABUS_SUBJECTS.map((sub) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chapter / Topic (Optional)</label>
                <input
                  type="text"
                  value={noteChapter}
                  onChange={(e) => setNoteChapter(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="e.g., Chromatography & Electrophoresis"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Google Drive Sharing Link *</label>
                <input
                  type="url"
                  required
                  value={noteDriveLink}
                  onChange={(e) => setNoteDriveLink(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="Paste Drive sharing link (file or folder)"
                />
                <p className="text-[10px] text-slate-400 font-mono mt-1">
                  Ensure link access is set to "Anyone with the link can view".
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Description / Summary (Optional)</label>
              <textarea
                value={noteDescription}
                onChange={(e) => setNoteDescription(e.target.value)}
                rows={3}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                placeholder="Short outline of what's covered in this note..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setIsCreating(false); setEditingNote(null); resetForm(); }}
                className="px-4 py-2 text-sm font-semibold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-md cursor-pointer"
              >
                {editingNote ? 'Save Changes' : 'Publish Note'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* SEARCH AND SUBJECT FILTER ACCORDION */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* SEARCH INPUT */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by topic, chapter, keyword..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-800 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* QUICK REFRESH */}
          <div className="flex justify-end">
            <button
              onClick={fetchNotes}
              className="flex items-center gap-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* SUBJECT SELECTION BADGES */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button
            onClick={() => setSelectedSubject('All')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
              selectedSubject === 'All'
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
            }`}
          >
            All Categories
          </button>
          {SYLLABUS_SUBJECTS.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition cursor-pointer ${
                selectedSubject === sub
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>
      </div>

      {/* LOADING STATE */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-mono text-slate-500">Retrieving study materials...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16 bg-slate-50/50 border border-dashed border-slate-300 rounded-xl">
          <FileText className="mx-auto text-slate-300 mb-3" size={48} />
          <h3 className="text-lg font-bold text-slate-700 mb-1">No Notes Found</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {searchQuery || selectedSubject !== 'All' 
              ? "We couldn't find any study notes matching your filters. Try clearing your search or category."
              : "No study notes have been uploaded yet. Check back soon for premium learning files."}
          </p>
          {(searchQuery || selectedSubject !== 'All') && (
            <button
              onClick={() => { setSearchQuery(''); setSelectedSubject('All'); }}
              className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* NOTES LIST COLUMN */}
          <div className={selectedNoteForPreview ? "lg:col-span-5 space-y-3 max-h-[650px] overflow-y-auto pr-1" : "lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"}>
            <AnimatePresence mode="popLayout">
              {filteredNotes.map((note) => {
                const { isFolder } = getGoogleDriveEmbedUrl(note.driveLink);
                const isCurrentlySelected = selectedNoteForPreview?.id === note.id;

                return (
                  <motion.div
                    key={note.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`bg-white border rounded-xl p-4 transition-all flex flex-col justify-between cursor-pointer ${
                      isCurrentlySelected 
                        ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20 bg-blue-50/10' 
                        : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedNoteForPreview(note)}
                  >
                    <div>
                      {/* Subject Tag */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[180px]">
                          {note.subject}
                        </span>
                        
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-bold text-slate-800 text-sm line-clamp-1 flex items-center gap-1.5">
                        {isFolder ? <Folder size={15} className="text-amber-500 shrink-0" /> : <FileText size={15} className="text-blue-500 shrink-0" />}
                        {note.title}
                      </h4>

                      {/* Chapter Indicator */}
                      {note.chapter && (
                        <p className="text-[11px] font-semibold text-slate-500 mt-1 flex items-center gap-1">
                          <ChevronRight size={12} className="text-slate-400" />
                          Topic: {note.chapter}
                        </p>
                      )}

                      {/* Description */}
                      {note.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 italic">
                          {note.description}
                        </p>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-4" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedNoteForPreview(note)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Eye size={13} />
                        View Direct
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Open in Drive External link */}
                        <a
                          href={note.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
                          title="Open directly in Google Drive"
                        >
                          <ExternalLink size={14} />
                        </a>

                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => startEdit(note)}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Edit Note"
                            >
                              <Edit size={14} />
                            </button>
                            
                            {confirmDeleteId === note.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteNote(note.id)}
                                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded cursor-pointer"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(note.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                title="Delete Note"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* ACTIVE PREVIEW PANEL */}
          {selectedNoteForPreview && (
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[650px] relative shadow-lg">
              {/* Preview Header */}
              <div className="flex justify-between items-center pb-3 border-b border-slate-800 mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                    {getGoogleDriveEmbedUrl(selectedNoteForPreview.driveLink).isFolder ? <Folder size={16} /> : <FileText size={16} />}
                  </span>
                  <div>
                    <h4 className="font-bold text-white text-sm line-clamp-1">{selectedNoteForPreview.title}</h4>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{selectedNoteForPreview.subject}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Open in Drive */}
                  <a
                    href={selectedNoteForPreview.driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 transition"
                  >
                    <ExternalLink size={12} />
                    Open in Drive
                  </a>

                  {/* Close Preview */}
                  <button 
                    onClick={() => setSelectedNoteForPreview(null)}
                    className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Direct Description Info if present */}
              {selectedNoteForPreview.description && (
                <div className="mb-3 p-2 bg-slate-800/40 rounded border border-slate-800/80 text-xs text-slate-300 italic shrink-0">
                  <span className="font-bold text-slate-400 not-italic uppercase text-[10px] tracking-wide block mb-0.5">Admin Summary:</span>
                  {selectedNoteForPreview.description}
                </div>
              )}

              {/* Responsive Embedded Iframe Viewport */}
              <div className="flex-1 bg-slate-950 rounded-lg overflow-hidden relative border border-slate-800">
                {(() => {
                  const { embedUrl, isFolder } = getGoogleDriveEmbedUrl(selectedNoteForPreview.driveLink);
                  if (embedUrl) {
                    return (
                      <iframe
                        src={embedUrl}
                        className="w-full h-full border-0 bg-white"
                        allow="autoplay"
                        referrerPolicy="no-referrer"
                        title={selectedNoteForPreview.title}
                        sandbox="allow-same-origin allow-scripts allow-popups"
                      />
                    );
                  } else {
                    return (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400 bg-slate-950">
                        <AlertCircle className="text-amber-500 mb-2" size={32} />
                        <h5 className="font-bold text-white mb-1">Direct Embed Unavailable</h5>
                        <p className="text-xs text-slate-500 max-w-sm mb-4">
                          This Google Drive link could not be parsed for direct rendering. You can still open and view it in a new window.
                        </p>
                        <a
                          href={selectedNoteForPreview.driveLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-sm transition"
                        >
                          View in Google Drive
                        </a>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Preview Footer details */}
              <div className="pt-2 text-[10px] text-slate-500 text-center shrink-0">
                Google Drive files are governed by Google's Privacy & Security rules. Make sure you are signed in to Google if required.
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
