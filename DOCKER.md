# Docker Guide - StudyFlow 2.0

Este projeto pode ser containerizado usando Docker para deploy fácil em produção.

## Estrutura

- `Dockerfile` - Multi-stage build (builder + production)
- `docker-compose.yml` - Orquestração local
- `.dockerignore` - Arquivos ignorados no build
- `.env.production` - Variáveis de produção

## Build & Run

### Com Docker Compose (Recomendado)

```bash
# Setup
cp .env.example .env.production
# Edite .env.production com suas credenciais Supabase

# Build e inicie
docker-compose up -d

# Parar
docker-compose down
```

### Com Docker CLI

```bash
# Build
docker build -t studyflow:latest .

# Run
docker run -d \
  -p 3000:3000 \
  -e VITE_SUPABASE_PROJECT_ID=your_id \
  -e VITE_SUPABASE_PUBLISHABLE_KEY=your_key \
  -e VITE_SUPABASE_URL=your_url \
  --name studyflow \
  studyflow:latest

# Stop
docker stop studyflow
docker rm studyflow
```

## Verificar Saúde

```bash
# Logs
docker-compose logs -f studyflow

# Status
docker-compose ps

# Health check manual
curl http://localhost:3000
```

## Otimizações

- **Multi-stage**: Apenas prod assets no container final
- **Alpine Linux**: Imagem base pequena (~50MB)
- **npm ci**: Dependências determinísticas
- **Health Check**: Monitoramento automático

## Variáveis de Ambiente

Adicione ao `.env.production`:

```env
VITE_SUPABASE_PROJECT_ID=seu_project_id
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
VITE_SUPABASE_URL=sua_url_supabase
```

## Deploy em Produção

### AWS ECR + ECS
```bash
# Build e push
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.us-east-1.amazonaws.com
docker build -t studyflow:latest .
docker tag studyflow:latest <account>.dkr.ecr.us-east-1.amazonaws.com/studyflow:latest
docker push <account>.dkr.ecr.us-east-1.amazonaws.com/studyflow:latest
```

### Heroku
```bash
heroku container:push web
heroku container:release web
```

### Railway / Render
Conecte seu repo do GitHub e configure as variáveis de ambiente automaticamente.

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Port já em uso | `docker-compose down` ou `docker kill container_name` |
| Build falha | `docker build --no-cache -t studyflow:latest .` |
| Variáveis não carregam | Verifique `.env.production` e reinicie container |
| Health check falha | `docker-compose logs studyflow` |

## Mais Informações

- [Docker Docs](https://docs.docker.com/)
- [Docker Compose Docs](https://docs.docker.com/compose/)
