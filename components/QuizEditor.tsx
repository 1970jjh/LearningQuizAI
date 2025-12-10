
import React, { useState } from 'react';
import { QuizQuestion, Slide } from '../types';
import { regenerateQuestion } from '../services/geminiService';
import { Clock, RefreshCcw, Trash2, Save, PlayCircle, Edit3 } from 'lucide-react';

interface QuizEditorProps {
  questions: QuizQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<QuizQuestion[]>>;
  slides: Slide[];
  onStartQuiz: () => void;
}

export const QuizEditor: React.FC<QuizEditorProps> = ({ questions, setQuestions, slides, onStartQuiz }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regenPrompt, setRegenPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleUpdate = (id: string, field: keyof QuizQuestion, value: any) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const handleDelete = (id: string) => {
    if(confirm('이 문제를 삭제하시겠습니까?')) {
        setQuestions(prev => prev.filter(q => q.id !== id));
    }
  };

  const handleRegenerate = async (question: QuizQuestion) => {
      if (!regenPrompt.trim()) return;
      setIsRegenerating(true);
      try {
          const newQ = await regenerateQuestion(question, regenPrompt, slides);
          setQuestions(prev => prev.map(q => q.id === question.id ? newQ : q));
          setRegenPrompt('');
          setEditingId(null);
      } catch (e) {
          alert('재생성 실패');
      } finally {
          setIsRegenerating(false);
      }
  };

  return (
    <div className="flex-1 h-full bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0">
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">퀴즈 편집 ({questions.length})</h1>
            <button 
                onClick={onStartQuiz}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-md transition-all hover:-translate-y-0.5"
            >
                <PlayCircle className="w-5 h-5" /> Quiz 초대하기 & 시작
            </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
            {questions.map((q, idx) => (
                <div key={q.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    
                    {/* Top Bar */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-3 py-1 rounded text-sm">
                                Q{idx + 1}. {q.type === 'multiple-choice' ? '객관식' : '주관식'}
                            </span>
                            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">
                                <Clock className="w-4 h-4" />
                                <input 
                                    type="number" 
                                    className="w-10 bg-transparent text-center font-bold focus:outline-none"
                                    value={q.timeLimit}
                                    onChange={(e) => handleUpdate(q.id, 'timeLimit', parseInt(e.target.value))}
                                />
                                <span className="text-xs">초</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setEditingId(editingId === q.id ? null : q.id)} className="p-2 text-blue-500 hover:bg-blue-50 rounded">
                                 <Edit3 className="w-4 h-4" />
                             </button>
                             <button onClick={() => handleDelete(q.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                 <Trash2 className="w-4 h-4" />
                             </button>
                        </div>
                    </div>

                    {/* Question Content */}
                    <div className="space-y-3">
                         <input 
                            value={q.question}
                            onChange={(e) => handleUpdate(q.id, 'question', e.target.value)}
                            className="w-full text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent border-b border-transparent focus:border-blue-500 focus:outline-none pb-1"
                         />
                         
                         {q.type === 'multiple-choice' && (
                             <div className="grid grid-cols-2 gap-3 mt-4">
                                 {q.options?.map((opt, i) => (
                                     <div key={i} className={`p-3 rounded-lg border flex items-center gap-2 ${opt === q.correctAnswer ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                                         <span className="w-6 h-6 rounded-full bg-white border flex items-center justify-center text-xs font-bold text-slate-500">
                                             {i + 1}
                                         </span>
                                         <input 
                                            value={opt}
                                            onChange={(e) => {
                                                const newOptions = [...(q.options || [])];
                                                newOptions[i] = e.target.value;
                                                handleUpdate(q.id, 'options', newOptions);
                                            }}
                                            className="flex-1 bg-transparent text-sm focus:outline-none"
                                         />
                                     </div>
                                 ))}
                             </div>
                         )}
                         {q.type === 'short-answer' && (
                             <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 font-bold">
                                 정답: <input value={q.correctAnswer} onChange={(e) => handleUpdate(q.id, 'correctAnswer', e.target.value)} className="bg-transparent focus:outline-none" />
                             </div>
                         )}
                         
                         <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm text-slate-600 dark:text-slate-400">
                             <span className="font-bold block mb-1 text-slate-700 dark:text-slate-300">💡 해설</span>
                             <textarea 
                                value={q.explanation}
                                onChange={(e) => handleUpdate(q.id, 'explanation', e.target.value)}
                                className="w-full bg-transparent resize-none focus:outline-none h-16"
                             />
                         </div>
                    </div>

                    {/* AI Modify Panel */}
                    {editingId === q.id && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                            <input 
                                value={regenPrompt}
                                onChange={(e) => setRegenPrompt(e.target.value)}
                                placeholder="AI에게 수정 요청 (예: 좀 더 어렵게 만들어줘, 보기를 헷갈리게 해줘)"
                                className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                            <button 
                                onClick={() => handleRegenerate(q)}
                                disabled={isRegenerating}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
                            >
                                <RefreshCcw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
                                AI 수정
                            </button>
                        </div>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
};
