# Performance & Bundle Analysis Guide

## Overview

Este guia descreve como usar as ferramentas de análise de performance e bundle da aplicação StudyFlow.

## Metricas de Web Vitals

### Core Web Vitals Monitorados

- **FCP (First Contentful Paint)**: Tempo até o primeiro conteúdo aparecer
- **LCP (Largest Contentful Paint)**: Tempo até o maior elemento aparecer
- **CLS (Cumulative Layout Shift)**: Estabilidade visual da página
- **FID (First Input Delay)**: Resposta à interação do usuário
- **TTFB (Time to First Byte)**: Tempo para primeira resposta do servidor

## Usar Performance Monitor

### Em Desenvolvimento

O `PerformanceMonitor` aparece no canto inferior direito durante desenvolvimento:

```tsx
import { PerformanceMonitor } from "@/hooks/usePerformanceMonitoring";

function App() {
  return (
    <>
      <YourApp />
      <PerformanceMonitor />
    </>
  );
}
```

### Dados Reportados

Todos os dados de performance são automaticamente enviados para `/api/metrics` via:
- `navigator.sendBeacon()` (preferido, não bloqueia navegação)
- `fetch()` com `keepalive: true` (fallback)

## Bundle Analysis

### Gerar Relatório de Bundle

```bash
npm run build:analyze
```

Este comando:
1. Faz build em modo `analyze`
2. Abre `dist/stats.html` com visualização interativa
3. Mostra tamanho de cada chunk e dependência

### Interpretar Relatório

- **Tamanho em cores**: Verde (pequeno) → Amarelo → Vermelho (grande)
- **Clique em um bloco**: Ver dependências dentro daquele chunk
- **Comparar chunks**: Identificar oportunidades de otimização

## Test Coverage

### Rodar Testes com Coverage

```bash
npm run test:coverage
```

Gera:
- `coverage/` - Relatório HTML
- Indicador de cobertura por arquivo (linhas, funções, branches)

### Targets de Cobertura

- **Linhas**: 80%
- **Funções**: 80%
- **Branches**: 75%
- **Statements**: 80%

Abra `coverage/index.html` no navegador para ver detalhes.

## Performance Profiling

### Usar V8 Profiler

```bash
npm run performance:profile
```

Gera arquivo `profile.txt` com detalhes de execução.

### Analisar com Chrome DevTools

1. Abrir DevTools (F12)
2. Aba "Performance"
3. Gravar ações do usuário
4. Analisar:
   - Rendering time
   - JavaScript execution
   - Idle time

## Otimizações Implementadas

### 1. Code Splitting Automático

Chunks separados para:
- Recharts (gráficos)
- React Markdown (editor de markdown)
- Konva (canvas)
- KaTeX (matemática)
- Notebook (features específicas)
- Flora (IA chat)
- Study Tools (quiz, notas)
- Editor (TipTap)

### 2. Compressão

Dois algoritmos aplicados automaticamente:
- **Gzip** (.gz)
- **Brotli** (.br)

Servidor deve servir arquivo comprimido correspondente aceito pelo navegador.

### 3. Tree Shaking

Terser remove código não utilizado em produção.

### 4. Minificação

Remove console.log em produção para reduzir tamanho.

## Error Boundary

Componente `ErrorBoundary` captura erros React:

```tsx
import { ErrorBoundary } from "@/components/ErrorBoundary";

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

### Features

- ✅ UI limpa de erro com retry
- ✅ Detalhes do erro em development
- ✅ Integração com Sentry (se `window.__ERROR_LOG__` existir)
- ✅ HOC `withErrorBoundary` para componentes

## CI/CD Integration

### GitHub Actions

- `npm run lint` - Validação de código
- `npm run test:coverage` - Testes com cobertura
- `npm run build` - Build otimizado
- `npm run build:analyze` - Gerar stats.html

## Checklist de Performance

- [ ] Rodar `npm run test:coverage` - Manter 80%+ coverage
- [ ] Rodar `npm run build:analyze` - Verificar tamanho de chunks
- [ ] Monitorar Web Vitals com `PerformanceMonitor`
- [ ] Revisar errors com `ErrorBoundary`
- [ ] Aplicar Code Splitting para novos chunks grandes

## Próximos Passos

- [ ] Integrar Sentry para error tracking em produção
- [ ] Adicionar monitoring de Web Vitals em produção
- [ ] Implementar Service Worker para caching
- [ ] Setup de CDN com cache headers otimizados
- [ ] Lighthouse CI integrado ao GitHub Actions
