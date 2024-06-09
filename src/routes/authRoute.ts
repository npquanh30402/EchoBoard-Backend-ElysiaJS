import { Elysia, t } from "elysia";
import crypto from "crypto";
import { calculatePasswordHash } from "../utils";
import { db } from "../database/db";
import { profileTable, userTable } from "../database/schemas";
import { eq, getTableColumns, sql } from "drizzle-orm";
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

      const { userId, ...restOfUser } = getTableColumns(userTable);

      await db.transaction(async (tx) => {
        const insertedUser = await tx
          .insert(userTable)
          .values({
            username,
            email,
            passwordSalt,
            passwordHash,
          })
          .returning({ userId });

        await tx.insert(profileTable).values({
          userId: insertedUser[0].userId,
        });
      });

      set.status = 201;
      return {};
    },
    {
      body: t.Object({
        username: t.String({
          default: "npquanh",
          minLength: 3,
          maxLength: 20,
        }),
        email: t.String({
          format: "email",
          default: "npquanh@example.com",
        }),
        password: t.String({
          default: "12345678",
          minLength: 8,
        }),
      }),
      response: {
        200: t.Object({}),
      },
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
      body: t.Object({
        email: t.String({
          format: "email",
          default: "npquanh@example.com",
        }),
        password: t.String({
          default: "12345678",
        }),
      }),
      response: {
        200: t.Object({
          userId: t.String({
            format: "uuid",
          }),
          username: t.String(),
          email: t.String({
            format: "email",
          }),
          emailVerified: t.Union([t.Date(), t.Null()]),
          isAdmin: t.Boolean(),
          createdAt: t.Date(),
        }),
        401: t.String({
          default: "Invalid credentials",
        }),
        404: t.String({
          default: "User not found",
        }),
      },
      detail: {
        summary: "Login",
        tags,
      },
    },
  )
  .post(
    "/logout",
    async ({ cookie }) => {
      const { auth } = cookie;

      auth.remove();

      return {};
    },
    {
      response: {
        200: t.Object({}),
      },
      detail: {
        description: "Delete auth httpOnly cookie",
        summary: "Logout",
        tags,
      },
    },
  );
