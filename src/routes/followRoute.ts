import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { and, desc, eq, getTableColumns, gt, lt, or } from "drizzle-orm";
import { followTable } from "../database/schemas";
import { db } from "../database/db";
import { UserType } from "../database/schemas/userTable";
import { cursorPaginationBodyDTO } from "../validators";
import { createNotification } from "./notificationRoute";

const tags = ["FOLLOW"];

export const followRoute = new Elysia({
  prefix: "/follow",
})
  .use(authJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
    return {
      authUser,
    };
  })
  .post(
    "/:followedId",
    async ({ params, authUser, set }) => {
      const { followedId } = params;

      await db.transaction(async (tx) => {
        await tx.insert(followTable).values({
          followerId: authUser.userId,
          followedId,
        });
      });

      await createNotification(
        "follow",
        `${authUser.username} followed you`,
        followedId,
      );

      set.status = 201;
      return {};
    },
    {
      params: t.Object({
        followedId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        201: t.Object({}),
      },
      detail: {
        summary: "Follow an user",
        tags,
      },
    },
  )
  .delete(
    "/:followedId",
    async ({ params, authUser }) => {
      const { followedId } = params;

      const {} = getTableColumns(followTable);
      await db.transaction(async (tx) => {
        await tx
          .delete(followTable)
          .where(
            and(
              eq(followTable.followerId, authUser.userId),
              eq(followTable.followedId, followedId),
            ),
          );
      });

      return {};
    },
    {
      params: t.Object({
        followedId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Unfollow an user",
        tags,
      },
    },
  )
  .post(
    "/followers/:userId",
    async ({ params, body }) => {
      const { userId } = params;
      const cursor = body.cursor || null;

      const searchCondition = eq(followTable.followedId, userId);

      const pageSize = 10;

      const followers = await db.query.followTable.findMany({
        where: cursor
          ? and(
              searchCondition,
              or(
                lt(followTable.createdAt, cursor.createdAt),
                and(
                  eq(followTable.createdAt, cursor.createdAt),
                  gt(followTable.followId, cursor.id),
                ),
              ),
            )
          : searchCondition,
        limit: pageSize,
        orderBy: [desc(followTable.createdAt), desc(followTable.followId)],
        columns: {
          followId: true,
          createdAt: true,
        },
        with: {
          follower: {
            columns: {
              userId: true,
              username: true,
            },
            with: {
              profile: {
                columns: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      const results = followers.map((item) => {
        return {
          followId: item.followId,
          userId: item.follower.userId,
          username: item.follower.username,
          avatarUrl: item.follower.profile.avatarUrl,
          createdAt: item.createdAt,
        };
      });

      return results;
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(
          t.Object({
            followId: t.String(),
            userId: t.String(),
            username: t.String(),
            avatarUrl: t.Union([t.String(), t.Null()]),
            createdAt: t.Date(),
          }),
        ),
      },
      detail: {
        summary: "Fetch who followed an user",
        tags,
      },
    },
  )
  .post(
    "/following/:userId",
    async ({ params, body }) => {
      const { userId } = params;
      const cursor = body.cursor || null;

      const searchCondition = eq(followTable.followerId, userId);

      const pageSize = 10;

      const followers = await db.query.followTable.findMany({
        where: cursor
          ? and(
              searchCondition,
              or(
                lt(followTable.createdAt, cursor.createdAt),
                and(
                  eq(followTable.createdAt, cursor.createdAt),
                  gt(followTable.followId, cursor.id),
                ),
              ),
            )
          : searchCondition,
        limit: pageSize,
        orderBy: [desc(followTable.createdAt), desc(followTable.followId)],
        columns: {
          followId: true,
          createdAt: true,
        },
        with: {
          followed: {
            columns: {
              userId: true,
              username: true,
            },
            with: {
              profile: {
                columns: {
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      const results = followers.map((item) => {
        return {
          followId: item.followId,
          userId: item.followed.userId,
          username: item.followed.username,
          avatarUrl: item.followed.profile.avatarUrl,
          createdAt: item.createdAt,
        };
      });

      return results;
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(
          t.Object({
            followId: t.String(),
            userId: t.String(),
            username: t.String(),
            avatarUrl: t.Union([t.String(), t.Null()]),
            createdAt: t.Date(),
          }),
        ),
      },
      detail: {
        summary: "Fetch who the user is following",
        tags,
      },
    },
  );
