import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const depositMethodsTable = pgTable("deposit_methods", {
  id: serial("id").primaryKey(),
  beneficiaryId: integer("beneficiary_id").notNull().unique(),
  // Bank method
  bankAccountName: text("bank_account_name").notNull().default(""),
  bankIban: text("bank_iban").notNull().default(""),
  bankName: text("bank_name").notNull().default(""),
  // USDT method
  usdtWalletAddress: text("usdt_wallet_address").notNull().default(""),
  usdtNetwork: text("usdt_network").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type DepositMethods = typeof depositMethodsTable.$inferSelect;
