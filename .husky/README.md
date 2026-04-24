# Husky Git Hooks

Este projeto usa [Husky](https://typicode.github.io/husky/) para validar código antes de commits e pushes.

## O que é executado?

### Pre-commit Hook
- Roda `lint-staged` que:
  - Executa ESLint em arquivos `.ts`, `.tsx`, `.js`, `.jsx`
  - Formata arquivos com Prettier
  - Só valida arquivos modificados

### Pre-push Hook
- Roda test suite completo (`npm run test`)
- Impede push se testes falharem

## Setup

```bash
npm install
npm run prepare  # Instala os hooks
```

## Pulando Hooks (Quando necessário)

```bash
git commit --no-verify  # Pula pre-commit
git push --no-verify    # Pula pre-push
```

**⚠️ Use apenas em emergências!**

## Dicas

- Certifique-se que seu código passa no lint antes de commitar
- Os hooks rodam automaticamente, então não precisa fazer nada especial
- Se um hook falhar, corrija o código e tente novamente

## Mais Informações

- [Documentação Husky](https://typicode.github.io/husky/)
- [Documentação lint-staged](https://github.com/okonet/lint-staged)
