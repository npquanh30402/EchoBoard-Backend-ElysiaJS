import { Elysia } from "elysia";
import { db } from "../database/db";
import { userTable } from "../database/schemas";
import { and, asc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { cursorPaginationBodyDTO } from "../validators";

const tags = ["USER"];

export const userRoute = new Elysia({
  prefix: "/user",
}).post(
  "/search",
  ({ body }) => {
    const cursor = body.cursor || null;
    const searchTerm = body.searchTerm;

    return searchAndPaginate(searchTerm, 10, cursor);
  },
  {
    body: cursorPaginationBodyDTO,
    detail: {
      summary: "Search user",
      tags,
    },
  },
);

async function searchAndPaginate(
  searchTerm: string,
  pageSize = 3,
  cursor?: { id: string; createdAt: Date } | null,
) {
  const searchCondition = or(
    ilike(userTable.username, sql.placeholder("username")),
    ilike(userTable.email, sql.placeholder("email")),
  );

  const users = await db.query.userTable
    .findMany({
      columns: {
        id: true,
        username: true,
        createdAt: true,
      },
      with: {
        profile: {
          columns: {
            fullName: true,
            profilePictureUrl: true,
          },
        },
      },
      where: cursor
        ? and(
            searchCondition,
            or(
              gt(userTable.createdAt, cursor.createdAt),
              and(
                eq(userTable.createdAt, cursor.createdAt),
                gt(userTable.id, cursor.id),
              ),
            ),
          )
        : searchCondition,
      limit: pageSize,
      orderBy: [asc(userTable.createdAt), asc(userTable.id)],
    })
    .prepare("searchUserQuery")
    .execute({
      username: `%${searchTerm}%`,
      email: `%${searchTerm}%`,
    });

  return users.map((user) => {
    return {
      id: user.id,
      username: user.username,
      fullName: user.profile.fullName,
      profilePictureUrl: user.profile.profilePictureUrl,
      createdAt: user.createdAt,
    };
  });
}
