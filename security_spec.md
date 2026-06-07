# MLT Exam Portal Security Specifications

This specification outlines the data invariants, test payloads, and security assertions enforced via Firestore Security Rules.

## 1. Data Invariants
1. Students cannot read or write settings or other students' information.
2. Only approved students can access exams, exam attempts, and results.
3. Students can only create exam attempts for their own user ID, and update only their own active attempts.
4. Admins can manage all students, read/write exams and questions, and view all exam attempts and results.
5. SMTP credentials stored in `emailConfigs` are readable and writeable ONLY by authenticated admins.
6. A student can only register their profile if they have authenticated. Initial registration status is forced to `pending`.

## 2. The "Dirty Dozen" Malicious Payloads (Vulnerability Scenarios)
1. **Self-Approval Attack**: A pending student attempts to update their own student status in `students/{studentId}` to `approved`.
2. **Settings Hijack**: A student tries to write or edit SMTP credentials in `settings/emailConfigs` or `emailConfigs/smtp`.
3. **Impersonated Exam Attempt**: Student `A` creates an exam attempt in `examAttempts/attempt123` with `studentId: 'B'`.
4. **Result Poisoning**: A student attempts to create a high-score `results/result123` bypassing the exam completion flow.
5. **Question Injection**: A student attempts to create a fake question in `questionBank/q123`.
6. **Student Data Harvesting**: Student `A` queries all student credentials in `students` collection without filters.
7. **Exam Alteration**: Student attempts to edit exam passing percentage or questions in `exams/{examId}`.
8. **Admin Promotion**: User attempts to insert their own UID into `admins/{userId}` to gain administrative privileges.
9. **OTP Forgery**: A user attempts to write a verified flag to their OTP or register their profile without verifying their email address.
10. **Shadow Field Injection**: A user tries to inject a `ghost_field` containing elevated permissions when self-registering.
11. **Double Submission**: A student attempts to overwrite a finalized result in `results/{resultId}` that has already been submitted.
12. **Unauthenticated Read**: An unauthenticated user attempts to view standard user info or list exams in the database.

## 3. Test Runner Concept
The rules check for:
- Identity: `request.auth.uid != null`
- Role validation: `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` or matching email domains
- Validation of status and parameters
- Preventing unapproved students from reading databases.

All "Dirty Dozen" payloads will return `PERMISSION_DENIED` under our fortress security rules.
