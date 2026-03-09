// /config/defaultSettings.js
// Each entry: { value, summary, public, ui: { type, label, group, order, options? } }
//
// ui.type values:
//   text | textarea | boolean | number | select | multiselect |
//   email | url | color | json | markdown | image | redacted

import crypto from "crypto";

const defaultSettings = (ctx) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return {
    // ── Server identity ──────────────────────────────────────────────────────
    actorId: {
      value: ctx.domain ? `@${ctx.domain}` : null,
      summary: "Canonical server actor ID. Set automatically — do not edit.",
      public: true,
      ui: { type: "redacted", label: "Server Actor ID", group: "server", order: 10 },
    },

    domain: {
      value: ctx.domain,
      summary: "The fully-qualified domain name this server is reachable at.",
      public: true,
      ui: { type: "text", label: "Domain", group: "server", order: 1 },
    },

    adminEmail: {
      value: ctx.adminEmail,
      summary: "Contact email address for server administration.",
      public: false,
      ui: { type: "email", label: "Admin Email", group: "server", order: 2 },
    },

    adminCircle: {
      value: "",
      summary: "ID of the circle whose members have server admin privileges. Managed automatically.",
      public: false,
      ui: { type: "redacted", label: "Admin Circle ID", group: "server", order: 11 },
    },

    modCircle: {
      value: "",
      summary: "ID of the circle whose members have server moderator privileges. Managed automatically.",
      public: false,
      ui: { type: "redacted", label: "Moderator Circle ID", group: "server", order: 12 },
    },

    // ── Appearance ───────────────────────────────────────────────────────────
    profile: {
      value: {
        name: ctx.siteTitle,
        subtitle: "My brand new Kowloon server",
        description:
          "<p>This is a new Kowloon server. It's going to be a great place for me and my community to share ideas!</p>",
        location: {
          name: "Kowloon Walled City, Hong Kong",
          type: "Place",
          latitude: "22.332222",
          longitude: "114.190278",
        },
        icon: "/images/icons/server.png",
        urls: [`https://${ctx.domain}`],
      },
      summary: "Public-facing server profile (name, description, icon, etc.).",
      public: true,
      ui: { type: "json", label: "Server Profile", group: "appearance", order: 1 },
    },

    likeEmojis: {
      value: [
        { name: "Like",    emoji: "👍" },
        { name: "Laugh",   emoji: "😂" },
        { name: "Love",    emoji: "❤️" },
        { name: "Sad",     emoji: "😭" },
        { name: "Angry",   emoji: "🤬" },
        { name: "Shocked", emoji: "😮" },
        { name: "Puke",    emoji: "🤮" },
      ],
      summary: "Emoji reactions available to users. Each entry: { name, emoji }.",
      public: true,
      ui: { type: "json", label: "React Emojis", group: "appearance", order: 2 },
    },

    // ── Registration ─────────────────────────────────────────────────────────
    registrationIsOpen: {
      value: true,
      summary: "When enabled, anyone can register without an invite code.",
      public: true,
      ui: { type: "boolean", label: "Open Registration", group: "registration", order: 1 },
    },

    // ── Users & defaults ─────────────────────────────────────────────────────
    defaultPronouns: {
      value: {
        subject: "they",
        object: "them",
        possAdj: "their",
        possPro: "theirs",
        reflexive: "themselves",
      },
      summary: "Default pronouns pre-filled when a new user registers.",
      public: true,
      ui: { type: "json", label: "Default Pronouns", group: "users", order: 1 },
    },

    adminUsers: {
      value: [],
      summary: "Legacy list of admin user IDs. Prefer using the Admin Circle instead.",
      public: false,
      ui: { type: "json", label: "Admin User IDs", group: "server", order: 5 },
    },

    editorUsers: {
      value: [],
      summary: "User IDs with permission to create and edit server Pages.",
      public: false,
      ui: { type: "json", label: "Editor User IDs", group: "server", order: 6 },
    },

    // ── Uploads ──────────────────────────────────────────────────────────────
    maxUploadSize: {
      value: 100,
      summary: "Maximum allowed file upload size in megabytes.",
      public: true,
      ui: {
        type: "number",
        label: "Max Upload Size (MB)",
        group: "uploads",
        order: 1,
        options: { min: 1, max: 2048, step: 1 },
      },
    },

    // ── Moderation ───────────────────────────────────────────────────────────
    blocked: {
      value: {},
      summary: "Blocked domains/servers. Keys are domains, values are block reasons.",
      public: false,
      ui: { type: "json", label: "Blocked Domains", group: "moderation", order: 1 },
    },

    flagOptions: {
      value: {
        spam: {
          label: "Spam",
          description: "Unwanted commercial or repetitive content, including unsolicited ads and link farming.",
        },
        harassment: {
          label: "Harassment or Bullying",
          description: "Targeted insults, abusive behavior, or attempts to intimidate or shame an individual or group.",
        },
        hate_speech: {
          label: "Hate Speech",
          description: "Content that attacks or demeans people based on race, ethnicity, national origin, religion, gender, sexual orientation, disability, or other protected characteristics.",
        },
        threats: {
          label: "Threats or Violence",
          description: "Direct or implied threats of harm, or encouragement of violence against individuals or groups.",
        },
        sexual_content: {
          label: "Sexually Explicit Content",
          description: "Pornography or sexually graphic material not suitable for general audiences.",
        },
        child_exploitation: {
          label: "Child Sexual Exploitation",
          description: "Any sexual or exploitative content involving children or minors. This category is handled with the highest urgency.",
        },
        self_harm: {
          label: "Self-Harm or Suicide",
          description: "Content that promotes, depicts, or encourages self-injury, eating disorders, or suicide.",
        },
        misinformation: {
          label: "Misinformation",
          description: "False or misleading claims, including medical, scientific, or civic misinformation that could cause harm.",
        },
        illegal: {
          label: "Illegal Goods or Services",
          description: "Content promoting unlawful activity such as drugs, weapons, counterfeit goods, or other regulated items.",
        },
        impersonation: {
          label: "Impersonation",
          description: "Accounts or content misrepresenting someone else's identity, organization, or brand in a misleading or deceptive way.",
        },
        terrorism: {
          label: "Terrorism or Extremism",
          description: "Content that promotes terrorist organizations, violent extremist groups, or recruitment for such activity.",
        },
        graphic_violence: {
          label: "Graphic Violence or Gore",
          description: "Excessively violent or gory content intended to shock or disturb.",
        },
        other: {
          label: "Other",
          description: "Anything objectionable not covered by the categories above.",
        },
      },
      summary: "Available reasons users can select when flagging content for moderation.",
      public: true,
      ui: { type: "json", label: "Flag/Report Options", group: "moderation", order: 2 },
    },

    // ── Email ────────────────────────────────────────────────────────────────
    emailServer: {
      value: {
        protocol: "smtp",
        host: ctx.smtpHost || "localhost",
        username: ctx.smtpUser || "",
        password: ctx.smtpPass || "",
      },
      summary: "Outbound SMTP email server configuration.",
      public: false,
      ui: { type: "json", label: "Email Server", group: "email", order: 1 },
    },

    // ── Security / keys (read-only) ──────────────────────────────────────────
    publicKey: {
      value: publicKey,
      summary: "Server RSA public key (PEM). Generated automatically — do not edit.",
      public: true,
      ui: { type: "redacted", label: "Server Public Key", group: "security", order: 1 },
    },

    privateKey: {
      value: privateKey,
      summary: "Server RSA private key (PEM). Never exposed via API.",
      public: false,
      ui: { type: "redacted", label: "Server Private Key", group: "security", order: 2 },
    },
  };
};

export default defaultSettings;
