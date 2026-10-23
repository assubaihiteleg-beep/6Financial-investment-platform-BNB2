import { defineConfig } from "drizzle-kit";
import path from "path";

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const sqlUser = process.env.SQL_ADMIN_USER || process.env.SQL_USER;
const sqlPassword = process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD;

const dbCredentials = sqlHost && sqlDbName && sqlUser
  ? {
      host: sqlHost,
      user: sqlUser,
      password: sqlPassword,
      database: sqlDbName,
      ssl: false,
    }
  : {
      url: process.env.DATABASE_URL || "postgres://localhost/mock",
    };

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials,
});
