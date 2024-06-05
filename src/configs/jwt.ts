import jwt from "@elysiajs/jwt";
import { AUTH_COOKIE_NAME, JWT_SECRET } from "../constants";

export const authJwt = jwt({
  name: AUTH_COOKIE_NAME,
  secret: JWT_SECRET,
  exp: "7d",
});
