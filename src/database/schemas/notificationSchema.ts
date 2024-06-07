import {
  boolean,
  index,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userTable } from "./userSchema";

export const notificationTypeEnum = pgEnum("notification_type", [
  "account_activity",
  "friend_request",
  "moderation_alert",
  "other",
]);

export const notificationTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: notificationTypeEnum("notification_type").notNull(),
    // title: varchar("title", { length: 256 }).notNull(),
    content: text("content").notNull(),
    read: boolean("read").default(false),
    metadata: json("metadata"),
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

    userId: uuid("user_id").references(() => userTable.id, {
      onDelete: "cascade",
    }),
  },
  (table) => {
    return {
      // createdAtIdx: index("notification_createdAt_idx").on(table.createdAt),
      createdAtAndIdIndex: index("notification_createdAt_idx_and_id_idx").on(
        table.createdAt,
        table.id,
      ),
    };
  },
);

export const notificationRelations = relations(
  notificationTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [notificationTable.userId],
      references: [userTable.id],
    }),
  }),
);

export type NotificationType = typeof notificationTable.$inferSelect;
