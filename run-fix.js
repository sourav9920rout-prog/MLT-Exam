fetch('http://localhost:3000/api/admin/fix-subjects', { method: 'POST' }).then(r => r.json()).then(console.log).catch(console.error);
