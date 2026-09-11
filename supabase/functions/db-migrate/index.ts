// TEMPORARY maintenance runner. The SQL is hardcoded (never taken from the
// request) so this cannot be used as an arbitrary-SQL endpoint. Delete this
// function once the migration is complete.
import "@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "../_shared/util.ts";
import postgres from "npm:postgres@3";

// Removes throwaway accounts left by the test suites (username prefixes
// t<ms>_ / f<ms>_ / e2e_test_) and any couple rows they created.
const MIGRATIONS = [
  `delete from auth.users where id in (
     select id from profiles
      where username ~ '^(t|f|pwui|pwtest)[_0-9]' or username like 'e2e_test_%' or username like 'CaseTest%')`,
  `delete from config where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from entries where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from categories where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from rewards where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from punishments where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from bag where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from letters where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from photos where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from monthly where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from shop where match_id not in (select distinct match_id from profiles where match_id is not null)`,
  `delete from matches where id not in (select distinct match_id from profiles where match_id is not null)`,
];

serve(async () => {
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  const results: string[] = [];
  try {
    for (const stmt of MIGRATIONS) {
      const r = await sql.unsafe(stmt);
      results.push(`${r.count ?? 0} rows: ${stmt.trim().split("\n")[0].slice(0, 60)}`);
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), results }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  } finally {
    await sql.end();
  }
  return new Response(JSON.stringify({ success: true, results }), {
    headers: { "Content-Type": "application/json" },
  });
});
