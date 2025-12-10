
import React, { useState, useEffect, useRef } from 'react';
import { QuizQuestion, Participant, QuizState, Slide, WinnerPoster, QuizReport } from '../types';
import { generateWinnerPoster, generateReportInfographic } from '../services/geminiService';
import { saveImageToPdf, saveReportToPdf } from '../services/pdfService';
import { QRCodeSVG } from 'qrcode.react';
import { Chart } from 'chart.js/auto';
import { Users, Timer, Trophy, CheckCircle, XCircle, Download, FileText, Camera, Volume2, VolumeX } from 'lucide-react';

interface LiveSessionProps {
  questions: QuizQuestion[];
  slides: Slide[];
}

// URLs for Audio
const BGM_URL = "https://upload.wikimedia.org/wikipedia/commons/5/5e/Drum_beat.ogg"; // Urgent drum beat loop
const RANK_SFX = "https://upload.wikimedia.org/wikipedia/commons/3/34/Sound_Effect_-_Fanfare.ogg"; // Fanfare for ranking
const WIN_SFX = "https://upload.wikimedia.org/wikipedia/commons/9/9f/Applause_cheering.ogg"; // Cheering for final result

export const LiveSession: React.FC<LiveSessionProps> = ({ questions, slides }) => {
  // --- State ---
  const [gameState, setGameState] = useState<QuizState>({
    status: 'lobby',
    currentQuestionIndex: 0,
    startTime: 0,
    timerActive: false
  });
  
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showRankPopup, setShowRankPopup] = useState(false);
  const [winnerData, setWinnerData] = useState<WinnerPoster>({ companyName: '', winnerName: '', winnerPhoto: '' });
  const [generatedPoster, setGeneratedPoster] = useState<string | null>(null);
  const [report, setReport] = useState<QuizReport | null>(null);
  const [isGeneratingFinals, setIsGeneratingFinals] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const channelRef = useRef<BroadcastChannel | null>(null);
  const timerRef = useRef<any>(null);
  const chartRef = useRef<any>(null);

  // Audio Refs
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const rankSfxRef = useRef<HTMLAudioElement | null>(null);
  const winSfxRef = useRef<HTMLAudioElement | null>(null);

  // --- Audio Setup ---
  useEffect(() => {
    bgmRef.current = new Audio(BGM_URL);
    bgmRef.current.loop = true;
    bgmRef.current.volume = 0.4;

    rankSfxRef.current = new Audio(RANK_SFX);
    rankSfxRef.current.volume = 0.6;

    winSfxRef.current = new Audio(WIN_SFX);
    winSfxRef.current.volume = 0.8;

    return () => {
        bgmRef.current?.pause();
        rankSfxRef.current?.pause();
        winSfxRef.current?.pause();
    };
  }, []);

  // --- Audio Logic ---
  useEffect(() => {
      if (isMuted) {
          bgmRef.current?.pause();
          return;
      }

      // BGM Logic: Play only when status is 'playing' (question is active)
      if (gameState.status === 'playing') {
          bgmRef.current?.play().catch(e => console.log("Audio play failed (autoplay policy):", e));
      } else {
          bgmRef.current?.pause();
          if (bgmRef.current) bgmRef.current.currentTime = 0;
      }

      // Win SFX Logic
      if (gameState.status === 'final-result') {
          winSfxRef.current?.play().catch(() => {});
      }
  }, [gameState.status, isMuted]);

  // Rank SFX Logic
  useEffect(() => {
      if (showRankPopup && !isMuted) {
          rankSfxRef.current?.play().catch(() => {});
      }
  }, [showRankPopup, isMuted]);


  // --- Broadcast Channel Setup ---
  useEffect(() => {
    const channel = new BroadcastChannel('quiz_channel');
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'JOIN') {
        const newP: Participant = { id: payload.id, name: payload.name, score: 0, answers: {} };
        setParticipants(prev => {
            if(prev.find(p => p.id === newP.id)) return prev;
            return [...prev, newP];
        });
      } else if (type === 'SUBMIT_ANSWER') {
        const { playerId, answer, timeTaken } = payload;
        setParticipants(prev => prev.map(p => {
          if (p.id === playerId) {
             const currentQ = questions[gameState.currentQuestionIndex];
             const isCorrect = answer === currentQ.correctAnswer;
             // Score logic: 500 for correct + up to 500 for speed
             const speedBonus = isCorrect ? Math.max(0, Math.floor(500 * (1 - timeTaken / currentQ.timeLimit))) : 0;
             const points = isCorrect ? 500 + speedBonus : 0;
             
             return {
                 ...p,
                 score: p.score + points,
                 answers: {
                     ...p.answers,
                     [currentQ.id]: { answer, isCorrect, timeTaken }
                 }
             };
          }
          return p;
        }));
      }
    };

    return () => {
       channel.close();
       if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.currentQuestionIndex, questions]);

  // --- Sync State to Channel ---
  useEffect(() => {
    channelRef.current?.postMessage({
        type: 'STATE_UPDATE',
        payload: {
            gameState,
            currentQuestion: questions[gameState.currentQuestionIndex],
            totalQuestions: questions.length
        }
    });
  }, [gameState]);

  // --- Timer Logic ---
  useEffect(() => {
    if (gameState.timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (gameState.timerActive && timeLeft === 0) {
      // Time's up
      setGameState(prev => ({ ...prev, timerActive: false, status: 'question-result' }));
    }
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, gameState.timerActive]);

  // --- Actions ---

  const startGame = () => {
    setGameState({
        status: 'playing',
        currentQuestionIndex: 0,
        startTime: Date.now(),
        timerActive: true
    });
    setTimeLeft(questions[0].timeLimit);
  };

  const nextQuestion = () => {
      if (gameState.currentQuestionIndex < questions.length - 1) {
          const nextIdx = gameState.currentQuestionIndex + 1;
          setGameState({
              status: 'playing',
              currentQuestionIndex: nextIdx,
              startTime: Date.now(),
              timerActive: true
          });
          setTimeLeft(questions[nextIdx].timeLimit);
          setShowRankPopup(false);
      } else {
          setGameState(prev => ({ ...prev, status: 'final-result', timerActive: false }));
      }
  };

  const handleRevealAnswer = () => {
      // Logic handled by changing status to question-result, which triggers reveal in UI
      channelRef.current?.postMessage({
          type: 'REVEAL_ANSWER',
          payload: { correctAnswer: questions[gameState.currentQuestionIndex].correctAnswer }
      });
  };

  const handleShowRank = () => {
      setShowRankPopup(true);
  };

  // --- Winner & Report ---
  const handleWinnerPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onload = () => setWinnerData(prev => ({ ...prev, winnerPhoto: reader.result as string }));
          reader.readAsDataURL(file);
      }
  };

  const generateFinals = async () => {
      setIsGeneratingFinals(true);
      try {
          // Poster
          if (winnerData.winnerPhoto) {
              const posterUrl = await generateWinnerPoster(winnerData);
              setGeneratedPoster(posterUrl);
          }
          // Report
          const reportData = await generateReportInfographic(slides, questions);
          setReport({ summaryInfographic: reportData.image, textReport: reportData.text });
          
      } catch (e) {
          console.error(e);
          alert("생성 중 오류 발생");
      } finally {
          setIsGeneratingFinals(false);
      }
  };
  
  const downloadAll = () => {
      if (!report || !generatedPoster) return;
      saveReportToPdf({
          report,
          poster: generatedPoster,
          rankings: participants.sort((a,b) => b.score - a.score)
      });
  };

  // --- Renders ---

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score);
  const currentQ = questions[gameState.currentQuestionIndex];

  // Render Bar Chart for Multiple Choice stats
  useEffect(() => {
    if (gameState.status === 'question-result' && currentQ.type === 'multiple-choice') {
        const ctx = document.getElementById('resultChart') as HTMLCanvasElement;
        if (ctx) {
            if (chartRef.current) chartRef.current.destroy();
            
            const counts = currentQ.options?.map(opt => 
                participants.filter(p => p.answers[currentQ.id]?.answer === opt).length
            );

            chartRef.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: currentQ.options?.map((_, i) => `${i+1}번`),
                    datasets: [{
                        label: '응답 수',
                        data: counts,
                        backgroundColor: currentQ.options?.map(opt => opt === currentQ.correctAnswer ? '#22c55e' : '#94a3b8'),
                        borderRadius: 8
                    }]
                },
                options: { animation: { duration: 1000 } }
            });
        }
    }
  }, [gameState.status, currentQ, participants]);

  if (gameState.status === 'lobby') {
    const joinLink = window.location.href + '?mode=student';
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-white p-8">
         <h1 className="text-4xl font-black mb-8 animate-bounce">Quiz Lobby</h1>
         
         <div className="flex gap-12 items-center mb-12">
             <div className="bg-white p-4 rounded-xl">
                 <QRCodeSVG value={joinLink} size={200} />
             </div>
             <div className="text-left">
                 <p className="text-2xl font-bold mb-2">Join at:</p>
                 <p className="text-blue-400 text-xl underline mb-4">{joinLink}</p>
                 <p className="text-slate-400">QR코드를 찍거나 주소로 접속하세요.</p>
             </div>
         </div>

         <div className="w-full max-w-4xl bg-slate-800 rounded-2xl p-6 min-h-[200px]">
             <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                 <Users className="w-5 h-5 text-green-400" />
                 참가자 ({participants.length})
             </h2>
             <div className="flex flex-wrap gap-3">
                 {participants.map(p => (
                     <div key={p.id} className="bg-slate-700 px-4 py-2 rounded-full font-bold animate-in zoom-in">
                         {p.name}
                     </div>
                 ))}
             </div>
         </div>

         <button onClick={startGame} className="mt-8 bg-blue-600 hover:bg-blue-500 text-white px-12 py-4 rounded-full text-2xl font-bold shadow-lg shadow-blue-600/50 transition-all hover:scale-105">
             Quiz Start!
         </button>
      </div>
    );
  }

  if (gameState.status === 'playing' || gameState.status === 'question-result') {
      return (
          <div className="h-full flex flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden relative">
              {/* Header */}
              <div className="h-20 bg-white dark:bg-slate-800 flex items-center justify-between px-8 shadow-sm z-10 pl-16">
                  <div className="text-2xl font-black text-slate-800 dark:text-white">Q{gameState.currentQuestionIndex + 1}</div>
                  <div className={`text-4xl font-mono font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
                      {timeLeft}s
                  </div>
                  <div className="flex items-center gap-4">
                      <button onClick={() => setIsMuted(!isMuted)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                          {isMuted ? <VolumeX className="w-6 h-6 text-slate-400" /> : <Volume2 className="w-6 h-6 text-slate-700 dark:text-slate-200" />}
                      </button>
                      <div className="text-sm font-medium text-slate-500">
                          응답: {participants.filter(p => p.answers[currentQ.id]).length} / {participants.length}
                      </div>
                  </div>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
                  <div className="w-full max-w-5xl bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 mb-6">
                      <h2 className="text-3xl font-bold text-center leading-snug text-slate-800 dark:text-white mb-8">
                          {currentQ.question}
                      </h2>
                      
                      {currentQ.type === 'multiple-choice' ? (
                          <div className="grid grid-cols-2 gap-4">
                              {currentQ.options?.map((opt, i) => (
                                  <div key={i} className={`p-6 rounded-xl border-2 text-xl font-bold transition-all
                                      ${gameState.status === 'question-result' && opt === currentQ.correctAnswer 
                                          ? 'bg-green-100 border-green-500 text-green-800' 
                                          : 'bg-slate-50 border-slate-200 text-slate-600'}
                                  `}>
                                      {gameState.status === 'question-result' && (
                                          <div className="h-2 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                              <div 
                                                className="h-full bg-blue-500" 
                                                style={{ width: `${(participants.filter(p => p.answers[currentQ.id]?.answer === opt).length / participants.length) * 100}%` }} 
                                              />
                                          </div>
                                      )}
                                      {i + 1}. {opt}
                                  </div>
                              ))}
                          </div>
                      ) : (
                          <div className="text-center">
                              {gameState.status === 'question-result' && (
                                  <div className="text-4xl font-black text-green-600 animate-bounce">
                                      정답: {currentQ.correctAnswer}
                                  </div>
                              )}
                          </div>
                      )}
                  </div>

                  {gameState.status === 'question-result' && (
                      <div className="w-full max-w-5xl bg-blue-50 dark:bg-slate-800/50 border border-blue-200 rounded-xl p-6 animate-in slide-in-from-bottom-10">
                          <h3 className="font-bold text-blue-800 dark:text-blue-300 mb-2">💡 해설</h3>
                          <p className="text-lg text-slate-700 dark:text-slate-300">{currentQ.explanation}</p>
                      </div>
                  )}
                  
                  {gameState.status === 'question-result' && currentQ.type === 'multiple-choice' && (
                     <div className="w-full max-w-2xl mt-8">
                         <canvas id="resultChart"></canvas>
                     </div>
                  )}
              </div>

              {/* Controls */}
              <div className="h-24 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-4 px-8">
                  {gameState.status === 'playing' ? (
                      <button onClick={() => setGameState(prev => ({ ...prev, status: 'question-result', timerActive: false }))} className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-bold text-xl">
                          정답 확인 (Stop)
                      </button>
                  ) : (
                      <>
                        <button onClick={handleShowRank} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-bold text-xl flex items-center gap-2">
                             <Trophy className="w-5 h-5" /> 순위 보기
                        </button>
                        <button onClick={nextQuestion} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-xl flex items-center gap-2">
                             다음 문제 <CheckCircle className="w-5 h-5" />
                        </button>
                      </>
                  )}
              </div>

              {/* Rank Popup */}
              {showRankPopup && (
                  <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowRankPopup(false)}>
                      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden animate-in zoom-in">
                          <div className="bg-purple-600 p-6 text-white text-center font-bold text-2xl">
                              Leaderboard
                          </div>
                          <div className="p-4">
                              {sortedParticipants.slice(0, 5).map((p, i) => (
                                  <div key={p.id} className="flex items-center justify-between p-4 border-b last:border-0">
                                      <div className="flex items-center gap-4">
                                          <span className={`text-2xl font-black w-8 ${i===0 ? 'text-yellow-500' : 'text-slate-400'}`}>{i+1}</span>
                                          <span className="text-xl font-bold text-slate-800">{p.name}</span>
                                      </div>
                                      <span className="text-xl font-bold text-purple-600">{p.score} pts</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  // Final Result
  return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto p-8 relative">
          
          <button 
              onClick={() => setIsMuted(!isMuted)} 
              className="absolute top-8 right-8 p-3 rounded-full bg-white dark:bg-slate-800 shadow-lg z-10 hover:bg-slate-50"
          >
              {isMuted ? <VolumeX className="w-6 h-6 text-slate-400" /> : <Volume2 className="w-6 h-6 text-slate-700 dark:text-slate-200" />}
          </button>

          <div className="max-w-4xl mx-auto space-y-8">
              <h1 className="text-4xl font-black text-center text-slate-800 dark:text-white">최종 결과 (Final Result)</h1>
              
              {/* Winner Section */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 shadow-xl border-2 border-yellow-400">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-yellow-600">
                      <Trophy className="w-8 h-8 fill-yellow-400" /> 오늘의 Winner
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                          <div className="text-4xl font-black text-slate-800 dark:text-white">
                              1위: {sortedParticipants[0]?.name || "None"}
                          </div>
                          <div className="space-y-3">
                             <input 
                                placeholder="회사명 / 소속" 
                                className="w-full p-3 border rounded-lg"
                                value={winnerData.companyName}
                                onChange={e => setWinnerData(prev => ({ ...prev, companyName: e.target.value }))}
                             />
                             <input 
                                placeholder="Winner 이름 (영문 권장)" 
                                className="w-full p-3 border rounded-lg"
                                value={winnerData.winnerName}
                                onChange={e => setWinnerData(prev => ({ ...prev, winnerName: e.target.value }))}
                             />
                             <label className="block w-full p-4 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-slate-50">
                                 <Camera className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                                 <span className="text-sm text-slate-500">{winnerData.winnerPhoto ? '사진 변경' : 'Winner 사진 업로드'}</span>
                                 <input type="file" className="hidden" accept="image/*" onChange={handleWinnerPhotoUpload} />
                             </label>
                             {winnerData.winnerPhoto && <img src={winnerData.winnerPhoto} className="h-20 object-cover rounded mx-auto" alt="preview" />}
                          </div>
                      </div>
                      <div className="flex items-center justify-center bg-slate-100 rounded-xl min-h-[300px] relative overflow-hidden">
                          {generatedPoster ? (
                              <img src={generatedPoster} className="w-full h-full object-cover" alt="Winner Poster" />
                          ) : (
                              <div className="text-center text-slate-400">
                                  <Trophy className="w-16 h-16 mx-auto mb-2 opacity-20" />
                                  <p>AI 포스터가 여기에 생성됩니다.</p>
                              </div>
                          )}
                      </div>
                  </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                  <button 
                    onClick={generateFinals}
                    disabled={isGeneratingFinals}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all"
                  >
                     {isGeneratingFinals ? 'AI Report & Poster 생성 중...' : 'AI Report & Winner Poster 생성'}
                  </button>
                  {report && generatedPoster && (
                      <button 
                        onClick={downloadAll}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                      >
                         <Download className="w-6 h-6" /> PDF 다운로드
                      </button>
                  )}
              </div>
              
              {/* Report Preview */}
              {report && (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg">
                      <h3 className="text-xl font-bold mb-4">AI Report Preview</h3>
                      <div className="grid grid-cols-2 gap-8">
                          <img src={report.summaryInfographic} className="w-full rounded-lg shadow-md" alt="Info" />
                          <div className="prose dark:prose-invert text-sm max-h-[500px] overflow-y-auto whitespace-pre-wrap">
                              {report.textReport}
                          </div>
                      </div>
                  </div>
              )}
          </div>
      </div>
  );
};
