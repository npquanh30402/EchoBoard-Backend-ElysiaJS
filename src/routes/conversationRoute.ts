import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userSchema";
import { db } from "../database/db";
import { conversationTable } from "../database/schemas";
import { and, eq, getTableColumns, or, sql } from "drizzle-orm";
import { idParamDTO } from "../validators";
import { checkAuthenticatedMiddleware } from "../middleware";

const tags = ["CONVERSATION"];

export const conversationRoute = new Elysia({
  prefix: "/conversation",
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
          eq(conversationTable.user1Id, authUser.id),
          eq(conversationTable.user2Id, authUser.id),
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
          user2: {
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
        },
      });

      return conversations.map((item) => {
        const { user1Id, user2Id, user1, user2, ...rest } = item;
        const otherUser = user1.id === authUser.id ? user2 : user1;

        return {
          ...rest,
          otherUser: {
            id: otherUser.id,
            username: otherUser.username,
            profilePictureUrl: otherUser.profile.profilePictureUrl,
          },
        };
      });
    },
    {
      detail: {
        summary: "Fetch conversations",
        tags,
      },
    },
  )
  .get(
    "/:id",
    ({ params, authUser }) => {
      const { id } = params;
      return db.query.conversationTable
        .findFirst({
          where: or(
            and(
              eq(conversationTable.user1Id, authUser.id),
              eq(conversationTable.user2Id, sql.placeholder("otherUserId")),
            ),
            and(
              eq(conversationTable.user1Id, sql.placeholder("otherUserId")),
              eq(conversationTable.user2Id, authUser.id),
            ),
          ),
          columns: {
            conversationId: true,
            user1Id: true,
            user2Id: true,
            createdAt: true,
          },
        })
        .prepare("fetchConversationBetweenUsersQuery")
        .execute({
          otherUserId: id,
        });
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Fetch conversation between auth user and other user",
        tags,
      },
    },
  )
  .post(
    "/",
    async ({ body, authUser }) => {
      const { userId } = body;

      const { updatedAt, ...restOfConversation } =
        getTableColumns(conversationTable);

      return await db.transaction((tx) => {
        return tx
          .insert(conversationTable)
          .values({
            user1Id: authUser.id,
            user2Id: userId,
          })
          .returning(restOfConversation);
      });
    },
    {
      body: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      detail: {
        summary: "Create a new conversation",
        tags,
      },
    },
  );
// .ws("/central-conversation", {
//   body: t.Object({
//     receiverId: t.String({
//       format: "uuid",
//     }),
//     content: t.Object({
//       id: t.String(),
//       username: t.String(),
//       fullName: t.String(),
//       profilePictureUrl: t.String(),
//       message: t.String(),
//       date: t.Optional(t.Date()),
//     }),
//   }),
//   open(ws) {
//     ws.subscribe("central-conversation");
//   },
//   message(ws, message) {
//     const { authUser } = ws.data;
//     const { receiverId, content } = message;
//
//     if (receiverId === authUser.id) return;
//
//     function formatTime(date: Date) {
//       const hours = date.getHours();
//       const minutes = date.getMinutes();
//
//       return `${hours}:${minutes}`;
//     }
//
//     const data = {
//       type: "private-chat",
//       data: {
//         senderId: authUser.id,
//         content: {
//           ...content,
//           date: formatTime(new Date()),
//         },
//       },
//     };
//
//     ws.publish(`user-private-conversation-${receiverId}`, data, true);
//     ws.send(data);
//   },
// })
// .ws("/user-private-conversation", {
//   open(ws) {
//     const { authUser } = ws.data;
//     ws.subscribe(`user-private-conversation-${authUser.id}`);
//   },
// });
