import assert from "node:assert/strict";

export class TestClient {
  constructor({ baseURL }) {
    this.baseURL = baseURL.replace(/\/$/, "");
    this.token = null;
  }
  setToken(token) {
    this.token = token;
  }

  async request(path, { method = "GET", body, headers = {} } = {}) {
    const res = await fetch(this.baseURL + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json };
  }

  // Convenience
  async login(username, password) {
    const { status, json } = await this.request("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    assert.equal(
      status,
      200,
      `login failed: ${status} ${JSON.stringify(json)}`
    );
    this.setToken(json?.token || json?.accessToken);
    return json;
  }

  postOutbox(activity) {
    return this.request("/outbox/post", { method: "POST", body: activity });
  }
  postInbox(activity) {
    return this.request("/inbox/post", { method: "POST", body: activity });
  }
}
