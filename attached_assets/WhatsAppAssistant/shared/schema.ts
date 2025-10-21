import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull(),
  password: text("password").notNull(),
});

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const candidates = pgTable("candidates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  isPinned: boolean("is_pinned").notNull().default(false),
  chatType: text("chat_type").notNull().default("individual"),
  previousChatType: text("previous_chat_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  candidateId: varchar("candidate_id").notNull().references(() => candidates.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed
  direction: text("direction").notNull().default("outgoing"), // outgoing, incoming
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  deliveredAt: timestamp("delivered_at"),
  errorMessage: text("error_message"),
});

// Relations
export const candidatesRelations = relations(candidates, ({ many }) => ({
  messages: many(whatsappMessages),
}));

export const whatsappMessagesRelations = relations(whatsappMessages, ({ one }) => ({
  candidate: one(candidates, {
    fields: [whatsappMessages.candidateId],
    references: [candidates.id],
  }),
}));

// Insert schemas
export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  sentAt: true,
});

// Types
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;
export type Candidate = typeof candidates.$inferSelect;

export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
