// /config/defaultSettings.js
import crypto from "crypto";

const defaultSettings = (ctx) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048, // Adjust the key length as per your requirements
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return {
    actorId: `@${ctx.DOMAIN}`,
    profile: {
      name: ctx.SITE_TITLE,
      subtitle: "My brand new Kowloon server",
      description:
        "<p>This is a new Kowloon server that I've set up. It's going to be a great place for me and my community to share ideas with each other and the world!</p>",
      location: {
        name: "Kowloon Walled City, Hong Kong",
        type: "Place",
        latitude: "22.332222",
        longitude: "114.190278",
      },
      icon: "/images/icons/server.png",
      urls: [`https://${ctx.DOMAIN}`],
    },
    domain: ctx.DOMAIN,
    registrationIsOpen: false,
    maxUploadSize: 100,
    defaultPronouns: {
      subject: "they",
      object: "them",
      possAdj: "their",
      possPro: "theirs",
      reflexive: "themselves",
    },
    blocked: {},
    likeEmojis: [
      { name: "Like", emoji: "👍" },
      { name: "Laugh", emoji: "😂" },
      { name: "Love", emoji: "❤️" },
      { name: "Sad", emoji: "😭" },
      { name: "Angry", emoji: "🤬" },
      { name: "Shocked", emoji: "😮" },
      { name: "Puke", emoji: "🤮" },
    ],
    flagOptions: {
      spam: {
        label: "Spam",
        description:
          "Unwanted commercial or repetitive content, including unsolicited ads and link farming.",
      },
      harassment: {
        label: "Harassment or Bullying",
        description:
          "Targeted insults, abusive behavior, or attempts to intimidate or shame an individual or group.",
      },
      hate_speech: {
        label: "Hate Speech",
        description:
          "Content that attacks or demeans people based on race, ethnicity, national origin, religion, gender, sexual orientation, disability, or other protected characteristics.",
      },
      threats: {
        label: "Threats or Violence",
        description:
          "Direct or implied threats of harm, or encouragement of violence against individuals or groups.",
      },
      sexual_content: {
        label: "Sexually Explicit Content",
        description:
          "Pornography or sexually graphic material not suitable for general audiences.",
      },
      child_exploitation: {
        label: "Child Sexual Exploitation",
        description:
          "Any sexual or exploitative content involving children or minors. This category is handled with the highest urgency.",
      },
      self_harm: {
        label: "Self-Harm or Suicide",
        description:
          "Content that promotes, depicts, or encourages self-injury, eating disorders, or suicide.",
      },
      misinformation: {
        label: "Misinformation",
        description:
          "False or misleading claims, including medical, scientific, or civic misinformation that could cause harm.",
      },
      illegal: {
        label: "Illegal Goods or Services",
        description:
          "Content promoting unlawful activity such as drugs, weapons, counterfeit goods, or other regulated items.",
      },
      impersonation: {
        label: "Impersonation",
        description:
          "Accounts or content misrepresenting someone else's identity, organization, or brand in a misleading or deceptive way.",
      },
      terrorism: {
        label: "Terrorism or Extremism",
        description:
          "Content that promotes terrorist organizations, violent extremist groups, or recruitment for such activity.",
      },
      graphic_violence: {
        label: "Graphic Violence or Gore",
        description:
          "Excessively violent or gory content intended to shock or disturb.",
      },
      other: {
        label: "Other",
        description:
          "Anything objectionable not covered by the categories above.",
      },
    },
    adminEmail: ctx.adminEmail,
    adminUsers: [],
    editorUsers: [],
    emailServer: {
      protocol: "smtp",
      host: ctx.smtpHost || "localhost",
      username: ctx.smtpUser || "test",
      password: ctx.smtpPass || "test",
    },
    adminCircle: "",
    modCircle: "",
    publicKey: publicKey,
    privateKey: privateKey,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

export default defaultSettings;
