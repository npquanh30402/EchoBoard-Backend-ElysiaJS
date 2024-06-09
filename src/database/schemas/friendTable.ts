import {
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { userTable } from "./userTable";
import { relations } from "drizzle-orm";

export const friendshipStatusEnum = pgEnum("friendship_status_enum", [
  "pending",
  "accepted",
  "rejected",
]);

export const friendTable = pgTable(
  "friends",
  {
    friendId: uuid("friend_id").primaryKey().defaultRandom(),
    senderID: uuid("sender_id")
      .references(() => userTable.userId, { onDelete: "cascade" })
      .notNull(),
    receiverID: uuid("receiver_id")
      .references(() => userTable.userId, { onDelete: "cascade" })
      .notNull(),
    friendStatus: friendshipStatusEnum("friend_status")
      .notNull()
      .default("pending"),
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
      senderAndReceiverUnique: unique("friend_sender_receiver_unique").on(
        table.senderID,
        table.receiverID,
      ),
      primaryAndCreatedAtIdx: index("friend_primary_createdAt_idx").on(
        table.friendId,
        table.createdAt,
      ),
      senderIdIdx: index("friend_sender_id_idx").on(table.senderID),
      receiverIdIdx: index("friend_receiver_id_idx").on(table.receiverID),
      friendStatusIdx: index("friend_friend_status_idx").on(table.friendStatus),
    };
  },
);

export const friendRelations = relations(friendTable, ({ one }) => ({
  sender: one(userTable, {
    fields: [friendTable.senderID],
    references: [userTable.userId],
  }),
  receiver: one(userTable, {
    fields: [friendTable.receiverID],
    references: [userTable.userId],
  }),
}));

export type FriendType = typeof friendTable.$inferSelect;
