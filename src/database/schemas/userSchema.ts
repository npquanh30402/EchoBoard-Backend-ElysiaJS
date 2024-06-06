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
import { profileTable } from "./profileSchema";
import { postTable } from "./postSchema";
import { conversationTable } from "./conversationSchema";
import { fileTable } from "./fileSchema";
import { conversationMessagesTable } from "./conversationMessagesSchema";

export const userTable = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    username: varchar("username", { length: 20 }).unique().notNull(),
    email: varchar("email", { length: 320 }).unique().notNull(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    emailVerified: timestamp("emailVerified"),
    isAdmin: boolean("isAdmin").notNull().default(false),
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
      // createdAtIndex: index("user_created_at_idx").on(table.createdAt),
      createdAtAndIdIndex: index("user_created_at_and_id_idx").on(
        table.createdAt,
        table.id,
      ),
    };
  },
);

export const userRelations = relations(userTable, ({ one, many }) => ({
  profile: one(profileTable, {
    fields: [userTable.id],
    references: [profileTable.userId],
  }),
  posts: many(postTable),
  conversations: many(conversationTable),
  conversationMessages: many(conversationMessagesTable),
  files: many(fileTable),
}));

export type UserType = typeof userTable.$inferSelect;
