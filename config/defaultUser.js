export default (ctx) => {
  return {
    username: ctx.adminUsername,
    password: ctx.adminPassword,
    email: ctx.adminEmail,
    profile: {
      name: ctx.adminDisplayName || ctx.adminUsername || "Admin",
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
