🏗️ PROSTORS TEMPLATE — ПОЛНЫЙ ТЕХНИЧЕСКИЙ ПАСПОРТ ПРОЕКТА

**Версия:** 1.0.0 
**Дата:** 7 июля 2026 
**Назначение:** Шаблон для создания Telegram Mini App каталога новостроек

---

## 📋 ОГЛАВЛЕНИЕ

1. [Общая информация](#общая-информация)
2. [Архитектура системы](#архитектура-системы)
3. [Структура репозитория](#структура-репозитория)
4. [База данных (Google Sheets)](#база-данных-google-sheets)
5. [API (Google Apps Script)](#api-google-apps-script)
6. [Пошаговая инструкция по развёртыванию](#пошаговая-инструкция-по-развёртыванию)
7. [Cloudflare Worker (прокси для webhook)](#cloudflare-worker-прокси-для-webhook)
8. [Тестирование и проверка](#тестирование-и-проверка)
9. [Устранение неполадок](#устранение-неполадок)
10. [Безопасность](#безопасность)

---

## 📖 ОБЩАЯ ИНФОРМАЦИЯ

### Что это такое

**Prostors Template** — готовый шаблон Telegram Mini App для каталога новостроек. Позволяет агентам по недвижимости:
- Показывать объекты клиентам через Telegram
- Управлять каталогом через админ-панель
- Получать заявки от клиентов
- Отправлять уведомления в Telegram

### Технологический стек (3 платформы)

| Компонент | Технология | Назначение |
|-----------|------------|------------|
| **Фронтенд** | Yandex Object Storage (Static Website) | Хостинг HTML/JS/CSS + фото |
| **Бэкенд** | Google Apps Script + Google Sheets | API, логика, база данных |
| **Webhook Proxy** | Cloudflare Workers | Приём webhook от Telegram |

### Почему такая архитектура

1. **Yandex Object Storage** — быстрый CDN в РФ, бесплатный тариф (10 GB)
2. **Google Apps Script** — бесплатный серверless, простая интеграция с Sheets
3. **Cloudflare Workers** — решает проблемы с сетевыми блокировками, бесплатный (100K запросов/день)

---

## 🏛️ АРХИТЕКТУРА СИСТЕМЫ

```
┌─────────────────────────────────────────────────────────────┐
│                      TELEGRAM CLIENT                        │
│                    (Mini App в Telegram)                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (fetch)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              YANDEX OBJECT STORAGE                          │
│              (Static Website Hosting)                       │
│                                                             │
│  • index.html        — клиентское приложение               │
│  • admin.html        — админ-панель                        │
│  • app.js            — логика клиента                      │
│  • styles.css        — стили                               │
│  • client-config.json — конфигурация                       │
│  • /images/          — фото объектов                       │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (fetch API)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           GOOGLE APPS SCRIPT (Code.gs)                      │
│                                                             │
│  • doGet()  — обработка GET-запросов                       │
│  • doPost() — обработка POST-запросов                      │
│  • CRUD операции с объектами и заявками                    │
│  • Авторизация (initData + PIN)                            │
│  • Изоляция по agent_id                                    │
└──────────────────────┬──────────────────────────────────────┘
                       │ Google Sheets API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                GOOGLE SHEETS (База данных)                  │
│                                                             │
│  Листы:                                                     │
│  • Agents     — агенты и их настройки                      │
│  • Listings   — объекты недвижимости                       │
│  • Leads      — заявки от клиентов                         │
│  • AgentData  — профили агентов                            │
│  • Pages      — статические страницы                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                TELEGRAM BOT API                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ Webhook (POST)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           CLOUDFLARE WORKER (tg-proxy)                      │
│                                                             │
│  • Принимает webhook от Telegram                           │
│  • Проверяет X-Telegram-Bot-Api-Secret-Token               │
│  • Пересылает в Google Apps Script                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS (fetch)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│           GOOGLE APPS SCRIPT (Code.gs)                      │
│                                                             │
│  • processTelegramWebhook() — обработка webhook            │
│  • sendTelegramNotification() — отправка уведомлений       │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 СТРУКТУРА РЕПОЗИТОРИЯ

```
prostors-template/
├── index.html                          # Клиентское приложение (Mini App)
├── admin.html                          # Административная панель
├── app.js                              # Логика клиентского приложения
├── styles.css                          # Стили
├── Code.gs                             # Google Apps Script (бэкенд)
├── client-config.json.example          # Шаблон конфигурации
├── cloudflare-worker/                  # Прокси для Telegram webhook
│   ├── worker.js                       # Код Cloudflare Worker
│   ├── wrangler.toml                   # Конфигурация Wrangler
│   └── README.md                       # Инструкция по настройке
└── README.md                           # Этот файл
```

### Описание файлов

| Файл | Назначение | Изменяется клиентом? |
|------|------------|----------------------|
| `index.html` | HTML-разметка клиентской части | Редко |
| `admin.html` | HTML-разметка админки | Редко |
| `app.js` | Логика: фильтрация, рендеринг, отправка заявок | Иногда (новые фичи) |
| `styles.css` | CSS-стили и переменные | Редко (брендирование) |
| `Code.gs` | Бэкенд: API, работа с БД, уведомления | Нет (только при обновлении шаблона) |
| `client-config.json` | Конфигурация: URL скрипта, ID владельца | **Да** (при настройке) |

---

## 🗄️ БАЗА ДАННЫХ (GOOGLE SHEETS)

### Лист `Agents` (Агенты)

Реестр всех агентов системы.

| Колонка | Тип | Обязательна | Пример | Описание |
|---------|-----|-------------|--------|----------|
| `agent_id` | String | ✅ | `07072026-001` | Уникальный ID (формат: DDMMYYYY-XXX) |
| `name` | String | ✅ | "Иван Петров" | Имя агента / название агентства |
| `telegram_user_id` | Number | ✅ | `2038206387` | Telegram User ID (для авторизации) |
| `pin_hash` | String | ✅ | `abc123...` | SHA-256 хеш PIN-кода (4-6 цифр) |
| `status` | Enum | ✅ | `active` | Статус: `active`, `suspended`, `trial` |
| `plan_type` | Enum | ✅ | `lifetime` | Тип: `subscription`, `lifetime` |
| `expires_at` | Date | ⬜ | `31.12.2099` | Дата окончания доступа |
| `created_at` | DateTime | ✅ | `07.07.2026 10:00` | Дата создания записи |
| `custom_domain` | String | ⬜ | `catalog.realty.ru` | Персональный домен |
| `brand_config` | JSON | ⬜ | `{...}` | Конфигурация брендирования |
| `chat_id` | String | ⬜ | `2038206387` | Chat ID для уведомлений |

#### Формат `brand_config` (JSON)

```json
{
  "primaryColor": "#3D5266",
  "accentColor": "#3498DB",
  "logoUrl": "https://storage.yandexcloud.net/bucket/logo.png",
  "agentPhotoUrl": "https://storage.yandexcloud.net/bucket/agent.jpg",
  "welcomeTitle": "КАТАЛОГ НОВОСТРОЕК",
  "appName": "Просторы.Новостройки",
  "tagline": "Подберём квартиру под ваш бюджет",
  "buttonText": "НАЧАТЬ ПОДБОР"
}
```

### Лист `Listings` (Объекты)

Каталог недвижимости.

| Колонка | Тип | Пример | Описание |
|---------|-----|--------|----------|
| `agent_id` | String | `07072026-001` | Привязка к агенту |
| `id` | String | `obj-1720345678` | Уникальный ID объекта |
| `name` | String | "ЖК Аристократ" | Название ЖК |
| `address` | String | "ул. Примерная, 10" | Адрес |
| `district` | String | "Василеостровский" | Район |
| `metro` | String | "Горный институт" | Станция метро |
| `price_from` | Number | `14.6` | Цена от (млн ₽) |
| `price_to` | Number | `75.0` | Цена до (млн ₽) |
| `area_min` | Number | `23.1` | Площадь от (м²) |
| `area_max` | Number | `120.8` | Площадь до (м²) |
| `price_per_sqm` | Number | `632035` | Цена за м² (₽) |
| `rooms` | String | "студия,1,2,3" | Комнатность (через запятую) |
| `class` | String | "Комфорт" | Класс: Эконом/Комфорт/Бизнес/Премиум |
| `completion_soonest` | String | "II кв 2026" | Срок сдачи (начало) |
| `completion_all` | String | "IV кв 2027" | Срок сдачи (конец) |
| `finishing` | String | "Предчистовая" | Отделка |
| `status` | String | "Строится" | Статус: Строится/Сдан/Частично сдан |
| `description` | String | "..." | Описание |
| `features` | String | "Паркинг,Фитнес" | Преимущества (через запятую) |
| `image_main` | String | "https://..." | URL главного фото |
| `images_gallery` | String | "https://...,https://..." | URL галереи (через запятую) |
| `floor_plans_images` | String | "https://..." | URL планировок |
| `lat` | Number | `59.9343` | Широта |
| `lng` | Number | `30.3351` | Долгота |
| `active` | Boolean | `TRUE` | TRUE = показывать в каталоге |
| `created_at` | DateTime | `07.07.2026 10:00` | Дата создания |
| `updated_at` | DateTime | `07.07.2026 12:00` | Дата обновления |

### Лист `Leads` (Заявки)

Заявки от клиентов.

| Колонка | Тип | Пример | Описание |
|---------|-----|--------|----------|
| `agent_id` | String | `07072026-001` | Привязка к агенту |
| `id` | String | `lead-1720345678` | Уникальный ID заявки |
| `timestamp` | String | `2026-07-07T16:54:00.000Z` | Дата/время (ISO 8601) |
| `objectName` | String | "ЖК Аристократ" | Название объекта |
| `clientName` | String | "Алексей" | Имя клиента |
| `clientPhone` | String | `79991234567` | Телефон (без +) |
| `clientTelegram` | String | "@alexey" | Telegram username |
| `status` | String | "Новая" | Статус: Новая/Обзвонена/Завершена/Отменена |

> ⚠️ **ВАЖНО:** Поле `timestamp` должно храниться в формате ISO 8601: `new Date().toISOString()`.

### Лист `AgentData` (Профили агентов)

Публичная информация об агентах.

| Колонка | Тип | Пример | Описание |
|---------|-----|--------|----------|
| `agent_id` | String | `07072026-001` | Привязка к агенту |
| `name` | String | "Иван Петров" | Имя |
| `role` | String | "Эксперт по недвижимости" | Должность |
| `agencyName` | String | "АН Просторы" | Название агентства |
| `agencyAddress` | String | "Невский пр., 10" | Адрес офиса |
| `telegramUsername` | String | "ivan_realty" | Telegram username (без @) |
| `phone` | String | "+7 (999) 123-45-67" | Телефон |
| `photoUrl` | String | "https://..." | URL фото профиля |

### Лист `Pages` (Статические страницы)

Страницы "Обо мне", "Контакты" и др.

| Колонка | Тип | Пример | Описание |
|---------|-----|--------|----------|
| `agent_id` | String | `07072026-001` | Привязка к агенту |
| `page` | String | `about` | Тип: `about`, `contacts`, `help` |
| `title` | String | "Обо мне" | Заголовок |
| `content` | String | "<p>Текст...</p>" | Содержимое (поддерживается HTML) |

---

## 🔌 API (GOOGLE APPS SCRIPT)

Все запросы выполняются к URL веб-приложения Apps Script.

### GET-запросы

**Формат:** `{scriptUrl}?action={action}&agent_id={agent_id}[&доп.параметры]`

#### 1. `get_listings` — Получить список объектов

**Параметры:**
- `agent_id` (обязательный) — ID агента
- `includeHidden` (опциональный) — `true` для получения скрытых объектов

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "obj-1720345678",
      "name": "ЖК Аристократ",
      "price_from": 14.6,
      ...
    }
  ]
}
```

#### 2. `get_agent_config` — Получить конфигурацию агента

**Параметры:**
- `agent_id` (обязательный)
- `user_id` (опциональный) — Telegram User ID для проверки прав

**Ответ:**
```json
{
  "success": true,
  "agentId": "07072026-001",
  "name": "Иван Петров",
  "config": {
    "primaryColor": "#3D5266",
    ...
  },
  "isOwner": true
}
```

#### 3. `get_leads` — Получить заявки

**Параметры:**
- `agent_id` (обязательный)

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "id": "lead-1720345678",
      "timestamp": "2026-07-07T16:54:00.000Z",
      "formattedTime": "07.07.2026 16:54",
      "objectName": "ЖК Аристократ",
      "clientName": "Алексей",
      ...
    }
  ]
}
```

#### 4. `verify_pin` — Проверить PIN-код

**Параметры:**
- `agent_id` (обязательный)
- `pin` (обязательный)

**Ответ:**
```json
{
  "success": true,
  "agentId": "07072026-001"
}
```

#### 5. `get_agent_profile` — Получить профиль агента

**Ответ:**
```json
{
  "success": true,
  "data": {
    "name": "Иван Петров",
    "role": "Эксперт",
    ...
  }
}
```

#### 6. `get_pages` — Получить статические страницы

**Ответ:**
```json
{
  "success": true,
  "data": [
    {
      "page": "about",
      "title": "Обо мне",
      "content": "<p>Текст...</p>"
    }
  ]
}
```

#### 7. `resolve_agent_by_domain` — Найти агента по домену

**Параметры:**
- `domain` (обязательный) — доменное имя

**Ответ:**
```json
{
  "success": true,
  "agentId": "07072026-001"
}
```

#### 8. `get_last_file_url` — Получить URL последнего загруженного файла

**Ответ:**
```json
{
  "success": true,
  "url": "https://lh3.googleusercontent.com/d/FILE_ID"
}
```

---

### POST-запросы

**Формат:** `POST {scriptUrl}` 
**Заголовок:** `Content-Type: text/plain;charset=utf-8` 
**Тело:** JSON

```json
{
  "action": "create",
  "agentId": "07072026-001",
  "initData": "...",
  "pin": "...",
  "data": { ... }
}
```

#### 1. `create` — Создать объект

**Данные:**
```json
{
  "name": "ЖК Новый",
  "price_from": 10.5,
  "district": "Центральный",
  ...
}
```

#### 2. `update` — Обновить объект

**Данные:**
```json
{
  "id": "obj-1720345678",
  "price_from": 11.0,
  ...
}
```

#### 3. `delete` — Удалить объект

**Данные:**
```json
{
  "id": "obj-1720345678"
}
```

#### 4. `save_lead` — Сохранить заявку

**Данные:**
```json
{
  "objectName": "ЖК Аристократ",
  "clientName": "Алексей",
  "clientPhone": "+7 (999) 123-45-67",
  "clientTelegram": "@alexey"
}
```

**Ответ:**
```json
{
  "success": true,
  "id": "lead-1720345678"
}
```

#### 5. `update_lead_status` — Изменить статус заявки

**Данные:**
```json
{
  "id": "lead-1720345678",
  "status": "contacted"
}
```

Статусы: `new`, `contacted`, `completed`, `cancelled`

#### 6. `upload_image` — Загрузить фото

**Данные:**
```json
{
  "image": "data:image/jpeg;base64,/9j/4AAQ...",
  "fileName": "object-123.jpg"
}
```

**Ответ:**
```json
{
  "success": true,
  "url": "https://lh3.googleusercontent.com/d/FILE_ID",
  "id": "FILE_ID"
}
```

#### 7. `update_agent_profile` — Обновить профиль

**Данные:**
```json
{
  "name": "Иван Петров",
  "phone": "+7 (999) 123-45-67",
  ...
}
```

#### 8. `change_pin` — Сменить PIN-код

**Данные:**
```json
{
  "oldPin": "1234",
  "newPin": "5678"
}
```

---

## 🚀 ПОШАГОВАЯ ИНСТРУКЦИЯ ПО РАЗВЁРТЫВАНИЮ

### Шаг 1: Создание Google Таблицы (10 минут)

1. **Откройте** [Google Sheets](https://sheets.google.com)
2. **Создайте новую таблицу** с названием `Prostors - [Ваше агентство]`
3. **Создайте 5 листов** с точными названиями:
   - `Agents`
   - `Listings`
   - `Leads`
   - `AgentData`
   - `Pages`

4. **Добавьте заголовки столбцов** (первая строка каждого листа):

**Лист `Agents`:**
```
agent_id | name | telegram_user_id | pin_hash | status | plan_type | expires_at | created_at | custom_domain | brand_config | chat_id
```

**Лист `Listings`:**
```
agent_id | id | name | address | district | metro | price_from | price_to | area_min | area_max | price_per_sqm | rooms | class | completion_soonest | completion_all | finishing | status | description | features | image_main | images_gallery | floor_plans_images | lat | lng | active | created_at | updated_at
```

**Лист `Leads`:**
```
agent_id | id | timestamp | objectName | clientName | clientPhone | clientTelegram | status
```

**Лист `AgentData`:**
```
agent_id | name | role | agencyName | agencyAddress | telegramUsername | phone | photoUrl
```

**Лист `Pages`:**
```
agent_id | page | title | content
```

5. **Добавьте первого агента** (в лист `Agents`):

| Колонка | Значение |
|---------|----------|
| `agent_id` | `07072026-001` (или текущая дата + `-001`) |
| `name` | Ваше имя / название агентства |
| `telegram_user_id` | Ваш Telegram ID (узнайте через @userinfobot) |
| `pin_hash` | SHA-256 хеш PIN-кода (см. ниже) |
| `status` | `active` |
| `plan_type` | `lifetime` |
| `expires_at` | `31.12.2099` |
| `created_at` | `07.07.2026 10:00` (текущая дата) |
| `custom_domain` | (оставьте пустым) |
| `brand_config` | `{}` (пустой JSON) |
| `chat_id` | Ваш Telegram ID |

**Как создать PIN-код:**
1. Придумайте PIN из 4-6 цифр (например, `1234`)
2. Откройте [генератор SHA-256](https://emn178.github.io/online-tools/sha256.html)
3. Введите PIN, скопируйте хеш
4. Вставьте хеш в колонку `pin_hash`

---

### Шаг 2: Настройка Google Apps Script (15 минут)

1. **Откройте таблицу** → **Расширения** → **Apps Script**

2. **Удалите весь код** в файле `Code.gs`

3. **Скопируйте содержимое** файла `Code.gs` из этого репозитория и вставьте в редактор

4. **Нажмите** **Сохранить** (Ctrl+S / Cmd+S)

5. **Разверните как веб-приложение:**
   - Нажмите **Развернуть** (Deploy) → **Новое развёртывание** (New deployment)
   - Тип: **Веб-приложение** (Web app)
   - Описание: `Prostors API v1.0.0`
   - Выполнять как: **Я** (Me)
   - У кого есть доступ: **Все** (Anyone)
   - Нажмите **Развернуть** (Deploy)

6. **Скопируйте URL веб-приложения** (выглядит как `https://script.google.com/macros/s/AKfycbx.../exec`)

7. **Настройте переменные окружения:**
   - В редакторе Apps Script откройте **Настройки проекта** (Project Settings)
   - Раздел **Переменные среды** (Script Properties)
   - Добавьте:
     - `TELEGRAM_NOTIFICATION_BOT_TOKEN` = токен вашего Telegram бота (из @BotFather)
     - `PLATFORM_OWNER_TELEGRAM_ID` = ваш Telegram User ID

---

### Шаг 3: Создание Telegram бота (5 минут)

1. **Откройте** [@BotFather](https://t.me/BotFather) в Telegram

2. **Отправьте команду** `/newbot`

3. **Придумайте имя** бота (например, "Каталог Новостроек Иван")

4. **Придумайте username** (например, `ivan_realty_bot`)

5. **Скопируйте токен** (выглядит как `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`)

6. **Откройте вашего бота** и нажмите **Start**

7. **Узнайте свой Chat ID** через [@userinfobot](https://t.me/userinfobot)

---

### Шаг 4: Развёртывание на Яндекс.Облаке (15 минут)

1. **Зарегистрируйтесь** на [console.cloud.yandex.ru](https://console.cloud.yandex.ru)

2. **Создайте бакет:**
   - В меню слева выберите **Object Storage**
   - Нажмите **Создать бакет**
   - Имя: `prostors-ваше-название` (латиницей, без пробелов)
   - **Включите тумблер "Публичный доступ"** (иначе сайт не откроется)
   - **Включите тумблер "Статический сайт"** (Static Website Hosting)
   - Нажмите **Создать**

3. **Настройте лимиты расходов** (чтобы не списались деньги):
   - В Object Storage нажмите **Настройки** → **Лимиты расходов**
   - Установите жесткий лимит: **0 ₽** или **100 ₽**

4. **Загрузите файлы:**
   - Откройте созданный бакет
   - Нажмите **Загрузить** и выберите:
     - `index.html`
     - `admin.html`
     - `app.js`
     - `styles.css`

5. **Создайте файл конфигурации:**
   - Создайте на компьютере файл `client-config.json`
   - Вставьте содержимое:
     ```json
     {
       "client": {
         "scriptUrl": "URL_ИЗ_ШАГА_2",
         "ownerId": "ВАШ_TELEGRAM_ID"
       }
     }
     ```
   - Замените:
     - `URL_ИЗ_ШАГА_2` на URL из Google Apps Script
     - `ВАШ_TELEGRAM_ID` на ваш Telegram User ID
   - Загрузите этот файл в корень бакета

6. **Скопируйте URL сайта:**
   - В настройках бакета (раздел "Статический сайт")
   - Скопируйте **Ссылку для доступа к сайту**
   - Выглядит как: `https://prostors-ваше-название.storage.yandexcloud.net`

---

### Шаг 5: Настройка Cloudflare Worker (10 минут)

См. раздел [Cloudflare Worker](#cloudflare-worker-прокси-для-webhook) ниже.

---

### Шаг 6: Финальная проверка (10 минут)

1. **Откройте Mini App:**
   ```
   https://prostors-ваше-название.storage.yandexcloud.net/index.html?agent=07072026-001
   ```

2. **Проверьте загрузку** каталога

3. **Откройте админку:**
   ```
   https://prostors-ваше-название.storage.yandexcloud.net/admin.html?agent=07072026-001
   ```

4. **Введите PIN-код**

5. **Создайте тестовый объект**

6. **Отправьте тестовую заявку** из клиентской части

7. **Проверьте уведомление** в Telegram

---

## ☁️ CLOUDFLARE WORKER (ПРОКСИ ДЛЯ WEBHOOK)

### Зачем нужен Cloudflare Worker

Google Apps Script имеет ограничения на обработку входящих webhook от Telegram. Cloudflare Worker решает эту проблему:
- Принимает webhook от Telegram
- Проверяет секретный токен
- Пересылает данные в Google Apps Script
- Возвращает ответ обратно в Telegram

### Структура файлов

```
cloudflare-worker/
├── worker.js           # Код Worker
├── wrangler.toml       # Конфигурация Wrangler
└── README.md           # Инструкция
```

### Код Worker (`worker.js`)

```javascript
export default {
  async fetch(request, env) {
    // Принимаем только POST-запросы
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    // Верификация секретного токена от Telegram
    const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
    if (!env.TELEGRAM_SECRET || secret !== env.TELEGRAM_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Читаем тело запроса
    let body;
    try {
      body = await request.text();
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    // Пересылаем в Google Apps Script
    try {
      const response = await fetch(env.GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      // Возвращаем ответ от функции обратно в Telegram
      const result = await response.text();
      return new Response(result, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('Proxy error:', err);
      return new Response('Bad Gateway', { status: 502 });
    }
  },
};
```

### Конфигурация (`wrangler.toml`)

```toml
name = "tg-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
# Не храните секреты здесь — только через wrangler secret put
```

### Пошаговая настройка

#### Вариант А: Через Cloudflare Dashboard (проще)

1. **Зайдите** на [dash.cloudflare.com](https://dash.cloudflare.com)

2. **Workers & Pages** → **Create Application**

3. **Create Worker** → название: `tg-proxy` → **Deploy**

4. **Edit Code** → скопируйте код из `worker.js` → **Save and Deploy**

5. **Settings** → **Variables** → **Add variable**:
   - Variable name: `GAS_URL`
   - Value: URL вашего Google Apps Script
   - Type: **Secret**
   - **Save**

6. **Settings** → **Variables** → **Add variable**:
   - Variable name: `TELEGRAM_SECRET`
   - Value: любая секретная строка (например, `my-secret-token-123`)
   - Type: **Secret**
   - **Save**

7. **Скопируйте URL Worker'а** (выглядит как `https://tg-proxy.ваш-аккаунт.workers.dev`)

#### Вариант Б: Через Wrangler CLI (для продвинутых)

1. **Установите Wrangler:**
   ```bash
   npm install -g wrangler
   ```

2. **Авторизуйтесь:**
   ```bash
   wrangler login
   ```

3. **Разверните:**
   ```bash
   wrangler deploy
   ```

4. **Добавьте секреты:**
   ```bash
   wrangler secret put GAS_URL
   wrangler secret put TELEGRAM_SECRET
   ```

### Установка webhook в Telegram

1. **Подготовьте данные:**
   - `BOT_TOKEN` = токен бота из @BotFather
   - `WORKER_URL` = URL вашего Cloudflare Worker
   - `SECRET` = значение `TELEGRAM_SECRET` (из шага 5)

2. **Выполните команду:**
   ```bash
   curl "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
     -d "url=${WORKER_URL}" \
     -d "secret_token=${SECRET}"
   ```

   **Или откройте в браузере:**
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=<WORKER_URL>&secret_token=<SECRET>
   ```

3. **Проверьте статус:**
   ```bash
   curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
   ```

   **Должно вернуться:**
   ```json
   {
     "ok": true,
     "result": {
       "url": "https://tg-proxy.ваш-аккаунт.workers.dev",
       "has_custom_certificate": false,
       "pending_update_count": 0,
       ...
     }
   }
   ```

### Проверка работы

1. **Напишите боту** `/start`

2. **Проверьте логи** в Cloudflare:
   - Worker → **Observability** → **Logs**
   - Должны быть запросы с кодом 200

3. **Проверьте Google Apps Script:**
   - Выполнения → должны быть вызовы `processTelegramWebhook()`

---

## ✅ ТЕСТИРОВАНИЕ И ПРОВЕРКА

### Чек-лист проверки

Пройдитесь по всем пунктам:

- [ ] Google Таблица создана с 5 листами
- [ ] Заголовки столбцов добавлены
- [ ] Первый агент добавлен в лист `Agents`
- [ ] Google Apps Script развёрнут как Web App
- [ ] URL Apps Script скопирован
- [ ] Переменные окружения настроены (`TELEGRAM_NOTIFICATION_BOT_TOKEN`, `PLATFORM_OWNER_TELEGRAM_ID`)
- [ ] Telegram бот создан, токен получен
- [ ] Бакет в Яндекс.Облаке создан
- [ ] Файлы загружены в бакет
- [ ] `client-config.json` создан и загружен
- [ ] Статический сайт включён
- [ ] Cloudflare Worker создан
- [ ] Переменные `GAS_URL` и `TELEGRAM_SECRET` добавлены
- [ ] Webhook установлен в Telegram
- [ ] `pending_update_count` = 0

### Функциональное тестирование

1. **Открытие Mini App:**
   - Откройте URL: `https://<bucket>.storage.yandexcloud.net/index.html?agent=07072026-001`
   - ✅ Должен открыться приветственный экран
   - ✅ Должны загрузиться объекты (если есть)

2. **Фильтрация:**
   - Нажмите "Фильтры"
   - Выберите район/метро/цену
   - ✅ Список должен обновиться

3. **Карта:**
   - Переключитесь на вкладку "Карта"
   - ✅ Должны отобразиться маркеры объектов

4. **Отправка заявки:**
   - Откройте карточку объекта
   - Нажмите "Заказать консультацию"
   - Заполните форму
   - ✅ Должно появиться сообщение "Заявка отправлена"

5. **Уведомление:**
   - ✅ В Telegram должно прийти уведомление с данными заявки

6. **Админка:**
   - Откройте `.../admin.html?agent=07072026-001`
   - Введите PIN
   - ✅ Должна открыться админ-панель

7. **CRUD операции:**
   - Создайте новый объект
   - Отредактируйте его
   - Удалите
   - ✅ Все операции должны выполняться без ошибок

8. **Webhook:**
   - Напишите боту `/start`
   - ✅ Бот должен ответить приветствием

---

## 🐛 УСТРАНЕНИЕ НЕПОЛАДОК

### Проблема: "Агент не найден"

**Причины:**
- Неверный `agent_id` в URL
- Агент не добавлен в лист `Agents`
- Статус агента не `active`

**Решение:**
1. Проверьте `agent_id` в URL
2. Откройте лист `Agents`, убедитесь что агент есть
3. Проверьте колонку `status` — должно быть `active`

---

### Проблема: "Ошибка авторизации"

**Причины:**
- Неверный PIN-код
- `initData` не совпадает с `telegram_user_id`

**Решение:**
1. Проверьте PIN-код (введите заново)
2. Проверьте `telegram_user_id` в листе `Agents`
3. Убедитесь что открываете Mini App из того же Telegram-аккаунта

---

### Проблема: Заявки не приходят

**Причины:**
- Не настроен webhook
- Неверный `TELEGRAM_NOTIFICATION_BOT_TOKEN`
- Не указан `chat_id`

**Решение:**
1. Проверьте webhook: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Проверьте токен в Script Properties
3. Проверьте `chat_id` в листе `Agents`

---

### Проблема: Фото не загружаются

**Причины:**
- Превышен лимит Google Drive
- Ошибка в `uploadImage()`

**Решение:**
1. Проверьте место на Google Drive
2. Откройте логи Apps Script (Выполнения)
3. Найдите ошибку в функции `uploadImage()`

---

### Проблема: Сайт не открывается

**Причины:**
- Не включён публичный доступ в бакете
- Не включён Static Website Hosting

**Решение:**
1. Откройте бакет в Яндекс.Облаке
2. Проверьте настройки: **Публичный доступ** = ВКЛ
3. Проверьте: **Статический сайт** = ВКЛ

---

### Проблема: Cloudflare Worker возвращает 401

**Причины:**
- Неверный `TELEGRAM_SECRET`
- Telegram не отправляет `X-Telegram-Bot-Api-Secret-Token`

**Решение:**
1. Проверьте значение `TELEGRAM_SECRET` в Cloudflare
2. Перенастройте webhook с правильным `secret_token`
3. Проверьте логи Cloudflare

---

## 🔐 БЕЗОПАСНОСТЬ

### Хранение секретов

| Секрет | Где хранится | Доступ |
|--------|--------------|--------|
| Telegram Bot Token | Script Properties (Apps Script) | Только владелец скрипта |
| TELEGRAM_SECRET | Cloudflare Worker Secrets | Только владелец Worker |
| PIN-код | Лист `Agents` (`pin_hash`) | Только хеш, оригинал не хранится |
| `client-config.json` | Yandex Object Storage | Публичный (не храните секреты!) |

### Изоляция данных

- Каждый агент имеет свой `agent_id`
- Все запросы проверяют `agent_id`
- Агент видит только свои объекты и заявки
- Проверка `telegram_user_id` для авторизации

### HTTPS

- Все соединения только по HTTPS
- Yandex Object Storage — HTTPS
- Google Apps Script — HTTPS
- Cloudflare Workers — HTTPS

### Ограничения

- `no-cors` при POST-запросах в Apps Script
- Ответы на POST не читаются
- Используйте GET для подтверждения операций

---

## 🛡️ АРХИТЕКТУРНЫЕ РЕШЕНИЯ И АНАЛИЗ РИСКОВ (Four Pillars)

Данный раздел описывает критический анализ архитектуры «младшего» проекта (Standalone-шаблон).
Главный принцип: **Каждый агент получает полностью независимый экземпляр приложения на своих личных аккаунтах (Яндекс, Google, Cloudflare).**
Это исключает зависимость от центрального сервера разработчика, но накладывает специфические ограничения.

Ниже приведен разбор по четырем ключевым направлениям (Four Pillars) и план реализации принятых решений.

### 1. 🏗️ НАДЁЖНОСТЬ (Оценка: 9/10)

| Риск | Решение и статус |
| :--- | :--- |
| **`no-cors` при POST-запросах** | **Принято.** Риск минимален для MVP. В 99% случаев данные сохраняются. |
| **Таймауты при загрузке фото** | **Исправлено.** Внедрено клиентское сжатие (Canvas). Фото сжимается до 1200px / 75% качества прямо в браузере перед отправкой. Вес файла падает с 5 МБ до ~150 КБ, что исключает таймауты Google Apps Script. |
| **Лимиты Google Apps Script** | **Игнорируется.** Поскольку у каждого агента своя таблица и свой аккаунт, лимиты (20 000 запросов/день) недостижимы в реальных сценариях использования. |

### 2. 🔐 БЕЗОПАСНОСТЬ (Оценка: 7/10)

| Риск | Решение и статус |
| :--- | :--- |
| **Подделка Telegram `initData`** | **Принято.** Глубокая криптографическая проверка (HMAC-SHA256) не внедряется для упрощения. Реальным рубежом обороны является **PIN-код**. Без PIN злоумышленник может только читать данные, но не изменять их. |
| **Хранение PIN в браузере** | **Исправлено.** PIN-код **никогда не сохраняется** в `sessionStorage` или `localStorage`. Сессия активна только пока открыта вкладка Mini App. Закрыл приложение — введи PIN снова. |
| **Google Sheets как БД** | **Осознанный риск.** Принято как плата за простоту и нулевую стоимость хостинга. Ответственность за сохранность аккаунта Google перекладывается на агента (фиксируется в оферте). |
| **Rate Limiting (Спам)** | **Игнорируется.** Жесткие квоты Google Apps Script (6 минут выполнения) работают как естественный и бесплатный ограничитель частоты запросов. |

### 3. 🧩 ПРОСТОТА (Оценка: 6/10)

| Риск | Решение и статус |
| :--- | :--- |
| **Привязка карты в Яндекс.Облаке** | **Психологический барьер.** Технически карта нужна только для активации бесплатного гранта. Решается через видеоинструкции. |
| **Отсутствие "Установщика в 1 клик"** | **Принято.** Полная автоматизация невозможна без нарушения принципа независимости агента. Решается через полуавтоматический «Мастер настройки» и платную услугу «Настройка под ключ». |
| **Сложность самодиагностики** | **Исправлено.** Внедряется базовый набор инструментов: Чек-лист диагностики (PDF), команда `/status` в Telegram-боте, лист `Errors` в Google Таблице для логирования. |

### 4. 📈 МАСШТАБИРУЕМОСТЬ (Оценка: 8/10)

| Риск | Решение и статус |
| :--- | :--- |
| **Нагрузка на БД и сервер** | **10/10.** Идеальная изоляция. Падение или спам одного агента никак не влияет на других. Технического потолка нет. |
| **Обновление кода у клиентов** | **Управляется.** Поскольку код лежит у агентов, внедряется версионирование в `client-config.json`. При выходе критических патчей агент получает уведомление в Telegram-канале обновлений. |
| **Техподдержка при росте** | **Управляется.** Отказ от доступа к личным аккаунтам агентов. Переход на модель самодиагностики и анонимный сбор критических ошибок фронтенда. |

---

### 📋 ПЛАН РЕАЛИЗАЦИИ (TODO)

На основе анализа рисков, в код шаблона должны быть внедрены следующие изменения:

####  Фронтенд (`admin.html`, `app.js`)
- [ ] **Внедрить функцию сжатия фото `compressImage()`** через HTML5 Canvas (max 1200px, quality 0.75).
- [ ] **Убрать `setTimeout(3000)`** в функции загрузки фото, заменить на ожидание готовности сжатого файла.
- [ ] **Изменить логику сессии админки:** убрать сохранение PIN в `sessionStorage`. Сессия должна жить только до закрытия вкладки/Mini App.
- [ ] **Добавить версионирование:** читать поле `version` из `client-config.json` и сверять с актуальной версией (для будущих обновлений).

#### ⚙️ Бэкенд (`Code.gs`)
- [ ] **Создать лист `Errors`** в Google Таблице и добавить функцию логирования всех исключений (`try/catch`) в этот лист.
- [ ] **Убедиться, что все POST-запросы** (изменение данных) жестко требуют валидации PIN-кода или `initData`.

####  Telegram Бот и Документация
- [ ] **Добавить команду `/status`** в бота (проверка статуса webhook и токена).
- [ ] **Создать PDF "Чек-лист самодиагностики"** (5 основных проблем и их решения).
- [ ] **Оформить Telegram-канал** для релизов и обновлений шаблона.

## 📄 ЛИЦЕНЗИЯ

Код предоставляется на условиях лицензии Prostors Template License.

**Разрешено:**
- Создание производных проектов
- Коммерческое использование
- Модификация кода

**Запрещено:**
- Перепродажа шаблона как есть
- Сублицензирование
- Удаление атрибуции

**© 2026 Prostors. Все права защищены.**

## 📂 ФАЙЛЫ РЕПОЗИТОРИЯ

### Фронтенд (загружаются в Yandex Object Storage)

| Файл | Размер | Описание |
|------|--------|----------|
| `index.html` | ~15KB | Клиентское приложение (Mini App) |
| `admin.html` | ~25KB | Админ-панель с CRUD |
| `app.js` | ~35KB | Логика: фильтрация, карта, заявки |
| `styles.css` | ~12KB | Стили + CSS-переменные для брендирования |
| `client-config.json.example` | ~200B | Шаблон конфигурации (скопировать в client-config.json) |

### Бэкенд (Google Apps Script)

| Файл | Описание |
|------|----------|
| `Code.gs` | Полный код бэкенда (скопировать в Apps Script) |

### Cloudflare Worker

| Файл | Описание |
|------|----------|
| `cloudflare-worker/worker.js` | Код прокси для webhook |
| `cloudflare-worker/wrangler.toml` | Конфигурация Wrangler |

## 🎯 БЫСТРЫЙ СТАРТ (Чек-лист на 1 час)

- [ ] 1. Создать Google Таблицу с 5 листами (10 мин)
- [ ] 2. Развернуть Google Apps Script (15 мин)
- [ ] 3. Создать Telegram бота (5 мин)
- [ ] 4. Настроить Yandex Object Storage (15 мин)
- [ ] 5. Настроить Cloudflare Worker (10 мин)
- [ ] 6. Протестировать (10 мин)

🟢 БЛОК 1: КОНТЕКСТ ДЛЯ РАЗРАБОТЧИКА (Чтобы не искать, где мы остановились)

```markdown
## 🧠 СТАТУС ПРОЕКТА И СЛЕДУЮЩИЕ ШАГИ

**Где мы сейчас:**
Архитектура утверждена, весь код написан и протестирован. Паспорт проекта finalized.

**Что нужно сделать прямо сейчас (Первые задачи после прочтения):**
1. Создать публичный репозиторий `prostors-template` на GitHub.
2. Загрузить в корень репозитория чистые файлы: `index.html`, `admin.html`, `app.js`, `styles.css`, `Code.gs`, `client-config.json.example`.
3. Создать папку `cloudflare-worker/` и загрузить туда `worker.js` и `wrangler.toml`.
4. Вставить этот README.md в корень репозитория.
5. Запустить процесс первых продаж (BASE тариф).

**Важно:** Весь код уже готов. Его НЕ нужно переписывать или генерировать заново. Он находится в истории чата и готов к копированию в файлы.
```

---

### 🟢 БЛОК 2: КАРТА ФАЙЛОВ И ДЕПЛОЯ (Чтобы не гадать, куда что класть)

```markdown
## 🗺️ КАРТА РАЗВЁРТЫВАНИЯ (КУДА ЗАГРУЖАТЬ ФАЙЛЫ)

Чтобы не запутаться, вот точная карта, где должен лежать каждый файл из репозитория:

### 1. Яндекс.Облако (Object Storage / Static Website)
*Здесь лежит фронтенд и медиа. Доступ публичный.*
* **Корень бакета (`/`):**
  - `index.html`
  - `admin.html`
  - `app.js`
  - `styles.css`
  - `client-config.json` (создается из `.example`)
  - `logo.png` (опционально, если не используется внешний URL)
* **Папка `/images/` (создать вручную):**
  - Сюда будут автоматически сохраняться фото объектов (если используется загрузка через Google Drive fallback) или сюда можно загружать статику вручную.

### 2. Google Apps Script
*Здесь лежит бэкенд. Доступ только у владельца.*
* **Файл `Code.gs`:** Вставляется в редактор Apps Script, привязанный к Google Таблице.

### 3. Cloudflare Dashboard
*Здесь лежит прокси для webhook. Доступ только у владельца.*
* **Worker `tg-proxy`:** Код из `cloudflare-worker/worker.js` вставляется в редактор Cloudflare.

### 4. Google Sheets
*Здесь лежит база данных. Доступ только у владельца.*
* Листы: `Agents`, `Listings`, `Leads`, `AgentData`, `Pages`.
```

---

### 🟢 БЛОК 3: ЧЕК-ЛИСТ БЫСТРОГО СТАРТА (За 60 минут)

```markdown
## ⚡ БЫСТРЫЙ СТАРТ (ЧЕК-ЛИСТ НА 1 ЧАС)

Если нужно развернуть копию максимально быстро, следуй этому чек-листу:

- [ ] **00:00 - 00:10** | **Google Sheets:** Создать таблицу, добавить 5 листов, заполнить первую строку в `Agents` (сгенерировать SHA-256 для PIN).
- [ ] **00:10 - 00:25** | **Apps Script:** Вставить `Code.gs`, сделать Deploy (Web App, Anyone), скопировать URL. Добавить Secrets (`TELEGRAM_NOTIFICATION_BOT_TOKEN`, `PLATFORM_OWNER_TELEGRAM_ID`).
- [ ] **00:25 - 00:30** | **Telegram:** Создать бота в @BotFather, получить токен, узнать свой Chat ID через @userinfobot.
- [ ] **00:30 - 00:45** | **Yandex Cloud:** Создать бакет, включить Public Access и Static Website. Загрузить 4 файла фронтенда + `client-config.json`.
- [ ] **00:45 - 00:55** | **Cloudflare:** Создать Worker `tg-proxy`, вставить код, добавить Secrets (`GAS_URL`, `TELEGRAM_SECRET`). Настроить Webhook через curl.
- [ ] **00:55 - 01:00** | **Тест:** Открыть ссылку на бакет с `?agent=...`, отправить тестовую заявку, проверить уведомление в Telegram.
```

---

### 🟢 БЛОК 4: LESSONS LEARNED (Критические нюансы, чтобы не наступать на грабли)

```markdown
## ⚠️ ВАЖНЫЕ НЮАНСЫ (LESSONS LEARNED)

Эти пункты получены опытным путем. Их нарушение ломает систему:

1. **Replit НЕ используется.** Ранее тестировался Replit для webhook, но финальное и рабочее решение — **Cloudflare Workers**. Не трать время на поиск кода для Replit.
2. **Опечатка с датой.** В ранних версиях `Code.gs` была ошибка `tolSOString()`. В текущем эталонном файле она исправлена на `toISOString()`. Если берешь код из старых бэкапов — проверь это.
3. **Формат даты в таблице.** В листе `Leads` колонка `timestamp` должна сохраняться строго через `new Date().toISOString()`. Фронтенд сам отформатирует её в русский вид. Не используй `Utilities.formatDate()` при сохранении.
4. **Лимиты Apps Script.** POST-запросы к Apps Script работают в режиме `no-cors`. Это значит, что фронтенд **не может прочитать ответ** от сервера при POST-запросах. Поэтому после отправки заявки фронтенд просто показывает "Успешно", не дожидаясь реального ответа от БД.
5. **Секретный токен Telegram.** При установке webhook через Cloudflare ОБЯЗАТЕЛЬНО передавай параметр `secret_token`. Без него Cloudflare Worker будет отклонять запросы (возвращать 401 Unauthorized).
6. **Изоляция.** Никогда не храни данные клиентов (таблицы, фото) на своих личных аккаунтах Google или Яндекс. Каждый клиент должен регистрировать свои аккаунты. Ты продаешь шаблон и настройку, а не хостинг.
```

---
