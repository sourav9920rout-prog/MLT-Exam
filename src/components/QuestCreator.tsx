import React, { useState } from 'react';
import QuestionBankManager from './QuestionBankManager.tsx';
import ExamPublisher from './ExamPublisher.tsx';
import AdminTakeExam from './AdminTakeExam.tsx';

interface QuestCreatorProps {
  onNotify: (message: string, isError?: boolean) => void;
}

export default function QuestCreator({ onNotify }: QuestCreatorProps) {
  const [activeTab, setActiveTab] = useState<'bank' | 'publisher' | 'ongoing'>('bank');

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 mb-4">
        <button
          onClick={() => setActiveTab('bank')}
          className={`py-3 px-2 border-b-2 text-sm font-bold transition ${activeTab === 'bank' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Question Bank Manager
        </button>
        <button
          onClick={() => setActiveTab('publisher')}
          className={`py-3 px-2 border-b-2 text-sm font-bold transition ${activeTab === 'publisher' ? 'border-amber-600 text-amber-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Exam Publisher
        </button>
        <button
          onClick={() => setActiveTab('ongoing')}
          className={`py-3 px-2 border-b-2 text-sm font-bold transition ${activeTab === 'ongoing' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          Take Exam (Test)
        </button>
      </div>

      {activeTab === 'bank' && <QuestionBankManager onNotify={onNotify} />}
      {activeTab === 'publisher' && <ExamPublisher onNotify={onNotify} />}
      {activeTab === 'ongoing' && <AdminTakeExam />}
    </div>
  );
}
