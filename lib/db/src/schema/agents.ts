import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentsTable = pgTable("agents", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  plainPassword: text("plain_password").notNull().default(""),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"), // "active" | "frozen" | "disabled"
  maxBeneficiariesQuota: integer("max_beneficiaries_quota").notNull().default(5),
  canEditBeneficiaries: boolean("can_edit_beneficiaries").notNull().default(true),
  canManagePhases: boolean("can_manage_phases").notNull().default(false),
  canManageFinancials: boolean("can_manage_financials").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgentSchema = createInsertSchema(agentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
});

export const updateAgentSchema = insertAgentSchema.partial();

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agentsTable.$inferSelect;
