import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userTable } from "./userTable";
import { postTable } from "./postTable";

export const commentTable = pgTable(
  "comments",
  {
    commentId: uuid("comment_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => userTable.userId, { onDelete: "cascade" })
      .notNull(),
    postId: uuid("post_id")
      .references(() => postTable.postId, { onDelete: "cascade" })
      .notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => {
    return {
      postIdIndex: index("comment_post_id_idx").on(table.postId),
      userIdIndex: index("comment_user_id_idx").on(table.userId),
      createdAtIndex: index("comment_created_at_idx").on(table.createdAt),
      primaryAndCreatedAtIdx: index("comment_primary_createdAt_idx").on(
        table.commentId,
        table.createdAt,
      ),
    };
  },
);

export const commentRelations = relations(commentTable, ({ one }) => ({
  user: one(userTable, {
    fields: [commentTable.userId],
    references: [userTable.userId],
  }),
  post: one(postTable, {
    fields: [commentTable.postId],
    references: [postTable.postId],
  }),
}));

export type CommentType = typeof commentTable.$inferSelect;
