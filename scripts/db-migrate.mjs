// Applies supabase/migrations/*.sql in order, once each. Usage: pnpm db:migrate
// Reads DATABASE_URL from the root .env.local.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, onnotice: () => {} });
try {
  await sql`create table if not exists public.schema_migrations (name text primary key, applied_at timestamptz default now())`;
  await sql`alter table public.schema_migrations enable row level security`;
  const done = new Set((await sql`select name from public.schema_migrations`).map((r) => r.name));
  const dir = join(root, "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`insert into public.schema_migrations (name) values (${file})`;
    });
    console.log("applied", file);
  }
  console.log("migrations up to date");
} finally {
  await sql.end();
}
