// /methods/federation/index.js

import shouldFederate from "./shouldFederate.js";
import syncCircleForViewer from "./syncCircleForViewer.js";
import handlePull from "./handlePull.js";
import verifyHttpSignature from "./verifyHttpSignature.js";
import { startChallenge, finishChallenge } from "./authChallenge.js";
import resolveAudience from "./resolveAudience.js";
import enqueueOutbox from "./enqueueOutbox.js";
import signHttpRequest from "./signHttpRequest.js";
import {
  processOutboxBatch,
  startOutboxWorker,
} from "./outboxWorker.js";

// Default export used by Kowloon.federation
const federation = {
  shouldFederate,
  verifyHttpSignature,
  handlePull,
  syncCircleForViewer,
  resolveAudience,
  enqueueOutbox,
  signHttpRequest,
  processOutboxBatch,
  startOutboxWorker,
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
  resolveAudience,
  enqueueOutbox,
  signHttpRequest,
  processOutboxBatch,
  startOutboxWorker,
};
