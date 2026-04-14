// /methods/federation/index.js

import shouldFederate from "./shouldFederate.js";
import verifyHttpSignature from "./verifyHttpSignature.js";
import { startChallenge, finishChallenge } from "./authChallenge.js";
import resolveAudience from "./resolveAudience.js";
import enqueueOutbox from "./enqueueOutbox.js";
import signHttpRequest from "./signHttpRequest.js";
import {
  processOutboxBatch,
  startOutboxWorker,
} from "./outboxWorker.js";
import pullFromRemote from "./pullFromRemote.js";
import normalizeInboundActivity from "./normalizeInboundActivity.js";
import sendAccept from "./sendAccept.js";

// Default export used by Kowloon.federation
const federation = {
  shouldFederate,
  verifyHttpSignature,
  pullFromRemote,
  resolveAudience,
  enqueueOutbox,
  signHttpRequest,
  processOutboxBatch,
  startOutboxWorker,
  normalizeInboundActivity,
  sendAccept,
  auth: {
    startChallenge,
    finishChallenge,
  },
};

export default federation;

export {
  shouldFederate,
  verifyHttpSignature,
  pullFromRemote,
  startChallenge,
  finishChallenge,
  resolveAudience,
  enqueueOutbox,
  signHttpRequest,
  processOutboxBatch,
  startOutboxWorker,
  normalizeInboundActivity,
  sendAccept,
};
