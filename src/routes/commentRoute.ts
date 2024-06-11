import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { checkAuthenticatedMiddleware } from "../middleware";
import { userTable, UserType } from "../database/schemas/userTable";
import { db } from "../database/db";
import { commentTable, profileTable } from "../database/schemas";
import { cursorPaginationBodyDTO } from "../validators";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  or,
  SQL,
} from "drizzle-orm";

const tags = ["COMMENT"];

export const commentRoute = new Elysia({
  prefix: "/comments",
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
    "/:postId/create",
    async ({ set, params, body, authUser }) => {
      const { postId } = params;
      const { commentContent, parentCommentId } = body;

      const {
        userId,
        postId: commentPostId,
        ...restOfComment
      } = getTableColumns(commentTable);

      const [comment] = await db.transaction((tx) => {
        return tx
          .insert(commentTable)
          .values({
            postId,
            userId: authUser.userId,
            commentContent,
            parentCommentId: parentCommentId || null,
          })
          .returning(restOfComment);
      });

      set.status = 201;
      return comment;
    },
    {
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      body: t.Object({
        parentCommentId: t.Optional(
          t.String({
            format: "uuid",
          }),
        ),
        commentContent: t.String(),
      }),
      response: {
        201: t.Object({
          commentId: t.String({
            format: "uuid",
          }),
          parentCommentId: t.Union([
            t.String({
              format: "uuid",
            }),
            t.Null(),
          ]),
          commentContent: t.String(),
          createdAt: t.Date(),
          updatedAt: t.Date(),
        }),
      },
      detail: {
        summary: "Create a new comment on a post",
        tags,
      },
    },
  )
  .post(
    "/:postId/get-all-comments",
    async ({ params, body }) => {
      const { postId } = params;
      const cursor = body.cursor || null;
      const pageSize = 10;

      const searchCondition = eq(commentTable.postId, postId);

      const comments = await fetchCommentListPagination(
        searchCondition,
        pageSize,
        cursor,
      );

      return comments;
    },
    {
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(
          t.Object({
            commentId: t.String({
              format: "uuid",
            }),
            postId: t.String({
              format: "uuid",
            }),
            parentCommentId: t.Union([
              t.String({
                format: "uuid",
              }),
              t.Null(),
            ]),
            commentContent: t.String(),
            commentCount: t.Number(),
            author: t.Object({
              userId: t.String({
                format: "uuid",
              }),
              username: t.String(),
              avatarUrl: t.Union([t.String(), t.Null()]),
            }),
            createdAt: t.Date(),
            updatedAt: t.Date(),
          }),
        ),
      },
      detail: {
        summary: "Fetch all comments of a post",
        tags,
      },
    },
  );

async function fetchCommentListPagination(
  searchCondition: SQL<unknown> | undefined,
  pageSize: number = 10,
  cursor: {
    id: string;
    createdAt: Date;
  } | null = null,
) {
  const comments = await db
    .select({
      commentId: commentTable.commentId,
      postId: commentTable.postId,
      parentCommentId: commentTable.parentCommentId,
      commentContent: commentTable.commentContent,
      commentCount: count(commentTable.commentId),
      author: {
        userId: userTable.userId,
        username: userTable.username,
        avatarUrl: profileTable.avatarUrl,
      },
      createdAt: commentTable.createdAt,
      updatedAt: commentTable.updatedAt,
    })
    .from(commentTable)
    .innerJoin(userTable, eq(userTable.userId, commentTable.userId))
    .innerJoin(profileTable, eq(profileTable.userId, userTable.userId))
    .where(
      cursor
        ? and(
            searchCondition,
            or(
              lt(commentTable.createdAt, cursor.createdAt),
              and(
                eq(commentTable.createdAt, cursor.createdAt),
                gt(commentTable.postId, cursor.id),
              ),
            ),
          )
        : searchCondition,
    )
    .groupBy(commentTable.commentId, userTable.userId, profileTable.profileId)
    .limit(pageSize)
    .orderBy(desc(commentTable.createdAt), desc(commentTable.postId));

  return comments;
}
