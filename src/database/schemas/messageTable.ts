import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./userTable";
import { conversationTable } from "./conversationTable";
import { fileTable } from "./fileTable";
import { relations } from "drizzle-orm";

export const messageTable = pgTable(
  "messages",
  {
    messageId: uuid("message_id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .references(() => conversationTable.conversationId, {
        onDelete: "cascade",
      })
      .notNull(),
    senderId: uuid("sender_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
    messageContent: text("message_content").notNull(),
    fileId: uuid("file_id").references(() => fileTable.fileId),
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
      primaryAndCreatedAtIdx: index("message_primary_createdAt_idx").on(
        table.messageId,
        table.createdAt,
      ),
      conversationIdIdx: index("message_conversation_id_idx").on(
        table.conversationId,
      ),
      senderIdIdx: index("message_sender_id_idx").on(table.senderId),
      fileIdIdx: index("message_file_id_idx").on(table.fileId),
    };
  },
);

export const messageRelations = relations(messageTable, ({ one, many }) => ({
  sender: one(userTable, {
    fields: [messageTable.senderId],
    references: [userTable.userId],
  }),
  conversation: one(conversationTable, {
    fields: [messageTable.conversationId],
    references: [conversationTable.conversationId],
  }),
  // files: many(fileTable),
}));

export type messageType = typeof messageTable.$inferSelect;
