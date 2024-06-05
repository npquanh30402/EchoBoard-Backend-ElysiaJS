import { AuthSeeder } from "./authSeeder";

async function main() {
  await AuthSeeder(100);

  process.exit(0);
}

main();
