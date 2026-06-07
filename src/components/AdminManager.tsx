import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../utils/firebase.ts';
import { Shield, Plus, Trash2, RefreshCw } from 'lucide-react';

export default function AdminManager({ onNotify }: { onNotify: (msg: string, isErr?: boolean) => void }) {
  const [adminEmails, setAdminEmails] = useState<{email: string, addedAt: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'adminEmails'));
      const list: any[] = [];
      snap.forEach(doc => {
        list.push({ email: doc.id, addedAt: doc.data().addedAt });
      });
      setAdminEmails(list);
    } catch (e) {
      console.error(e);
      onNotify("Failed to fetch admin emails", true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      onNotify("Please enter a valid email address.", true);
      return;
    }
    setSaving(true);
    try {
      const emailLower = newEmail.toLowerCase().trim();
      await setDoc(doc(db, 'adminEmails', emailLower), {
        email: emailLower,
        addedAt: new Date().toISOString()
      });
      onNotify(`Added ${emailLower} as an admin.`);
      setNewEmail('');
      fetchEmails();
    } catch (err) {
      console.error(err);
      onNotify("Error adding admin.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!window.confirm(`Are you sure you want to revoke admin access for ${email}?`)) return;
    try {
      await deleteDoc(doc(db, 'adminEmails', email));
      onNotify(`Admin access revoked for ${email}`);
      fetchEmails();
    } catch (err) {
      console.error(err);
      onNotify("Error revoking admin.", true);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl min-h-[60vh]">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
         <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Shield className="text-blue-600" size={20} /> System Administrators
            </h2>
            <p className="text-sm text-slate-500 mt-1">Manage global admin email allocations.</p>
         </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <form onSubmit={handleAddAdmin} className="p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
           <input 
             type="email"
             value={newEmail}
             onChange={e => setNewEmail(e.target.value)}
             placeholder="Enter new admin email to invite..."
             className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
             required
           />
           <button type="submit" disabled={saving || !newEmail} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 font-bold text-sm rounded shadow flex items-center gap-2 disabled:opacity-50">
             <Plus size={16} /> Add Admin
           </button>
        </form>
        
        {loading ? (
             <div className="p-8 flex justify-center"><RefreshCw className="animate-spin text-slate-400" /></div>
        ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                        <th className="px-6 py-3 font-semibold text-slate-700">Admin Email Address</th>
                        <th className="px-6 py-3 font-semibold text-slate-700">Added Term</th>
                        <th className="px-6 py-3 font-semibold text-slate-700 w-10 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    <tr className="bg-slate-50 opacity-80">
                        <td className="px-6 py-4 font-medium text-slate-900 border-l-4 border-emerald-500">
                           sourav.9920rout@gmail.com
                           <span className="ml-2 text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Super Founder</span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">System Genesis</td>
                        <td className="px-6 py-4 text-right cursor-not-allowed">
                           <Shield size={16} className="text-slate-300 inline" />
                        </td>
                    </tr>
                    {adminEmails.map((item, id) => (
                        <tr key={id} className="hover:bg-slate-50 transition">
                            <td className="px-6 py-4 font-medium text-slate-700">{item.email}</td>
                            <td className="px-6 py-4 text-slate-500">{new Date(item.addedAt).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-right">
                                <button 
                                  onClick={() => handleRemoveAdmin(item.email)}
                                  className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition"
                                  title="Revoke Admin"
                                >
                                  <Trash2 size={16} />
                                </button>
                            </td>
                        </tr>
                    ))}
                    {adminEmails.length === 0 && (
                        <tr>
                            <td colSpan={3} className="px-6 py-8 text-center text-slate-500 italic">No additional admins allocated.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
}
