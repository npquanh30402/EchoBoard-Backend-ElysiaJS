import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userTable } from "./userSchema";

export const postTable = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorId: uuid("user_id")
    .references(() => userTable.id, {
      onDelete: "cascade",
    })
    .notNull(),
  title: varchar("username", { length: 100 }).unique().notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const postRelations = relations(postTable, ({ one }) => ({
  author: one(userTable, {
    fields: [postTable.authorId],
    references: [userTable.id],
  }),
}));

export type PostType = typeof postTable.$inferSelect;
