import { AuthSeeder } from "./authSeeder";
import { PostSeeder } from "./postSeeder";

async function main() {
  await AuthSeeder(50);
  await PostSeeder(300);
  process.exit(0);
}

main();
