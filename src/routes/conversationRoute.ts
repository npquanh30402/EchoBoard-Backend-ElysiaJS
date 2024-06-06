import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userSchema";
import { db } from "../database/db";
import { conversationTable } from "../database/schemas";
import { eq, or } from "drizzle-orm";

const tags = ["CONVERSATION"];

export const conversationRoute = new Elysia({
  prefix: "/conversation",
})
  .use(authJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
    return {
      authUser,
    };
  })
  .get(
    "/",
    ({ authUser }) => {
      return db.query.conversationTable.findMany({
        where: or(
          eq(conversationTable.user1Id, authUser.id),
          eq(conversationTable.user2Id, authUser.id),
        ),
        columns: {
          conversationId: true,
          user1Id: true,
          user2Id: true,
        },
      });
    },
    {
      detail: {
        summary: "Fetch conversations",
        tags,
      },
    },
  )
  .post(
    "/",
    async ({ body, authUser }) => {
      const { userId } = body;

      await db.transaction(async (tx) => {
        await tx.insert(conversationTable).values({
          user1Id: authUser.id,
          user2Id: userId,
        });
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
  )
  .ws("/central-conversation", {
    body: t.Object({
      receiverId: t.String({
        format: "uuid",
      }),
      content: t.Object({
        id: t.String(),
        username: t.String(),
        fullName: t.String(),
        profilePictureUrl: t.String(),
        message: t.String(),
        date: t.Optional(t.Date()),
      }),
    }),
    open(ws) {
      ws.subscribe("central-conversation");
    },
    message(ws, message) {
      const { authUser } = ws.data;
      const { receiverId, content } = message;

      if (receiverId === authUser.id) return;

      function formatTime(date: Date) {
        const hours = date.getHours();
        const minutes = date.getMinutes();

        return `${hours}:${minutes}`;
      }

      const data = {
        type: "private-chat",
        data: {
          senderId: authUser.id,
          content: {
            ...content,
            date: formatTime(new Date()),
          },
        },
      };

      ws.publish(`user-private-conversation-${receiverId}`, data, true);
      ws.send(data);
    },
  })
  .ws("/user-private-conversation", {
    open(ws) {
      const { authUser } = ws.data;
      ws.subscribe(`user-private-conversation-${authUser.id}`);
    },
  });
