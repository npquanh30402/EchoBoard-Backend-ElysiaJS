import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./userTable";
import { relations } from "drizzle-orm";
import { messageTable } from "./messageTable";

export const conversationTable = pgTable(
  "conversations",
  {
    conversationId: uuid("conversation_id").primaryKey().defaultRandom(),
    user1Id: uuid("user_1_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
    user2Id: uuid("user_2_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
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
      user1AndUser2Unique: unique("conversation_user1_user2_unique").on(
        table.user1Id,
        table.user2Id,
      ),
      primaryAndCreatedAtIdx: index("conversation_primary_createdAt_idx").on(
        table.conversationId,
        table.createdAt,
      ),
      user1IdIdx: index("conversation_user_1_id_idx").on(table.user1Id),
      user2IdIdx: index("conversation_user_2_id_idx").on(table.user2Id),
    };
  },
);

export const conversationRelations = relations(
  conversationTable,
  ({ one, many }) => ({
    user1: one(userTable, {
      fields: [conversationTable.user1Id],
      references: [userTable.userId],
    }),
    user2: one(userTable, {
      fields: [conversationTable.user2Id],
      references: [userTable.userId],
    }),
    messages: many(messageTable),
  }),
);

export type conversationType = typeof conversationTable.$inferSelect;
