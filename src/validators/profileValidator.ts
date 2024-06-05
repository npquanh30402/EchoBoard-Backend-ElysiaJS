import { t } from "elysia";

export const updateProfileDTO = t.Partial(
  t.Object({
    fullName: t.String({
      default: "Nguyễn Phú Quang Anh",
      maxLength: 256,
    }),
    bio: t.String({
      default: "I am a web developer",
    }),
    profilePictureUrl: t.File({
      maxSize: "5m",
      type: "image",
      error: "File must be an image and size must be less than 5MB",
      default: null,
    }),
  }),
);
