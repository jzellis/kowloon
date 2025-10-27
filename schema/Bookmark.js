// schema/Bookmark.js
import mongoose from "mongoose";
import Settings from "./Settings.js";
import { marked } from "marked";
import { getServerSettings } from "#methods/settings/schemaHelpers.js";

const { Schema } = mongoose;

const BookmarkSchema = new Schema(
  {
    // Stable Kowloon ID: "bookmark:<uuid>@<domain>"
    id: { type: String, unique: true, index: true },
    objectType: { type: String, default: "Bookmark" },

    // Bookmark or Folder (collection)
    type: {
      type: String,
      enum: ["Bookmark", "Folder"],
      default: "Bookmark",
      index: true,
    },

    // 🔐 Ownership (NEW)
    actorId: { type: String, required: true },

    // Folder hierarchy
    parentFolder: { type: String, default: undefined, index: true }, // id of a Folder

    // What is being bookmarked
    // Either an internal target id (post:/event:/page:/etc) OR an external URL (href).
    target: { type: String, default: undefined, index: true },
    href: { type: String, default: undefined },

    // Presentation
    title: { type: String, default: undefined },
    image: { type: String, default: undefined },

    // Visibility of the *bookmark record itself*
    to: { type: String, default: "" },

    // Optional metadata
    tags: { type: [String], default: [] },
    summary: { type: String, default: undefined },
    source: {
      content: { type: String, default: "" }, // raw text/HTML/Markdown
      mediaType: { type: String, default: "text/html" },
    },
    body: { type: String, default: "" },

    // Lifecycle
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },

    // Convenience
    url: { type: String, default: undefined },

    // 🧯 Back-compat (deprecated): map to ownerId/ownerType if present
    actorId: { type: String, default: undefined }, // DEPRECATED
    actor: { type: Object, default: undefined }, // DEPRECATED
    server: { type: String, default: undefined }, // host/domain (kept if you use it elsewhere)
  },
  {
    strict: false,
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---- Indexes for common access patterns ----
BookmarkSchema.index({ ownerId: 1, createdAt: -1 }); // listing someone's bookmarks
BookmarkSchema.index({ parentFolder: 1, createdAt: -1 }); // folder views
BookmarkSchema.index({ to: 1, ownerType: 1 });
BookmarkSchema.index({ target: 1, createdAt: -1 }); // reverse lookups / cleanup

// If you want reactions *to bookmarks* (optional; keep if you use it)
BookmarkSchema.virtual("reacts", {
  ref: "React",
  localField: "id",
  foreignField: "target",
});

// ------ Helpers ------
function inferOwnerTypeFromId(id) {
  if (!id || typeof id !== "string") return "user";
  if (id.startsWith("@server@")) return "server";
  if (id.startsWith("group:")) return "group";
  return id.startsWith("@") ? "user" : "user";
}

// ------ Pre-save normalization ------
BookmarkSchema.pre("save", async function (next) {
  try {
    if (this.isNew) {
      // Load domain + default server actor
      const { domain, actorId } = getServerSettings();
      if (!domain) throw new Error("Bookmark: missing Settings.domain");

      // id + url
      if (!this.id) {
        // Note: using this._id gives a stable ObjectId; embed domain as spec
        this.id = `bookmark:${this._id}@${domain}`;
      }
      if (!this.url) {
        this.url = `https://${domain}/bookmarks/${encodeURIComponent(this.id)}`;
      }

      // ownerId / ownerType (NEW) -- back-compat with legacy actorId
      if (!this.ownerId && this.actorId) {
        this.ownerId = this.actorId;
      }
      if (!this.ownerType && this.ownerId) {
        this.ownerType = inferOwnerTypeFromId(this.ownerId);
      }

      // Ensure required ownership is set
      if (!this.ownerId || !this.ownerType) {
        throw new Error("Bookmark requires ownerId and ownerType");
      }

      // Visibility default
      this.to = this.to || "@public";

      // Image + presentation defaults
      this.image = this.image || `https://${domain}/images/bookmark.png`;
      if (!this.title) this.title = this.href || this.target || this.title;

      // Render body from source
      const mediaType = this.source?.mediaType || "text/html";
      const content = this.source?.content || "";
      switch (mediaType) {
        case "text/markdown":
          this.body = `<div>${marked(content)}</div>`;
          break;
        case "text/html":
          this.body = content;
          break;
        default:
          this.body = `<p>${String(content).replace(
            /(?:\r\n|\r|\n)/g,
            "</p><p>"
          )}</p>`;
          break;
      }

      // Optional: store server label (domain) if you use it for queries
      if (!this.server) this.server = domain;
    } else {
      // On updates, keep ownerId/ownerType consistent if someone edits actorId
      if (!this.ownerId && this.actorId) this.ownerId = this.actorId;
      if (this.ownerId && !this.ownerType)
        this.ownerType = inferOwnerTypeFromId(this.ownerId);
    }

    // Validation: either target (internal object) OR href (external) must exist for type=Bookmark
    if (this.type === "Bookmark") {
      if (!this.target && !this.href) {
        throw new Error("Bookmark requires either target or href");
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("Bookmark", BookmarkSchema);
