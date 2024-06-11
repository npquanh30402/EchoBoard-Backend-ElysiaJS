import { Elysia } from "elysia";
import {
  authRoute,
  commentRoute,
  conversationRoute,
  followRoute,
  friendRoute,
  likeRoute,
  messageRoute,
  notificationRoute,
  postRoute,
  profileRoute,
  userRoute,
  utilRoute,
} from "./routes";

export const apiRoute = new Elysia({
  prefix: "/api",
})
  .use(authRoute)
  .use(profileRoute)
  .use(friendRoute)
  .use(userRoute)
  .use(notificationRoute)
  .use(conversationRoute)
  .use(postRoute)
  .use(followRoute)
  .use(messageRoute)
  .use(utilRoute)
  .use(commentRoute)
  .use(likeRoute);
