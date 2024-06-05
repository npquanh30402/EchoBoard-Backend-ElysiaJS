import util from "util";
import crypto from "crypto";

const pbkdf2Async = util.promisify(crypto.pbkdf2);

export async function calculatePasswordHash(
  plainTextPassword: string,
  passwordSalt: string,
) {
  const passwordHash = await pbkdf2Async(
    plainTextPassword,
    passwordSalt,
    1000,
    64,
    "sha512",
  );

  return passwordHash.toString("hex");
}
