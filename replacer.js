const fs = require('fs');
let content = fs.readFileSync('src/components/QuestionBankManager.tsx', 'utf-8');
content = content.replace(/subject: uploadSubject\.trim\(\) \|\| q\.subject \|\| "Miscellaneous"/g, 'subject: (((uploadSubject.trim() || q.subject)?.trim().toLowerCase() === \\'mathematics\\') ? \\'Math\\' : (uploadSubject.trim() || q.subject)) || "Miscellaneous"');
fs.writeFileSync('src/components/QuestionBankManager.tsx', content);
