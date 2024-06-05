import { Elysia } from "elysia";
import { db } from "../database/db";
import { friendTable, profileTable, userTable } from "../database/schemas";
import { checkAuthenticatedMiddleware } from "../middleware";
import { UserType } from "../database/schemas/userSchema";
import { authJwt } from "../configs";
import { and, asc, eq, or } from "drizzle-orm";
import { union } from "drizzle-orm/pg-core";
import { idParamDTO, paginationQueryDTO } from "../validators";

const tags = ["FRIEND"];

export const friendRoute = new Elysia({
  prefix: "/friend",
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
    "/send-friend-request/:id",
    async ({ params, authUser }) => {
      const { id } = params;

      await db.transaction(async (tx) => {
        await tx.insert(friendTable).values({
          senderID: authUser.id,
          receiverID: id,
        });
      });

      return {};
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Send friend request",
        tags,
      },
    },
  )
  .patch(
    "/accept-friend-request/:id",
    async ({ params, authUser }) => {
      const { id } = params;

      await db.transaction(async (tx) => {
        await tx
          .update(friendTable)
          .set({
            status: "accepted",
            updatedAt: new Date(),
          })
          .where(
            or(
              and(
                eq(friendTable.receiverID, id),
                eq(friendTable.senderID, authUser.id),
              ),
              and(
                eq(friendTable.receiverID, authUser.id),
                eq(friendTable.senderID, id),
              ),
            ),
          );
      });

      return {};
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Accept friend request",
        tags,
      },
    },
  )
  .patch(
    "/reject-friend-request/:id",
    async ({ params, authUser }) => {
      const { id } = params;

      await db.transaction(async (tx) => {
        await tx
          .update(friendTable)
          .set({
            status: "rejected",
            updatedAt: new Date(),
          })
          .where(
            or(
              and(
                eq(friendTable.receiverID, id),
                eq(friendTable.senderID, authUser.id),
              ),
              and(
                eq(friendTable.receiverID, authUser.id),
                eq(friendTable.senderID, id),
              ),
            ),
          );
      });

      return {};
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Reject friend request",
        tags,
      },
    },
  )

  .get(
    "/friendship-status/:id",
    async ({ params, authUser }) => {
      const { id } = params;
      const friendStatus = await db.query.friendTable.findFirst({
        where: or(
          and(
            eq(friendTable.receiverID, id),
            eq(friendTable.senderID, authUser.id),
          ),
          and(
            eq(friendTable.receiverID, authUser.id),
            eq(friendTable.senderID, id),
          ),
        ),
        columns: {
          status: true,
        },
      });

      return friendStatus?.status ?? "none";
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Fetch friendship status",
        tags,
      },
    },
  )
  .get(
    "/friend-list",
    async ({ query, authUser }) => {
      const page = query.page ? Number(query.page) : 1;
      const pageSize = query.pageSize ? Number(query.pageSize) : 10;

      const commonSelect = {
        id: userTable.id,
        username: userTable.username,
        email: userTable.email,
        profilePictureUrl: profileTable.profilePictureUrl,
        createdAt: profileTable.createdAt,
        updatedAt: profileTable.updatedAt,
      };

      const friendsAsSenderQuery = db
        .select(commonSelect)
        .from(friendTable)
        .leftJoin(userTable, eq(friendTable.receiverID, userTable.id))
        .leftJoin(profileTable, eq(userTable.id, profileTable.userId))
        .where(
          and(
            eq(friendTable.senderID, authUser.id),
            eq(friendTable.status, "accepted"),
          ),
        );

      const friendsAsReceiverQuery = db
        .select(commonSelect)
        .from(friendTable)
        .leftJoin(userTable, eq(friendTable.senderID, userTable.id))
        .leftJoin(profileTable, eq(userTable.id, profileTable.userId))
        .where(eq(friendTable.receiverID, authUser.id));

      return union(friendsAsSenderQuery, friendsAsReceiverQuery)
        .orderBy(asc(friendTable.createdAt), asc(friendTable.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
    },
    {
      query: paginationQueryDTO,
      detail: {
        summary: "Fetch friend list",
        tags,
      },
    },
  );
