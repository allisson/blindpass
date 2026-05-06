# DB Migrations

Schema: `apps/server/src/db/schema.ts`. Migrations: `apps/server/src/db/migrations/`.

Generate a new migration after schema changes:

```bash
make db:migrate
```

Do not hand-edit generated SQL files.
