import React, { useState, useEffect } from 'react';
import { collection, updateDoc, doc, getDocs, deleteDoc, query, getDoc, setDoc, onSnapshot, limit, where } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Trash2, UserX, UserCheck, ShieldAlert, RotateCcw, AlertTriangle } from 'lucide-react';
import { StudentProfile } from '../types.ts';

interface StudentManagerProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function StudentManager({ onNotify }: StudentManagerProps) {
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'approved' | 'pending' | 'revoked' | 'deleted'>('approved');
  const [sortType, setSortType] = useState<'' | 'name_asc' | 'name_desc' | 'date_asc' | 'date_desc'>('');
  const [loading, setLoading] = useState(false);
  const [requireAdminApproval, setRequireAdminApproval] = useState<boolean>(true);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);

  // Fetch student roster
  const fetchStudents = async (fetchAll = false) => {
    setLoading(true);
    try {
      let qBuilder: any = collection(db, 'students');
      
      // We must query by status because we're paginating/limiting
      qBuilder = query(qBuilder, where('status', '==', activeSubTab));
      
      if (!fetchAll) {
         qBuilder = query(qBuilder, limit(15));
      }
      
      const querySnapshot = await getDocs(qBuilder);
      const studentList: StudentProfile[] = [];
      querySnapshot.forEach((doc) => {
        studentList.push({ id: doc.id, ...doc.data() } as any);
      });
      setStudents(studentList);
      setHasLoadedAll(fetchAll || studentList.length < 15);
    } catch (error) {
      console.error('Error listing student list:', error);
      onNotify('Failed to fetch student list from cloud.', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setHasLoadedAll(false);
    fetchStudents(false);
  }, [activeSubTab]);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.requireAdminApproval !== undefined) {
          setRequireAdminApproval(data.requireAdminApproval);
        }
      }
    });
    return () => unsubSettings();
  }, []);

  const toggleApprovalRequirement = async () => {
    try {
      const newValue = !requireAdminApproval;
      await setDoc(doc(db, 'settings', 'general'), { requireAdminApproval: newValue }, { merge: true });
      onNotify(`Admin approval requirement is now ${newValue ? 'ON' : 'OFF'}.`);
    } catch (error) {
       onNotify('Failed to update approval requirement setting.', true);
    }
  };

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

      fetchStudents(hasLoadedAll);
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
      fetchStudents(hasLoadedAll);
    } catch (e) {
      console.error(e);
      onNotify('Could not permanently remove student.', true);
    } finally {
      setStudentToDelete(null);
    }
  };

  const filteredList = students.sort((a, b) => {
    if (sortType === 'name_asc') {
      return (a.fullName || '').localeCompare(b.fullName || '');
    } else if (sortType === 'name_desc') {
      return (b.fullName || '').localeCompare(a.fullName || '');
    } else if (sortType === 'date_asc') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateA - dateB;
    } else if (sortType === 'date_desc') {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    }
    return 0;
  });

  return (
    <div id="student-manager-container" className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap justify-between items-center gap-4 bg-slate-50">
        <div>
           <h3 className="text-sm font-semibold text-slate-800">Global Settings</h3>
           <p className="text-xs text-slate-500">Turn on to require manual Admin approval for new student registrations.</p>
        </div>
        <button 
           onClick={toggleApprovalRequirement}
           className={`px-4 py-1.5 text-xs font-semibold rounded-md border transition-colors ${requireAdminApproval ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'}`}
        >
           {requireAdminApproval ? 'Approval Needed : YES' : 'Approval Needed : NO'}
        </button>
      </div>
      {/* Sub Tabs Header */}
      <div className="flex border-b border-slate-100 bg-white px-6 py-3 gap-6 text-sm overflow-x-auto justify-between items-center">
        <div className="flex gap-6">
          {(['approved', 'pending', 'revoked', 'deleted'] as const).map((tab) => {
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
              </button>
            );
          })}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select 
            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-blue-100 cursor-pointer"
            value={sortType}
            onChange={(e) => setSortType(e.target.value as any)}
          >
            <option value="">Default</option>
            <option value="name_asc">Name (A-Z)</option>
            <option value="name_desc">Name (Z-A)</option>
            <option value="date_desc">Registered (New to Old)</option>
            <option value="date_asc">Registered (Old to New)</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        {loading && students.length === 0 ? (
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
                  <th className="px-6 py-3 border-b border-slate-200 font-bold w-12 text-center">S.No</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Full Name</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Mobile Number</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Email Address</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold">Registered On</th>
                  <th className="px-6 py-3 border-b border-slate-200 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredList.map((student, index) => (
                  <tr key={student.uid} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-4 border-b border-slate-100 font-mono text-xs text-slate-400 text-center">{index + 1}</td>
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
            
            {!hasLoadedAll && (
              <div className="p-4 flex justify-center border-t border-slate-100">
                 <button 
                   onClick={() => fetchStudents(true)}
                   disabled={loading}
                   className="px-6 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold text-sm rounded-lg transition"
                 >
                   {loading ? 'Loading...' : 'View All Students'}
                 </button>
              </div>
            )}
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
