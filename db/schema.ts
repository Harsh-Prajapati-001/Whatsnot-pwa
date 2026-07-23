import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  picture: text("picture"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [uniqueIndex("sessions_token_hash_idx").on(table.tokenHash)]);

export const systems = sqliteTable("systems", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  goalsJson: text("goals_json").notNull(),
  provider: text("provider").notNull(),
  monthlyCost: integer("monthly_cost").notNull().default(0),
  status: text("status").notNull().default("setting_up"),
  progress: integer("progress").notNull().default(20),
  lastEvent: text("last_event").notNull().default("Waiting for WhatsApp connection"),
  destination: text("destination").notNull().default("Not connected"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const messageEvents = sqliteTable("message_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  systemId: text("system_id").references(() => systems.id, { onDelete: "set null" }),
  systemName: text("system_name").notNull(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull(),
  customerReference: text("customer_reference"),
  createdAt: integer("created_at").notNull(),
});
