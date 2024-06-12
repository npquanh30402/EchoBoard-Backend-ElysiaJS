import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { checkAuthenticatedMiddleware } from "../middleware";
import { UserType } from "../database/schemas/userTable";
import { db } from "../database/db";
import { likeTable } from "../database/schemas";
import { and, eq } from "drizzle-orm";

const tags = ["LIKE"];

export const likeRoute = new Elysia({
  prefix: "/like",
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
  .post(
    "/:postId/like",
    async ({ params, authUser }) => {
      const { postId } = params;

      await db.transaction(async (tx) => {
        const [like] = await tx
          .update(likeTable)
          .set({
            type: "like",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(likeTable.postId, postId),
              eq(likeTable.userId, authUser.userId),
            ),
          )
          .returning();

        if (like) {
          return {};
        }

        await tx.insert(likeTable).values({
          type: "like",
          userId: authUser.userId,
          postId,
        });
      });

      return {};
    },
    {
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Like a post",
        tags,
      },
    },
  )
  .post(
    "/:postId/dislike",
    async ({ params, authUser }) => {
      const { postId } = params;

      await db.transaction(async (tx) => {
        const [like] = await tx
          .update(likeTable)
          .set({
            type: "dislike",
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(likeTable.postId, postId),
              eq(likeTable.userId, authUser.userId),
            ),
          )
          .returning();

        if (like) {
          return {};
        }

        await tx.insert(likeTable).values({
          type: "dislike",
          userId: authUser.userId,
          postId,
        });
      });

      return {};
    },
    {
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Dislike a post",
        tags,
      },
    },
  )
  .delete(
    "/:postId",
    async ({ params, authUser }) => {
      const { postId } = params;

      await db.transaction(async (tx) => {
        await tx
          .delete(likeTable)
          .where(
            and(
              eq(likeTable.postId, postId),
              eq(likeTable.userId, authUser.userId),
            ),
          );
      });

      return {};
    },
    {
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Delete a like",
        tags,
      },
    },
  );
