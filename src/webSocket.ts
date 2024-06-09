import { Elysia } from "elysia";
import { UserType } from "./database/schemas/userTable";
import { authJwt } from "./configs";
import { checkAuthenticatedMiddleware } from "./middleware";

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
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
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
  });
