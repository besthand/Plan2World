import { GoogleGenAI } from "@google/genai";
import { Wall } from "../types";

// Helper to clean JSON string from markdown
const cleanJsonString = (str: string): string => {
  // Try to extract from code block first
  const match = str.match(/```json\n([\s\S]*?)\n```/);
  if (match) return match[1].trim();
  
  // If no code block, strip potential markdown wrapper
  return str.replace(/```json\n?|\n?```/g, '').trim();
};

export const analyzeFloorPlan = async (
  base64Image: string, 
  width: number, 
  height: number
): Promise<{ walls: Wall[] }> => {
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const model = 'gemini-3-flash-preview';

    // Gemini works best with normalized coordinates [0, 1000]
    const prompt = `
      Analyze this floor plan.
      Identify all straight BLACK LINES that represent walls.
      
      Output a JSON object with a "walls" array.
      Each wall is a line segment defined by start and end coordinates.
      
      CRITICAL: Return coordinates in a NORMALIZED scale of 0 to 1000.
      (0,0) is top-left, (1000,1000) is bottom-right.
      
      Format:
      {
        "walls": [
          { "y1": number, "x1": number, "y2": number, "x2": number }
        ]
      }
      
      Do not include furniture. Only the structural walls (black lines).
      Ensure lines that appear connected in the image share endpoints.
    `;

    // Extract base64 data (remove header if present)
    const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: base64Data
            }
          },
          {
            text: prompt
          }
        ]
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const jsonStr = cleanJsonString(text);
    let data;
    try {
        data = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON:", jsonStr);
        throw new Error("Invalid JSON response from AI");
    }

    // Convert normalized [0-1000] coordinates back to actual image [width, height]
    const scaleX = width / 1000;
    const scaleY = height / 1000;

    const walls: Wall[] = (data.walls || []).map((w: any, idx: number) => ({
      id: `ai-wall-${idx}-${Date.now()}`,
      start: { 
        x: w.x1 * scaleX, 
        y: w.y1 * scaleY 
      },
      end: { 
        x: w.x2 * scaleX, 
        y: w.y2 * scaleY 
      },
      thickness: 15,
      height: 240
    }));

    return { walls };

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    return { walls: [] };
  }
};