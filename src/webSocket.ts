import { Elysia, t } from "elysia";
import { UserType } from "./database/schemas/userSchema";
import { authJwt } from "./configs";
import { db } from "./database/db";
import {
  conversationMessagesTable,
  notificationTable,
} from "./database/schemas";

const notificationDTO = t.Object({
  type: t.String(),
  content: t.String(),
  metadata: t.Optional(t.Object({})),
  receiverId: t.String(),
});

const friendDTO = t.Object({
  type: t.String(),
  user: t.Object({
    id: t.String(),
    fullName: t.Union([t.String(), t.Null()]),
    username: t.String(),
    profilePictureUrl: t.Union([t.String(), t.Null()]),
    createdAt: t.Date(),
  }),
  receiverId: t.String(),
});

const conversationMessageDTO = t.Object({
  conversationId: t.String(),
  messageText: t.String(),
  fileId: t.Optional(t.String()),
  sender: t.Object({
    id: t.String(),
    username: t.String(),
    profilePictureUrl: t.Union([t.String(), t.Null()]),
  }),
  receiverId: t.String(),
});

export const webSocketRoute = new Elysia({
  prefix: "/ws",
})
  .use(authJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
    return {
      authUser,
    };
  })
  .ws("/", {
    body: t.Partial(
      t.Object({
        action: t.String(),
        type: t.String(),
        notification: t.Optional(notificationDTO),
        friend: t.Optional(friendDTO),
        conversation_message: t.Optional(conversationMessageDTO),
      }),
    ),
    open(ws) {
      const { authUser } = ws.data;
      ws.subscribe("central-ws");

      ws.subscribe(`private-notification-${authUser.id}`);
      ws.subscribe(`private-conversation-${authUser.id}`);
      ws.subscribe(`private-friend-${authUser.id}`);
    },
    async message(ws, msg) {
      const { authUser } = ws.data;

      const { type, action } = msg;

      if (action === "message") {
        if (type === "notification" && msg.notification) {
          const notificationMessage = msg.notification;

          const insertedNotification = await db.transaction(async (tx) => {
            return tx
              .insert(notificationTable)
              .values({
                // @ts-ignore
                type: notificationMessage.type,
                content: notificationMessage.content,
                metadata: notificationMessage.metadata || null,
                userId: notificationMessage.receiverId,
              })
              .returning();
          });

          if (authUser.id === notificationMessage.receiverId) {
            ws.send(insertedNotification[0]);
          } else {
            ws.publish(
              `private-notification-${notificationMessage.receiverId}`,
              {
                notification: {
                  ...insertedNotification[0],
                },
              },
              true,
            );
          }
        }

        if (type === "friend" && msg.friend) {
          const friendMessage = msg.friend;
          const { receiverId, ...restOfFriend } = friendMessage;

          if (authUser.id !== friendMessage.receiverId) {
            ws.publish(
              `private-friend-${friendMessage.receiverId}`,
              {
                friend: {
                  ...restOfFriend,
                },
              },
              true,
            );
          }
        }

        if (type === "conversation-message" && msg.conversation_message) {
          const { conversationId, messageText, fileId, sender, receiverId } =
            msg.conversation_message;

          const convoMsg = await db.transaction((tx) => {
            return tx
              .insert(conversationMessagesTable)
              .values({
                conversationId,
                messageText,
                senderId: authUser.id,
                fileId: fileId || null,
              })
              .returning();
          });

          const resultMsg = {
            conversation_message: {
              conversationId: convoMsg[0].conversationId,
              messageId: convoMsg[0].id,
              sender: {
                id: sender.id,
                username: sender.username,
                profilePictureUrl: sender.profilePictureUrl,
              },
              messageText,
              createdAt: convoMsg[0].createdAt,
            },
          };

          ws.send(resultMsg);

          ws.publish(`private-conversation-${receiverId}`, resultMsg, true);
        }
      }
    },
    close(ws) {},
  });
