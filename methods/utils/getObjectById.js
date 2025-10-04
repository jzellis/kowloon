import {
  Post,
  Page,
  Bookmark,
  Circle,
  Event,
  Group,
  File,
  User,
  Reply,
} from "#schema";

/**
 * Retrieves any Kowloon object (User, Post, Event, etc.) by its full ID.
 * @param {string} id - The object's Kowloon ID (e.g. post:uuid@domain or @user@domain)
 * @returns {Promise<Object|null>} - The matching document or null if not found.
 */
export default async function getObjectById(id) {
  if (!id || typeof id !== "string") return null;

  let Model = null;
  let query = { id };

  // Users: @username@domain
  if (id.startsWith("@")) {
    Model = User;
  } else {
    // Everything else: objecttype:uuid@domain
    const type = id.split(":")[0].toLowerCase();
    switch (type) {
      case "post":
        Model = Post;
        break;
      case "page":
        Model = Page;
        break;
      case "bookmark":
        Model = Bookmark;
        break;
      case "circle":
        Model = Circle;
        break;
      case "event":
        Model = Event;
        break;
      case "group":
        Model = Group;
        break;
      case "file":
        Model = File;
        break;
      case "reply":
        Model = Reply;
        break;
      default:
        throw new Error(`Unknown object type in ID: ${type}`);
    }
  }

  return Model ? await Model.findOne(query).lean() : null;
}
