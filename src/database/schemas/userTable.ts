import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profileTable } from "./profileTable";
import { postTable } from "./postTable";
import { conversationTable } from "./conversationTable";
import { messageTable } from "./messageTable";
import { fileTable } from "./fileTable";
import { followTable } from "./followTable";

export const userTable = pgTable(
  "users",
  {
    userId: uuid("user_id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 20 }).unique().notNull(),
    email: varchar("email", { length: 320 }).unique().notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    emailVerified: timestamp("email_verified"),
    isAdmin: boolean("is_admin").notNull().default(false),
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
      usernameIdx: index("user_username_idx").on(table.username),
      emailIdx: index("user_email_idx").on(table.email),
      primaryAndCreatedAtIdx: index("user_primary_createdAt_idx").on(
        table.userId,
        table.createdAt,
      ),
    };
  },
);

export const userRelations = relations(userTable, ({ one, many }) => ({
  profile: one(profileTable, {
    fields: [userTable.userId],
    references: [profileTable.userId],
  }),
  posts: many(postTable),
  conversations: many(conversationTable),
  conversationMessages: many(messageTable),
  files: many(fileTable),
  followers: many(followTable),
  following: many(followTable),
}));

export type UserType = typeof userTable.$inferSelect;
