import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  const subjects = ["Pathology", "Microbiology", "Anatomy", "Biochemistry"];
  const prompt = `Analyze this multiple-choice question and determine the most appropriate subject category.
Question: """What is red blood cell?"""
Options: ["A","B","C","D"]
Explanation: """RBC"""

Available Subjects:
${subjects.map((s) => `- ${s}`).join('\n')}

Rules:
Return ONLY the exact string from the Available Subjects list. Do not explain.`;

  try {
    const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: prompt,
       config: { temperature: 0.1 }
    });
    console.log('RAW RESPONSE:', response.text);
    let aiSubject = (response.text || '').trim();
    if (!subjects.includes(aiSubject)) {
      const matched = subjects.find((s) => aiSubject.includes(s));
      if (matched) aiSubject = matched;
    }
    console.log('PARSED:', subjects.includes(aiSubject) ? aiSubject : null);
  } catch(e) { console.error('ERROR', e); }
}
run();
