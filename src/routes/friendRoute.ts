import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { friendTable, userTable } from "../database/schemas";
import { checkAuthenticatedMiddleware } from "../middleware";
import { UserType } from "../database/schemas/userTable";
import { authJwt } from "../configs";
import { and, desc, eq, gt, lt, or } from "drizzle-orm";
import { cursorPaginationBodyDTO } from "../validators";
import { createNotification } from "./notificationRoute";
import { server } from "../index";

const tags = ["FRIEND"];

export const friendRoute = new Elysia({
  prefix: "/friends",
})
  .use(authJwt)
  .guard({
    async beforeHandle({ set, cookie, authJwt }) {
      const { auth } = cookie;

      if (!(await checkAuthenticatedMiddleware(authJwt, auth.value))) {
        set.status = 401;
        throw new Error("Unauthorized");
      }
    },
  })
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;

    return {
      authUser,
    };
  })
  .post(
    "/send-friend-request/:userId",
    async ({ set, params, authUser }) => {
      const { userId } = params;

      const result = await db.transaction(async (tx) => {
        const [newRequest] = await tx
          .insert(friendTable)
          .values({
            senderID: authUser.userId,
            receiverID: userId,
          })
          .returning();

        const user = await tx.query.userTable.findFirst({
          where: eq(userTable.userId, authUser.userId),
          columns: {
            username: true,
          },
          with: {
            profile: {
              columns: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        });

        return {
          friendId: newRequest.friendId,
          friendStatus: newRequest.friendStatus,
          userId,
          username: user?.username,
          fullName: user?.profile.fullName,
          avatarUrl: user?.profile.avatarUrl,
          createdAt: newRequest.createdAt,
        };
      });

      if (userId !== authUser.userId) {
        await createNotification(
          "friend_request",
          `${authUser.username} sent you a friend request`,
          userId,
        );

        server?.publish(`private-friend-${userId}`, JSON.stringify(result));
      }

      set.status = 201;
      return result;
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        201: t.Object({
          friendId: t.String({
            format: "uuid",
          }),
          friendStatus: t.Union([
            t.Literal("pending"),
            t.Literal("accepted"),
            t.Literal("rejected"),
          ]),
          userId: t.String({
            format: "uuid",
          }),
          username: t.Union([t.String(), t.Undefined()]),
          fullName: t.Union([t.String(), t.Undefined(), t.Null()]),
          avatarUrl: t.Union([t.String(), t.Undefined(), t.Null()]),
          createdAt: t.Date(),
        }),
      },
      detail: {
        summary: "Send friend request",
        tags,
      },
    },
  )
  .patch(
    "/accept-friend-request/:userId",
    async ({ params, authUser }) => {
      const { userId } = params;

      const result = await db.transaction(async (tx) => {
        const [updatedRequest] = await tx
          .update(friendTable)
          .set({
            friendStatus: "accepted",
            updatedAt: new Date(),
          })
          .where(
            or(
              and(
                eq(friendTable.receiverID, userId),
                eq(friendTable.senderID, authUser.userId),
              ),
              and(
                eq(friendTable.receiverID, authUser.userId),
                eq(friendTable.senderID, userId),
              ),
            ),
          )
          .returning();

        const user = await tx.query.userTable.findFirst({
          where: eq(userTable.userId, authUser.userId),
          columns: {
            username: true,
          },
          with: {
            profile: {
              columns: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        });

        return {
          friendId: updatedRequest.friendId,
          friendStatus: updatedRequest.friendStatus,
          userId,
          username: user?.username,
          fullName: user?.profile.fullName,
          avatarUrl: user?.profile.avatarUrl,
          createdAt: updatedRequest.createdAt,
        };
      });

      if (userId !== authUser.userId) {
        await createNotification(
          "friend_request",
          `${authUser.username} has accepted your friend request`,
          userId,
        );

        server?.publish(`private-friend-${userId}`, JSON.stringify(result));
      }

      return {};
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Accept friend request",
        tags,
      },
    },
  )
  .patch(
    "/reject-friend-request/:userId",
    async ({ params, authUser }) => {
      const { userId } = params;

      const result = await db.transaction(async (tx) => {
        const [updatedRequest] = await tx
          .update(friendTable)
          .set({
            friendStatus: "rejected",
            updatedAt: new Date(),
          })
          .where(
            or(
              and(
                eq(friendTable.receiverID, userId),
                eq(friendTable.senderID, authUser.userId),
              ),
              and(
                eq(friendTable.receiverID, authUser.userId),
                eq(friendTable.senderID, userId),
              ),
            ),
          )
          .returning();

        const user = await tx.query.userTable.findFirst({
          where: eq(userTable.userId, authUser.userId),
          columns: {
            username: true,
          },
          with: {
            profile: {
              columns: {
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        });

        return {
          friendId: updatedRequest.friendId,
          friendStatus: updatedRequest.friendStatus,
          userId,
          username: user?.username,
          fullName: user?.profile.fullName,
          avatarUrl: user?.profile.avatarUrl,
          createdAt: updatedRequest.createdAt,
        };
      });

      if (userId !== authUser.userId) {
        await createNotification(
          "friend_request",
          `${authUser.username} has rejected your friend request`,
          userId,
        );

        server?.publish(`private-friend-${userId}`, JSON.stringify(result));
      }

      return {};
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Reject friend request",
        tags,
      },
    },
  )
  .delete(
    "/delete-request-sent/:userId",
    async ({ params, authUser }) => {
      const { userId } = params;

      const result = await db.transaction(async (tx) => {
        const [deletedRequest] = await tx
          .delete(friendTable)
          .where(
            and(
              eq(friendTable.receiverID, userId),
              eq(friendTable.senderID, authUser.userId),
            ),
          )
          .returning({
            friendId: friendTable.friendId,
          });

        return {
          friendId: deletedRequest.friendId,
          friendStatus: "deleted",
        };
      });

      server?.publish(`private-friend-${userId}`, JSON.stringify(result));

      return {};
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Delete request sent",
        tags,
      },
    },
  )
  .get(
    "/friendship-status/:userId",
    async ({ params, authUser }) => {
      const { userId } = params;
      const friendStatus = await db.query.friendTable.findFirst({
        where: or(
          and(
            eq(friendTable.receiverID, userId),
            eq(friendTable.senderID, authUser.userId),
          ),
          and(
            eq(friendTable.receiverID, authUser.userId),
            eq(friendTable.senderID, userId),
          ),
        ),
        columns: {
          friendStatus: true,
        },
      });

      return friendStatus?.friendStatus ?? "none";
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Union([
          t.Literal("pending"),
          t.Literal("accepted"),
          t.Literal("rejected"),
          t.Literal("none"),
        ]),
      },
      detail: {
        summary: "Fetch friendship status",
        tags,
      },
    },
  )
  .post(
    "/friend-request",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;
      const pageSize = 10;

      const searchCondition = and(
        eq(friendTable.receiverID, authUser.userId),
        eq(friendTable.friendStatus, "pending"),
      );

      const sent = await db.query.friendTable.findMany({
        columns: {
          friendId: true,
          senderID: true,
          createdAt: true,
        },
        where: cursor
          ? and(
              searchCondition,
              or(
                lt(friendTable.createdAt, cursor.createdAt),
                and(
                  eq(friendTable.createdAt, cursor.createdAt),
                  gt(friendTable.receiverID, cursor.id),
                ),
              ),
            )
          : searchCondition,
        limit: pageSize,
        orderBy: [desc(friendTable.createdAt), desc(friendTable.senderID)],
        with: {
          sender: {
            columns: {
              username: true,
            },
            with: {
              profile: {
                columns: {
                  fullName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      const results = sent
        .filter((item) => item.senderID !== authUser.userId)
        .map((item) => ({
          friendId: item.friendId,
          userId: item.senderID,
          username: item.sender.username,
          fullName: item.sender.profile.fullName,
          avatarUrl: item.sender.profile.avatarUrl,
          createdAt: item.createdAt,
        }));

      return results;
    },
    {
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(
          t.Object({
            friendId: t.String(),
            userId: t.String(),
            username: t.String(),
            fullName: t.Union([t.String(), t.Null()]),
            avatarUrl: t.Union([t.String(), t.Null()]),
            createdAt: t.Date(),
          }),
        ),
      },
      detail: {
        summary: "Fetch friend request list",
        tags,
      },
    },
  )
  .post(
    "/request-sent",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;
      const pageSize = 10;

      const searchCondition = and(
        eq(friendTable.senderID, authUser.userId),
        eq(friendTable.friendStatus, "pending"),
      );

      const sent = await db.query.friendTable.findMany({
        columns: {
          friendId: true,
          receiverID: true,
          createdAt: true,
        },
        where: cursor
          ? and(
              searchCondition,
              or(
                lt(friendTable.createdAt, cursor.createdAt),
                and(
                  eq(friendTable.createdAt, cursor.createdAt),
                  gt(friendTable.receiverID, cursor.id),
                ),
              ),
            )
          : searchCondition,
        limit: pageSize,
        orderBy: [desc(friendTable.createdAt), desc(friendTable.senderID)],
        with: {
          receiver: {
            columns: {
              username: true,
            },
            with: {
              profile: {
                columns: {
                  fullName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      const results = sent
        .filter((item) => item.receiverID !== authUser.userId)
        .map((item) => ({
          friendId: item.friendId,
          userId: item.receiverID,
          username: item.receiver.username,
          fullName: item.receiver.profile.fullName,
          avatarUrl: item.receiver.profile.avatarUrl,
          createdAt: item.createdAt,
        }));

      return results;
    },
    {
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(
          t.Object({
            friendId: t.String(),
            userId: t.String(),
            username: t.String(),
            fullName: t.Union([t.String(), t.Null()]),
            avatarUrl: t.Union([t.String(), t.Null()]),
            createdAt: t.Date(),
          }),
        ),
      },
      detail: {
        summary: "Fetch request sent list",
        tags,
      },
    },
  )
  .post(
    "/friend-list",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;
      const pageSize = 10;

      const searchCondition = and(
        eq(friendTable.friendStatus, "accepted"),
        or(
          eq(friendTable.senderID, authUser.userId),
          eq(friendTable.receiverID, authUser.userId),
        ),
      );

      const sent = await db.query.friendTable.findMany({
        columns: {
          friendId: true,
          receiverID: true,
          senderID: true,
          createdAt: true,
        },
        where: cursor
          ? and(
              searchCondition,
              or(
                lt(friendTable.createdAt, cursor.createdAt),
                and(
                  eq(friendTable.createdAt, cursor.createdAt),
                  gt(friendTable.receiverID, cursor.id),
                ),
              ),
            )
          : searchCondition,
        limit: pageSize,
        orderBy: [desc(friendTable.createdAt), desc(friendTable.senderID)],
        with: {
          receiver: {
            columns: {
              username: true,
            },
            with: {
              profile: {
                columns: {
                  fullName: true,
                  avatarUrl: true,
                },
              },
            },
          },
          sender: {
            columns: {
              username: true,
            },
            with: {
              profile: {
                columns: {
                  fullName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      const results = sent.map((item) => {
        if (item.receiverID === authUser.userId) {
          return {
            friendId: item.friendId,
            userId: item.senderID,
            username: item.sender.username,
            fullName: item.sender.profile.fullName,
            avatarUrl: item.sender.profile.avatarUrl,
            createdAt: item.createdAt,
          };
        } else {
          return {
            friendId: item.friendId,
            userId: item.receiverID,
            username: item.receiver.username,
            fullName: item.receiver.profile.fullName,
            avatarUrl: item.receiver.profile.avatarUrl,
            createdAt: item.createdAt,
          };
        }
      });

      return results;
    },
    {
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(
          t.Object({
            friendId: t.String(),
            userId: t.String(),
            username: t.String(),
            fullName: t.Union([t.String(), t.Null()]),
            avatarUrl: t.Union([t.String(), t.Null()]),
            createdAt: t.Date(),
          }),
        ),
      },
      detail: {
        summary: "Fetch friend list",
        tags,
      },
    },
  );
