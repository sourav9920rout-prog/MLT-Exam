fetch('http://localhost:3000/api/admin/auto-classify-batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    questions: [{ id: "1", englishQuestion: "What is red blood cell?", englishOptions: ["A","B","C","D"], englishExplanation: "RBC", subject: "Miscellaneous" }],
    subjects: ["Pathology", "Microbiology", "Anatomy", "Biochemistry"]
  })
}).then(r => r.json()).then(console.log);
