import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { userTable } from "./userSchema";
import { relations } from "drizzle-orm";

export const conversationTable = pgTable(
  "conversations",
  {
    conversationId: uuid("id").primaryKey().defaultRandom(),
    user1Id: uuid("user_1_id")
      .references(() => userTable.id, {
        onDelete: "cascade",
      })
      .notNull(),
    user2Id: uuid("user_2_id")
      .references(() => userTable.id, {
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
      conversationUserUniquePair: unique("conversation_user_unique_pair").on(
        table.user1Id,
        table.user2Id,
      ),
    };
  },
);

export const conversationRelations = relations(
  conversationTable,
  ({ one }) => ({
    user1: one(userTable, {
      fields: [conversationTable.user1Id],
      references: [userTable.id],
    }),
    user2: one(userTable, {
      fields: [conversationTable.user2Id],
      references: [userTable.id],
    }),
  }),
);

export type conversationType = typeof conversationTable.$inferSelect;
