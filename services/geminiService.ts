
import { GoogleGenAI, Type } from "@google/genai";
import { Slide, QuizConfig, QuizQuestion, WinnerPoster, GeneratedImage } from "../types";

const getBase64FromDataUrl = (dataUrl: string): string => {
  return dataUrl.split(',')[1];
};

const TEXT_MODEL_NAME = 'gemini-3-pro-preview';
const IMAGE_MODEL_NAME = 'gemini-3-pro-image-preview';

export const ensureApiKey = async (): Promise<void> => {
  const win = window as any;
  if (!win.aistudio) {
    console.warn("AI Studio definitions missing.");
    return;
  }
  const hasKey = await win.aistudio.hasSelectedApiKey();
  if (!hasKey) {
    await win.aistudio.openSelectKey();
  }
};

export const openApiKeyDialog = async (): Promise<void> => {
  const win = window as any;
  if (win.aistudio) {
    await win.aistudio.openSelectKey();
  }
};

export const generateQuizQuestions = async (
  slides: Slide[],
  config: QuizConfig
): Promise<QuizQuestion[]> => {
  await ensureApiKey();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const parts: any[] = [];
  
  const prompt = `
  Create a learning quiz based on the provided slide images.
  
  Configuration:
  - Multiple Choice Questions: ${config.multipleChoiceCount}
  - Short Answer Questions: ${config.shortAnswerCount}
  - Difficulty: ${config.difficulty}
  
  Rules:
  1. Questions must be strictly based on the content of the slides.
  2. The primary language must be KOREAN (한국어).
  3. If an English term is crucial, use the format: "Korean (English)".
  4. For the 'explanation', provide a detailed reasoning in Korean.
  5. CRITICAL: When referring to the source slide in the explanation, YOU MUST use this exact format: "[학습자료 {page_number} page 참고]". Do not use "Slide X".
  6. Output must be a valid JSON array.
  `;

  parts.push({ text: prompt });

  // Add only selected slides to context
  slides.filter(s => s.selected).forEach((slide) => {
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: getBase64FromDataUrl(slide.originalImage),
      },
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }], // Enable grounding for better explanations
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['multiple-choice', 'short-answer'] },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING },
            },
            required: ['type', 'question', 'correctAnswer', 'explanation']
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const rawQuestions = JSON.parse(text);
    
    // Post-process to add IDs and default timer
    return rawQuestions.map((q: any) => ({
      ...q,
      id: crypto.randomUUID(),
      timeLimit: 15,
      options: q.type === 'short-answer' ? [] : q.options
    }));

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    throw error;
  }
};

export const regenerateQuestion = async (
  originalQuestion: QuizQuestion,
  instruction: string,
  slides: Slide[]
): Promise<QuizQuestion> => {
    await ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts: any[] = [];
    parts.push({ text: `Modify the following quiz question based on this instruction: "${instruction}". 
    Original Question: ${JSON.stringify(originalQuestion)}
    
    Rules:
    - Language: Korean (한국어)
    - Keep English terms in "Korean (English)" format if needed.
    - Reference format: "[학습자료 N page 참고]"
    ` });
    
    slides.filter(s => s.selected).slice(0, 5).forEach((slide) => {
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: getBase64FromDataUrl(slide.originalImage),
          },
        });
    });

    const response = await ai.models.generateContent({
        model: TEXT_MODEL_NAME,
        contents: { parts },
        config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING, enum: ['multiple-choice', 'short-answer'] },
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['type', 'question', 'correctAnswer', 'explanation']
            }
        }
    });

    const newQ = JSON.parse(response.text!);
    return { ...originalQuestion, ...newQ };
}

export const generateWinnerPoster = async (
    data: WinnerPoster
): Promise<string> => {
    await ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const parts: any[] = [];
    parts.push({ text: `Create a cinematic, high-quality celebration poster for a quiz winner.
    
    Details:
    - Winner Name: ${data.winnerName}
    - Company: ${data.companyName}
    - Aspect Ratio: 3:5 (Vertical Poster)
    - Style: Energetic, Golden Confetti, Spotlight, "Winner" text prominent.
    - Action: The winner should be holding a large golden trophy high above their head with both hands, screaming with joy or smiling broadly in victory.
    - Atmosphere: Dramatic lighting, stadium-like celebration, vibrant colors.
    - Composition: Integrate the person's face from the reference image naturally into this heroic body holding the trophy.
    `});

    if (data.winnerPhoto) {
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: getBase64FromDataUrl(data.winnerPhoto)
            }
        });
    }

    const response = await ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "3:4", // Closest to 3:5
                imageSize: "1K"
            }
        }
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart && imagePart.inlineData) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
    throw new Error("Failed to generate poster");
};

export const generateReportInfographic = async (
    slides: Slide[],
    quizData: QuizQuestion[]
): Promise<{ image: string, text: string }> => {
    await ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // 1. Generate Text Report first
    const textPrompt = `Summarize the key learning points from the provided slides and the quiz questions.
    Format plain text only. NO markdown, NO asterisks, NO bolding symbols.
    Language: Korean (한국어).
    Structure:
    1. 핵심 요약 (Executive Summary)
    2. 주요 학습 개념 (Key Concepts Learned)
    3. 퀴즈 리뷰 (Quiz Review - Briefly mention difficult concepts based on questions: ${quizData.map(q => q.question).join(', ')})
    `;
    
    // We reuse the quiz questions context or slide context
    const textResponse = await ai.models.generateContent({
        model: TEXT_MODEL_NAME,
        contents: { parts: [{ text: textPrompt }] }
    });
    const reportText = textResponse.text || "Report generation failed.";

    // 2. Generate Infographic
    const imageParts: any[] = [];
    imageParts.push({ text: `Create a "Vibrant Modern Infographic" summarizing the main topic. 
    Use Full Color, high saturation, and clean layout. 
    Do NOT use black and white. Make it colorful and engaging.
    Include visual elements like charts, icons, and bold Korean text headers if possible.
    Topic context: ${reportText.slice(0, 200)}...` });
    
    slides.filter(s => s.selected).slice(0, 3).forEach(s => {
         imageParts.push({
             inlineData: { mimeType: 'image/jpeg', data: getBase64FromDataUrl(s.originalImage) }
         });
    });

    const imageResponse = await ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: { parts: imageParts },
        config: {
             imageConfig: { aspectRatio: "3:4" }
        }
    });

    const imagePart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    let infographicUrl = '';
    if (imagePart && imagePart.inlineData) {
        infographicUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }

    return { image: infographicUrl, text: reportText };
}

export const generateSlideVariations = async (
  originalImage: string,
  prompt: string,
  count: number
): Promise<GeneratedImage[]> => {
  await ensureApiKey();
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Generate parallel requests to simulate 'count'
  const promises = Array.from({ length: count }).map(async () => {
      try {
        const parts: any[] = [];
        parts.push({
            inlineData: {
                mimeType: 'image/jpeg',
                data: getBase64FromDataUrl(originalImage)
            }
        });
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: IMAGE_MODEL_NAME,
            contents: { parts },
            config: {
                imageConfig: {
                    aspectRatio: "16:9", 
                    imageSize: "1K"
                }
            }
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        if (imagePart && imagePart.inlineData) {
            return {
                id: crypto.randomUUID(),
                dataUrl: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`
            } as GeneratedImage;
        }
        return null;
      } catch (e) {
          console.error("Variation generation failed", e);
          return null;
      }
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is GeneratedImage => r !== null);
};
