import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userTable } from "./userTable";
import { likeTable } from "./likeTable";
import { commentTable } from "./commentTable";

export const postTable = pgTable(
  "posts",
  {
    postId: uuid("post_id").primaryKey().defaultRandom(),
    authorId: uuid("author_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
    postTitle: varchar("post_title", { length: 256 }).notNull(),
    postContent: text("post_content").notNull(),
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
      primaryAndCreatedAtIdx: index("post_primary_createdAt_idx").on(
        table.postId,
        table.createdAt,
      ),
      authorIdAndCreatedAtIdx: index("post_author_id_created_at_idx").on(
        table.authorId,
        table.createdAt,
      ),
      authorIdIdx: index("post_author_id_idx").on(table.authorId),
      // postTitleIdx: index("post_title_idx").using(
      //   "gin",
      //   sql`to_tsvector('english', ${table.postTitle})`,
      // ),
      // postContentIdx: index("post_content_idx").using(
      //   "gin",
      //   sql`to_tsvector('english', ${table.postContent})`,
      // ),
      updatedAtIdx: index("post_updated_at_idx").on(table.updatedAt),
    };
  },
);

export const postRelations = relations(postTable, ({ one, many }) => ({
  author: one(userTable, {
    fields: [postTable.authorId],
    references: [userTable.userId],
  }),
  likes: many(likeTable),
  comments: many(commentTable),
}));

export type PostType = typeof postTable.$inferSelect;
