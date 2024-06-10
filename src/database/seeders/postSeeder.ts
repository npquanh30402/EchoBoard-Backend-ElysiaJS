import { faker } from "@faker-js/faker";
import { db } from "../db";
import { postTable, userTable } from "../schemas";

export async function PostSeeder(number = 20) {
  const data: (typeof postTable.$inferInsert)[] = [];

  const users = await db.select().from(userTable);

  if (users.length === 0) {
    console.log("No users found.");
    return;
  }

  const shuffledUsers = users.sort(() => 0.5 - Math.random());

  for (let i = 0; i < number; i++) {
    const randomUser = shuffledUsers[i % shuffledUsers.length];
    data.push({
      postTitle: faker.lorem.sentence(),
      postContent: faker.lorem.paragraphs(100),
      authorId: randomUser.userId,
      createdAt: faker.date.recent(),
    });
  }

  console.log("PostSeeder start...");

  await db.transaction(async (tx) => {
    await tx.insert(postTable).values(data);
  });

  console.log("PostSeeder done!");
}
