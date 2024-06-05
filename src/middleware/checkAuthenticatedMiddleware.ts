export async function checkAuthenticatedMiddleware(jwt: any, value: any) {
  const payload = await jwt.verify(value);

  return !!payload;
}
