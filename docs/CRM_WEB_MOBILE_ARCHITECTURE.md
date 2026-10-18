# Performance CRM: архитектура веб-приложения и мобильного приложения

## 1. Статус документа

Этот документ описывает целевую архитектуру Performance CRM, в которой есть:

- веб-приложение;
- мобильное приложение для iOS и Android;
- единая регистрация и авторизация экосистемы Atlant/ScoutScope;
- общий API;
- PostgreSQL как основная база данных;
- Redis для кеша, rate limit, очередей и realtime-коммуникации;
- объектное хранилище для файлов;
- возможность горизонтального масштабирования.

Это демонстрационная архитектура. Текущая веб-регистрация и общая авторизация
уже работают через ScoutScope Backsite. Мобильное приложение, refresh-сессии,
очереди и realtime-слой являются следующим этапом реализации.

## 2. Основная идея

Веб-приложение и мобильное приложение не должны обмениваться данными напрямую.
Оба клиента работают с одним серверным API и одной моделью пользователя.

```text
┌─────────────────────┐           ┌─────────────────────┐
│ Web Performance CRM │           │ Mobile Performance  │
│ Next.js + React     │           │ Flutter + Dart      │
└──────────┬──────────┘           └──────────┬──────────┘
           │ HTTPS / JSON                     │ HTTPS / JSON
           │ SSE или WebSocket                │ WebSocket
           ▼                                  ▼
┌────────────────────────────────────────────────────────┐
│                   API Gateway / Nginx                  │
│ TLS, маршрутизация, request ID, базовые ограничения    │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│        FastAPI: Identity API + Performance CRM API      │
│ Auth, пользователи, команды, задачи, отчёты, права      │
└───────────────┬───────────────────────┬────────────────┘
                │                       │
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│ PostgreSQL               │  │ Redis                    │
│ постоянные данные        │  │ cache / queue / realtime │
└──────────────────────────┘  └─────────────┬────────────┘
                                           ▼
                              ┌──────────────────────────┐
                              │ Background workers       │
                              │ уведомления, импорт, PDF  │
                              └─────────────┬────────────┘
                                            ▼
                              ┌──────────────────────────┐
                              │ S3-совместимое хранилище │
                              │ файлы, аватары, отчёты   │
                              └──────────────────────────┘
```

## 3. Рекомендуемый стек технологий

### 3.1. Веб-приложение

| Часть | Технология | Назначение |
| --- | --- | --- |
| Framework | Next.js 16, App Router | страницы, SSR, BFF endpoint |
| UI | React 19 + TypeScript | интерфейс CRM |
| Styles | CSS Modules / Tailwind CSS | дизайн-система и адаптивность |
| Работа с API | native `fetch` + TanStack Query | кеш запросов и синхронизация состояния |
| Формы | React Hook Form + Zod | формы и клиентская валидация |
| Realtime | SSE или WebSocket client | обновления задач, уведомлений и статусов |
| Авторизация | HttpOnly cookie | JWT недоступен JavaScript-коду браузера |

Next.js выполняет роль BFF — Backend for Frontend. Браузер обращается только к
same-origin endpoint вида `/api/*`. BFF проверяет cookie и вызывает внутренний
ScoutScope/CRM API.

### 3.2. Мобильное приложение

| Часть | Технология | Назначение |
| --- | --- | --- |
| Framework | Flutter | единая кодовая база iOS и Android |
| Язык | Dart | бизнес-логика и UI мобильного приложения |
| Навигация | `go_router` | экраны, guards и deep links |
| HTTP-клиент | Dio | REST-запросы, interceptors и refresh token flow |
| Состояние | Riverpod | состояние приложения и dependency injection |
| Локальная БД | Drift поверх SQLite | offline-кеш и очередь несинхронизированных действий |
| Безопасное хранение | `flutter_secure_storage` | refresh token в iOS Keychain/Android Keystore |
| Push | Firebase Cloud Messaging | push-уведомления iOS и Android |
| Realtime | `web_socket_channel` | WebSocket-события при открытом приложении |

Мобильное приложение не использует browser cookie. Оно получает короткоживущий
access token и ротируемый refresh token. Refresh token хранится только в iOS
Keychain или Android Keystore через `flutter_secure_storage`.

### 3.3. Backend

Целевой центральный backend реализуется на Python и FastAPI. Существующий
ScoutScope Backsite на Node.js используется до завершения миграции, после чего
FastAPI становится единой точкой входа для авторизации и CRM-функций:

| Часть | Технология |
| --- | --- |
| Runtime | Python 3.12+ |
| HTTP API | FastAPI + Uvicorn |
| Валидация | Pydantic v2 |
| ORM и SQL | SQLAlchemy 2 Async + `asyncpg` |
| Миграции БД | Alembic |
| Авторизация | JWT access token + rotating refresh token |
| Очереди | Celery поверх Redis |
| Realtime | FastAPI WebSocket или SSE |
| Логи | Structlog, JSON logs |
| Тестирование | Pytest + HTTPX |
| API-контракт | OpenAPI 3.1, генерируется FastAPI |

На первом этапе не нужно разделять backend на микросервисы. Лучше использовать
модульный монолит: один deployable API, но отдельные модули `auth`, `crm`,
`teams`, `reports`, `notifications`, `files` и `admin`.

Когда нагрузка вырастет, worker и realtime gateway можно вынести в отдельные
процессы без изменения API клиентов.

## 4. Где разворачиваются данные

### PostgreSQL

PostgreSQL является единственным постоянным источником истины. Рекомендуемый
production-вариант — отдельный managed PostgreSQL-инстанс в приватной сети.
Допустим самостоятельный PostgreSQL в Docker/VM, если настроены резервные копии,
мониторинг, обновления и восстановление.

PostgreSQL нельзя открывать в интернет. Подключаться к нему могут только API и
служебные worker-процессы.

Минимальные production-требования:

- PostgreSQL 16 или новее;
- отдельный пользователь БД с ограниченными правами;
- TLS или приватная сеть между API и БД;
- ежедневный backup и point-in-time recovery;
- отдельная replica для тяжёлой аналитики при росте нагрузки;
- PgBouncer, если количество соединений становится большим.

### Redis

Redis хранит только временные или восстанавливаемые данные. PostgreSQL остаётся
источником истины.

Redis используется для:

1. rate limit по IP и пользователю;
2. кеша часто читаемых справочников;
3. хранения одноразовых кодов и коротких блокировок;
4. ротации refresh token и отзыва сессий;
5. очередей фоновых задач;
6. доставки realtime-событий между несколькими экземплярами API;
7. distributed lock для операций, которые нельзя выполнить одновременно.

Для production нужен Redis 7+ в приватной сети, с паролем/ACL и TLS либо
защищённым внутренним соединением.

Redis Pub/Sub подходит для мгновенных событий, потеря которых допустима.
Redis Streams или Celery используются для задач, которые нельзя потерять.

### Объектное хранилище

Файлы не записываются внутрь PostgreSQL и не хранятся на локальном диске API.
Используется S3-совместимое object storage:

- аватары;
- вложения к задачам;
- экспортированные PDF/Excel;
- изображения и видео;
- временные файлы импорта.

В PostgreSQL сохраняются только `object_key`, имя, MIME-тип, размер, владелец и
дата создания. Клиент загружает файл по короткоживущему presigned URL.

## 5. Единая модель идентификатора

`auth_users.id` — единственный ID человека во всей экосистеме.

```text
auth_users.id
    ├── crm_profiles.user_id
    ├── crm_team_members.user_id
    ├── crm_tasks.assignee_user_id
    ├── crm_reports.created_by_user_id
    ├── crm_notifications.user_id
    └── mobile_devices.user_id
```

Нельзя создавать отдельные аккаунты `web_user` и `mobile_user`. Веб и мобильное
приложение получают один и тот же `user.id` после авторизации.

Пример таблицы мобильных устройств:

```sql
CREATE TABLE public.mobile_devices (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES public.auth_users(id)
    ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  push_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX mobile_devices_user_id_idx
  ON public.mobile_devices(user_id);
```

## 6. Коммуникация веба и мобильного приложения

### Обычные запросы

Для создания и чтения данных используется HTTPS REST API с JSON:

```text
Web → Next.js BFF → CRM API → PostgreSQL
Mobile → CRM API → PostgreSQL
```

Примеры endpoint:

```text
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/me

GET    /api/v1/teams
POST   /api/v1/teams
GET    /api/v1/tasks
POST   /api/v1/tasks
PATCH  /api/v1/tasks/:taskId
GET    /api/v1/reports
POST   /api/v1/files/presign
GET    /api/v1/notifications
PATCH  /api/v1/notifications/:id/read
```

### Realtime

Если пользователь изменил задачу в вебе, мобильное приложение должно увидеть
изменение без постоянного опроса сервера.

```text
1. Web отправляет PATCH /tasks/:id.
2. API открывает транзакцию PostgreSQL.
3. API сохраняет изменение задачи.
4. API создаёт запись события в outbox в той же транзакции.
5. Worker читает outbox и публикует событие в Redis.
6. Realtime gateway получает событие из Redis.
7. Gateway отправляет событие подключённому Web/Mobile клиенту.
8. Web обновляет кеш TanStack Query, а Flutter — состояние Riverpod/локальную БД.
```

Пример события:

```json
{
  "eventId": "dc6faa94-81e7-4dd4-b82e-4e241a7ebce0",
  "type": "crm.task.updated",
  "version": 1,
  "occurredAt": "2026-09-15T12:00:00.000Z",
  "actorUserId": "550e8400-e29b-41d4-a716-446655440000",
  "teamId": "2543252b-0ee6-4c6d-91cb-bc51676190ac",
  "data": {
    "taskId": "51cc067d-492c-423c-b1b0-20816fc66324",
    "status": "done"
  }
}
```

Каждое событие содержит `eventId` и `version`. Клиент должен уметь безопасно
получить одно событие повторно. После события клиент может запросить актуальную
сущность через REST — событие уведомляет об изменении, а не заменяет БД.

## 7. Redis-каналы и ключи

Рекомендуемая схема именования:

```text
crm:cache:user:{userId}
crm:cache:team:{teamId}
crm:ratelimit:ip:{ip}:{route}
crm:ratelimit:user:{userId}:{route}
crm:session:{sessionId}
crm:refresh:{tokenId}
crm:lock:report:{reportId}
crm:stream:domain-events
crm:queue:notifications
crm:queue:exports
crm:presence:user:{userId}
```

Правила:

- у cache, rate limit, presence и одноразовых ключей всегда есть TTL;
- пароль и полный JWT никогда не записываются в Redis logs;
- очередь должна иметь retry, exponential backoff и dead-letter обработку;
- сообщение считается выполненным только после успешной обработки;
- Redis недоступен из публичного интернета.

## 8. Регистрация и авторизация

### Веб-регистрация

```text
1. Браузер → POST /api/auth/register в Next.js.
2. BFF оставляет только разрешённые поля.
3. BFF → POST /api/ecosystem/auth/register в ScoutScope Backsite.
4. Backsite проверяет email, пароль и уникальность пользователя.
5. Пароль хешируется PBKDF2-SHA256 с индивидуальной солью.
6. Пользователь записывается в auth_users.
7. Backsite возвращает JWT только BFF.
8. BFF устанавливает Secure HttpOnly cookie.
```

### Мобильная регистрация

```text
1. Mobile → POST /api/v1/auth/register.
2. API создаёт того же пользователя в auth_users.
3. API возвращает короткий access token и refresh token.
4. Mobile хранит access token в памяти.
5. Mobile хранит refresh token через `flutter_secure_storage`.
6. При обновлении refresh token старый токен отзывается.
```

Рекомендуемые сроки:

- access token: 10–15 минут;
- web cookie/session: до 2 часов с безопасным продлением;
- mobile refresh token: до 30 дней с обязательной ротацией;
- при смене пароля отзываются все активные refresh-сессии.

Для мобильных endpoint нужно добавить таблицу сессий:

```sql
CREATE TABLE public.auth_refresh_sessions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES public.auth_users(id)
    ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  device_id UUID,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX auth_refresh_sessions_user_id_idx
  ON public.auth_refresh_sessions(user_id);
```

В БД хранится хеш refresh token, а не исходный токен.

## 9. Пример потока данных CRM

### Создание задачи в вебе

```text
Web form
  → POST /api/tasks
  → Next.js BFF проверяет web session
  → POST /api/v1/tasks во внутренний API
  → API проверяет членство пользователя в команде
  → INSERT crm_tasks в PostgreSQL
  → INSERT crm_outbox в той же транзакции
  → Worker публикует crm.task.created через Redis
  → Mobile получает WebSocket-событие
  → Mobile обновляет список задач
```

### Изменение задачи без интернета на мобильном устройстве

```text
1. Mobile сохраняет действие в локальную очередь.
2. Интерфейс оптимистично обновляет задачу.
3. После восстановления сети Mobile отправляет PATCH с operationId.
4. API проверяет operationId и не выполняет действие второй раз.
5. При конфликте версий API отвечает 409 conflict.
6. Mobile получает актуальную версию и предлагает повторить изменение.
```

Для изменяемых CRM-сущностей полезно хранить числовое поле `version` и применять
optimistic locking:

```sql
UPDATE crm_tasks
SET status = $1,
    version = version + 1,
    updated_at = NOW()
WHERE id = $2
  AND version = $3;
```

Если обновлено 0 строк, клиент работал с устаревшей версией.

## 10. Рекомендуемые CRM-таблицы

```text
auth_users                  единые пользователи экосистемы
crm_profiles                настройки пользователя в CRM
crm_teams                   команды
crm_team_members            пользователь + команда + роль
crm_tasks                   задачи
crm_task_comments           комментарии
crm_reports                 отчёты и аналитика
crm_files                   метаданные файлов object storage
crm_notifications           уведомления пользователя
mobile_devices              push-токены устройств
auth_refresh_sessions       мобильные refresh-сессии
crm_outbox                  гарантированная отправка событий
crm_processed_operations    защита от повторного mobile-запроса
```

Роли участника команды должны находиться в `crm_team_members`. Глобальные роли
администратора системы не должны смешиваться с ролями конкретной команды.

Пример:

```text
global siteRole: user | admin | main_admin
team role: owner | manager | coach | analyst | player | viewer
```

## 11. Безопасность

- Только HTTPS.
- Web JWT хранится только в Secure HttpOnly cookie.
- Mobile refresh token хранится через `flutter_secure_storage` в Keychain/Keystore.
- Проверка прав выполняется backend-сервером для каждого запроса.
- `user_id`, роль и team membership нельзя принимать на доверии от клиента.
- CORS содержит только известные web origins.
- Для cookie-запросов применяется SameSite и same-origin/CSRF-проверка.
- Rate limit применяется по IP и по пользователю через Redis.
- SQL-запросы параметризованы.
- Файлы проверяются по размеру, MIME-type и при необходимости антивирусом.
- Секреты находятся в secret manager или environment, но не в Git.
- Логи не содержат паролей, JWT, cookie и персональных данных целиком.
- Административные действия записываются в audit log.
- Блокировка пользователя проверяется по актуальной записи PostgreSQL.

## 12. Развёртывание

Рекомендуемая production-схема:

```text
Internet
   │
   ▼
CDN/WAF
   │
   ▼
Nginx / Load Balancer
   ├── web-1: Next.js
   ├── web-2: Next.js
   ├── api-1: FastAPI Identity/CRM API
   ├── api-2: FastAPI Identity/CRM API
   ├── realtime gateway
   └── background worker

Private network
   ├── PostgreSQL
   ├── Redis
   └── S3-compatible object storage endpoint
```

Компоненты запускаются в Docker-контейнерах. Для начального production достаточно
Docker Compose на одном сервере с отдельным managed PostgreSQL и Redis. При росте
нагрузки stateless web/API-контейнеры переносятся в Kubernetes или managed
container platform.

Не рекомендуется размещать PostgreSQL внутри того же контейнера, что и API.
Локальный диск API также не используется для постоянных пользовательских файлов.

## 13. Environment variables

Пример общих переменных backend:

```env
NODE_ENV=production
BACKSITE_PORT=8090
SCOUTSCOPE_DATABASE_URL=postgresql://crm_user:password@postgres.internal:5432/scoutscope
SCOUTSCOPE_REDIS_URL=redis://:password@redis.internal:6379/0
BACKSITE_JWT_SECRET=<secret-manager-value>
BACKSITE_JWT_ISSUER=atlant-identity
BACKSITE_JWT_AUDIENCE=atlant-ecosystem
S3_ENDPOINT=https://storage.example.com
S3_BUCKET=performance-crm
S3_ACCESS_KEY_ID=<secret-manager-value>
S3_SECRET_ACCESS_KEY=<secret-manager-value>
```

Web:

```env
SCOUTSCOPE_API_URL=http://scoutscope-api.internal:8090
```

Mobile public build configuration:

```env
EXPO_PUBLIC_API_URL=https://api.example.com/api/v1
EXPO_PUBLIC_WS_URL=wss://api.example.com/realtime
```

В `EXPO_PUBLIC_*` и `NEXT_PUBLIC_*` нельзя записывать секреты: эти значения
попадают в клиентскую сборку.

## 14. Этапы реализации

### Этап 1 — текущий MVP

- единый `auth_users`;
- регистрация, вход и `/me`;
- web BFF и HttpOnly cookie;
- PostgreSQL;
- локальный rate limit;
- один экземпляр backend.

### Этап 2 — CRM API

- таблицы команд, участников, задач и отчётов;
- OpenAPI-контракт;
- Redis rate limit и кеш;
- audit log;
- object storage;
- background worker и Celery.

### Этап 3 — мобильное приложение

- Flutter + Dart;
- mobile access/refresh tokens;
- `flutter_secure_storage`;
- push tokens;
- offline queue;
- versioning и idempotency операций.

### Этап 4 — realtime и масштабирование

- outbox pattern;
- Redis Streams/PubSub;
- WebSocket gateway;
- несколько API-инстансов;
- replica PostgreSQL;
- метрики, tracing и alerting.

## 15. Главные архитектурные правила

1. Один человек — один `auth_users.id` для веба и мобильного приложения.
2. PostgreSQL — источник истины, Redis — ускоритель и транспорт временных данных.
3. Web и Mobile не общаются напрямую, только через общий API.
4. Браузер не получает JWT в JavaScript.
5. Мобильный refresh token хранится в защищённом хранилище устройства.
6. Любое право доступа повторно проверяется backend-сервером.
7. Событие в Redis не заменяет запись в PostgreSQL.
8. Критические события доставляются через outbox + Streams/очередь.
9. Файлы находятся в object storage, а не в БД или локальной папке API.
10. Новые модули сначала создаются внутри модульного монолита; микросервисы
    появляются только при реальной необходимости масштабирования.
