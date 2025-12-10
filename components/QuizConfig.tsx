
import React, { useState } from 'react';
import { QuizConfig, Difficulty } from '../types';
import { Settings2, Zap, Key, Lock, Unlock, LogIn } from 'lucide-react';
import { openApiKeyDialog } from '../services/geminiService';

interface QuizConfigProps {
  config: QuizConfig;
  onChange: (config: QuizConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  hasSlides: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
}

export const QuizConfigPanel: React.FC<QuizConfigProps> = ({ 
    config, onChange, onGenerate, isGenerating, hasSlides, isLoggedIn, onLogin 
}) => {
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(false);

  const handleLoginSubmit = () => {
    if (password === '6749467') {
      onLogin();
      setLoginError(false);
    } else {
      setLoginError(true);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl relative z-20">
       
       {/* 1. Admin Login Section */}
       <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 shrink-0">
         <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
             {isLoggedIn ? <Unlock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-slate-500" />}
             관리자 접속
         </h2>
         
         {!isLoggedIn ? (
           <div className="space-y-2">
             <input 
                 type="password"
                 placeholder="비밀번호 입력"
                 value={password}
                 onChange={(e) => { setPassword(e.target.value); setLoginError(false); }}
                 onKeyDown={(e) => e.key === 'Enter' && handleLoginSubmit()}
                 className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
             />
             {loginError && <p className="text-xs text-red-500 font-medium">비밀번호가 올바르지 않습니다.</p>}
             <button 
                 onClick={handleLoginSubmit}
                 className="w-full py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2"
             >
                 <LogIn className="w-3 h-3" /> 로그인
             </button>
           </div>
         ) : (
              <div className="text-xs text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg border border-green-100 flex items-center gap-2">
                  <CheckCircleIcon className="w-3 h-3" />
                  관리자 권한 인증됨
              </div>
         )}
       </div>

       {/* 2. API Key Section */}
       <div className={`p-5 border-b border-slate-200 dark:border-slate-800 transition-opacity ${!isLoggedIn ? 'opacity-50 pointer-events-none' : ''}`}>
          <button 
             onClick={openApiKeyDialog}
             className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
             <Key className="w-4 h-4" /> Gemini API Key 설정
          </button>
       </div>

       <div className={`p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 transition-opacity ${!isLoggedIn ? 'opacity-50 pointer-events-none' : ''}`}>
          <h2 className="font-bold text-slate-800 dark:text-slate-100 text-base uppercase tracking-wider flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> 퀴즈 설정
          </h2>
       </div>

       <div className={`p-6 space-y-8 flex-1 overflow-y-auto transition-opacity ${!isLoggedIn ? 'opacity-50 pointer-events-none' : ''}`}>
          
          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                난이도 (Difficulty)
            </label>
            <div className="flex gap-2">
                {(['High', 'Medium', 'Low'] as Difficulty[]).map(level => (
                    <button
                        key={level}
                        onClick={() => onChange({ ...config, difficulty: level })}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg border transition-all
                            ${config.difficulty === level 
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}
                        `}
                    >
                        {level === 'High' ? '상' : level === 'Medium' ? '중' : '하'}
                    </button>
                ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                객관식 문제 수 (4지선다)
            </label>
            <input 
                type="range" 
                min="0" max="10" step="1"
                value={config.multipleChoiceCount}
                onChange={(e) => onChange({...config, multipleChoiceCount: parseInt(e.target.value)})}
                className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-right font-mono text-indigo-600 font-bold">{config.multipleChoiceCount} 문제</div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                주관식 문제 수 (단답형)
            </label>
            <input 
                type="range" 
                min="0" max="10" step="1"
                value={config.shortAnswerCount}
                onChange={(e) => onChange({...config, shortAnswerCount: parseInt(e.target.value)})}
                className="w-full accent-pink-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="text-right font-mono text-pink-600 font-bold">{config.shortAnswerCount} 문제</div>
          </div>

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
            <button
                onClick={onGenerate}
                disabled={isGenerating || !hasSlides}
                className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
                    ${isGenerating || !hasSlides
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white transform hover:-translate-y-1'}
                `}
            >
                {isGenerating ? (
                    '문제 출제 중...'
                ) : (
                    <>
                        <Zap className="w-5 h-5 fill-current" /> Learning Quiz 생성
                    </>
                )}
            </button>
            {!hasSlides && <p className="text-center text-xs text-red-400 mt-2">자료를 먼저 업로드하고 선택해주세요.</p>}
          </div>
       </div>
    </div>
  );
};

const CheckCircleIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);
