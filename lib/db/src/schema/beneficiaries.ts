import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const beneficiariesTable = pgTable("beneficiaries", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id"),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull().default(""),
  plainPassword: text("plain_password").notNull().default(""),
  name: text("name").notNull(),
  profits: text("profits").notNull().default("0"),
  subscription: text("subscription").notNull().default("0"),
  fees: text("fees").notNull().default("0"),
  accountHolder: text("account_holder").notNull().default(""),
  iban: text("iban").notNull().default(""),
  phone: text("phone").notNull().default(""),
  status: text("status").notNull().default("active"),
  loginTitle: text("login_title").notNull().default(""),
  loginSlug: text("login_slug").notNull().default(""),
  telegramLink: text("telegram_link").notNull().default(""),
  withdrawalFeeStatus: text("withdrawal_fee_status").notNull().default("unpaid"),
  withdrawalFeePaidAt: timestamp("withdrawal_fee_paid_at", { withTimezone: true }),
  phase1Visible: boolean("phase1_visible").notNull().default(false),
  phase2Visible: boolean("phase2_visible").notNull().default(false),
  liberationFee: text("liberation_fee").notNull().default("0"),
  liberationFeeStatus: text("liberation_fee_status").notNull().default("unpaid"),
  liberationFeePaidAt: timestamp("liberation_fee_paid_at", { withTimezone: true }),
  transactionFee: text("transaction_fee").notNull().default("0"),
  transactionFeeStatus: text("transaction_fee_status").notNull().default("unpaid"),
  transactionFeePaidAt: timestamp("transaction_fee_paid_at", { withTimezone: true }),
  phase3Visible: boolean("phase3_visible").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBeneficiarySchema = createInsertSchema(beneficiariesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
});

export const updateBeneficiarySchema = insertBeneficiarySchema.partial();

export type InsertBeneficiary = z.infer<typeof insertBeneficiarySchema>;
export type Beneficiary = typeof beneficiariesTable.$inferSelect;
