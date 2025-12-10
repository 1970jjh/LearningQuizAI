import type { VercelRequest, VercelResponse } from '@vercel/node';

interface ExtractResult {
  success: boolean;
  type: 'webpage' | 'youtube';
  title: string;
  content: string;
  error?: string;
}

// YouTube video ID 추출
function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// YouTube 자막 추출 (innertube API 사용)
async function fetchYoutubeTranscript(videoId: string): Promise<{ title: string; transcript: string }> {
  // 먼저 비디오 페이지에서 정보 추출
  const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  const html = await videoPageResponse.text();

  // 제목 추출
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  let title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'YouTube Video';

  // ytInitialPlayerResponse에서 자막 정보 추출
  const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
  if (!playerResponseMatch) {
    throw new Error('자막 정보를 찾을 수 없습니다. 자막이 있는 영상인지 확인해주세요.');
  }

  let playerResponse;
  try {
    playerResponse = JSON.parse(playerResponseMatch[1]);
  } catch {
    throw new Error('영상 정보 파싱 실패');
  }

  // 자막 트랙 URL 가져오기
  const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('이 영상에는 자막이 없습니다.');
  }

  // 한국어 자막 우선, 없으면 첫 번째 자막 사용
  let captionTrack = captionTracks.find((t: any) => t.languageCode === 'ko') || captionTracks[0];
  const captionUrl = captionTrack.baseUrl;

  // 자막 데이터 가져오기
  const captionResponse = await fetch(captionUrl);
  const captionXml = await captionResponse.text();

  // XML에서 텍스트 추출
  const textMatches = captionXml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
  const transcriptParts: string[] = [];

  for (const match of textMatches) {
    let text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();
    if (text) transcriptParts.push(text);
  }

  return {
    title,
    transcript: transcriptParts.join(' ')
  };
}

// 웹페이지 콘텐츠 추출
async function fetchWebpageContent(url: string): Promise<{ title: string; content: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
    }
  });

  if (!response.ok) {
    throw new Error(`웹페이지 접근 실패: ${response.status}`);
  }

  const html = await response.text();

  // 제목 추출
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled';

  // HTML에서 텍스트 콘텐츠 추출 (간단한 파서)
  let content = html
    // script, style, nav, footer, header 태그 제거
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '')
    // 주석 제거
    .replace(/<!--[\s\S]*?-->/g, '')
    // 모든 HTML 태그 제거
    .replace(/<[^>]+>/g, ' ')
    // HTML 엔티티 디코딩
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    // 연속 공백 정리
    .replace(/\s+/g, ' ')
    .trim();

  // 콘텐츠가 너무 길면 잘라내기 (약 15000자)
  if (content.length > 15000) {
    content = content.substring(0, 15000) + '...';
  }

  return { title, content };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'URL이 필요합니다' });
  }

  try {
    // YouTube URL인지 확인
    const youtubeId = extractYoutubeId(url);

    if (youtubeId) {
      // YouTube 자막 추출
      const { title, transcript } = await fetchYoutubeTranscript(youtubeId);

      if (!transcript || transcript.length < 50) {
        return res.status(400).json({
          success: false,
          error: '자막 내용이 너무 짧습니다. 다른 영상을 시도해주세요.'
        });
      }

      const result: ExtractResult = {
        success: true,
        type: 'youtube',
        title,
        content: transcript
      };

      return res.status(200).json(result);
    } else {
      // 일반 웹페이지 콘텐츠 추출
      const { title, content } = await fetchWebpageContent(url);

      if (!content || content.length < 100) {
        return res.status(400).json({
          success: false,
          error: '웹페이지에서 충분한 콘텐츠를 추출할 수 없습니다.'
        });
      }

      const result: ExtractResult = {
        success: true,
        type: 'webpage',
        title,
        content
      };

      return res.status(200).json(result);
    }
  } catch (error: any) {
    console.error('Extract error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '콘텐츠 추출 중 오류가 발생했습니다.'
    });
  }
}
