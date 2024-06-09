import { Elysia, t } from "elysia";
import { db } from "../database/db";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { profileTable } from "../database/schemas";
import crypto from "crypto";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { optimizeImage } from "../utils";
import { PUBLIC_PATH } from "../constants";
import { ProfileType } from "../database/schemas/profileTable";
import { UserType } from "../database/schemas/userTable";
import { authJwt } from "../configs";
import { checkAuthenticatedMiddleware } from "../middleware";
import { createNotification } from "./notificationRoute";

const tags = ["PROFILE"];

export const profileRoute = new Elysia({
  prefix: "/profiles",
})
  .use(authJwt)
  .resolve(async ({ cookie: { auth }, authJwt }) => {
    const authUser = (await authJwt.verify(auth.value)) as unknown as UserType;

    return {
      authUser,
    };
  })
  .get(
    "/:userId",
    async ({ params, set }) => {
      const { userId } = params;

      const profile = await db.query.profileTable
        .findFirst({
          where: eq(profileTable.userId, sql.placeholder("userId")),
          columns: {
            fullName: true,
            bio: true,
            avatarUrl: true,
          },
          with: {
            user: {
              columns: {
                username: true,
              },
            },
          },
        })
        .prepare("fetchProfileQuery")
        .execute({
          userId: userId,
        });

      if (!profile) {
        set.status = 404;
        throw new Error("Profile not found");
      }

      return {
        userId,
        username: profile.user.username,
        fullName: profile.fullName,
        bio: profile.bio,
        avatarUrl: profile.avatarUrl,
      };
    },
    {
      params: t.Object({
        userId: t.String({
          format: "uuid",
        }),
      }),
      response: {
        200: t.Object({
          userId: t.String(),
          username: t.String(),
          fullName: t.Union([t.String(), t.Null()]),
          bio: t.Union([t.String(), t.Null()]),
          avatarUrl: t.Union([t.String(), t.Null()]),
        }),
      },
      detail: {
        summary: "Fetch profile by user id",
        tags,
      },
    },
  )
  .patch(
    "/",
    async ({ set, body, authUser }) => {
      const { fullName, bio, avatarUrl } = body;

      let filePath: string | undefined = undefined;
      if (avatarUrl) {
        const fileName = crypto.randomBytes(32).toString("hex") + ".webp";

        const fileBuffer = await optimizeImage(avatarUrl);

        filePath = path.join(PUBLIC_PATH, "profiles", fileName);

        await Bun.write(filePath, fileBuffer);
      }

      const updateData: Partial<ProfileType> = {};

      if (fullName) {
        updateData.fullName = fullName;
      }
      if (bio) {
        updateData.bio = bio;
      }
      if (filePath) {
        updateData.avatarUrl = filePath;

        const oldProfile = await db.query.profileTable.findFirst({
          where: eq(profileTable.userId, authUser.userId),
          columns: {
            avatarUrl: true,
          },
        });

        const oldFilePath = oldProfile?.avatarUrl;

        if (oldFilePath && (await Bun.file(oldFilePath).exists())) {
          await unlink(oldFilePath);
        }
      }

      if (Object.keys(updateData).length <= 0) {
        set.status = 400;
        throw new Error("No data to update");
      }

      updateData.updatedAt = new Date();

      const { userId, createdAt, updatedAt, ...restOfProfile } =
        getTableColumns(profileTable);

      const profile = await db.transaction(async (tx) => {
        const updatedProfile = await tx
          .update(profileTable)
          .set(updateData)
          .where(eq(profileTable.userId, authUser.userId))
          .returning(restOfProfile);

        return updatedProfile[0];
      });

      await createNotification(
        "account_activity",
        "You have updated your profile",
        authUser.userId,
      );

      return profile;
    },
    {
      beforeHandle: async ({ set, cookie, authJwt }) => {
        const { auth } = cookie;

        if (!(await checkAuthenticatedMiddleware(authJwt, auth.value))) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
      },
      body: t.Partial(
        t.Object({
          fullName: t.String({
            default: "Nguyễn Phú Quang Anh",
            maxLength: 256,
          }),
          bio: t.String({
            default: "I am a web developer",
          }),
          avatarUrl: t.File({
            maxSize: "5m",
            type: "image",
            error: "File must be an image and size must be less than 5MB",
            default: null,
          }),
        }),
      ),
      response: {
        200: t.Object({
          profileId: t.String(),
          fullName: t.Union([t.String(), t.Null()]),
          bio: t.Union([t.String(), t.Null()]),
          avatarUrl: t.Union([t.String(), t.Null()]),
        }),
      },
      detail: {
        summary: "Update profile",
        tags,
      },
    },
  );
