import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { checkAuthenticatedMiddleware } from "../middleware";
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
  sql,
} from "drizzle-orm";
import {
  commentTable,
  followTable,
  likeTable,
  postTable,
  profileTable,
  userTable,
} from "../database/schemas";
import { db } from "../database/db";
import { UserType } from "../database/schemas/userTable";
import { cursorPaginationBodyDTO } from "../validators";

const tags = ["POST"];

const postDTO = t.Union([
  t.Object({
    postId: t.String(),
    postTitle: t.String(),
    postContent: t.String(),
    likeCount: t.Number(),
    commentCount: t.Number(),
    likedByUser: t.Union([t.String(), t.Null()]),
    author: t.Object({
      userId: t.String(),
      username: t.String(),
      fullName: t.Union([t.String(), t.Null()]),
      avatarUrl: t.Union([t.String(), t.Null()]),
    }),
    createdAt: t.Date(),
    updatedAt: t.Date(),
  }),
  t.Undefined(),
]);

export const postRoute = new Elysia({
  prefix: "/posts",
})
  .use(authJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;
    return {
      authUser,
    };
  })
  .post(
    "all-posts-from-user/:userId",
    async ({ params, body, authUser }) => {
      const { userId } = params;
      const cursor = body.cursor || null;
      const pageSize = 10;

      const searchCondition = eq(postTable.authorId, userId);

      const posts = await fetchPostListPagination(
        searchCondition,
        true,
        authUser,
        pageSize,
        cursor,
      );

      return posts;
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(postDTO),
      },
      detail: {
        summary: "Fetch posts from an user",
        tags,
      },
    },
  )
  .post(
    "/following",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;
      const pageSize = 10;

      const searchCondition = eq(followTable.followerId, authUser.userId);

      const posts = await fetchPostListPagination(
        searchCondition,
        true,
        authUser,
        pageSize,
        cursor,
      );

      return posts;
    },
    {
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(postDTO),
      },
      detail: {
        summary: "Fetch posts from those you followed",
        tags,
      },
    },
  )
  .get(
    "/:postId",
    async ({ set, params, authUser }) => {
      const { postId } = params;
      const pageSize = 10;

      const searchCondition = eq(postTable.postId, postId);
      const [post] = await fetchPostListPagination(
        searchCondition,
        false,
        authUser,
        pageSize,
        null,
      );

      if (!post) {
        set.status = 404;
        throw new Error("Post not found");
      }

      return post;
    },
    {
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: postDTO,
        404: t.String({
          default: "Post not found",
        }),
      },
      detail: {
        summary: "Fetch a post by post id",
        tags,
      },
    },
  )
  .post(
    "/",
    async ({ authUser, body }) => {
      const { postTitle, postContent } = body;

      const { postId } = getTableColumns(postTable);

      const [post] = await db.transaction((tx) => {
        return tx
          .insert(postTable)
          .values({
            authorId: authUser.userId,
            postTitle,
            postContent,
          })
          .returning({ postId });
      });

      return post;
    },
    {
      async beforeHandle({ set, cookie, authJwt }) {
        const { auth } = cookie;

        if (!(await checkAuthenticatedMiddleware(authJwt, auth.value))) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
      },
      body: t.Object({
        postTitle: t.String(),
        postContent: t.String(),
      }),
      response: {
        200: t.Object({
          postId: t.String(),
        }),
      },
      detail: {
        summary: "Create a new post",
        tags,
      },
    },
  )
  .patch(
    "/:postId",
    async ({ authUser, body, params }) => {
      const { postId } = params;
      const { postTitle, postContent } = body;

      const posts = await db.transaction((tx) => {
        return tx
          .update(postTable)
          .set({
            postTitle,
            postContent,
          })
          .where(
            and(
              eq(postTable.authorId, authUser.userId),
              eq(postTable.postId, postId),
            ),
          )
          .returning();
      });

      return posts[0];
    },
    {
      async beforeHandle({ set, cookie, authJwt }) {
        const { auth } = cookie;

        if (!(await checkAuthenticatedMiddleware(authJwt, auth.value))) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
      },
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      body: t.Object({
        postTitle: t.String(),
        postContent: t.String(),
      }),
      response: {
        200: t.Object({
          postId: t.String(),
          authorId: t.String(),
          postTitle: t.String(),
          postContent: t.String(),
          createdAt: t.Date(),
          updatedAt: t.Date(),
        }),
        404: t.String({
          default:
            "Post not found or you do not have permission to delete this post",
        }),
      },
      detail: {
        summary: "Update a post",
        tags,
      },
    },
  )
  .delete(
    "/:postId",
    async ({ authUser, params, set }) => {
      const { postId } = params;

      const { postId: returnedPostId } = getTableColumns(postTable);

      const [deletedPost] = await db.transaction((tx) => {
        return tx
          .delete(postTable)
          .where(
            and(
              eq(postTable.postId, postId),
              eq(postTable.authorId, authUser.userId),
            ),
          )
          .returning({ returnedPostId });
      });

      if (!deletedPost) {
        set.status = 404;
        throw new Error(
          "Post not found or you do not have permission to delete this post",
        );
      }

      return {};
    },
    {
      async beforeHandle({ set, cookie, authJwt }) {
        const { auth } = cookie;

        if (!(await checkAuthenticatedMiddleware(authJwt, auth.value))) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
      },
      params: t.Object({
        postId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
        404: t.String({
          default:
            "Post not found or you do not have permission to delete this post",
        }),
      },
      detail: {
        summary: "Delete a post",
        tags,
      },
    },
  )
  .post(
    "/latest",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;
      const pageSize = 10;

      const posts = await fetchPostListPagination(
        undefined,
        true,
        authUser,
        pageSize,
        cursor,
      );

      return posts;
    },
    {
      body: cursorPaginationBodyDTO,
      response: {
        200: t.Array(postDTO),
      },
      detail: {
        summary: "Fetch latest posts",
        tags,
      },
    },
  );

function fetchPostListPagination(
  searchCondition: SQL<unknown> | undefined,
  truncatePostContent: boolean = false,
  user: UserType,
  pageSize: number = 10,
  cursor: {
    id: string;
    createdAt: Date;
  } | null = null,
) {
  return db
    .select({
      postId: postTable.postId,
      postTitle: postTable.postTitle,
      postContent: truncatePostContent
        ? sql<string>`SUBSTRING(${postTable.postContent}, 1, 100)`.as(
            "postContent",
          )
        : postTable.postContent,
      likeCount: sql<number>`
      (SELECT CAST(COUNT(*) AS INTEGER) FROM ${likeTable} WHERE ${likeTable.type} = 'like' AND ${likeTable.postId} = ${postTable.postId}) -
      (SELECT CAST(COUNT(*) AS INTEGER) FROM ${likeTable} WHERE ${likeTable.type} = 'dislike' AND ${likeTable.postId} = ${postTable.postId})
    `.as("likeCount"),
      commentCount: count(commentTable.commentId),
      likedByUser: user.userId
        ? sql<string>`
          CASE 
            WHEN ${likeTable.userId} = ${user.userId} AND ${likeTable.type} = 'like' THEN 'like' 
            WHEN ${likeTable.userId} = ${user.userId} AND ${likeTable.type} = 'dislike' THEN 'dislike' 
          END
        `.as("likedByUser")
        : sql<null>`NULL`.as("likedByUser"),
      author: {
        userId: userTable.userId,
        username: userTable.username,
        fullName: profileTable.fullName,
        avatarUrl: profileTable.avatarUrl,
      },
      createdAt: postTable.createdAt,
      updatedAt: postTable.updatedAt,
    })
    .from(postTable)
    .innerJoin(userTable, eq(userTable.userId, postTable.authorId))
    .innerJoin(profileTable, eq(profileTable.userId, userTable.userId))
    .leftJoin(likeTable, eq(postTable.postId, likeTable.postId))
    .leftJoin(commentTable, eq(postTable.postId, commentTable.postId))
    .where(
      cursor
        ? and(
            searchCondition,
            or(
              lt(postTable.createdAt, cursor.createdAt),
              and(
                eq(postTable.createdAt, cursor.createdAt),
                gt(postTable.postId, cursor.id),
              ),
            ),
          )
        : searchCondition,
    )
    .groupBy(
      postTable.postId,
      userTable.userId,
      profileTable.profileId,
      likeTable.likeId,
    )
    .limit(pageSize)
    .orderBy(desc(postTable.createdAt), desc(postTable.postId));
}
