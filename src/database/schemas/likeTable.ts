import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userTable } from "./userTable";
import { postTable } from "./postTable";

export const likeTable = pgTable(
  "likes",
  {
    likeId: uuid("like_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
    postId: uuid("post_id")
      .references(() => postTable.postId, {
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
      userAndPostUnique: unique("like_user_post_unique").on(
        table.userId,
        table.postId,
      ),
      userIdIdx: index("like_user_id_idx").on(table.userId),
      postIdIdx: index("like_post_id_idx").on(table.postId),
    };
  },
);

export const likeRelations = relations(likeTable, ({ one }) => ({
  user: one(userTable, {
    fields: [likeTable.userId],
    references: [userTable.userId],
  }),
  post: one(postTable, {
    fields: [likeTable.postId],
    references: [postTable.postId],
  }),
}));

export type LikeType = typeof likeTable.$inferSelect;
