// eslint-disable-next-line import/no-anonymous-default-export
export default {
  root: "http://localhost:3001/",
  login: "http://localhost:3001/login",
  auth: "http://localhost:3001/auth",
  inbox: (id) => `http://localhost:3001/@${id.split("@")[1]}/inbox`,
  outbox: (id) => `http://localhost:3001/@${id.split("@")[1]}/outbox`,
  profile: (id) => `http://localhost:3001/@${id.split("@")[1]}`,
  user: "http://localhost:3001/api/user",
  actors: (actors) => {
    let actorArray = typeof actors == "object" ? Object.keys(actors) : actors;
    let actorList = actorArray.join("&actors=");
    let url = `http://localhost:3001/actors?actors=${actorList}`;
    return url;
  },
  setup: "http://localhost:3001/api/setup",
};
