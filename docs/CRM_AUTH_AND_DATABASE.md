# Performance CRM: авторизация, регистрация и схема данных

## 1. Назначение

Performance CRM использует общую учетную запись экосистемы Atlant/ScoutScope.
Источником истины для пользователей является ScoutScope Backsite и таблица
PostgreSQL `auth_users`.

CRM не должна:

- создавать отдельную таблицу пользователей с другими паролями;
- хранить пароль, JWT или хеш пароля в своей базе;
- отправлять JWT в JavaScript-код браузера;
- принимать от клиента `siteRole`, `isAdmin`, `unrestricted` или другие поля доступа.

Пользователь, зарегистрированный в CRM, может войти с теми же данными в Atlant
и ScoutScope. Пользователь, созданный в Atlant или ScoutScope, может войти в CRM.

## 2. Архитектура

```text
Браузер Performance CRM
        │
        │ same-origin /api/auth/*
        ▼
Next.js BFF Performance CRM
        │
        │ /api/ecosystem/auth/* + Bearer JWT
        ▼
ScoutScope Backsite
        │
        ▼
PostgreSQL: auth_users
```

Браузер не обращается к ScoutScope Backsite напрямую. Next.js BFF получает JWT
от Backsite и сохраняет его в cookie `performance_ecosystem_session` со свойствами
`HttpOnly`, `Secure` в production и `SameSite=Strict`.

Адрес Backsite задается только на сервере CRM:

```env
SCOUTSCOPE_API_URL=http://127.0.0.1:8090
```

Переменная не должна иметь префикс `NEXT_PUBLIC_`.

## 3. Единый ID пользователя

В экосистеме существует один идентификатор пользователя:

```text
┌───────────────────────────────────────────────┐
│ ecosystem_user_id = auth_users.id             │
│ формат: UUID, в существующей БД хранится TEXT │
└───────────────────────────────────────────────┘
          │              │              │
          ▼              ▼              ▼
   CRM-профиль      команда CRM     подписки/доступ
     user_id          user_id            user_id
```

Правило для нового функционала CRM:

```sql
user_id TEXT NOT NULL
  REFERENCES public.auth_users(id)
  ON DELETE CASCADE
```

Не нужно создавать `crm_users.id` для идентификации того же человека. Если
CRM-профиль относится к одному пользователю, `user_id` одновременно является
его первичным и внешним ключом:

```sql
CREATE TABLE public.crm_profiles (
  user_id TEXT PRIMARY KEY
    REFERENCES public.auth_users(id)
    ON DELETE CASCADE,
  faceit_url TEXT,
  access_mode TEXT NOT NULL CHECK (access_mode IN ('personal', 'team')),
  team_role TEXT CHECK (team_role IN ('player', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Для сущностей, которых у пользователя может быть несколько, используется
отдельный ID сущности и общий `user_id` владельца:

```sql
CREATE TABLE public.crm_reports (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL
    REFERENCES public.auth_users(id)
    ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX crm_reports_user_id_idx ON public.crm_reports(user_id);
```

`user_id` берется только из проверенной сервером сессии (`request.auth.user.id`).
Нельзя доверять `user_id`, присланному браузером в JSON, query string или header.

## 4. Endpoint CRM для браузера

Base URL совпадает с доменом CRM. Например: `https://crm.example.com`.

### POST `/api/auth/register`

Регистрирует общую учетную запись и сразу создает сессию CRM.

Заголовок:

```http
Content-Type: application/json
```

Соло-регистрация:

```json
{
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "password": "StrongPassword123",
  "access": "personal",
  "role": null,
  "faceit": "https://www.faceit.com/en/players/example",
  "teamCode": null
}
```

Командный доступ игрока:

```json
{
  "name": "Иван Иванов",
  "email": "ivan@example.com",
  "password": "StrongPassword123",
  "access": "team",
  "role": "player",
  "faceit": "https://www.faceit.com/en/players/example",
  "teamCode": "TEAM-2026"
}
```

Командный доступ стаффа:

```json
{
  "name": "Анна Тренер",
  "email": "coach@example.com",
  "password": "StrongPassword123",
  "access": "team",
  "role": "staff",
  "faceit": null,
  "teamCode": "TEAM-2026"
}
```

Допустимые значения:

| Поле | Формат |
| --- | --- |
| `name` | строка от 2 до 120 символов |
| `email` | корректный email, уникальный в экосистеме |
| `password` | 8–128 символов, минимум одна буква и одна цифра |
| `access` | `personal` или `team` |
| `role` | для команды: `player` или `staff` |
| `faceit` | URL до 500 символов или `null` |
| `teamCode` | строка до 64 символов или `null` |

Успешный ответ: `201 Created`. JWT в JSON не возвращается — BFF устанавливает
защищенную cookie.

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "login": "ivan",
    "name": "Иван Иванов",
    "email": "ivan@example.com",
    "isActive": true,
    "isEmailVerified": false,
    "tariff": {
      "code": null,
      "status": "inactive"
    }
  },
  "access": {
    "tariffActive": false,
    "admin": false
  }
}
```

### POST `/api/auth/login`

```json
{
  "loginOrEmail": "ivan@example.com",
  "password": "StrongPassword123"
}
```

Успешный ответ: `200 OK`. BFF обновляет защищенную session cookie.

### GET `/api/auth/me`

Возвращает текущего пользователя. Браузер автоматически отправляет HttpOnly
cookie; вручную добавлять `Authorization` не нужно.

```ts
const response = await fetch("/api/auth/me", {
  credentials: "same-origin",
  cache: "no-store",
});

if (response.ok) {
  const { user } = await response.json();
  console.log(user.id);
}
```

При отсутствии или истечении сессии возвращается `401 Unauthorized`.

### POST `/api/auth/logout`

```ts
await fetch("/api/auth/logout", {
  method: "POST",
  credentials: "same-origin",
});
```

Ответ: `200 OK`. Cookie удаляется.

## 5. Канонический API ScoutScope Backsite

Эти endpoint используются сервером CRM. Вызывать их напрямую из браузера CRM
не следует.

| Метод | Endpoint | Назначение |
| --- | --- | --- |
| `POST` | `/api/ecosystem/auth/register` | регистрация общего аккаунта |
| `POST` | `/api/ecosystem/auth/login` | получение JWT |
| `GET` | `/api/ecosystem/auth/me` | получение пользователя по JWT |
| `DELETE` | `/api/ecosystem/auth/me` | удаление своего аккаунта |

Для `GET` и `DELETE /me` Backsite ожидает:

```http
Authorization: Bearer <JWT>
```

Старые `/api/site/auth/*` сохранены как совместимые aliases, но новый код должен
использовать `/api/ecosystem/auth/*`.

## 6. Как Backsite записывает регистрацию CRM

BFF сам формирует разрешенный `profileMeta`:

```json
{
  "registration_source": "performance_crm",
  "apps": {
    "performance_crm": {
      "accessMode": "team",
      "role": "player",
      "faceitUrl": "https://www.faceit.com/en/players/example",
      "teamCode": "TEAM-2026"
    }
  }
}
```

Backsite повторно применяет allowlist. Поля `siteRole`, `site_role`, `isAdmin`,
`unrestricted`, тариф и любые неизвестные поля публичная регистрация игнорирует.

Основные поля `auth_users`:

| Поле БД | Назначение |
| --- | --- |
| `id` | единый ecosystem user ID |
| `login` | уникальный логин; при регистрации CRM создается из email |
| `full_name` | имя пользователя |
| `email` | уникальная почта |
| `password_hash` | PBKDF2-SHA256, индивидуальная случайная соль |
| `is_active` | разрешен ли вход |
| `is_email_verified` | подтверждена ли почта |
| `failed_login_attempts` | число неудачных попыток входа |
| `locked_until` | блокировка после превышения попыток |
| `tariff_code`, `tariff_status` | тариф и его состояние |
| `profile_meta_json` | безопасные метаданные приложений |
| `registered_at`, `last_login_at` | даты регистрации и последнего входа |
| `created_at`, `updated_at` | технические даты записи |

Пароль никогда не хранится в открытом виде. Текущий формат хеша:

```text
pbkdf2_sha256$390000$<random-salt>$<derived-key>
```

## 7. Формат ошибок

```json
{
  "error": {
    "code": "user_already_exists",
    "message": "User with this login or email already exists.",
    "details": null
  }
}
```

Основные статусы:

| HTTP | Когда возвращается |
| --- | --- |
| `400` | неправильный email, слабый пароль или невалидные поля |
| `401` | неправильный пароль, отсутствующая или истекшая сессия |
| `403` | аккаунт отключен или недостаточно прав |
| `409` | логин или email уже существует |
| `423` | аккаунт временно заблокирован |
| `429` | превышен rate limit входа или регистрации |
| `502` | CRM не может подключиться к ScoutScope Backsite |

Интерфейс должен показывать безопасное пользовательское сообщение из
`error.message`, но не должен выводить stack trace или внутренние ошибки БД.

## 8. Пример клиентского кода регистрации

```ts
type RegistrationPayload = {
  name: string;
  email: string;
  password: string;
  access: "personal" | "team";
  role: "player" | "staff" | null;
  faceit: string | null;
  teamCode: string | null;
};

export async function register(payload: RegistrationPayload) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error?.message || "Не удалось зарегистрироваться");
  }
  return result.user;
}
```

## 9. Checklist нового CRM endpoint

При добавлении защищенной CRM-ручки:

1. Получить пользователя из серверной HttpOnly-сессии.
2. Проверить JWT через ScoutScope Backsite или общий server-side middleware.
3. Использовать только подтвержденный `user.id` как `user_id` в SQL.
4. Не принимать роль, тариф или `user_id` из тела запроса как доказательство прав.
5. Использовать параметризованные SQL-запросы (`$1`, `$2`, ...).
6. Ограничить длину и допустимые значения всех входных полей.
7. Для административной операции проверять актуального пользователя из БД, а
   не только роль, записанную в старом JWT.
8. Не возвращать `password_hash`, `profile_meta_json`, JWT и внутренние поля доступа.

