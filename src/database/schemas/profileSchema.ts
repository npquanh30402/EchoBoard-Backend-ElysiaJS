import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { userTable } from "./userSchema";
import { relations } from "drizzle-orm";

export const profileTable = pgTable("profiles", {
  userId: uuid("user_id")
    .references(() => userTable.id, {
      onDelete: "cascade",
    })
    .primaryKey()
    .notNull(),
  fullName: varchar("full_name", { length: 256 }),
  bio: text("bio"),
  profilePictureUrl: varchar("profile_picture_url", { length: 256 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const profileRelations = relations(profileTable, ({ one }) => ({
  user: one(userTable, {
    fields: [profileTable.userId],
    references: [userTable.id],
  }),
}));

export type ProfileType = typeof profileTable.$inferSelect;
