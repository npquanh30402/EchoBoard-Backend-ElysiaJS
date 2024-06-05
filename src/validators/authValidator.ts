import { t } from "elysia";

export const userRegistrationDTO = t.Object({
  username: t.String({
    default: "npquanh",
    minLength: 3,
    maxLength: 20,
  }),
  email: t.String({
    format: "email",
    default: "npquanh@example.com",
  }),
  password: t.String({
    default: "12345678",
    minLength: 8,
  }),
});

export const userLoginDTO = t.Object({
  email: t.String({
    format: "email",
    default: "npquanh@example.com",
  }),
  password: t.String({
    default: "12345678",
    minLength: 8,
  }),
});
