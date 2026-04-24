# API Documentation

## Overview

StudyFlow expõe uma API REST para integração com serviços externos e aplicações mobile.

**Base URL**: `https://api.studyflow.com/v1`

**Documentation**: OpenAPI/Swagger em `openapi.yaml`

## Authentication

### Bearer Token

Todas as requisições autenticadas usam JWT Bearer tokens:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Obtendo Token

```bash
curl -X POST https://api.studyflow.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

Resposta:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "expires_at": "2026-05-24T10:00:00Z"
  }
}
```

### Refresh Token

```bash
curl -X POST https://api.studyflow.com/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "eyJ..."
  }'
```

## Endpoints

### Authentication

#### Sign Up

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "User Name"
}
```

**Response** (201):
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "User Name",
    "created_at": "2026-04-24T10:00:00Z"
  },
  "session": {
    "access_token": "eyJ..."
  }
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Logout

```http
POST /auth/logout
Authorization: Bearer {token}
```

### Users

#### Get Current User

```http
GET /users/me
Authorization: Bearer {token}
```

**Response** (200):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "User Name",
  "avatar_url": "https://...",
  "plan": "pro",
  "streak": 15,
  "total_study_hours": 125.5,
  "created_at": "2026-01-24T10:00:00Z"
}
```

#### Update Profile

```http
PATCH /users/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "New Name",
  "avatar_url": "https://..."
}
```

### Study Sessions

#### List Sessions

```http
GET /study-sessions?limit=10&offset=0&topic_id=uuid
Authorization: Bearer {token}
```

**Query Parameters**:
- `limit` (int, default: 10) - Quantidade de resultados
- `offset` (int, default: 0) - Paginação
- `topic_id` (string, UUID) - Filtrar por tópico
- `from` (string, ISO8601) - Data inicial
- `to` (string, ISO8601) - Data final

**Response** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "topic": "Mathematics",
    "duration_minutes": 45,
    "focus_mode": true,
    "completed": true,
    "created_at": "2026-04-24T10:00:00Z"
  }
]
```

#### Create Session

```http
POST /study-sessions
Authorization: Bearer {token}
Content-Type: application/json

{
  "topic": "Mathematics",
  "duration_minutes": 45,
  "focus_mode": true
}
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "topic": "Mathematics",
  "duration_minutes": 45,
  "focus_mode": true,
  "completed": true,
  "created_at": "2026-04-24T10:00:00Z"
}
```

#### Get Session Details

```http
GET /study-sessions/{id}
Authorization: Bearer {token}
```

#### Update Session

```http
PATCH /study-sessions/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "duration_minutes": 60,
  "completed": true
}
```

#### Delete Session

```http
DELETE /study-sessions/{id}
Authorization: Bearer {token}
```

### Topics

#### List Topics

```http
GET /topics
Authorization: Bearer {token}
```

**Response** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Mathematics",
    "description": "Algebra and Calculus",
    "color": "#3B82F6",
    "priority": 1,
    "created_at": "2026-04-24T10:00:00Z"
  }
]
```

#### Create Topic

```http
POST /topics
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Mathematics",
  "description": "Algebra and Calculus",
  "color": "#3B82F6",
  "priority": 1
}
```

#### Update Topic

```http
PATCH /topics/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Advanced Math",
  "priority": 2
}
```

#### Delete Topic

```http
DELETE /topics/{id}
Authorization: Bearer {token}
```

### Flashcards

#### List Flashcards for Review

```http
GET /flashcards?topic_id=uuid
Authorization: Bearer {token}
```

**Response** (200):
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "topic_id": "550e8400-e29b-41d4-a716-446655440002",
    "question": "What is 2 + 2?",
    "answer": "4",
    "ease_factor": 2.5,
    "interval_days": 3,
    "next_review": "2026-04-27T10:00:00Z",
    "review_count": 5,
    "created_at": "2026-04-24T10:00:00Z"
  }
]
```

#### Record Flashcard Review

```http
PATCH /flashcards/{id}/review
Authorization: Bearer {token}
Content-Type: application/json

{
  "quality": 4
}
```

**Quality Levels** (SM-2 Algorithm):
- 0: Complete blackout, incorrect response
- 1: Incorrect response, but the right direction
- 2: Correct response, but required significant effort
- 3: Correct response after some hesitation
- 4: Correct response with difficulty
- 5: Correct response without any difficulty

### Metrics

#### Dashboard Metrics

```http
GET /metrics/dashboard?period=weekly
Authorization: Bearer {token}
```

**Query Parameters**:
- `period` (string) - `daily`, `weekly`, `monthly`

**Response** (200):
```json
{
  "total_study_hours": 125.5,
  "sessions_count": 50,
  "topics_count": 8,
  "streak": 15,
  "accuracy": 0.85,
  "weekly_breakdown": [
    {
      "date": "2026-04-18",
      "hours": 12.5
    }
  ]
}
```

#### Subject Statistics

```http
GET /metrics/subjects/{topic_id}
Authorization: Bearer {token}
```

## Error Responses

### Error Format

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid email format",
  "details": {
    "field": "email",
    "value": "invalid"
  }
}
```

### Common Errors

| Status | Code | Message |
|--------|------|---------|
| 400 | VALIDATION_ERROR | Request validation failed |
| 400 | INVALID_CREDENTIALS | Invalid email or password |
| 401 | UNAUTHORIZED | Missing or invalid token |
| 403 | FORBIDDEN | Permission denied |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource already exists |
| 429 | RATE_LIMITED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

## Rate Limiting

- **Free plan**: 100 requests/hour
- **Pro plan**: 1000 requests/hour
- **Premium plan**: Unlimited

Headers retornados:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 1624046400
```

## Webhooks

### Subscribe to Events

```http
POST /webhooks/subscribe
Authorization: Bearer {token}
Content-Type: application/json

{
  "event": "session.completed",
  "url": "https://your-app.com/webhook",
  "secret": "your-secret"
}
```

### Webhook Events

- `session.created` - Nova sessão criada
- `session.completed` - Sessão concluída
- `flashcard.reviewed` - Flashcard revisado
- `user.updated` - Perfil atualizado

### Webhook Payload

```json
{
  "event": "session.completed",
  "timestamp": "2026-04-24T10:00:00Z",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "topic": "Mathematics",
    "duration_minutes": 45
  },
  "signature": "sha256=..."
}
```

## SDK & Libraries

### JavaScript/TypeScript

```bash
npm install @studyflow/sdk
```

```typescript
import { StudyFlow } from "@studyflow/sdk";

const client = new StudyFlow({
  token: "your-access-token"
});

const sessions = await client.studySessions.list();
```

### Python

```bash
pip install studyflow
```

```python
from studyflow import StudyFlow

client = StudyFlow(token="your-access-token")
sessions = client.study_sessions.list()
```

## Best Practices

1. **Cache Responses** - Use cache headers para reduzir requisições
2. **Handle Errors** - Implementar retry logic com backoff exponencial
3. **Batch Requests** - Usar bulk endpoints quando disponível
4. **Monitor Usage** - Acompanhar rate limits
5. **Secure Tokens** - Nunca commitar tokens em código

## Suporte

- Email: api-support@studyflow.com
- Docs: https://docs.studyflow.com
- Issues: https://github.com/studyflow/api/issues
