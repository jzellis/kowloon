// /methods/core/index.js
// Core Kowloon API methods

import getObjectById from "./getObjectById.js";
import getCollection from "./getCollection.js";
import getUser from "./getUser.js";
import getPost from "./getPost.js";
import getCircle from "./getCircle.js";
import getGroup from "./getGroup.js";
import getFeedItem from "./getFeedItem.js";

// Re-export container utilities
import containers from "../containers/index.js";

export {
  getObjectById,
  getCollection,
  getUser,
  getPost,
  getCircle,
  getGroup,
  getFeedItem,
  containers,
};

export default {
  getObjectById,
  getCollection,
  getUser,
  getPost,
  getCircle,
  getGroup,
  getFeedItem,
  containers,
};
