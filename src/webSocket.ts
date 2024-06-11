import { Elysia } from "elysia";
import { UserType } from "./database/schemas/userTable";
import { authJwt } from "./configs";
import { db } from "./database/db";
import { eq } from "drizzle-orm";
import { profileTable } from "./database/schemas";
import { checkAuthenticatedMiddleware } from "./middleware";
import { server } from "./index";

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
      );

      ws.send(JSON.stringify({ type: "USERS_SET", data: users }));
      ws.send(JSON.stringify({ type: "MESSAGES_SET", data: messages }));
    },
    message(ws, message) {
      const { authUser } = ws.data;

      const user = {
        userId: authUser.userId,
        username: authUser.username,
        avatarUrl: authUser.avatarUrl,
      };

      const msg = {
        message,
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
      );

      ws.send(JSON.stringify({ type: "MESSAGE_ADD", data: send }));
    },
    close(ws) {
      const { authUser } = ws.data;

      users = users.filter((user) => user.userId !== authUser.userId);

      if (users.length === 0) {
        messages = [];
        return;
      }

      server?.publish(
        "global-chat",
        JSON.stringify({ type: "USER_REMOVE", data: authUser }),
      );
    },
  });
