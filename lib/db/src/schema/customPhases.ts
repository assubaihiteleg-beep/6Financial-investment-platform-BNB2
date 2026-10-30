import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";

export const customPhasesTable = pgTable("custom_phases", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  defaultAmount: text("default_amount").notNull().default("0"),
  failureMessage: text("failure_message").notNull(),
  failureTitle: text("failure_title"),
  cardColor: text("card_color"),
  status: text("status").notNull().default("active"), // "active" | "frozen"
  isFrozen: boolean("is_frozen").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const userCustomPhasesTable = pgTable("user_custom_phases", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  phaseId: integer("phase_id").notNull(),
  amount: text("amount").notNull().default("0"),
  status: text("status").notNull().default("unpaid"), // "unpaid" | "paid"
  paidAt: timestamp("paid_at", { withTimezone: true }),
  visible: boolean("visible").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CustomPhase = typeof customPhasesTable.$inferSelect;
export type UserCustomPhase = typeof userCustomPhasesTable.$inferSelect;
