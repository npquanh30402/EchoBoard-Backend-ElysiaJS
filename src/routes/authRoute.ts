import { Elysia, redirect, t } from "elysia";
import crypto from "crypto";
import { calculatePasswordHash, lruCache, sendMail } from "../utils";
import { db } from "../database/db";
import { profileTable, userTable } from "../database/schemas";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { authJwt, emailVerificationJwt } from "../configs";
import fs from "fs";
import { UserType } from "../database/schemas/userTable";

const tags = ["AUTHENTICATION"];

export const authRoute = new Elysia({
  prefix: "/auth",
})
  .use(authJwt)
  .use(emailVerificationJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
    return {
      authUser,
    };
  })
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
  )
  .post(
    "/send-email-verification",
    async ({ set, body, authUser, emailVerificationJwt }) => {
      const { email } = body;

      const user = await db.query.userTable.findFirst({
        where: (userTable, { eq }) => {
          if (email) {
            return eq(userTable.email, email);
          }

          return eq(userTable.email, authUser.email);
        },
        columns: {
          userId: true,
          email: true,
          emailVerified: true,
        },
      });

      if (!user) {
        set.status = 404;
        throw new Error("User not found!");
      }

      if (user.emailVerified) {
        set.status = 409;
        throw new Error("Email already verified");
      }

      const authJwt = {
        userId: user.userId,
        email: user.email,
      };

      const emailVerificationJwtToken =
        await emailVerificationJwt.sign(authJwt);

      const mailOptions = {
        to: user.email,
        subject: "Verify your email",
        text: "Verify your email",
      };

      const data = {
        website: { name: "EchoBoard", author: "npquanh30402" },
        // verificationLink:
        //   server?.url +
        //   "api/auth/email-verification?token=" +
        //   emailVerificationJwtToken,
        verificationLink:
          process.env.HOST +
          "/api/auth/email-verification?token=" +
          emailVerificationJwtToken,
      };

      const emailSource = fs.readFileSync(
        "./src/resources/email/account_verification/index.html",
        "utf8",
      );

      await sendMail(mailOptions, data, emailSource);

      const userMailVerificationKey = `user-${authJwt.userId}-${authJwt.email}-email-verification`;

      lruCache.set(userMailVerificationKey, emailVerificationJwtToken, {
        ttl: 10 * 60 * 1000,
      });

      return {};
    },
    {
      body: t.Partial(
        t.Object({
          email: t.String({
            format: "email",
            default: "npquanh@example.com",
          }),
        }),
      ),
      // response: {
      //   200: t.Object({}),
      // },
      detail: {
        summary: "Send Email Verification",
        tags,
      },
    },
  )
  .get(
    "/email-verification",
    async ({ set, query, emailVerificationJwt, cookie }) => {
      const { token } = query;
      const { auth } = cookie;

      if (!token) {
        set.status = 400;
        throw new Error("No token provided");
      }

      const user = (await emailVerificationJwt.verify(token)) as {
        userId: string;
        email: string;
      };

      const userMailVerificationKey = `user-${user.userId}-${user.email}-email-verification`;

      const jwtCache = lruCache.get(userMailVerificationKey);

      if (!jwtCache) {
        set.status = 401;
        throw new Error("Invalid token");
      }

      if (jwtCache === token) {
        await db.transaction(async (tx) => {
          await tx
            .update(userTable)
            .set({
              emailVerified: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(userTable.userId, user.userId));
        });

        lruCache.delete(userMailVerificationKey);

        auth.remove();
        return redirect(
          process.env.CORS_ORIGIN_URL +
            "/" +
            "verification-status?status=success",
        );
      }

      return redirect(
        process.env.CORS_ORIGIN_URL +
          "/" +
          "verification-status?status=failure",
      );
    },
    {
      query: t.Object({
        token: t.String({}),
      }),
      // response: {
      //   200: t.Object({}),
      // },
      detail: {
        summary: "Verify Email",
        tags,
      },
    },
  );
