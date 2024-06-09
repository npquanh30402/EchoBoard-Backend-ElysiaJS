import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userTable";
import { db } from "../database/db";
import { messageTable, profileTable } from "../database/schemas";
import {
  and,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  or,
  sql,
  SQL,
} from "drizzle-orm";
import { cursorPaginationBodyDTO } from "../validators";
import { checkAuthenticatedMiddleware } from "../middleware";
import { server } from "../index";

const tags = ["CONVERSATION MESSAGE"];

export const messageRoute = new Elysia({
  prefix: "/messages",
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
    "/:conversationId",
    async ({ params, body }) => {
      const { conversationId } = params;
      const cursor = body.cursor || null;

      const searchCondition = eq(messageTable.conversationId, conversationId);

      const messages = await messageCursorPaginate(10, searchCondition, cursor);

      const results = messages
        .map((item) => {
          const { messageId, senderId, messageContent, createdAt, sender } =
            item;

          if (messageId !== cursor?.id) {
            return {
              messageId,
              sender: {
                userId: senderId,
                username: sender.username,
                avatarUrl: sender.profile.avatarUrl,
              },
              messageContent,
              createdAt,
            };
          }
        })
        .reverse();

      return results;
    },
    {
      params: t.Object({
        conversationId: t.String({
          format: "uuid",
        }),
      }),
      body: cursorPaginationBodyDTO,
      // response: t.Array(
      //   t.Object({
      //     messageId: t.String({
      //       format: "uuid",
      //     }),
      //     sender: t.Object({
      //       userId: t.String({
      //         format: "uuid",
      //       }),
      //       username: t.String(),
      //       avatarUrl: t.Union([t.String(), t.Null()]),
      //     }),
      //     messageContent: t.String(),
      //     createdAt: t.Date(),
      //   }),
      // ),
      detail: {
        summary: "Fetch conversation messages",
        tags,
      },
    },
  )
  .post(
    "/",
    async ({ set, body, authUser }) => {
      const { conversationId, messageContent, receiverId } = body;

      const {
        conversationId: conversationIdMessage,
        senderId,
        fileId,
        updatedAt,
        ...restOfMessage
      } = getTableColumns(messageTable);

      const result = await db.transaction(async (tx) => {
        const [newMessage] = await tx
          .insert(messageTable)
          .values({
            conversationId,
            messageContent,
            senderId: authUser.userId,
          })
          .returning(restOfMessage);

        const profile = await tx.query.profileTable
          .findFirst({
            where: eq(profileTable.userId, sql.placeholder("userId")),
            columns: {
              avatarUrl: true,
            },
          })
          .prepare("fetchAvatarUrlQuery")
          .execute({
            userId: authUser.userId,
          });

        return {
          conversationId,
          messageId: newMessage.messageId,
          sender: {
            userId: authUser.userId,
            username: authUser.username,
            avatarUrl: profile?.avatarUrl,
          },
          messageContent,
          createdAt: newMessage.createdAt,
        };
      });

      server?.publish(
        `private-conversation-${authUser.userId}`,
        JSON.stringify(result),
      );

      server?.publish(
        `private-conversation-${receiverId}`,
        JSON.stringify(result),
      );

      set.status = 201;
      return {};
    },
    {
      body: t.Object({
        conversationId: t.String({
          format: "uuid",
        }),
        messageContent: t.String(),
        fileId: t.Optional(
          t.String({
            format: "uuid",
          }),
        ),
        receiverId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        201: t.Object({}),
      },
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
  return db.query.messageTable.findMany({
    columns: {
      messageId: true,
      messageContent: true,
      senderId: true,
      createdAt: true,
    },
    where: cursor
      ? and(
          searchCondition,
          or(
            lt(messageTable.createdAt, cursor.createdAt),
            and(
              eq(messageTable.createdAt, cursor.createdAt),
              gt(messageTable.messageId, cursor.id),
            ),
          ),
        )
      : searchCondition,
    limit: pageSize,
    orderBy: [desc(messageTable.createdAt), desc(messageTable.messageId)],
    with: {
      sender: {
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
}
