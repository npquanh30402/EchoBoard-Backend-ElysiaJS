import { Elysia } from "elysia";
import {
  authRoute,
  conversationRoute,
  friendRoute,
  notificationRoute,
  profileRoute,
  userRoute,
} from "./routes";

export const apiRoute = new Elysia({
  prefix: "/api",
})
  .use(authRoute)
  .use(profileRoute)
  .use(friendRoute)
  .use(userRoute)
  .use(notificationRoute)
  .use(conversationRoute);
