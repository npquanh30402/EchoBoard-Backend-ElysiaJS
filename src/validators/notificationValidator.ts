import { t } from "elysia";

export const notificationDTO = t.Array(
  t.Object({
    id: t.String({
      format: "uuid",
      default: "fffb078d-b96c-4bb5-bc82-7c17c560aa42",
    }),
    notification_type: t.String({
      default: "friend_request",
    }),
    content: t.String({
      default: "npquanh sent you a friend request",
    }),
    read: t.Boolean({
      default: false,
    }),
    createdAt: t.Date({
      default: "2024-06-03T15:39:23.368Z",
    }),
    updatedAt: t.Date({
      default: "2024-06-03T15:39:23.368Z",
    }),
  }),
);
