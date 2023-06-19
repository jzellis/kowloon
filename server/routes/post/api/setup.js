import Kowloon from "../../../kowloon/index.js";

export default async function handler(req, res, next) {
  let status = 401;
  let response = {};

  let defaultSettings = [
    {
      name: "domain",
      value: "http://localhost:3001",
      description: "Your site's domain",
    },
    {
      name: "title",
      value: "My Kowloon Server",
      description: "The title of your site",
    },
    {
      name: "defaultPronouns",
      value: {
        subject: "they",
        object: "them",
        possAdj: "their",
        possPro: "theirs",
        reflexive: "themselves",
      },
      description: "The default pronouns for users",
    },
    {
      name: "registrationIsOpen",
      value: false,
      description: "Can anyone create an account on your site?",
    },
    {
      name: "apDomain",
      value: "@localhost:3001",
      description: "The ActivityPub domain of your site",
    },
    {
      name: "uploadDir",
      value: "./uploads",
      description: "The directory for uploads",
    },
  ];

  res.status(status).json(response);
}
