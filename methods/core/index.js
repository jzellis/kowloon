// /methods/core/index.js
// Core Kowloon API methods

import getUser from "./getUser.js";
import getPost from "./getPost.js";
import getCircle from "./getCircle.js";
import getGroup from "./getGroup.js";
import getFeedItem from "./getFeedItem.js";

// Re-export container utilities
import containers from "../containers/index.js";

export {
  getUser,
  getPost,
  getCircle,
  getGroup,
  getFeedItem,
  containers,
};

export default {
  getUser,
  getPost,
  getCircle,
  getGroup,
  getFeedItem,
  containers,
};
