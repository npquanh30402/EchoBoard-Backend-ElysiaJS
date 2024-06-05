import { Elysia } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userSchema";

export const websocketRoute = new Elysia({
  prefix: "/ws",
})
  .use(authJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
    return {
      authUser,
    };
  })
  .ws("/user-private-notify", {
    open(ws) {
      const { authUser } = ws.data;
      ws.subscribe(`user-private-notify-${authUser.id}`);
    },
  });
