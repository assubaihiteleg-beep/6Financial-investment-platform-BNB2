import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id"),
  actorUsername: text("actor_username").notNull(),
  actorRole: text("actor_role").notNull(), // "admin" | "agent"
  action: text("action").notNull(),
  targetType: text("target_type").notNull(), // "beneficiary" | "agent" | "phase" | "system"
  targetId: text("target_id"),
  details: text("details"),
  result: text("result").notNull().default("success"), // "success" | "denied" | "failure"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
