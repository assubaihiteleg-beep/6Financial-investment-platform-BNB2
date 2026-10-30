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

  // 1. Data & Beneficiary Permissions
  canViewBeneficiaries: boolean("can_view_beneficiaries").notNull().default(true),
  canAddBeneficiaries: boolean("can_add_beneficiaries").notNull().default(false),
  canEditBeneficiaries: boolean("can_edit_beneficiaries").notNull().default(false),
  canDeleteBeneficiaries: boolean("can_delete_beneficiaries").notNull().default(false),

  // 2. Financial Permissions
  canManageProfits: boolean("can_manage_profits").notNull().default(false),
  canManageFees: boolean("can_manage_fees").notNull().default(false),
  canPayFees: boolean("can_pay_fees").notNull().default(false),
  canManageFinancials: boolean("can_manage_financials").notNull().default(false), // legacy fallback

  // 3. Phase Permissions
  canManagePhases: boolean("can_manage_phases").notNull().default(false),
  canPayPhases: boolean("can_pay_phases").notNull().default(false),

  // 4. Notifications & Accounts
  canSendNotifications: boolean("can_send_notifications").notNull().default(false),
  canViewAccountInfo: boolean("can_view_account_info").notNull().default(true),
  canEditAccountInfo: boolean("can_edit_account_info").notNull().default(false),

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
