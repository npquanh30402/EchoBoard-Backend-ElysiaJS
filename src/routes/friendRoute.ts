import { Elysia } from "elysia";
import { db } from "../database/db";
import { friendTable } from "../database/schemas";
import { checkAuthenticatedMiddleware } from "../middleware";
import { UserType } from "../database/schemas/userSchema";
import { authJwt } from "../configs";
import { and, asc, eq, gt, or, SQL } from "drizzle-orm";
import { cursorPaginationBodyDTO, idParamDTO } from "../validators";

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
  .delete(
    "/delete-request-sent/:id",
    async ({ params, authUser }) => {
      const { id } = params;

      await db.transaction(async (tx) => {
        await tx
          .delete(friendTable)
          .where(
            and(
              eq(friendTable.receiverID, id),
              eq(friendTable.senderID, authUser.id),
            ),
          );
      });

      return {};
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Delete request sent",
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
  .post(
    "/friend-request",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;

      const searchCondition = and(
        eq(friendTable.receiverID, authUser.id),
        eq(friendTable.status, "pending"),
      );

      const sent = await friendCursorPaginate(
        10,
        searchCondition,
        "sender",
        cursor,
      );

      return sent
        .filter((item) => item.senderID !== authUser.id)
        .map((item) => ({
          id: item.senderID,
          username: item.sender.username,
          fullName: item.sender.profile.fullName,
          profilePictureUrl: item.sender.profile.profilePictureUrl,
          createdAt: item.createdAt,
        }));
    },
    {
      body: cursorPaginationBodyDTO,
      detail: {
        summary: "Fetch Friend Request list",
        tags,
      },
    },
  )
  .post(
    "/request-sent",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;

      const searchCondition = and(
        eq(friendTable.senderID, authUser.id),
        eq(friendTable.status, "pending"),
      );

      const sent = await friendCursorPaginate(
        10,
        searchCondition,
        "sender",
        cursor,
      );

      return sent
        .filter((item) => item.receiverID !== authUser.id)
        .map((item) => ({
          id: item.receiverID,
          username: item.receiver.username,
          fullName: item.receiver.profile.fullName,
          profilePictureUrl: item.receiver.profile.profilePictureUrl,
          createdAt: item.createdAt,
        }));
    },
    {
      body: cursorPaginationBodyDTO,
      detail: {
        summary: "Fetch Request Sent list",
        tags,
      },
    },
  )
  .post(
    "/friend-list",
    async ({ body, authUser }) => {
      const cursor = body.cursor || null;

      const searchCondition = and(
        eq(friendTable.status, "accepted"),
        or(
          eq(friendTable.senderID, authUser.id),
          eq(friendTable.receiverID, authUser.id),
        ),
      );

      const friends = await friendCursorPaginate(
        10,
        searchCondition,
        "receiver",
        cursor,
      );

      return friends.map((friend) => {
        if (friend.receiverID === authUser.id) {
          // Return sender info if receiver is authUser
          return {
            id: friend.senderID,
            username: friend.sender.username,
            fullName: friend.sender.profile.fullName,
            profilePictureUrl: friend.sender.profile.profilePictureUrl,
            createdAt: friend.createdAt,
          };
        } else {
          // Return receiver info if sender is authUser
          return {
            id: friend.receiverID,
            username: friend.receiver.username,
            fullName: friend.receiver.profile.fullName,
            profilePictureUrl: friend.receiver.profile.profilePictureUrl,
            createdAt: friend.createdAt,
          };
        }
      });
    },
    {
      body: cursorPaginationBodyDTO,
      detail: {
        summary: "Fetch friend list",
        tags,
      },
    },
  );

function friendCursorPaginate(
  pageSize = 10,
  searchCondition: SQL<unknown> | undefined,
  senderOrReceiver: "sender" | "receiver",
  cursor?: { id: string; createdAt: Date } | null,
) {
  const choice =
    senderOrReceiver === "sender"
      ? friendTable.senderID
      : friendTable.receiverID;

  return db.query.friendTable.findMany({
    columns: {
      receiverID: true,
      senderID: true,
      createdAt: true,
    },
    where: cursor
      ? and(
          searchCondition,
          or(
            gt(friendTable.createdAt, cursor.createdAt),
            and(
              eq(friendTable.createdAt, cursor.createdAt),
              gt(friendTable.receiverID, cursor.id),
            ),
          ),
        )
      : searchCondition,
    limit: pageSize,
    orderBy: [asc(friendTable.createdAt), asc(choice)],
    with: {
      receiver: {
        columns: {
          username: true,
        },
        with: {
          profile: {
            columns: {
              fullName: true,
              profilePictureUrl: true,
            },
          },
        },
      },
      sender: {
        columns: {
          username: true,
        },
        with: {
          profile: {
            columns: {
              fullName: true,
              profilePictureUrl: true,
            },
          },
        },
      },
    },
  });
}
