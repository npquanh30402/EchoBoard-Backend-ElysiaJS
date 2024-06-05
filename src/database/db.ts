import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schemas from "./schemas";

const queryClient = postgres(process.env.DATABASE_URL as string);
export const db = drizzle(queryClient, {
  schema: schemas,
});
