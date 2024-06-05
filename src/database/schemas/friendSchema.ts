import {
  index,
  pgEnum,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { userTable } from "./userSchema";
import { relations } from "drizzle-orm";

export const friendshipStatusEnum = pgEnum("friendship_status", [
  "pending",
  "accepted",
  "rejected",
]);

export const friendTable = pgTable(
  "friends",
  {
    senderID: uuid("sender_id")
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    receiverID: uuid("receiver_id")
      .references(() => userTable.id, { onDelete: "cascade" })
      .notNull(),
    status: friendshipStatusEnum("friendship_status")
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.senderID, table.receiverID] }),
      createdAtIdx: index("friend_createdAt_idx").on(table.createdAt),
      updatedAtIdx: index("friend_updatedAt_idx").on(table.updatedAt),
    };
  },
);

export const friendRelations = relations(friendTable, ({ one }) => ({
  sender: one(userTable, {
    fields: [friendTable.senderID],
    references: [userTable.id],
  }),
  receiver: one(userTable, {
    fields: [friendTable.receiverID],
    references: [userTable.id],
  }),
}));

export type FriendType = typeof friendTable.$inferSelect;
