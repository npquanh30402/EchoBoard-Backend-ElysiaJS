import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { UserType } from "../database/schemas/userSchema";
import { db } from "../database/db";
import { notificationTable } from "../database/schemas";
import { and, count, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import { idParamDTO } from "../validators";
import { checkAuthenticatedMiddleware } from "../middleware";

const tags = ["NOTIFICATION"];

export const notificationRoute = new Elysia({
  prefix: "/notification",
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
    "mark-as-read/:id",
    async ({ params }) => {
      const { id } = params;

      await db.transaction(async (tx) => {
        await tx
          .update(notificationTable)
          .set({
            read: true,
            updatedAt: new Date(),
          })
          .where(eq(notificationTable.id, id));
      });

      return {};
    },
    {
      params: idParamDTO,
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
            read: true,
            updatedAt: new Date(),
          })
          .where(eq(notificationTable.userId, authUser.id));
      });

      return {};
    },
    {
      detail: {
        summary: "Mark all notifications as read",
        tags,
      },
    },
  )
  .post(
    "/",
    ({ authUser, body }) => {
      const cursor = body.cursor || null;

      const searchCondition = eq(
        notificationTable.userId,
        sql.placeholder("authUserId"),
      );

      return db.query.notificationTable
        .findMany({
          columns: {
            updatedAt: false,
          },
          where: cursor
            ? and(
                searchCondition,
                or(
                  lt(notificationTable.createdAt, cursor.createdAt),
                  and(
                    eq(notificationTable.createdAt, cursor.createdAt),
                    gt(notificationTable.id, cursor.id),
                  ),
                ),
              )
            : searchCondition,
          limit: 10,
          orderBy: [
            desc(notificationTable.createdAt),
            desc(notificationTable.id),
          ],
        })
        .prepare("fetchNotificationListQuery")
        .execute({ authUserId: authUser.id });
    },
    {
      body: t.Object({
        cursor: t.Optional(
          t.Object({
            id: t.String({
              format: "uuid",
            }),
            createdAt: t.Date(),
          }),
        ),
      }),
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
            eq(notificationTable.read, false),
          ),
        )
        .prepare("fetchNotificationUnreadCountQuery")
        .execute({ authUserId: authUser.id });

      return results[0].count;
    },
    {
      detail: {
        summary: "Fetch unread notification count",
        tags,
      },
    },
  );
// .ws("/central-notification", {
//   body: t.Object({
//     type: t.String(),
//     content: t.String(),
//     metadata: t.Partial(
//       t.Object({
//         from: t.String(),
//         related_id: t.String(),
//         additional_info: t.Object({}),
//       }),
//     ),
//     receiverId: t.Optional(
//       t.String({
//         format: "uuid",
//       }),
//     ),
//   }),
//   open(ws) {
//     ws.subscribe("central-notification");
//   },
//   async message(ws, message) {
//     let { type, content, metadata, receiverId } = message;
//
//     const notification = await db.transaction(async (tx) => {
//       return tx
//         .insert(notificationTable)
//         .values({
//           // @ts-ignore
//           type,
//           content,
//           metadata,
//           userId: receiverId,
//         })
//         .returning();
//     });
//
//     ws.publish(`private-notification-${receiverId}`, notification[0], true);
//   },
// })
// .ws("/private-notification", {
//   open(ws) {
//     const { authUser } = ws.data;
//     ws.subscribe(`private-notification-${authUser.id}`);
//   },
// });
