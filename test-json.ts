const text = `
{
  "questions": [
    {
      "options": ["A  ा", "B  े",],
      "answer": "A"
    }
  ]
}
`;

function parseJSONRobust(text: string) {
  let cleanText = text.trim();
  
  if (cleanText.startsWith('```')) {
    const match = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match && match[1]) {
      cleanText = match[1].trim();
    }
  }

  try { return JSON.parse(cleanText); } catch(e) {}
  
  // Clean trailing commas
  const noTrailingCommas = cleanText.replace(/,\s*([\]}])/g, '$1');
  try { return JSON.parse(noTrailingCommas); } catch(e) {}
  
  // Repair deeply truncated {"questions": [...] } JSON
  let repairedText = noTrailingCommas;
  if (!repairedText.endsWith('}') && !repairedText.endsWith(']')) {
    const lastCompleteObject = repairedText.lastIndexOf('},');
    if (lastCompleteObject !== -1) {
       try { return JSON.parse(repairedText.substring(0, lastCompleteObject + 1) + ']}'); } catch(e3) {}
       try { return JSON.parse(repairedText.substring(0, lastCompleteObject + 1) + ']'); } catch(e3) {}
    }
  }

  const startIndex = noTrailingCommas.indexOf('{');
  const endIndex = noTrailingCommas.lastIndexOf('}');
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const maybeJson = noTrailingCommas.substring(startIndex, endIndex + 1);
    try { return JSON.parse(maybeJson); } catch(e3) {}
  }
  
  const arrStartIndex = noTrailingCommas.indexOf('[');
  const arrEndIndex = noTrailingCommas.lastIndexOf(']');
  if (arrStartIndex !== -1 && arrEndIndex !== -1 && arrEndIndex > arrStartIndex) {
    const maybeJsonArr = noTrailingCommas.substring(arrStartIndex, arrEndIndex + 1);
    try { return JSON.parse(maybeJsonArr); } catch(e4) {}
  }

  // Fallback to original throw
  return JSON.parse(cleanText); 
}

console.log(parseJSONRobust(text));
