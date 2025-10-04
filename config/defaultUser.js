import generatePassword from "#methods/generate/password.js";

export default (ctx) => {
  return {
    username: "admin",
    password: ctx.adminPassword || generatePassword(),
    email: ctx.adminEmail,
    profile: {
      name: "Admin",
      subtitle: "The human, the myth, the legend",
      description: "I am the admin of this server.",
      urls: [`https://${ctx.domain}`],
      icon: "",
      location: {
        name: "Kowloon Walled City, Hong Kong",
        coordinates: ["114.190278", "22.332222"],
      },
    },
    to: "@public",
  };
};
