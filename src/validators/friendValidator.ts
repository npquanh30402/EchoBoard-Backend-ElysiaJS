import { t } from "elysia";

export const friendListDTO = t.Array(
  t.Object({
    id: t.String({
      format: "uuid",
      default: "fffb078d-b96c-4bb5-bc82-7c17c560aa42",
    }),
    username: t.String({
      default: "npquanh",
      minLength: 3,
      maxLength: 20,
    }),
    email: t.String({
      format: "email",
      default: "npquanh@example.com",
    }),
    profilePictureUrl: t.String({
      default:
        "public\\profiles\\b61b5fb00af803eca5cc2521115514c74726717a45f04886afba8c4c9b586f7d.webp",
    }),
    createdAt: t.Date({
      default: "2024-06-03T15:39:23.368Z",
    }),
    updatedAt: t.Date({
      default: "2024-06-03T15:39:23.368Z",
    }),
  }),
);
