import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./userSchema";
import { conversationTable } from "./conversationSchema";
import { fileTable } from "./fileSchema";
import { relations } from "drizzle-orm";

export const conversationMessagesTable = pgTable(
  "conversationMessages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversationTable.conversationId, {
        onDelete: "cascade",
      })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => userTable.id, {
        onDelete: "cascade",
      })
      .notNull(),
    messageText: text("message_text").notNull(),
    fileId: uuid("file_id").references(() => fileTable.id),
    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    return {
      createdAtAndIdIndex: index("conversation_createdAt_idx_and_id_idx").on(
        table.createdAt,
        table.id,
      ),
    };
  },
);

export const conversationMessagesRelations = relations(
  conversationMessagesTable,
  ({ one, many }) => ({
    sender: one(userTable, {
      fields: [conversationMessagesTable.senderId],
      references: [userTable.id],
    }),
    files: many(fileTable),
  }),
);

export type conversationMessageType =
  typeof conversationMessagesTable.$inferSelect;
