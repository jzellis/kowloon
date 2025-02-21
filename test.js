let followed = "@admin@kowloon.social";

let domain;
let url;
let parsed = followed.split("@");
if (parsed.length === 1) {
  let b = followed.split("//")[1].split("/")[0];
  let a = b.split(".");
  domain = a[a.length - 2] + "." + a.pop();
  url = followed;
} else {
  if (parsed.length === 2) domain = parsed[1];
  if (parsed.length === 3) domain = parsed.pop();
  url = `https://${domain}/outbox`;
}

console.log(domain, url);
