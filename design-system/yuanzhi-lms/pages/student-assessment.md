# Student assessment workspace

- Route: Student assignments, exams and chapter tests
- Audience: Student
- Archetype: Assessment focus
- Primary job: 在低干扰环境中完成题目、保存答案并明确提交状态。
- Primary action: 当前步骤的保存、下一题或最终提交；同一区域只能有一个 Primary。
- Information hierarchy: Assessment context → progress/time → current question → answer controls → navigation and submission.
- Layout and density: Desktop focus layout; ordinary Student sidebar may be hidden; answer content uses stable opaque surfaces.
- Special components: Focus header, question navigator, autosave status, deadline warning, submission confirmation.
- Allowed deviations: May hide the standard sidebar and use a calmer canvas; may not create a separate application theme or redefine success/warning/destructive semantics.
- Accessibility risks: Time pressure not announced, keyboard focus lost between questions, color-only correctness, unsaved answers, destructive final submission without confirmation.
- Acceptance criteria: Full keyboard path; persistent labels; save state is announced without moving focus; final submission requires confirmation; background mode never changes correctness or warning meaning.

