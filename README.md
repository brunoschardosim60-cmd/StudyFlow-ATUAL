# StudyFlow 2.0 🎓

Plataforma inteligente para otimizar seu estudo com IA, gamificação e revisão espaçada. Construída com React, TypeScript, Supabase e Vite.

## 🚀 Features

- **Revisão Espaçada Inteligente** - Sistema de revisão baseado em spaced repetition
- **Gamificação Completa** - XP, badges, streaks e desafios diários
- **Editor de Notas** - Markdown com suporte a KaTeX para equações
- **IA Integrada** - Flora Engine para recomendações personalizadas
- **Quiz Dinâmicos** - Geração automática de questões
- **Sessões de Foco** - Timer com modo picture-in-picture
- **Dashboard Análitico** - Métricas detalhadas de progresso
- **Autenticação Segura** - Supabase Auth
- **Responsivo** - Funciona em desktop, tablet e mobile

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript 5, Vite
- **Styling**: Tailwind CSS, Shadcn/ui, Radix-ui
- **Backend**: Supabase (PostgreSQL + Auth)
- **Editor**: TipTap com markdown + KaTeX
- **Query**: TanStack React Query
- **Testes**: Vitest + React Testing Library
- **Build**: Vite com code splitting automático

## 📋 Pré-requisitos

- Node.js 18+
- npm ou yarn
- Conta Supabase (gratuita)

## 🚀 Instalação

```bash
# Clone o repositório
git clone https://github.com/brunoschardosim60-cmd/StudyFlow2.0.git
cd StudyFlow2.0

# Instale as dependências
npm install
# ou com yarn
yarn install
# ou com bun
bun install
```

## 🔑 Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
VITE_SUPABASE_PROJECT_ID=seu_project_id
```

Obtenha essas credenciais em: https://app.supabase.com

## 💻 Desenvolvimento

```bash
# Inicie o servidor de desenvolvimento
npm run dev

# Abra http://localhost:8080 no navegador
```

## 🧪 Testes

```bash
# Rodas testes uma vez
npm run test

# Modo watch (reexecuta ao salvar)
npm run test:watch

# Verifique cobertura
npm run lint
```

## 🏗️ Build

```bash
# Build para produção
npm run build

# Preview do build
npm run preview

# Build de desenvolvimento (sem otimizações)
npm run build:dev
```

## 📁 Estrutura do Projeto

```
src/
├── components/          # Componentes React
│   ├── ui/             # Componentes base (Shadcn)
│   ├── admin/          # Painel administrativo
│   └── notebook/       # Editor de notas
├── hooks/              # Custom React hooks
├── lib/                # Funções utilitárias
├── pages/              # Páginas/rotas
├── integrations/       # Integrações externas (Supabase)
├── test/               # Setup de testes
├── App.tsx             # App principal
└── main.tsx            # Entry point

supabase/              # Migrations e Functions
public/                # Assets estáticos
```

## 🎯 Arquitetura

- **State Management**: Zustand stores (aiActivityStore, studyStateStore, etc)
- **API Client**: Supabase JS Client
- **Queries**: React Query para cache e sincronização
- **Forms**: React Hook Form com Zod validation
- **Temas**: next-themes com suporte claro/escuro

## 🔒 Segurança

- Autenticação via Supabase Auth (OAuth + Email)
- TypeScript strict mode ativado
- ESLint configurado
- Variáveis sensíveis em `.env`
- CORS configurado no Supabase

## 🤝 Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para diretrizes de contribuição.

## 📊 Performance

Bundle splitting otimizado para:
- Recharts (gráficos)
- Markdown (editor)
- KaTeX (equações)
- TipTap (editor rico)
- Notebook (módulo principal)

## 📝 Licença

Este projeto é proprietário. Veja LICENSE para detalhes.

## 👨‍💻 Autores

- Bruno Severo - [@brunoschardosim60-cmd](https://github.com/brunoschardosim60-cmd)

## 📞 Suporte

Para issues, dúvidas ou sugestões, abra uma [issue](https://github.com/brunoschardosim60-cmd/StudyFlow2.0/issues).
