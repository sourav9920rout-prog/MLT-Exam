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
  } catch(e) {
      // console.log("jsonrepair failed:", e.message);
  }

  // Try stripping the trailing incomplete object.
  // Find the last "}," and cut there
  let lastCommaBrace = cleanText.lastIndexOf('},');
  if (lastCommaBrace !== -1) {
      let trimmed = cleanText.substring(0, lastCommaBrace + 1) + ']}';
      try {
          const repaired2 = jsonrepair(trimmed);
          return JSON.parse(repaired2);
      } catch(e) {}
      
      trimmed = cleanText.substring(0, lastCommaBrace + 1) + ']';
      try {
          const repaired3 = jsonrepair(trimmed);
          return JSON.parse(repaired3);
      } catch(e) {}
  }

  // Attempt more aggressive backtracking
  let tempText = cleanText;
  for (let i = 0; i < 20; i++) {
      lastCommaBrace = tempText.lastIndexOf('},');
      if (lastCommaBrace !== -1) {
          tempText = tempText.substring(0, lastCommaBrace + 1);
          try {
              return JSON.parse(jsonrepair(tempText + ']}'));
          } catch(e) {}
          try {
              return JSON.parse(jsonrepair(tempText + ']'));
          } catch(e) {}
      } else {
          break;
      }
  }

  return JSON.parse(cleanText);
}

console.log(parseJSONRobust(`{"questions": [{"id": 1}, {"id": 2, "q": "trun`));
console.log(parseJSONRobust(`{"questions": [{"id": 1}, {`));
console.log(parseJSONRobust(`{"questions": [{"id": 1}, `));

