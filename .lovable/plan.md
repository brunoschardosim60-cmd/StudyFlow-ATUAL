

# Simplificar Dashboard e Melhorar Navegacao

## Resumo

Limpar o Dashboard removendo componentes redundantes, criar bottom navigation no mobile, e mover configuracoes para uma pagina separada.

## Etapas

### 1. Remover componentes redundantes do Dashboard

- **MotivationalQuote**: remover do Dashboard (chama edge function desnecessaria, ocupa espaco sem valor real).
- **SyncStatusCard**: remover import e referencia (ja esta comentado/morto no codigo).
- **StudyCoachPanel**: remover do Dashboard. Funcionalidade ja coberta pela Flora (IA central que analisa fraquezas e sugere acoes).
- **QuickStartChecklist**: manter, mas garantir que some permanentemente apos completar (ja tem auto-dismiss).

### 2. Criar Bottom Navigation no mobile

- Criar componente `BottomNav.tsx` com 4-5 itens: Dashboard, Cadernos, Redacao, Analise, Flora.
- Fixo no bottom da tela, visivel apenas em mobile (`md:hidden`).
- Highlight no item ativo baseado na rota atual.
- Esconder os botoes de navegacao do header em mobile (manter apenas no desktop).
- Posicionar o botao da Flora no bottom nav ao inves de floating button no mobile.

### 3. Criar pagina de Configuracoes

- Nova rota `/settings` com pagina `Settings.tsx`.
- Mover para la: `CustomThemeDialog`, botao de trocar tema (light/dark/black), logout.
- Limpar o header do Dashboard: manter apenas logo + navegacao principal.
- Adicionar item "Config" no bottom nav (mobile) ou link discreto no header (desktop).

### 4. Limpar header do Dashboard

- Desktop: logo + nav links inline (Cadernos, Redacao, Analise, Config).
- Mobile: logo apenas, toda navegacao no bottom nav.
- Remover botoes empilhados que causam overflow.

## Arquivos afetados

- `src/pages/Index.tsx` — remover MotivationalQuote, SyncStatusCard, StudyCoachPanel; simplificar header
- `src/components/BottomNav.tsx` — novo componente
- `src/pages/Settings.tsx` — nova pagina
- `src/App.tsx` — adicionar rota /settings
- `src/components/MotivationalQuote.tsx` — pode ser deletado
- `src/components/StudyCoachPanel.tsx` — pode ser deletado

