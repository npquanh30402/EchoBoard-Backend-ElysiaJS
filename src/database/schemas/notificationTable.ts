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
import { userTable } from "./userTable";

export const notificationTypeEnum = pgEnum("notification_type_enum", [
  "account_activity",
  "friend_request",
  "post_interaction",
  "mention",
  "group_activity",
  "event_reminder",
  "follow",
  "content_update",
  "achievement",
  "system_alert",
  "moderation_alert",
  "other",
]);

export const notificationTable = pgTable(
  "notifications",
  {
    notificationId: uuid("notification_id").primaryKey().defaultRandom(),
    notificationType: notificationTypeEnum("notification_type").notNull(),
    notificationContent: text("content").notNull(),
    isRead: boolean("is_read").default(false),
    notificationMetadata: json("notification_metadata"),
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

    userId: uuid("user_id").references(() => userTable.userId, {
      onDelete: "cascade",
    }),
  },
  (table) => {
    return {
      primaryAndCreatedAtIdx: index("notification_primary_createdAt_idx").on(
        table.notificationId,
        table.createdAt,
      ),
      userIdIdx: index("notification_user_id_idx").on(table.userId),
    };
  },
);

export const notificationRelations = relations(
  notificationTable,
  ({ one }) => ({
    user: one(userTable, {
      fields: [notificationTable.userId],
      references: [userTable.userId],
    }),
  }),
);

export type NotificationType = typeof notificationTable.$inferSelect;
