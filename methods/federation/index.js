// /methods/federation/index.js

import shouldFederate from "./shouldFederate.js";
import syncCircleForViewer from "./syncCircleForViewer.js";
import handlePull from "./handlePull.js";
import verifyHttpSignature from "./verifyHttpSignature.js";
import { startChallenge, finishChallenge } from "./authChallenge.js";

// Default export used by Kowloon.federation
const federation = {
  shouldFederate,
  verifyHttpSignature,
  handlePull,
  syncCircleForViewer,
  auth: {
    startChallenge,
    finishChallenge,
  },
};

export default federation;

// (Optional) named exports if you ever want them
export {
  shouldFederate,
  verifyHttpSignature,
  handlePull,
  syncCircleForViewer,
  startChallenge,
  finishChallenge,
};
