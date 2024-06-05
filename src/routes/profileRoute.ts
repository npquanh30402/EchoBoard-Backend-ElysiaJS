import { Elysia } from "elysia";
import { db } from "../database/db";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { profileTable } from "../database/schemas";
import { idParamDTO, updateProfileDTO } from "../validators";
import crypto from "crypto";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { optimizeImage } from "../utils";
import { PUBLIC_PATH } from "../constants";
import { ProfileType } from "../database/schemas/profileSchema";
import { UserType } from "../database/schemas/userSchema";
import { authJwt } from "../configs";
import { checkAuthenticatedMiddleware } from "../middleware";

const tags = ["PROFILE"];

export const profileRoute = new Elysia({
  prefix: "/profile",
})
  .use(authJwt)
  .get(
    "/:id",
    async ({ params, set }) => {
      const { id } = params;

      const profile = await db.query.profileTable
        .findFirst({
          where: eq(profileTable.userId, sql.placeholder("id")),
          columns: {
            fullName: true,
            bio: true,
            profilePictureUrl: true,
          },
          with: {
            user: {
              columns: {
                username: true,
              },
            },
          },
        })
        .prepare("fetchProfile")
        .execute({ id });

      if (!profile) {
        set.status = 404;
        throw new Error("Profile not found");
      }

      return {
        id,
        username: profile.user.username,
        fullName: profile.fullName,
        bio: profile.bio,
        profilePictureUrl: profile.profilePictureUrl,
      };
    },
    {
      params: idParamDTO,
      detail: {
        summary: "Fetch profile",
        tags,
      },
    },
  )
  .patch(
    "/",
    async ({ body, cookie, authJwt }) => {
      const { fullName, bio, profilePictureUrl } = body;
      const { auth } = cookie;

      const authUser = (await authJwt.verify(
        auth.value,
      )) as unknown as UserType;

      let filePath: string | undefined = undefined;
      if (profilePictureUrl) {
        const fileName = crypto.randomBytes(32).toString("hex") + ".webp";

        const fileBuffer = await optimizeImage(profilePictureUrl);

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
        updateData.profilePictureUrl = filePath;

        const oldProfile = await db.query.profileTable.findFirst({
          where: eq(profileTable.userId, authUser.id),
          columns: {
            profilePictureUrl: true,
          },
        });

        const oldFilePath = oldProfile?.profilePictureUrl;

        if (oldFilePath && (await Bun.file(oldFilePath).exists())) {
          await unlink(oldFilePath);
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedAt = new Date();

        const { userId, createdAt, updatedAt, ...rest } =
          getTableColumns(profileTable);

        const updatedProfile = await db.transaction(async (tx) => {
          return tx
            .update(profileTable)
            .set(updateData)
            .where(eq(profileTable.userId, authUser.id))
            .returning({ ...rest });
        });

        return updatedProfile[0];
      }

      return {};
    },
    {
      beforeHandle: async ({ set, cookie, authJwt }) => {
        const { auth } = cookie;

        if (!(await checkAuthenticatedMiddleware(authJwt, auth.value))) {
          set.status = 401;
          throw new Error("Unauthorized");
        }
      },
      body: updateProfileDTO,
      detail: {
        summary: "Update profile",
        tags,
      },
    },
  );
