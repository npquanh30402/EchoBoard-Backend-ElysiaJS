import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userTable";
import { db } from "../database/db";
import { notificationTable } from "../database/schemas";
import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { cursorPaginationBodyDTO } from "../validators";
import { checkAuthenticatedMiddleware } from "../middleware";
import { server } from "../index";

const tags = ["NOTIFICATION"];

export const notificationRoute = new Elysia({
  prefix: "/notifications",
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
  .patch(
    "mark-as-read/:notificationId",
    async ({ params }) => {
      const { notificationId } = params;

      await db.transaction(async (tx) => {
        await tx
          .update(notificationTable)
          .set({
            isRead: true,
            updatedAt: new Date(),
          })
          .where(eq(notificationTable.notificationId, notificationId));
      });

      return {};
    },
    {
      params: t.Object({
        notificationId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Mark a notification as read",
        tags,
      },
    },
  )
  .patch(
    "mark-all-as-read",
    async ({ authUser }) => {
      await db.transaction(async (tx) => {
        await tx
          .update(notificationTable)
          .set({
            isRead: true,
            updatedAt: new Date(),
          })
          .where(eq(notificationTable.userId, authUser.userId));
      });

      return {};
    },
    {
      response: {
        200: t.Object({}),
      },
      detail: {
        summary: "Mark all notifications as read",
        tags,
      },
    },
  )
  .post(
    "/",
    async ({ authUser, body }) => {
      const cursor = body.cursor || null;

      const searchCondition = eq(
        notificationTable.userId,
        sql.placeholder("authUserId"),
      );

      const notifications = await db.query.notificationTable
        .findMany({
          columns: {
            updatedAt: false,
            userId: false,
          },
          where: cursor
            ? and(
                searchCondition,
                or(
                  lt(notificationTable.createdAt, cursor.createdAt),
                  and(
                    eq(notificationTable.createdAt, cursor.createdAt),
                    gt(notificationTable.notificationId, cursor.id),
                  ),
                ),
              )
            : searchCondition,
          limit: 10,
          orderBy: [
            desc(notificationTable.createdAt),
            desc(notificationTable.notificationId),
          ],
        })
        .prepare("fetchNotificationListQuery")
        .execute({ authUserId: authUser.userId });

      return notifications;
    },
    {
      body: cursorPaginationBodyDTO,
      // response: {
      //   200: t.Object({
      //     notificationId: t.String({
      //       format: "uuid",
      //     }),
      //     createdAt: t.Date(),
      //     notificationContent: t.String(),
      //     notificationType: t.String(),
      //     notificationMetadata: t.Unknown(),
      //     isRead: t.Union([t.Boolean(), t.Null()]),
      //   }),
      // },
      detail: {
        summary: "Fetch notification list",
        tags,
      },
    },
  )
  .get(
    "/notification-unread-count",
    async ({ authUser }) => {
      const results = await db
        .select({ count: count() })
        .from(notificationTable)
        .where(
          and(
            eq(notificationTable.userId, sql.placeholder("authUserId")),
            eq(notificationTable.isRead, false),
          ),
        )
        .prepare("fetchNotificationUnreadCountQuery")
        .execute({ authUserId: authUser.userId });

      return results[0].count;
    },
    {
      response: {
        200: t.Number(),
      },
      detail: {
        summary: "Fetch unread notification count",
        tags,
      },
    },
  );

export async function createNotification(
  type: string,
  content: string,
  userId: string,
  metadata?: object,
) {
  const { updatedAt, ...restOfNotification } =
    getTableColumns(notificationTable);

  const notification = await db.transaction(async (tx) => {
    return tx
      .insert(notificationTable)
      .values({
        // @ts-ignore
        notificationType: type,
        notificationContent: content,
        notificationMetadata: metadata || null,
        userId,
      })
      .returning(restOfNotification);
  });

  server?.publish(
    `private-notification-${userId}`,
    JSON.stringify(notification[0]),
  );
}
