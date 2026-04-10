// scripts/seed-pages.js
// Creates (or upserts) the server's public informational pages.
// Safe to re-run — uses upsert on slug so pages won't be duplicated.
//
//   node scripts/seed-pages.js

import "dotenv/config";
import Kowloon, { attachMethodDomains } from "#kowloon";
import initKowloon from "#methods/utils/init.js";
import { Page } from "#schema";
import { getSetting } from "#methods/settings/cache.js";

const SERVER_PAGES = [
  // ── Top-level ─────────────────────────────────────────────────────────────
  {
    slug: "about",
    title: "About This Server",
    summary: "Who we are, what we do, and why we do it.",
    order: 1,
    source: {
      mediaType: "text/markdown",
      content: `# About This Server

Kowloon is a small, intentional community for people who care about design, music, writing, and the pleasures of a well-made thing. We run on open-source federated software.

## What We Are

A place to think out loud, share work, and find people who are interested in the same things you are. We are not trying to be large. We are trying to be good.

## What We Believe

That the internet was better when it was made of individual, idiosyncratic places. That you should own your words. That slow is fine.

If that sounds like your kind of place, you are welcome here.`,
    },
  },
  {
    slug: "projects",
    type: "Folder",
    title: "Projects",
    summary: "Ongoing and completed projects by server members.",
    order: 2,
    source: {
      mediaType: "text/markdown",
      content: `# Projects

A collection of things we are building, writing, and making.`,
    },
  },
  {
    slug: "contact",
    title: "Contact",
    summary: "How to reach the server administrators.",
    order: 3,
    source: {
      mediaType: "text/markdown",
      content: `# Contact

The best way to reach the server administrators is to send a message to **@admin** on this server.

For urgent matters, or if you cannot log in, email is available at the address listed in the server's federation profile.`,
    },
  },

  // ── Children of "about" ───────────────────────────────────────────────────
  {
    slug: "rules",
    title: "Rules & Guidelines",
    summary: "A short list of expectations for members of this community.",
    parentSlug: "about",
    order: 1,
    source: {
      mediaType: "text/markdown",
      content: `# Rules & Guidelines

We have very few rules. Here they are.

## Be decent

Treat people the way you would want to be treated in a small community where everyone knows each other.

## No harassment

Do not target, threaten, or repeatedly contact someone who does not want to hear from you.

## No spam or automated posting

Post because you have something to say, not to fill a feed.

## Follow the law

Do not post content that is illegal in your jurisdiction or ours.

## Respect visibility settings

If someone marks something as server-only or friends-only, do not screenshot and share it publicly.

---

Violations may result in a warning, content removal, or account suspension, at moderator discretion.`,
    },
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    summary: "How we handle your data and what we share with others.",
    parentSlug: "about",
    order: 2,
    source: {
      mediaType: "text/markdown",
      content: `# Privacy Policy

## What we collect

- Your username, email address, and password (hashed)
- Posts, replies, and reactions you create
- Profile information you provide voluntarily
- Server logs (IP addresses, request timestamps) for security purposes

## What we share

Content you mark as **public** is federated to other servers in the network and is accessible to anyone on the internet.

Content marked **server-only** stays on this server and is accessible only to registered members.

We do not sell your data to third parties. We do not run advertising.

## Data retention

Your data is retained as long as your account exists. You may request deletion of your account and associated content at any time by contacting an administrator.

## Federation

This server participates in the Fediverse. When you interact with users on other servers, your public profile information and public content may be sent to those servers.

## Contact

Questions about privacy can be directed to the server administrators via the [Contact](/pages/contact) page.`,
    },
  },
];

async function main() {
  console.log("→ Initializing Kowloon...");
  await initKowloon(Kowloon, {
    domain: process.env.DOMAIN,
    siteTitle: process.env.SITE_TITLE || "Kowloon",
    adminEmail: process.env.ADMIN_EMAIL,
  });
  await attachMethodDomains(Kowloon);

  const serverActorId =
    getSetting("actorId") || `https://${getSetting("domain")}/server`;

  console.log(`→ Server actor: ${serverActorId}`);

  // Build a slug→id map so we can wire up parentFolder
  const slugToId = {};
  const created = [];

  // Two passes: first top-level (no parentSlug), then children
  const sorted = [
    ...SERVER_PAGES.filter((p) => !p.parentSlug),
    ...SERVER_PAGES.filter((p) => p.parentSlug),
  ];

  for (const def of sorted) {
    const { parentSlug, ...fields } = def;

    const parentFolder = parentSlug ? slugToId[parentSlug] : undefined;
    if (parentSlug && !parentFolder) {
      console.warn(`  ! Parent "${parentSlug}" not found for "${def.slug}" — skipping`);
      continue;
    }

    // Upsert by slug
    const existing = await Page.findOne({ slug: def.slug, deletedAt: null }).lean();
    if (existing) {
      console.log(`  ~ skipping "${def.slug}" (already exists as ${existing.id})`);
      slugToId[def.slug] = existing.id;
      continue;
    }

    const page = await Page.create({
      type: fields.type ?? "Page",
      actorId: serverActorId,
      title: fields.title,
      slug: fields.slug,
      summary: fields.summary,
      order: fields.order ?? 0,
      parentFolder,
      source: fields.source,
      to: "@public",
      canReply: "@public",
      canReact: "@public",
    });

    slugToId[def.slug] = page.id;
    created.push(page.slug);
    console.log(`  + created "${page.slug}" → ${page.id}`);
  }

  console.log(`\n✅ Done. Created: [${created.join(", ")}]`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
