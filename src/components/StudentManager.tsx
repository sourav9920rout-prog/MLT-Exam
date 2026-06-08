import React, { useState, useEffect } from 'react';
import { collection, updateDoc, doc, getDocs, deleteDoc, query } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Trash2, UserX, UserCheck, ShieldAlert, RotateCcw, AlertTriangle } from 'lucide-react';
import { StudentProfile } from '../types.ts';

interface StudentManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function StudentManager({ onNotify }: StudentManagerProps) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'approved' | 'pending' | 'revoked' | 'deleted'>('approved');
  const [loading, setLoading] = useState(false);

  // Fetch student roster
  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = collection(db, 'students');
      const querySnapshot = await getDocs(q);
      const studentList: StudentProfile[] = [];
      querySnapshot.forEach((doc) => {
        studentList.push({ id: doc.id, ...doc.data() } as any);
      });
      setStudents(studentList);
    } catch (error) {
      console.error('Error listing student list:', error);
      onNotify('Failed to fetch student list from cloud.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const [studentToDelete, setStudentToDelete] = useState<StudentProfile | null>(null);

  // Set action updating state on firebase & dispatch custom mail update (SMTP 2)
  const handleStatusAction = async (student: StudentProfile, newStatus: StudentProfile['status'], actionLabel: string) => {
    try {
      const docRef = doc(db, 'students', student.uid);
      await updateDoc(docRef, { status: newStatus });
      onNotify(`Student "${student.fullName}" status updated to ${newStatus}.`);
      
      // Dispatch Backend SMTP 2 notification
      try {
        const res = await fetch('/api/admin/notify-status-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentEmail: student.email,
            studentName: student.fullName,
            actionType: actionLabel // approve, reject, revoke, reactivate
          })
        });
        if (!res.ok) {
           const errText = await res.text();
           throw new Error(`Server returned status ${res.status}: ${errText.substring(0, 100)}`);
        }
        const data = await res.json();
        if (!data.success && data.error) {
           console.warn(`Status updated, but email to student failed: ${data.error}`);
        } else if (data.success && data.smtpConfigured === false) {
           console.log(`Status updated. (Email skipped: SMTP not configured)`);
        }
      } catch (err: any) {
         console.warn('Update email dispatch error:', err);
      }

      fetchStudents();
    } catch (e) {
      console.error(e);
      onNotify('Failed to update student access state.', true);
    }
  };

  const handlePermanentDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteDoc(doc(db, 'students', studentToDelete.uid));
      onNotify(`Student "${studentToDelete.fullName}" permanently removed.`);
      fetchStudents();
    } catch (e) {
      console.error(e);
      onNotify('Could not permanently remove student.', true);
    } finally {
      setStudentToDelete(null);
    }
  };

  const filteredList = students.filter(s => {
    if (activeSubTab === 'approved') return s.status === 'approved';
    if (activeSubTab === 'pending') return s.status === 'pending';
    if (activeSubTab === 'revoked') return s.status === 'revoked';
    if (activeSubTab === 'deleted') return s.status === 'deleted';
    return false;
  });

  return (
    <div id="student-manager-container" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Sub Tabs Header */}
      <div className="flex border-b border-slate-100 bg-white px-6 py-3 gap-6 text-sm overflow-x-auto">
        {(['approved', 'pending', 'revoked', 'deleted'] as const).map((tab) => {
          const count = students.filter(s => s.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`flex items-center gap-3 py-1 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                activeSubTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600 -mb-[13px]'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab === 'approved' ? 'Accepted' : tab === 'pending' ? 'Pending Requests' : tab === 'revoked' ? 'Revoked Access' : tab} 
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${activeSubTab === tab ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center py-12 text-slate-500 font-mono text-sm">
            Loading student rosters...
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-mono text-sm border-2 border-dashed border-slate-100 rounded-xl">
            No students currently found in this category.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Full Name</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Mobile Number</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Email Address</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Registered On</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredList.map((student) => (
                  <tr key={student.uid} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 border-b border-slate-100 font-semibold text-slate-900">{student.fullName}</td>
                    <td className="px-6 py-4 border-b border-slate-100 text-slate-500">{student.mobileNumber || 'N/A'}</td>
                    <td className="px-6 py-4 border-b border-slate-100">{student.email}</td>
                    <td className="px-6 py-4 border-b border-slate-100 text-slate-500 text-xs">
                      {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Pending'}
                    </td>
                    <td className="px-6 py-4 border-b border-slate-100 text-right">
                      <div className="flex gap-2 justify-end">
                        {/* Sub Tab: Approved Students / Accepted Actions */}
                        {activeSubTab === 'approved' && (
                          <>
                            <button
                              onClick={() => handleStatusAction(student, 'revoked', 'revoke')}
                              title="Revoke Access"
                              className="px-3 py-1 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 cursor-pointer"
                            >
                              Revoke
                            </button>
                            <button
                              onClick={() => handleStatusAction(student, 'deleted', 'delete')}
                              title="Delete Student"
                              className="p-1 text-slate-400 hover:text-red-500 cursor-pointer transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}

                        {/* Sub Tab: Pending Request Actions */}
                        {activeSubTab === 'pending' && (
                          <>
                            <button
                              onClick={() => handleStatusAction(student, 'approved', 'approve')}
                              className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusAction(student, 'rejected', 'reject')}
                              className="px-3 py-1 bg-white border border-slate-200 text-red-600 text-xs font-bold rounded hover:bg-red-50 cursor-pointer transition"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {/* Sub Tab: Revoked Actions */}
                        {activeSubTab === 'revoked' && (
                          <>
                            <button
                              onClick={() => handleStatusAction(student, 'approved', 'reactivate')}
                              title="Admin Reactivate"
                              className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 cursor-pointer transition"
                            >
                              Reactivate
                            </button>
                            <button
                              onClick={() => handleStatusAction(student, 'deleted', 'delete')}
                              title="Archive to trash"
                              className="p-1 text-slate-400 hover:text-red-500 cursor-pointer transition"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}

                        {/* Sub Tab: Deleted Trash Can Actions */}
                        {activeSubTab === 'deleted' && (
                          <>
                            <button
                              onClick={() => handleStatusAction(student, 'pending', 'reactivate')}
                              title="Restore Member"
                              className="px-3 py-1 bg-white border border-slate-200 text-blue-600 text-xs font-bold rounded hover:bg-slate-50 cursor-pointer transition"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => setStudentToDelete(student)}
                              title="Permanently Expell"
                              className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded hover:bg-red-700 cursor-pointer transition flex items-center gap-1"
                            >
                              Permanently Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {studentToDelete && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 text-center">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Permanently Delete Student?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to permanently delete "{studentToDelete.fullName}"? This action cannot be undone.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setStudentToDelete(null)} className="px-5 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm">Cancel</button>
              <button 
                onClick={handlePermanentDelete}
                className="px-5 py-2 rounded bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center gap-2"
              >
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
