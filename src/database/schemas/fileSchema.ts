import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userTable } from "./userSchema";
import { relations } from "drizzle-orm";
import { conversationMessagesTable } from "./conversationMessagesSchema";

export const fileTable = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  uploadBy: uuid("upload_by")
    .references(() => userTable.id, { onDelete: "cascade" })
    .notNull(),
  fileName: varchar("file_name", {
    length: 256,
  }).notNull(),
  filePath: varchar("file_path", {
    length: 256,
  }).notNull(),
  fileSize: integer("file_size"),
  fileType: varchar("file_type", {
    length: 256,
  }).notNull(),
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
});

export const fileRelations = relations(fileTable, ({ one }) => ({
  user: one(userTable, {
    fields: [fileTable.uploadBy],
    references: [userTable.id],
  }),
  conversationMessages: one(conversationMessagesTable, {
    fields: [fileTable.id],
    references: [conversationMessagesTable.fileId],
  }),
}));

export type fileType = typeof fileTable.$inferSelect;
