import winston from "winston";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
};

export const winstonLogger = winston.createLogger({
  levels,
  level: process.env.LOGGER_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
    winston.format.prettyPrint(),
  ),
  transports: [
    new winston.transports.File({
      filename: "./logs/error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "./logs/all.log" }),
  ],
});

if (process.env.NODE_ENV !== "production") {
  winstonLogger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  );
}
