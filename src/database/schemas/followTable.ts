import { index, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { userTable } from "./userTable";

export const followTable = pgTable(
  "follows",
  {
    followId: uuid("follow_id").primaryKey().defaultRandom(),
    followerId: uuid("follower_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
    followedId: uuid("followed_id")
      .references(() => userTable.userId, {
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
      followerAndFollowedUnique: unique("follow_follower_followed_unique").on(
        table.followerId,
        table.followedId,
      ),
      primaryAndCreatedAtIdx: index("follow_primary_createdAt_idx").on(
        table.followId,
        table.createdAt,
      ),
      followerIdIdx: index("friend_follower_id_idx").on(table.followerId),
      followedIdIdx: index("friend_followed_id_idx").on(table.followedId),
    };
  },
);

export const followingRelations = relations(followTable, ({ one }) => ({
  follower: one(userTable, {
    fields: [followTable.followerId],
    references: [userTable.userId],
  }),
  followed: one(userTable, {
    fields: [followTable.followedId],
    references: [userTable.userId],
  }),
}));

export type FollowingType = typeof followTable.$inferSelect;
