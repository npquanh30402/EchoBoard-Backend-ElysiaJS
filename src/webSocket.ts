import { Elysia } from "elysia";
import { UserType } from "./database/schemas/userTable";
import { authJwt } from "./configs";
import { db } from "./database/db";
import { eq } from "drizzle-orm";
import { profileTable } from "./database/schemas";
import { checkAuthenticatedMiddleware } from "./middleware";
import { server } from "./index";
import { unlink } from "node:fs/promises";

let users: any[] = [];
let messages: any[] = [];

export const webSocketRoute = new Elysia({
  prefix: "/ws",
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
    const user = (await authJwt.verify(auth.value)) as unknown as UserType;

    const profile = await db.query.profileTable.findFirst({
      columns: {
        avatarUrl: true,
      },
      where: eq(profileTable.userId, user.userId),
    });

    const authUser = {
      ...user,
      avatarUrl: profile?.avatarUrl,
    };

    return {
      authUser,
    };
  })
  .ws("/", {
    open(ws) {
      const { authUser } = ws.data;
      ws.subscribe("central-ws");

      ws.subscribe(`private-notification-${authUser.userId}`);
      ws.subscribe(`private-conversation-${authUser.userId}`);
      ws.subscribe(`private-friend-${authUser.userId}`);
    },
  })
  .ws("/global-chat", {
    open(ws) {
      const { authUser } = ws.data;
      ws.subscribe("global-chat");

      const user = {
        userId: authUser.userId,
        username: authUser.username,
        avatarUrl: authUser.avatarUrl,
      };

      users.push(user);

      ws.publish(
        "global-chat",
        JSON.stringify({ type: "USERS_ADD", data: user }),
        true,
      );

      ws.send(JSON.stringify({ type: "USERS_SET", data: users }));
      ws.send(JSON.stringify({ type: "MESSAGES_SET", data: messages }));
    },
    message(ws, message) {
      const { authUser } = ws.data;

      const requestMessage = message as {
        message: string;
        file: string;
      };

      const user = {
        userId: authUser.userId,
        username: authUser.username,
        avatarUrl: authUser.avatarUrl,
      };

      const msg = {
        message: requestMessage.message,
        file: requestMessage.file,
        createdAt: new Date(),
      };

      const send = {
        ...user,
        ...msg,
      };

      messages.push(send);

      ws.publish(
        "global-chat",
        JSON.stringify({ type: "MESSAGE_ADD", data: send }),
        true,
      );

      ws.send(JSON.stringify({ type: "MESSAGE_ADD", data: send }));
    },
    async close(ws) {
      const { authUser } = ws.data;

      users = users.filter((user) => user.userId !== authUser.userId);

      if (users.length === 0) {
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];

          if (msg.file && (await Bun.file(msg.file).exists())) {
            await unlink(msg.file);
          }
        }

        messages = [];
        return;
      }

      server?.publish(
        "global-chat",
        JSON.stringify({ type: "USER_REMOVE", data: authUser }),
      );
    },
  });
