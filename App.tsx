
import React, { useState, useEffect, useRef } from 'react';
import { QuizConfig, Slide, QuizQuestion, ExtractedContent } from './types';
import { processFileToSlides } from './services/pdfService';
import { generateQuizQuestions, generateQuizFromText } from './services/geminiService';
import { PageSelector } from './components/PageSelector';
import { QuizConfigPanel } from './components/QuizConfig.tsx';
import { QuizEditor } from './components/QuizEditor.tsx';
import { LiveSession } from './components/LiveSession.tsx';
import { FileText, Moon, Sun, MonitorPlay, GraduationCap, ChevronLeft, ChevronRight, Menu } from 'lucide-react';

// Student Component (Inline for simplicity)
const StudentView = () => {
    const [name, setName] = useState('');
    const [joined, setJoined] = useState(false);
    const [currentQ, setCurrentQ] = useState<QuizQuestion | null>(null);
    const [qIndex, setQIndex] = useState(0);
    const [gameState, setGameState] = useState<any>({ status: 'lobby' });
    const [myAnswer, setMyAnswer] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<any>(null); // { isCorrect, correctAnswer }
    const channelRef = useRef<BroadcastChannel | null>(null);
    const idRef = useRef(crypto.randomUUID());

    useEffect(() => {
        const ch = new BroadcastChannel('quiz_channel');
        channelRef.current = ch;
        ch.onmessage = (e) => {
            const { type, payload } = e.data;
            if (type === 'STATE_UPDATE') {
                setGameState(payload.gameState);
                setCurrentQ(payload.currentQuestion);
                setQIndex(payload.gameState.currentQuestionIndex);
                if (payload.gameState.status === 'playing') {
                    setFeedback(null); // Reset feedback for new question
                }
            } else if (type === 'REVEAL_ANSWER') {
                setFeedback({ correctAnswer: payload.correctAnswer });
            }
        };
        return () => ch.close();
    }, []);

    const join = () => {
        if(!name) return;
        channelRef.current?.postMessage({ type: 'JOIN', payload: { id: idRef.current, name } });
        setJoined(true);
    };

    const submitAnswer = (ans: string) => {
        if (!currentQ || myAnswer) return;
        setMyAnswer(ans);
        // Calculate rough time taken (client side est)
        const timeTaken = Math.floor((Date.now() - gameState.startTime) / 1000);
        channelRef.current?.postMessage({
            type: 'SUBMIT_ANSWER',
            payload: { playerId: idRef.current, answer: ans, timeTaken }
        });
    };
    
    // Clear answer when question changes
    useEffect(() => {
        if (gameState.status === 'playing') {
            setMyAnswer(null);
            setFeedback(null);
        }
    }, [gameState.currentQuestionIndex, gameState.status]);

    if (!joined) {
        return (
            <div className="h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm text-center">
                    <GraduationCap className="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                    <h1 className="text-2xl font-bold mb-6 text-slate-800">Learning Quiz Join</h1>
                    <input 
                        value={name} onChange={e => setName(e.target.value)}
                        placeholder="이름을 입력하세요"
                        className="w-full p-4 bg-slate-100 rounded-xl mb-4 text-center text-lg font-bold"
                    />
                    <button onClick={join} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg">
                        입장하기
                    </button>
                </div>
            </div>
        );
    }

    if (gameState.status === 'lobby') {
        return (
             <div className="h-screen bg-slate-900 text-white flex flex-col items-center justify-center">
                 <div className="animate-pulse text-2xl font-bold">퀴즈 시작 대기중...</div>
                 <div className="mt-4 text-slate-400">호스트가 시작하면 문제가 화면에 나타납니다.</div>
             </div>
        );
    }

    if (gameState.status === 'final-result') {
        return (
            <div className="h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8 text-center">
                <h1 className="text-3xl font-bold mb-4">Quiz Finished!</h1>
                <p>관리자 화면에서 결과를 확인하세요.</p>
            </div>
        );
    }

    return (
        <div className="h-screen bg-slate-100 flex flex-col font-sans">
            <div className="bg-white p-4 shadow-sm text-center font-bold text-lg">Q{qIndex + 1}</div>
            <div className="flex-1 p-6 flex flex-col justify-center">
                 {currentQ ? (
                     <>
                        <h2 className="text-xl font-bold text-slate-800 mb-8 leading-relaxed">{currentQ.question}</h2>
                        
                        {currentQ.type === 'multiple-choice' ? (
                            <div className="space-y-3">
                                {currentQ.options.map((opt: string) => {
                                    let style = "bg-white border-2 border-slate-200 text-slate-700";
                                    if (myAnswer === opt) style = "bg-blue-600 border-blue-600 text-white";
                                    // Result Reveal
                                    if (feedback) {
                                        if (opt === feedback.correctAnswer) style = "bg-green-500 border-green-500 text-white";
                                        else if (myAnswer === opt && opt !== feedback.correctAnswer) style = "bg-red-500 border-red-500 text-white";
                                        else style = "opacity-50 bg-slate-100";
                                    }

                                    return (
                                        <button 
                                            key={opt}
                                            disabled={!!myAnswer || !!feedback}
                                            onClick={() => submitAnswer(opt)}
                                            className={`w-full p-4 rounded-xl text-left font-bold transition-all ${style}`}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center">
                                <p className="text-slate-500 mb-4">단답형 문제입니다.</p>
                                {/* Simple implementation for short answer visualization */}
                                {feedback ? (
                                    <div className="text-2xl font-bold text-green-600">정답: {feedback.correctAnswer}</div>
                                ) : (
                                    <div className="text-slate-400">화면을 보고 답을 생각하세요!</div>
                                )}
                            </div>
                        )}

                        {feedback && (
                            <div className="mt-6 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm animate-in fade-in">
                                <span className="font-bold mr-2">해설:</span>
                                {currentQ.explanation}
                            </div>
                        )}
                     </>
                 ) : <div>Loading...</div>}
            </div>
        </div>
    );
};


const App: React.FC = () => {
  // Check URL for student mode
  const [isStudent, setIsStudent] = useState(false);
  
  useEffect(() => {
     const params = new URLSearchParams(window.location.search);
     if (params.get('mode') === 'student') {
         setIsStudent(true);
     }
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'live'>('editor');
  
  // Sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Auto collapse sidebar when entering Live mode
  useEffect(() => {
      if (activeTab === 'live') {
          setIsSidebarCollapsed(true);
      }
  }, [activeTab]);

  const [quizConfig, setQuizConfig] = useState<QuizConfig>({
      multipleChoiceCount: 5,
      shortAnswerCount: 2,
      difficulty: 'Medium'
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // URL 관련 상태
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [isExtractingUrl, setIsExtractingUrl] = useState(false);

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // 공통 파일 처리 함수 (기존 슬라이드에 추가)
  const processFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(file =>
      file.type === 'application/pdf' || file.type.startsWith('image/')
    );

    if (validFiles.length === 0) {
      alert('PDF 또는 이미지 파일만 업로드 가능합니다.');
      return;
    }

    setIsProcessing(true);
    try {
      const results = await Promise.all(validFiles.map((file: File) => processFileToSlides(file)));
      const newSlides = results.flat();
      setSlides(prev => {
        const startIndex = prev.length;
        const indexedNewSlides = newSlides.map((s, i) => ({ ...s, pageIndex: startIndex + i + 1 }));
        return [...prev, ...indexedNewSlides];
      });
    } catch (error) {
      alert('파일 처리 실패');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFiles(files);
    e.target.value = '';
  };

  // 드래그 앤 드롭 핸들러
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn || isProcessing) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 자식 요소로 이동할 때 dragLeave가 발생하지 않도록 체크
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (!isLoggedIn || isProcessing) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(files);
    }
  };

  const toggleSlideSelection = (id: string) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, selected: !s.selected } : s));
  };
  
  const handleSelectAll = (select: boolean) => {
      setSlides(prev => prev.map(s => ({ ...s, selected: select })));
  };

  // URL 콘텐츠 추출 핸들러
  const handleUrlSubmit = async (url: string) => {
    setIsExtractingUrl(true);
    try {
      const response = await fetch('/api/extract-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const result = await response.json();

      if (!result.success) {
        alert(result.error || '콘텐츠 추출 실패');
        return;
      }

      setExtractedContent(result);
    } catch (error) {
      console.error('URL extraction error:', error);
      alert('URL 콘텐츠 추출 중 오류가 발생했습니다.');
    } finally {
      setIsExtractingUrl(false);
    }
  };

  const handleGenerateQuiz = async () => {
      setIsGenerating(true);
      try {
          let qs: QuizQuestion[];

          // 추출된 URL 콘텐츠가 있으면 텍스트 기반 퀴즈 생성
          if (extractedContent) {
            qs = await generateQuizFromText(extractedContent, quizConfig);
          } else {
            // 슬라이드 기반 퀴즈 생성
            qs = await generateQuizQuestions(slides, quizConfig);
          }

          setQuestions(qs);
          setActiveTab('editor');
      } catch (e) {
          alert('퀴즈 생성 실패');
      } finally {
          setIsGenerating(false);
      }
  };

  if (isStudent) {
      return <StudentView />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 z-20 relative">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-md">
                <GraduationCap className="w-5 h-5" />
            </div>
            <div>
                <h1 className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">
                Learning Quiz <span className="text-indigo-600">AI</span>
                </h1>
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        
        {/* Sidebar Container with Transition */}
        <div 
            className={`flex transition-all duration-300 ease-in-out ${isSidebarCollapsed ? '-ml-[640px]' : 'ml-0'}`}
        >
            {/* COLUMN 1: File Upload & Slides (320px) */}
            <div className="w-[320px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800">
                <PageSelector
                    slides={slides}
                    onToggleSlide={toggleSlideSelection}
                    onSelectAll={handleSelectAll}
                    onFileUpload={handleFileUpload}
                    isProcessing={isProcessing}
                    isLoggedIn={isLoggedIn}
                    onLogin={() => setIsLoggedIn(true)}
                    isDragging={isDragging}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onUrlSubmit={handleUrlSubmit}
                    isExtractingUrl={isExtractingUrl}
                    extractedContent={extractedContent ? { type: extractedContent.type, title: extractedContent.title } : null}
                />
            </div>

            {/* COLUMN 2: Admin Login & Config (320px) */}
            <div className="w-[320px] shrink-0 h-full border-r border-slate-200 dark:border-slate-800">
                <QuizConfigPanel
                    config={quizConfig}
                    onChange={setQuizConfig}
                    onGenerate={handleGenerateQuiz}
                    isGenerating={isGenerating}
                    hasSlides={slides.some(s => s.selected) || !!extractedContent}
                    isLoggedIn={isLoggedIn}
                    onLogin={() => setIsLoggedIn(true)}
                />
            </div>
        </div>

        {/* COLUMN 3: Workspace (Flexible) */}
        <div className="flex-1 bg-slate-50 dark:bg-slate-950 overflow-hidden flex flex-col relative">
            
            {/* Sidebar Toggle Button */}
            <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="absolute top-4 left-4 z-30 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-slate-600 dark:text-slate-300"
                title={isSidebarCollapsed ? "메뉴 열기" : "메뉴 닫기"}
            >
                {isSidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>

            {questions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center animate-in fade-in">
                    <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                        <MonitorPlay className="w-10 h-10 opacity-30" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 text-slate-600 dark:text-slate-300">퀴즈가 아직 없습니다</h3>
                    <p className="max-w-md">
                        좌측 패널에서 자료를 업로드하고 설정을 마친 후<br/> 
                        <span className="font-bold text-indigo-500">Learning Quiz 생성</span> 버튼을 눌러주세요.
                    </p>
                </div>
            ) : (
                activeTab === 'editor' ? (
                    <QuizEditor 
                        questions={questions} 
                        setQuestions={setQuestions} 
                        slides={slides}
                        onStartQuiz={() => setActiveTab('live')} 
                    />
                ) : (
                    <LiveSession questions={questions} slides={slides} />
                )
            )}
        </div>
      </main>
    </div>
  );
};

export default App;
