import Kowloon from "../../kowloon/index.js";

export default async function handler(req, res, next) {
  let resource = req.query.resource;
  if (resource.includes("acct:")) {
    resource = resource.split("acct:")[1];
  } else {
    resource = `@${resource.split("@")[1].split("/")[0]}${
      Kowloon.settings.apDomain
    }`;
  }
  let response = await Kowloon.getActor(resource);
  let status = 200;

  res.status(status).json(response);
}
