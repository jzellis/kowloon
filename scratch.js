import Kowloon from "#kowloon";

console.log(Kowloon.parse.kowloonId("@admin@kwln.org"));
console.log(Kowloon.parse.kowloonId("@kwln.org"));
console.log(Kowloon.parse.kowloonId("event:xxxx@kwln.org"));
console.log(Kowloon.parse.kowloonId("group:xxxx@kwln.org"));

console.log(Kowloon.settings.actorId);

process.exit(0);
