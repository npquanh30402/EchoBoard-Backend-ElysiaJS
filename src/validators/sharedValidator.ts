import { t } from "elysia";

export const idParamDTO = t.Object({
  id: t.String({
    format: "uuid",
    default: "fffb078d-b96c-4bb5-bc82-7c17c560aa42",
  }),
});

export const paginationQueryDTO = t.Object({
  page: t.String({
    default: "1",
  }),
  pageSize: t.String({
    default: "10",
  }),
});

export const cursorPaginationBodyDTO = t.Object({
  searchTerm: t.String(),
  cursor: t.Optional(
    t.Object({
      id: t.String({
        format: "uuid",
      }),
      createdAt: t.Date(),
    }),
  ),
});
