# Публікація Sklad.io на безплатному хостингу

Підготовлена копія фінального проєкту Lab_12. Лабораторні папки та звіти не змінені.

## Схема

Render Free запускає один Docker-контейнер: React за адресою /, Python/FastAPI за /api, документація /api/docs. Постійні дані зберігає Neon Free PostgreSQL. Для користувача потрібне одне HTTPS-посилання, локальні термінали й увімкнений комп’ютер не потрібні.

Render Free засинає після 15 хвилин без запитів; перший запуск триває близько хвилини. Відкрийте сайт завчасно перед показом. Neon Free має квоти; актуальні тарифи https://neon.com/pricing. SQLite на Render не використовується: локальні файли зникають після перезапуску.

## Для завершення публікації

Потрібні підключені облікові записи GitHub, Render та Neon. Секрети DATABASE_URL, JWT_SECRET і ADMIN_PASSWORD зберігаються в налаштуваннях хостингу. Не додавати їх у Git і публічний README.

1. Створити Neon Free проєкт у європейському регіоні, отримати PostgreSQL connection string із SSL.
2. Завантажити в приватний GitHub-репозиторій вміст цієї папки, де render.yaml лежить у корені.
3. У Render створити Blueprint із цього репозиторію. render.yaml явно задає plan: free.
4. DATABASE_URL — рядок Neon; ADMIN_PASSWORD — власний сильний пароль. JWT_SECRET Render генерує автоматично.
5. Дочекатися Live, перевірити /health, вхід, створення товару, надходження та звіт. Увійти як admin@sklad.io із заданим ADMIN_PASSWORD.

На першому старті створюються адміністратор і довідники. Повторні старти не змінюють пароль, товари й залишки. Безплатна Render PostgreSQL не вибрана: вона завершує термін дії через 30 днів.

## Локальна перевірка режиму хостингу

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm run build
cd ..
$env:ADMIN_PASSWORD='LocalTest123!'
uvicorn app.hosted:create_hosted_app --factory --host 127.0.0.1 --port 8000
```

Відкрийте http://127.0.0.1:8000: фронтенд і бекенд працюють через один сервер. Без DATABASE_URL локально використовується SQLite. На Render REQUIRE_PERSISTENT_DATABASE=1 забороняє випадковий запуск з тимчасовою SQLite-базою.

Усі перевірки: python -m pytest tests -v. Docker-build за наявності Docker: docker build -t sklad-hosted .

Джерела: https://render.com/docs/free, https://render.com/docs/blueprint-spec, https://neon.com/pricing.
