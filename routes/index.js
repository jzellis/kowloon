import Kowloon from "../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {
    server: {
      name: Kowloon.settings.title,
      description: Kowloon.settings.description,
      url: `https://${Kowloon.settings.domain}`,
      icon: Kowloon.settings.icon,
      location: Kowloon.settings.location || undefined,
    },
    queryTime: Date.now() - qStart,
  };

  res.status(status).json(response);
}
