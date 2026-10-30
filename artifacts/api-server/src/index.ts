import app from "./app";
import { logger } from "./lib/logger";

const isProd = process.env.NODE_ENV === "production";
const port = Number(process.env["PORT"] || "8080");

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${port}"`);
}

app.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "Server listening on 0.0.0.0");
});
