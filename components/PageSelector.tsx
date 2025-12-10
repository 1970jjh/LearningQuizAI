
import React, { useState } from 'react';
import { Slide } from '../types';
import { CheckCircle2, FileUp, CheckSquare, Square, Lock, Upload, Link2, Youtube, Globe, Loader2 } from 'lucide-react';

interface PageSelectorProps {
  slides: Slide[];
  onToggleSlide: (id: string) => void;
  onSelectAll: (select: boolean) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isProcessing: boolean;
  isLoggedIn: boolean;
  onLogin: () => void;
  isDragging: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  // URL 관련 props
  onUrlSubmit: (url: string) => Promise<void>;
  isExtractingUrl: boolean;
  extractedContent: { type: 'webpage' | 'youtube'; title: string } | null;
}

export const PageSelector: React.FC<PageSelectorProps> = ({
  slides,
  onToggleSlide,
  onSelectAll,
  onFileUpload,
  isProcessing,
  isLoggedIn,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onUrlSubmit,
  isExtractingUrl,
  extractedContent,
}) => {
  const [urlInput, setUrlInput] = useState('');

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    await onUrlSubmit(urlInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isExtractingUrl) {
      handleUrlSubmit();
    }
  };

  const isYoutubeUrl = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-colors relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* 드래그 앤 드롭 오버레이 */}
      {isDragging && isLoggedIn && (
        <div className="absolute inset-0 z-50 bg-blue-500/90 dark:bg-blue-600/90 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl text-center transform scale-100 animate-pulse">
            <Upload className="w-16 h-16 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
            <p className="text-xl font-bold text-slate-800 dark:text-white mb-2">파일을 여기에 놓으세요</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">PDF, 이미지 파일 (여러 개 가능)</p>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-950">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-3">
            <FileUp className="w-4 h-4" /> 학습 자료 업로드
        </h2>

        {!isLoggedIn && (
            <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                <Lock className="w-3 h-3" />
                <span>우측 패널에서 관리자 로그인 후 이용 가능합니다.</span>
            </div>
        )}

        <label className={`
          flex flex-col items-center justify-center gap-2 w-full py-6 px-4 rounded-xl border-2 border-dashed
          transition-all cursor-pointer shadow-sm relative overflow-hidden
          ${isProcessing
            ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-50'
            : !isLoggedIn
                ? 'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700 opacity-50 cursor-not-allowed'
                : 'bg-blue-50 dark:bg-slate-800 border-blue-200 dark:border-slate-700 hover:bg-blue-100 dark:hover:bg-slate-700 hover:border-blue-300'}
        `}>
          <FileUp className={`w-8 h-8 ${isLoggedIn ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
          <div className="flex flex-col items-center z-10">
             <span className={`font-bold text-base ${isLoggedIn ? 'text-blue-700 dark:text-blue-400' : 'text-slate-500'}`}>
                {isProcessing ? '파일 분석 중...' : 'PDF / 이미지 업로드'}
             </span>
             {isLoggedIn && !isProcessing && (
               <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                 클릭하거나 파일을 끌어다 놓으세요
               </span>
             )}
          </div>
          <input
            type="file"
            className="hidden"
            accept=".pdf,image/*"
            multiple
            onChange={onFileUpload}
            disabled={isProcessing || !isLoggedIn}
          />
        </label>

        {/* URL 입력 섹션 */}
        <div className="mt-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4" /> 웹페이지 / 유튜브 URL
            {urlInput && (
              isYoutubeUrl(urlInput) ? (
                <Youtube className="w-4 h-4 text-red-500" />
              ) : (
                <Globe className="w-4 h-4 text-blue-500" />
              )
            )}
          </h3>

          <div className={`flex gap-2 ${!isLoggedIn ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.youtube.com/watch?v="
              disabled={!isLoggedIn || isExtractingUrl}
              className="flex-1 px-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-slate-100"
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!isLoggedIn || isExtractingUrl || !urlInput.trim()}
              className={`px-3 py-2.5 rounded-lg font-bold transition-all flex items-center justify-center min-w-[44px]
                ${isExtractingUrl
                  ? 'bg-slate-200 dark:bg-slate-700 cursor-wait'
                  : urlInput.trim()
                    ? 'bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-700 dark:hover:bg-slate-200'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
            >
              {isExtractingUrl ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Link2 className="w-5 h-5" />
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            웹페이지 또는 유튜브 영상 내용을 분석하여 퀴즈 생성
          </p>

          {/* 추출된 콘텐츠 표시 */}
          {extractedContent && (
            <div className={`mt-3 p-3 rounded-lg border ${
              extractedContent.type === 'youtube'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
            }`}>
              <div className="flex items-center gap-2">
                {extractedContent.type === 'youtube' ? (
                  <Youtube className="w-4 h-4 text-red-500 shrink-0" />
                ) : (
                  <Globe className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {extractedContent.title}
                </span>
              </div>
            </div>
          )}
        </div>

        {slides.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">슬라이드 목록</h2>
                <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-full font-medium">
                    {slides.filter(s => s.selected).length} / {slides.length}
                </span>
            </div>
            
            <div className="flex gap-2">
                    <button 
                    onClick={() => onSelectAll(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                    <CheckSquare className="w-3.5 h-3.5" />
                    모두 선택
                    </button>
                    <button 
                    onClick={() => onSelectAll(false)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                    <Square className="w-3.5 h-3.5" />
                    해제
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Slide List - Expanded Area */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/50 ${!isLoggedIn ? 'opacity-30 pointer-events-none' : ''}`}>
        {slides.length === 0 ? (
           <div className="text-center py-20 text-slate-400 dark:text-slate-600">
              <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileUp className="w-8 h-8 opacity-30" />
              </div>
              <p className="text-sm font-medium">자료를 업로드하면<br/>여기에 표시됩니다.</p>
           </div>
        ) : (
          slides.map((slide) => (
            <div 
              key={slide.id}
              onClick={() => onToggleSlide(slide.id)}
              className={`
                group relative flex flex-col gap-2 p-3 rounded-xl cursor-pointer border-2 transition-all duration-200
                ${slide.selected 
                  ? 'bg-white dark:bg-slate-800 border-blue-600 shadow-lg ring-1 ring-blue-600/10' 
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-slate-600 hover:shadow-md'}
              `}
            >
              <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden shadow-inner">
                <img 
                  src={slide.originalImage} 
                  alt={`Page ${slide.pageIndex}`} 
                  className="w-full h-full object-contain bg-slate-200 dark:bg-slate-950"
                />
                <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-md">
                  P.{slide.pageIndex}
                </div>
                <div className={`absolute inset-0 transition-colors flex items-center justify-center
                   ${slide.selected ? 'bg-blue-600/10' : 'bg-transparent group-hover:bg-slate-900/5 dark:group-hover:bg-white/5'}
                `}>
                   {slide.selected && (
                      <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg transform scale-110">
                         <CheckCircle2 className="w-6 h-6" />
                      </div>
                   )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
