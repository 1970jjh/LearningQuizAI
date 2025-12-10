
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { Slide, Participant, QuizReport } from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const processFileToSlides = async (file: File): Promise<Slide[]> => {
  if (file.type.startsWith('image/')) {
    const base64 = await blobToBase64(file);
    return [{
      id: crypto.randomUUID(),
      pageIndex: 1,
      originalImage: base64,
      currentImage: base64,
      selected: true,
      generatedCandidates: []
    }];
  }

  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const slidePromises: Promise<Slide>[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      slidePromises.push(
        (async () => {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          
          if (!context) throw new Error("Canvas context not found");

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          
          return {
            id: crypto.randomUUID(),
            pageIndex: i,
            originalImage: dataUrl,
            currentImage: dataUrl,
            selected: true,
            generatedCandidates: []
          };
        })()
      );
    }

    return Promise.all(slidePromises);
  }

  throw new Error("Unsupported file type.");
};

export const saveImageToPdf = (imageUrl: string, filename: string = 'output.pdf') => {
  const img = new Image();
  img.src = imageUrl;
  img.onload = () => {
    const doc = new jsPDF({
      orientation: img.width > img.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [img.width, img.height]
    });

    doc.addImage(imageUrl, 'PNG', 0, 0, img.width, img.height);
    doc.save(filename);
  };
};

// Helper: Convert text to image to support Korean in jsPDF without embedding huge fonts
const createTextPageImage = (title: string, text: string, rankingText: string, width: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // A4 ratio approximation roughly
    const height = 1130; 
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.font = 'bold 32px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.fillText(title, 40, 60);

    // Text Body
    ctx.font = '16px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#334155';
    
    // Simple text wrap
    const words = text.split('\n');
    let y = 100;
    const lineHeight = 24;
    const maxWidth = width - 80;

    words.forEach(line => {
       // Check if line is too long
       if (ctx.measureText(line).width > maxWidth) {
           // Very basic wrapping
           const chars = line.split('');
           let currentLine = '';
           chars.forEach(char => {
               if (ctx.measureText(currentLine + char).width > maxWidth) {
                   ctx.fillText(currentLine, 40, y);
                   currentLine = char;
                   y += lineHeight;
               } else {
                   currentLine += char;
               }
           });
           ctx.fillText(currentLine, 40, y);
           y += lineHeight;
       } else {
           ctx.fillText(line, 40, y);
           y += lineHeight;
       }
    });

    // Ranking Section
    y += 40;
    ctx.font = 'bold 24px "Noto Sans KR", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText("Final Rankings", 40, y);
    y += 30;

    ctx.font = '18px "Noto Sans KR", sans-serif';
    const rankings = rankingText.split('\n');
    rankings.forEach(r => {
        ctx.fillText(r, 40, y);
        y += 28;
    });

    resolve(canvas.toDataURL('image/jpeg', 0.9));
  });
};

export const saveReportToPdf = async ({ report, poster, rankings }: { report: QuizReport, poster: string, rankings: Participant[] }) => {
    const doc = new jsPDF();
    
    // Page 1: Poster
    if (poster) {
        const imgProps = doc.getImageProperties(poster);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        doc.addImage(poster, 'JPEG', 0, 0, pdfWidth, pdfHeight); 
    }

    // Page 2: Text Report (Rendered as Image to support Korean)
    const rankingStr = rankings.map((p, i) => `${i+1}. ${p.name} - ${p.score} pts`).join('\n');
    const textImage = await createTextPageImage("AI Learning Report", report.textReport, rankingStr);
    
    doc.addPage();
    doc.addImage(textImage, 'JPEG', 0, 0, 210, 297); // A4 full page

    // Page 3: Infographic
    doc.addPage();
    // Fit infographic nicely
    doc.addImage(report.summaryInfographic, 'JPEG', 15, 15, 180, 240);

    doc.save("LearningQuiz_Result.pdf");
};
