import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { userTable, UserType } from "../database/schemas/userTable";
import { db } from "../database/db";
import { conversationTable } from "../database/schemas";
import { and, eq, getTableColumns, or, sql } from "drizzle-orm";
import { checkAuthenticatedMiddleware } from "../middleware";

const tags = ["CONVERSATION"];

export const conversationRoute = new Elysia({
  prefix: "/conversations",
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
  .get(
    "/",
    async ({ authUser }) => {
      const conversations = await db.query.conversationTable.findMany({
        where: or(
          eq(conversationTable.user1Id, authUser.userId),
          eq(conversationTable.user2Id, authUser.userId),
        ),
        columns: {
          conversationId: true,
          user1Id: true,
          user2Id: true,
          createdAt: true,
        },
        with: {
          user1: {
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
          user2: {
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

      const results = conversations.map((item) => {
        const { user1Id, user2Id, user1, user2, ...rest } = item;
        const otherUser = user1.userId === authUser.userId ? user2 : user1;

        return {
          ...rest,
          otherUser: {
            userId: otherUser.userId,
            username: otherUser.username,
            avatarUrl: otherUser.profile.avatarUrl,
          },
        };
      });

      return results;
    },
    {
      response: {
        200: t.Array(
          t.Object({
            conversationId: t.String(),
            createdAt: t.Date(),
            otherUser: t.Object({
              userId: t.String(),
              username: t.String(),
              avatarUrl: t.Union([t.String(), t.Null()]),
            }),
          }),
        ),
      },
      detail: {
        summary: "Fetch conversations",
        tags,
      },
    },
  )
  .get(
    "/:userId",
    async ({ params, authUser }) => {
      const { userId } = params;
      const conversation = await db.query.conversationTable
        .findFirst({
          where: or(
            and(
              eq(conversationTable.user1Id, authUser.userId),
              eq(conversationTable.user2Id, sql.placeholder("otherUserId")),
            ),
            and(
              eq(conversationTable.user1Id, sql.placeholder("otherUserId")),
              eq(conversationTable.user2Id, authUser.userId),
            ),
          ),
          columns: {
            conversationId: true,
            user1Id: true,
            user2Id: true,
            createdAt: true,
          },
          with: {
            user1: {
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
            user2: {
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
        })
        .prepare("fetchConversationBetweenUsersQuery")
        .execute({
          otherUserId: userId,
        });

      let result;
      if (conversation?.user1Id === authUser.userId) {
        result = {
          conversationId: conversation?.conversationId,
          createdAt: conversation?.createdAt,
          otherUser: {
            userId: conversation?.user2.userId,
            username: conversation?.user2.username,
            avatarUrl: conversation?.user2.profile.avatarUrl,
          },
        };
      } else {
        result = {
          conversationId: conversation?.conversationId,
          createdAt: conversation?.createdAt,
          otherUser: {
            userId: conversation?.user1.userId,
            username: conversation?.user1.username,
            avatarUrl: conversation?.user1.profile.avatarUrl,
          },
        };
      }

      return result;
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({
          conversationId: t.Union([t.String(), t.Undefined()]),
          createdAt: t.Union([t.Date(), t.Undefined()]),
          otherUser: t.Object({
            userId: t.Union([t.String(), t.Undefined()]),
            username: t.Union([t.String(), t.Undefined()]),
            avatarUrl: t.Union([t.String(), t.Undefined(), t.Null()]),
          }),
        }),
      },
      detail: {
        summary: "Fetch conversation between auth user and other user",
        tags,
      },
    },
  )
  .post(
    "/:userId",
    async ({ params, authUser, set }) => {
      const { userId } = params;

      const { updatedAt, ...restOfConversation } =
        getTableColumns(conversationTable);

      const conversation = await db.transaction(async (tx) => {
        const [newConversation] = await tx
          .insert(conversationTable)
          .values({
            user1Id: authUser.userId,
            user2Id: userId,
          })
          .returning(restOfConversation);

        const user = await tx.query.userTable.findFirst({
          where: eq(userTable.userId, userId),
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
          ...newConversation,
          otherUser: {
            userId: userId,
            username: user?.username,
            avatarUrl: user?.profile.avatarUrl,
          },
        };
      });

      if (!conversation) {
        throw new Error("Failed to create conversation");
      }

      set.status = 201;
      return conversation;
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        201: t.Object({
          conversationId: t.String({
            format: "uuid",
          }),
          user1Id: t.String({
            format: "uuid",
          }),
          user2Id: t.String({
            format: "uuid",
          }),
          otherUser: t.Object({
            userId: t.String({
              format: "uuid",
            }),
            username: t.Union([t.String(), t.Undefined()]),
            avatarUrl: t.Union([t.String(), t.Undefined(), t.Null()]),
          }),
          createdAt: t.Date(),
        }),
      },
      detail: {
        summary: "Create a new conversation",
        tags,
      },
    },
  );
