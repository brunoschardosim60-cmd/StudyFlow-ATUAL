# Project Memory

## Core
StudyFlow: plataforma de estudos inteligente com IA Flora. PT-BR.
Manter layout/design/cores existentes. Não alterar visual.
Flora = IA central, professora, mentora. Uso opcional, opera em segundo plano.
Backend: Lovable Cloud (Supabase). IA via Lovable AI Gateway.
Fontes: Space Grotesk headings, Inter body. 3 temas: light/dark/black.
Flora nunca exibe JSON, nunca diz que salvou, ações auto-executam via eventos.

## Memories
- [Flora Architecture](mem://features/flora) — Flora Engine: IA central que analisa dados do aluno e toma decisões
- [Design Constraint](mem://constraints/no-design-changes) — Não alterar layout, cores ou organização visual
- [Auth Constraint](mem://constraints/auth) — Constraint de autenticação
- [Flora Output Rules](mem://constraints/flora-output) — Flora nunca vaza JSON, ações auto-executam via CustomEvents
