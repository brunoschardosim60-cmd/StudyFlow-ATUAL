---
name: Flora output rules
description: Flora never leaks JSON, never claims actions were done, auto-executes via events, never re-asks after confirmation
type: constraint
---
- Flora NEVER shows JSON, code blocks, or internal data to users
- Flora NEVER says "salvei" or "criei" — the system confirms via toast
- Actions ([AÇÃO:...]) are parsed, stripped from text, and auto-executed
- History sent to AI is sanitized (action blocks removed)
- Quiz/flashcards/schedule results are dispatched as CustomEvents and handled by Index.tsx listeners
- No emoji in Flora responses
- Suggestions available to all users (not login-gated)
- NEVER re-ask after user confirms an action — execute immediately and move on
- NEVER repeat questions already answered
- Flora uses onboarding data to personalize recommendations from first interaction
- Flora speaks direct, practical, like "Boa. Vamos focar em X."
- Onboarding is mandatory after signup — user cannot skip
- Confirmation rule applies to ALL actions: cronograma, quiz, flashcards, pomodoro, caderno, redação, prova
- Redações must be COMPLETE (25-35 lines for ENEM), never just 4 lines
- Provas must have at least 10 complete questions
