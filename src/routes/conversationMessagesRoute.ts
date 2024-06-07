import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userSchema";
import { db } from "../database/db";
import { conversationMessagesTable } from "../database/schemas";
import { and, desc, eq, gt, lt, or, SQL } from "drizzle-orm";
import { cursorPaginationBodyDTO, idParamDTO } from "../validators";
import { checkAuthenticatedMiddleware } from "../middleware";

const tags = ["CONVERSATION MESSAGE"];

export const conversationMessagesRoute = new Elysia({
  prefix: "/conversation-message",
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
    "/:id",
    async ({ params, body }) => {
      const { id } = params;
      const cursor = body.cursor || null;

      const searchCondition = eq(conversationMessagesTable.conversationId, id);

      const messages = await messageCursorPaginate(10, searchCondition, cursor);

      return messages
        .map((item) => {
          const { id, createdAt, sender, files, messageText } = item;

          if (id !== cursor?.id) {
            return {
              messageId: id,
              sender: {
                id: sender.id,
                username: sender.username,
                profilePictureUrl: sender.profile.profilePictureUrl,
              },
              messageText,
              files,
              createdAt,
            };
          }
        })
        .reverse();

      // return conversations.map((item) => {
      //   const { user1Id, user2Id, user1, user2, ...rest } = item;
      //   const otherUser = user1.id === authUser.id ? user2 : user1;
      //
      //   return {
      //     ...rest,
      //     otherUser: {
      //       id: otherUser.id,
      //       username: otherUser.username,
      //       profilePictureUrl: otherUser.profile.profilePictureUrl,
      //     },
      //   };
      // });
    },
    {
      params: idParamDTO,
      body: cursorPaginationBodyDTO,
      detail: {
        summary: "Fetch conversation messages",
        tags,
      },
    },
  )
  .post(
    "/",
    async ({ body, authUser }) => {
      const { conversationId, messageText, fileId } = body;

      await db.transaction((tx) => {
        return tx.insert(conversationMessagesTable).values({
          conversationId,
          messageText,
          senderId: authUser.id,
          fileId: fileId || null,
        });
      });

      return {};
    },
    {
      body: t.Object({
        conversationId: t.String({
          format: "uuid",
        }),
        messageText: t.String(),
        fileId: t.Optional(
          t.String({
            format: "uuid",
          }),
        ),
      }),
      detail: {
        summary: "Store a conversation message",
        tags,
      },
    },
  );

function messageCursorPaginate(
  pageSize = 10,
  searchCondition: SQL<unknown> | undefined,
  cursor?: { id: string; createdAt: Date } | null,
) {
  return db.query.conversationMessagesTable.findMany({
    columns: {
      id: true,
      messageText: true,
      createdAt: true,
    },
    where: cursor
      ? and(
          searchCondition,
          or(
            lt(conversationMessagesTable.createdAt, cursor.createdAt),
            and(
              eq(conversationMessagesTable.createdAt, cursor.createdAt),
              gt(conversationMessagesTable.id, cursor.id),
            ),
          ),
        )
      : searchCondition,
    limit: pageSize,
    orderBy: [
      desc(conversationMessagesTable.createdAt),
      desc(conversationMessagesTable.id),
    ],
    with: {
      sender: {
        columns: {
          id: true,
          username: true,
        },
        with: {
          profile: {
            columns: {
              profilePictureUrl: true,
            },
          },
        },
      },
      files: {
        columns: {
          id: true,
          fileName: true,
          filePath: true,
          fileSize: true,
          fileType: true,
        },
      },
    },
  });
}
