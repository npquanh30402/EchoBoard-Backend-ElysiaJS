import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import swagger from "@elysiajs/swagger";
import staticPlugin from "@elysiajs/static";
import { apiRoute } from "./api";
import { winstonLogger } from "./configs";
import { compression } from "elysia-compression";

const app = new Elysia()
  .onError(({ code, error }) => {
    winstonLogger.error(error.message);

    if (code === "VALIDATION")
      return error.validator.Errors(error.value).First().message;

    return error.message;
  })
  .use(
    cors({
      origin: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
        "CONNECT",
        "SUBSCRIBE",
        "UNSUBSCRIBE",
      ],
      credentials: true,
    }),
  )
  .use(compression())
  .use(staticPlugin())
  .use(swagger())
  .get("/", ({ redirect }) => redirect("/swagger"))
  .use(apiRoute)
  .listen({
    // hostname: "192.168.1.8",
    port: process.env.PORT ?? 3000,
  });

console.log(`${process.env.APP_NAME} is running at ${app.server?.url}`);
