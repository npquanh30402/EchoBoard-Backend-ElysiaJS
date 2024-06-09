import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { userTable } from "../database/schemas";
import { and, desc, eq, ilike, lt, or, SQL } from "drizzle-orm";
import { cursorPaginationBodyDTO } from "../validators";

const tags = ["USER"];

export const userRoute = new Elysia({
  prefix: "/users",
}).post(
  "/search",
  async ({ body, query }) => {
    const cursor = body.cursor || null;
    const searchTerm = query.searchTerm;

    const searchCondition = or(
      ilike(userTable.username, `%${searchTerm}%`),
      ilike(userTable.email, `%${searchTerm}%`),
    );

    const users = await userCursorPaginate(10, searchCondition, cursor);

    const results = users.map((item) => {
      return {
        userId: item.userId,
        username: item.username,
        fullName: item.profile.fullName,
        avatarUrl: item.profile.avatarUrl,
        createdAt: item.createdAt,
      };
    });

    return results;
  },
  {
    query: t.Object({
      searchTerm: t.String(),
    }),
    body: cursorPaginationBodyDTO,
    response: {
      200: t.Array(
        t.Object({
          userId: t.String(),
          username: t.String(),
          avatarUrl: t.Union([t.String(), t.Null()]),
          createdAt: t.Date(),
        }),
      ),
    },
    detail: {
      summary: "Search user by username or email",
      tags,
    },
  },
);

async function userCursorPaginate(
  pageSize = 10,
  searchCondition: SQL<unknown> | undefined,
  cursor?: { id: string; createdAt: Date } | null,
) {
  const users = await db.query.userTable.findMany({
    columns: {
      userId: true,
      username: true,
      createdAt: true,
    },
    with: {
      profile: {
        columns: {
          fullName: true,
          avatarUrl: true,
        },
      },
    },
    where: cursor
      ? and(
          searchCondition,
          or(
            lt(userTable.createdAt, cursor.createdAt),
            and(
              eq(userTable.createdAt, cursor.createdAt),
              lt(userTable.userId, cursor.id),
            ),
          ),
        )
      : searchCondition,
    limit: pageSize,
    orderBy: [desc(userTable.createdAt), desc(userTable.userId)],
  });

  return users;
}
