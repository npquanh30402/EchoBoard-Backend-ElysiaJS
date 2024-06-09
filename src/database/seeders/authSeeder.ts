import crypto from "crypto";
import { faker } from "@faker-js/faker";
import { db } from "../db";
import { profileTable, userTable } from "../schemas";
import { calculatePasswordHash } from "../../utils";

export async function AuthSeeder(number = 20) {
  const data: (typeof userTable.$inferInsert)[] = [];

  const password = "123";
  const passwordSalt = crypto.randomBytes(64).toString("hex");
  const passwordHash = await calculatePasswordHash(password, passwordSalt);

  for (let i = 0; i < number; i++) {
    const email = faker.internet.email();
    const username = faker.internet.userName().substring(0, 20);
    const createdAt = faker.date.anytime();

    data.push({
      email,
      username,
      passwordHash,
      passwordSalt,
      createdAt,
    });
  }

  console.log("AuthSeeder start...");

  await db.transaction(async (tx) => {
    const users = await tx.insert(userTable).values(data).returning();

    users.map(async (user) => {
      await tx.insert(profileTable).values({
        userId: user.userId,
      });
    });
  });

  console.log("AuthSeeder done!");
}
