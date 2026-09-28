import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../server/index.mjs";

for (const trustProxy of [false, true]) {
  test(`rate limiting with trusted proxy ${trustProxy}`, async () => {
    const runtime = await createApp({ database: ":memory:", trustProxy });
    const server = runtime.app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const url = `http://127.0.0.1:${server.address().port}/api/join`;
    const request = (ip) => fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
      body: JSON.stringify({ code: "000000", name: "Test" }),
    });
    try {
      for (let i = 0; i < 40; i++) {
        const res = await request("198.51.100.1");
        await res.text();
        assert.notEqual(res.status, 429);
      }
      const blocked = await request("198.51.100.1");
      await blocked.text();
      assert.equal(blocked.status, 429);
      const second = await request("198.51.100.2");
      await second.text();
      assert.equal(second.status === 429, !trustProxy,
        "Only the explicitly trusted proxy may separate client addresses");
    } finally {
      await new Promise((resolve) => server.close(resolve));
      runtime.close();
    }
  });
}
