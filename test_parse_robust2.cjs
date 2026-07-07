const { jsonrepair } = require('jsonrepair');

function parseJSONRobust(text) {
  let cleanText = text.trim();
  
  if (cleanText.startsWith('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanText = match[1].trim();
    } else {
      cleanText = cleanText.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
  }

  try { return JSON.parse(cleanText); } catch(e) {}
  
  try {
      const repaired = jsonrepair(cleanText);
      return JSON.parse(repaired);
  } catch(e) {}

  let lastCommaBrace = cleanText.lastIndexOf('},');
  if (lastCommaBrace !== -1) {
      let trimmed = cleanText.substring(0, lastCommaBrace + 1) + ']}';
      try { return JSON.parse(jsonrepair(trimmed)); } catch(e) {}
      
      trimmed = cleanText.substring(0, lastCommaBrace + 1) + ']';
      try { return JSON.parse(jsonrepair(trimmed)); } catch(e) {}
  }

  let tempText = cleanText;
  for (let i = 0; i < 20; i++) {
      lastCommaBrace = tempText.lastIndexOf('},');
      if (lastCommaBrace !== -1) {
          tempText = tempText.substring(0, lastCommaBrace + 1);
          try { return JSON.parse(jsonrepair(tempText + ']}')); } catch(e) {}
          try { return JSON.parse(jsonrepair(tempText + ']')); } catch(e) {}
      } else {
          break;
      }
  }

  // Attempt regex extraction of individual question objects as last resort
  try {
      // Find all complete-looking objects that have "englishQuestion" or similar
      const matches = cleanText.match(/{(?:[^{}]|{(?:[^{}]|{[^{}]*})*})*}/g);
      if (matches && matches.length > 0) {
          const parsedArr = matches.map(m => {
              try { return JSON.parse(jsonrepair(m)); } catch(e) { return null; }
          }).filter(obj => obj && (obj.englishQuestion || obj.hindiQuestion || obj.question));
          if (parsedArr.length > 0) {
              return { questions: parsedArr };
          }
      }
  } catch(e) {}

  return JSON.parse(cleanText);
}

console.log(parseJSONRobust(`{"questions": [{"id": 1, "englishQuestion": "yes"}, {"id": 2, "q": "trun`));
console.log(parseJSONRobust(`[{"id": 1, "englishQuestion": "yes"}, {`));
console.log(parseJSONRobust(`{"questions": [{"id": 1, "englishQuestion": "yes"}, `));
