import { afterAll, afterEach, describe, expect, it } from "vitest";
import { closeDbClient } from "../db/client.js";
import { getDbExec } from "../db/index.js";
import { auth } from "./auth.js";

let createdUserId: string | null = null;

async function cleanup(): Promise<void> {
  if (!createdUserId) return;
  await getDbExec().execute({
    sql: "DELETE FROM app.auth_users WHERE id = $1",
    args: [createdUserId],
  });
  createdUserId = null;
}

afterEach(cleanup);
afterAll(closeDbClient);

describe("Better Auth on Postgres", () => {
  it("creates and resolves an anonymous session", async () => {
    const signIn = await auth.handler(
      new Request("http://localhost:8080/api/auth/sign-in/anonymous", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:8080",
        },
        body: "{}",
      }),
    );
    expect(signIn.status).toBe(200);
    const body = (await signIn.json()) as { user: { id: string } };
    createdUserId = body.user.id;

    const setCookie = signIn.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    const cookie = setCookie?.split(";")[0];
    const session = await auth.handler(
      new Request("http://localhost:8080/api/auth/get-session", {
        headers: { cookie: cookie ?? "" },
      }),
    );
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: { id: createdUserId, isAnonymous: true },
    });
  });
});
