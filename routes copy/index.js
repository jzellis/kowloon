import Kowloon from "../Kowloon.js";
export default async function (req, res, next) {
  let status = 200;
  let qStart = Date.now();
  let response = {
    server: {
      id: `@${Kowloon.settings.domain}`,
      profile: {
        name: Kowloon.settings.profile.name,
        description: Kowloon.settings.profile.description,
        icon: Kowloon.settings.profile.icon,
        location: Kowloon.settings.profile.location || undefined,
      },
      url: `https://${Kowloon.settings.domain}`,
      inbox: `https://${Kowloon.settings.domain}/inbox`,
      outbox: `https://${Kowloon.settings.domain}/outbox`,
      publicKey: Kowloon.settings.publicKey,
    },
    queryTime: Date.now() - qStart,
  };

  res.status(status).json(response);
}
