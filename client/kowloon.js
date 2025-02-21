let Kowloon = {
  user: {},
  server: "kowloon.social",
  baseUrl: "https://kowloon.social",
  setServer: function (server) {
    this.server = server;
    this.baseUrl = `https://${this.server}`;
  },
  headers: {
    "Content-Type": "application/json",
    Accepts: "application/json",
  },
  login: async function (username, password) {
    let that = this;
    let request = await fetch(`${this.baseUrl}/login`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ username, password }),
    });
    if (request.ok) {
      let response = await request.json();
      this.user = response.user;
      this.headers["kowloon-id"] = response.user.id;
      this.headers["kowloon-timestamp"] = response.timestamp;
      this.headers["kowloon-signature"] = response.signature;
    }
  },
  getInbox: async function (page) {
    page = page || 1;
    let request = await fetch(`${this.baseUrl}/users/${this.user?.id}/inbox`, {
      method: "GET",
      headers: this.headers,
    });
    if (request.ok) {
      return await request.json();
    }
  },

  getServerOutbox: async function (page) {
    page = page || 1;
    let request = await fetch(`${this.baseUrl}/outbox`, {
      method: "GET",
      headers: this.headers,
    });
    if (request.ok) {
      return await request.json();
    }
  },
};

export default Kowloon;
