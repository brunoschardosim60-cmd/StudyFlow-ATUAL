# Guia de Contribuição - StudyFlow 2.0

Obrigado por se interessar em contribuir com StudyFlow 2.0! 🙏

## Como Começar

1. **Fork o repositório**
   ```bash
   git clone https://github.com/SEU_USERNAME/StudyFlow2.0.git
   cd StudyFlow2.0
   ```

2. **Configure o ambiente**
   ```bash
   npm install
   cp .env.example .env
   # Preencha as variáveis de ambiente
   npm run dev
   ```

3. **Crie uma branch**
   ```bash
   git checkout -b feature/sua-feature
   # ou para fixes
   git checkout -b fix/seu-fix
   ```

## Padrões de Código

### TypeScript
- ✅ Sempre use TypeScript (strict mode ativado)
- ✅ Exporte tipos quando necessário
- ✅ Use interfaces para componentes props
- ❌ Nunca use `any`

```tsx
// ✅ Correto
interface ButtonProps {
  onClick: () => void;
  label: string;
}

export function Button({ onClick, label }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}

// ❌ Errado
export function Button(props: any) {
  return <button {...props} />;
}
```

### React
- ✅ Prefira functional components
- ✅ Use hooks adequadamente
- ✅ Memoize componentes custosos se necessário
- ✅ Coloque estilos em Tailwind/CSS Modules

```tsx
// ✅ Correto
export function MyComponent({ title }: { title: string }) {
  const [count, setCount] = useState(0);
  
  return <div className="p-4">{title}</div>;
}

// ❌ Evite
const MyComponent = (props: any) => {
  return <div style={{ padding: '16px' }}>{props.title}</div>;
};
```

### Commits
Siga o padrão Conventional Commits:

```bash
git commit -m "feat: adiciona nova feature"
git commit -m "fix: corrige bug em componente X"
git commit -m "docs: atualiza README"
git commit -m "test: adiciona testes para hook Y"
git commit -m "refactor: melhora performance de Z"
```

Tipos aceitos:
- `feat:` - Nova feature
- `fix:` - Correção de bug
- `docs:` - Documentação
- `test:` - Testes
- `refactor:` - Refatoração sem mudança funcional
- `perf:` - Melhoria de performance
- `style:` - Mudanças de formatação/estilo
- `ci:` - Mudanças em CI/CD

## Process de Pull Request

1. **Mantenha sua branch atualizada**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Faça commits semânticos**
   - Cada commit deve ser um trabalho lógico
   - Limite a 50 caracteres na primeira linha

3. **Execute testes localmente**
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

4. **Abra seu PR com descrição clara**
   - Descreva o problema que resolve
   - Link issues relacionadas: `Closes #123`
   - Adicione screenshots se for UI

### Template de PR
```markdown
## Descrição
Breve descrição do que foi implementado

## Tipo de Mudança
- [ ] Bug fix (correção que não quebra features)
- [ ] Nova feature (funcionalidade que não quebra features)
- [ ] Breaking change (fix ou feature que quebra features)

## Como Testar
Passos para reproduzir o comportamento

## Screenshots (se aplicável)
...

## Checklist
- [ ] Meu código segue o style do projeto
- [ ] Rodei `npm run lint` sem erros
- [ ] Rodei `npm run test` com sucesso
- [ ] Rodei `npm run build` sem erros
- [ ] Adicionei testes para novas features
- [ ] Atualizei a documentação
```

## Estrutura de Arquivos

Ao adicionar novos arquivos, siga este padrão:

### Novo Componente
```
src/components/
├── MyComponent/
│   ├── MyComponent.tsx       # Componente principal
│   ├── MyComponent.types.ts  # Types/interfaces
│   └── index.ts              # Export
```

### Novo Hook
```
src/hooks/
├── useMyHook.ts              # Implementação
├── useMyHook.test.tsx        # Testes
└── index.ts                  # Export (opcional)
```

### Nova Página
```
src/pages/
├── MyPage.tsx                # Componente
└── MyPage.module.css         # Estilos (se necessário)
```

## Testes

### Estrutura
```bash
npm run test                 # Rodar testes
npm run test:watch          # Modo watch
npm run lint                # ESLint check
```

### Exemplo de Teste
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MyComponent from "@/components/MyComponent";

describe("MyComponent", () => {
  it("renderiza corretamente", () => {
    render(<MyComponent />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("chama onClick quando clicado", () => {
    const onClick = vi.fn();
    render(<MyComponent onClick={onClick} />);
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalled();
  });
});
```

## Documentação

- Adicione JSDoc para funções públicas
- Documente tipos complexos
- Atualize README se adicionar features importantes

```tsx
/**
 * Calcula revisões usando spaced repetition
 * @param startDate - Data inicial no formato YYYY-MM-DD
 * @param skipWeekends - Se deve pular finais de semana
 * @returns Array de datas para revisão
 */
export function generateRevisionDates(
  startDate: string,
  skipWeekends: boolean
): string[] {
  // implementação
}
```

## Problemas Comuns

### ESLint errors
```bash
npm run lint -- --fix
```

### TypeScript errors
Verifique tipos e não use `any`. Se necessário, use `unknown` e narrowing.

### Merge conflicts
```bash
git fetch origin
git rebase origin/main
# Resolva conflitos
git add .
git rebase --continue
```

## Dúvidas?

- Abra uma [issue](https://github.com/brunoschardosim60-cmd/StudyFlow2.0/issues) com a tag `question`
- Veja issues existentes
- Consulte a documentação no README

## Código de Conduta

Por favor, seja respeitoso com outros contribuidores. Discriminação, assédio ou comportamento abusivo não será tolerado.

---

Happy coding! 🚀
