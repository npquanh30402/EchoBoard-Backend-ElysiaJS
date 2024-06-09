import {
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userTable } from "./userTable";
import { relations } from "drizzle-orm";

export const fileTable = pgTable("files", {
  fileId: uuid("file_id").primaryKey().defaultRandom(),
  uploadBy: uuid("upload_by")
    .references(() => userTable.userId, { onDelete: "cascade" })
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
    references: [userTable.userId],
  }),
  // conversationMessages: one(messageTable, {
  //   fields: [fileTable.fileId],
  //   references: [messageTable.fileId],
  // }),
}));

export type fileType = typeof fileTable.$inferSelect;
