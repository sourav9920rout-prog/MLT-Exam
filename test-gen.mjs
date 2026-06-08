import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const prompt = 'Analyze this... return exactly a category: Pathology, Microbiology, Anatomy, Biochemistry';
    const response = await ai.models.generateContent({
       model: 'gemini-1.5-flash',
       contents: prompt,
       config: { temperature: 0.1 }
    });
    console.log(response.text);
  } catch(e) { console.error('ERROR', e); }
}
run();
