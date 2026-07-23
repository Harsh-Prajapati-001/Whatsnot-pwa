import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb(database?: D1Database) {
  if (!database) throw new Error("Pass the Cloudflare D1 binding named DB to getDb().");
  return drizzle(database, { schema });
}
