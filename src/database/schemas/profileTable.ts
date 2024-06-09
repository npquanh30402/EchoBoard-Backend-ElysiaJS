import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { userTable } from "./userTable";
import { relations } from "drizzle-orm";

export const profileTable = pgTable(
  "profiles",
  {
    profileId: uuid("profile_id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => userTable.userId, {
        onDelete: "cascade",
      })
      .notNull(),
    fullName: varchar("full_name", { length: 256 }),
    bio: text("bio"),
    avatarUrl: varchar("avatar_url", { length: 256 }),
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
      userIdIdx: index("profile_user_id_idx").on(table.userId),
    };
  },
);

export const profileRelations = relations(profileTable, ({ one }) => ({
  user: one(userTable, {
    fields: [profileTable.userId],
    references: [userTable.userId],
  }),
}));

export type ProfileType = typeof profileTable.$inferSelect;
