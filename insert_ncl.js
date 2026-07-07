const fs = require('fs');

const raw = fs.readFileSync('ncl_raw.txt', 'utf8');
const lines = raw.split('\n').map(l => l.trim()).filter(l => l.length > 0);

const answers = {
  1: 'B', 2: 'A', 3: 'C', 4: 'B', 5: 'A', 6: 'A', 7: 'A', 8: 'A', 9: 'D', 10: 'B',
  11: 'A', 12: 'C', 13: 'A', 14: 'D', 15: 'B', 16: 'B', 17: 'C', 18: 'B', 19: 'D', 20: 'B',
  21: 'A', 22: 'D', 23: 'A', 24: 'D', 25: 'B', 26: 'B', 27: 'B', 28: 'C', 29: 'B', 30: 'A',
  31: 'A', 32: 'D', 33: 'A', 34: 'A', 35: 'C', 36: 'B', 37: 'A', 38: 'A', 39: 'B', 40: 'B',
  41: 'A', 42: 'A', 43: 'A', 44: 'B', 45: 'B', 46: 'B', 47: 'C', 48: 'B', 49: 'B', 50: 'A',
  51: 'A', 52: 'A', 53: 'A', 54: 'D', 55: 'A', 56: 'A', 57: 'B', 58: 'A', 59: 'A', 60: 'B',
  61: 'C', 62: 'B', 63: 'C', 64: 'A', 65: 'C', 66: 'D', 67: 'A', 68: 'A', 69: 'B', 70: 'C'
};

const questions = [];
let i = 0;

while (i < lines.length) {
  const match = lines[i].match(/^(\d+)\s+(.+)$/);
  if (match) {
    const qNum = parseInt(match[1]);
    let engQ = match[2];
    i++;
    // Continue gathering english question until options start
    while (i < lines.length && !lines[i].match(/^[A-D]\)/) && !lines[i].match(/^[\u0900-\u097F]/)) {
      engQ += " " + lines[i];
      i++;
    }

    // Now gather english options
    const engOpts = [];
    while (i < lines.length && lines[i].match(/^[A-D]\)/)) {
      // Split by A) B) C) D) as sometimes they are on the same line
      const splits = lines[i].split(/([A-D]\))/).filter(s => s.trim().length > 0);
      for(let k=0; k<splits.length; k+=2) {
         if(splits[k].match(/^[A-D]\)/)) {
           engOpts.push(splits[k+1].trim());
         }
      }
      i++;
    }

    // Now gather hindi question
    let hinQ = "";
    while (i < lines.length && !lines[i].match(/^[A-D]\)/) && !lines[i].match(/^\d+\s+/)) {
      hinQ += (hinQ ? " " : "") + lines[i];
      i++;
    }

    // Now gather hindi options
    const hinOpts = [];
    while (i < lines.length && lines[i].match(/^[A-D]\)/)) {
      const splits = lines[i].split(/([A-D]\))/).filter(s => s.trim().length > 0);
      for(let k=0; k<splits.length; k+=2) {
         if(splits[k].match(/^[A-D]\)/)) {
           hinOpts.push(splits[k+1].trim());
         }
      }
      i++;
    }
    
    // Ensure 4 options
    while(engOpts.length < 4) engOpts.push("");
    while(hinOpts.length < 4) hinOpts.push("");

    const ansStr = answers[qNum];
    const correctOptionIndex = ansStr === 'A' ? 0 : ansStr === 'B' ? 1 : ansStr === 'C' ? 2 : ansStr === 'D' ? 3 : 0;

    questions.push({
      englishQuestion: engQ,
      hindiQuestion: hinQ,
      englishOptions: engOpts,
      hindiOptions: hinOpts,
      correctOptionIndex,
      englishExplanation: "",
      hindiExplanation: "",
      subject: "NCL EXAM",
      difficulty: "medium"
    });
  } else {
    i++;
  }
}

console.log(JSON.stringify(questions, null, 2));
