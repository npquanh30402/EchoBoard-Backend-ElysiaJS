import { Elysia, t } from "elysia";
import { authJwt } from "../configs";
import { checkAuthenticatedMiddleware } from "../middleware";
import { UserType } from "../database/schemas/userTable";
import crypto from "crypto";
import { optimizeImage } from "../utils";
import path from "node:path";
import { PUBLIC_PATH } from "../constants";

const tags = ["UTILS"];

export const utilRoute = new Elysia({
  prefix: "/utils",
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
    "/upload-image",
    async ({ body }) => {
      const { imageFile } = body;

      const fileName = crypto.randomBytes(32).toString("hex") + ".webp";

      const fileBuffer = await optimizeImage(imageFile);

      const filePath = path.join(PUBLIC_PATH, "files", fileName);

      await Bun.write(filePath, fileBuffer);

      return filePath;
    },
    {
      body: t.Object({
        imageFile: t.File({
          maxSize: "5m",
          type: "image",
          error: "File must be an image and size must be less than 5MB",
          default: null,
        }),
      }),
      detail: {
        summary: "Upload image",
        tags,
      },
    },
  );
