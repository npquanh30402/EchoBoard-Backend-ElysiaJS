import { Elysia } from "elysia";
import { userLoginDTO, userRegistrationDTO } from "../validators";
import crypto from "crypto";
import { calculatePasswordHash } from "../utils";
import { db } from "../database/db";
import { profileTable, userTable } from "../database/schemas";
import { eq, sql } from "drizzle-orm";
import { authJwt } from "../configs";

const tags = ["AUTHENTICATION"];

export const authRoute = new Elysia({
  prefix: "/auth",
})
  .use(authJwt)
  .post(
    "/register",
    async ({ body, set }) => {
      const { username, email, password } = body;

      const passwordSalt = crypto.randomBytes(64).toString("hex");
      const passwordHash = await calculatePasswordHash(password, passwordSalt);

      await db.transaction(async (tx) => {
        const insertedUser = await tx
          .insert(userTable)
          .values({
            username,
            email,
            passwordSalt,
            passwordHash,
          })
          .returning({
            insertedId: userTable.id,
          });

        await tx.insert(profileTable).values({
          userId: insertedUser[0].insertedId,
        });
      });

      set.status = 201;
      return {};
    },
    {
      body: userRegistrationDTO,
      detail: {
        summary: "Register",
        tags,
      },
    },
  )
  .post(
    "/login",
    async ({ body, cookie, set, authJwt }) => {
      const { email, password } = body;
      const { auth } = cookie;

      const user = await db.query.userTable
        .findFirst({
          where: eq(userTable.email, sql.placeholder("email")),
          columns: {
            updatedAt: false,
          },
        })
        .prepare("loginQuery")
        .execute({
          email,
        });

      if (!user) {
        set.status = 404;
        throw new Error("User not found");
      }

      const incomingPasswordHash = await calculatePasswordHash(
        password,
        user.passwordSalt,
      );

      if (user.passwordHash !== incomingPasswordHash) {
        set.status = 401;
        throw new Error("Invalid credentials");
      }

      const { passwordHash, passwordSalt, ...restOfUser } = user;

      auth.set({
        value: await authJwt.sign(restOfUser as any),
        sameSite: "none",
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });

      return restOfUser;
    },
    {
      body: userLoginDTO,
      detail: {
        summary: "Login",
        tags,
      },
    },
  );
