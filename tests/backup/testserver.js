import Kowloon from "../../Kowloon.js";

let { id, timestamp, signature } = await Kowloon.createServerSignature();

console.log(id, timestamp, signature);

let headers = {
  "Content-Type": "application/json",
  "kowloon-type": "server",
  "kowloon-id": id,
  "kowloon-timestamp": timestamp,
  "kowloon-signature": signature,
};

let response,
  request = await fetch("https://kowloon.social/outbox", { headers });
if (request.ok === true) response = await request.json();
console.log(response);
process.exit(0);
