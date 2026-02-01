// /routes/outbox/post.js
import route from "../utils/route.js";
import Kowloon from "#kowloon";
import getSettings from "#methods/settings/get.js";
import createActivity from "#methods/activities/create.js"; // fallback creator

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const isNonEmptyStr = (s) => typeof s === "string" && s.trim().length > 0;
const DEV =
  process.env.NODE_ENV === "development" ||
  /^(1|true|yes)$/i.test(process.env.OUTBOX_DEBUG || "");

function isCreateUserActivity(body) {
  if (!isObj(body)) return false;
  if (body.type !== "Create") return false;
  if (body.objectType === "User") return true;
  const ot = body?.object?.type;
  return typeof ot === "string" && /^(User|Person)$/i.test(ot);
}

function pickCreateFn() {
  const viaKowloon = Kowloon?.activities?.create;
  return typeof viaKowloon === "function" ? viaKowloon : createActivity;
}

export default route(
  async ({ req, body, user, set, setStatus }) => {
    const rid = Math.random().toString(36).slice(2, 8);
    const label = `OUTBOX ${rid}`;
    console.time(label);

    const unauthCreateUser = isCreateUserActivity(body);

    // ---- settings for server actor ----
    const settings = await getSettings().catch(() => ({}));
    const domain = settings?.domain;

    // Build activity without mutating req.body
    const activity = { ...(body || {}) };

    // Enforce actor:
    // - For Create->User, force server actor (e.g. "@kwln.org")
    // - Otherwise, enforce the authenticated user
    if (unauthCreateUser) {
      if (isNonEmptyStr(domain)) {
        activity.actorId = `@${domain}`;
      } else if (!isNonEmptyStr(activity.actorId)) {
        setStatus(400);
        set("error", "Create User: missing server actor (settings.domain)");
        if (DEV)
          console.error(
            `${label}: 400 Create User missing server actor (settings.domain)`
          );
        console.timeEnd(label);
        return;
      }
    } else {
      activity.actorId = user.id;
    }

    // Ensure to/canReact/canReply exist on activity + object (don't override if present)
    if (!("to" in activity)) activity.to = "";
    if (!("canReact" in activity)) activity.canReact = "";
    if (!("canReply" in activity)) activity.canReply = "";
    if (isObj(activity.object)) {
      if (!("to" in activity.object)) activity.object.to = "";
      if (!("canReact" in activity.object)) activity.object.canReact = "";
      if (!("canReply" in activity.object)) activity.object.canReply = "";
    }

    if (DEV) {
      console.log(
        `${label}: normalized activity`,
        JSON.stringify(activity, null, 2)
      );
    }

    const createFn = pickCreateFn();
    const creatorPath =
      createFn === Kowloon?.activities?.create
        ? "Kowloon.activities.create"
        : "#methods/activities/create";
    if (DEV) console.log(`${label}: using creator`, creatorPath);

    if (typeof createFn !== "function") {
      setStatus(500);
      set("error", "Server not initialized: activities.create unavailable");
      if (DEV)
        console.error(`${label}: 500 no activity create function available`);
      console.timeEnd(label);
      return;
    }

    let created;
    try {
      created = await createFn(activity);
    } catch (err) {
      setStatus(500);
      set("error", err?.message || String(err));
      if (DEV) console.error(`${label}: create threw`, err?.stack || err);
      console.timeEnd(label);
      return;
    }

    if (!created || created.error) {
      setStatus(400);
      set("error", created?.error || "Failed to create activity");
      if (DEV)
        console.error(
          `${label}: creator returned error`,
          JSON.stringify(created, null, 2)
        );
      console.timeEnd(label);
      return;
    }

    const createdId =
      created?.result?.created?.id ||
      created?.result?.id ||
      created?.activity?.object?.id ||
      created?.activity?.id;

    // Handle outbound federation if needed
    let federationJob = null;
    if (created.federate && createdId) {
      try {
        const { enqueueOutbox } = await import(
          "#methods/federation/enqueueOutbox.js"
        );
        federationJob = await enqueueOutbox({
          activity: created.activity,
          activityId: createdId,
          actorId: activity.actorId,
          reason: "activity.federate = true",
        });
        if (DEV) {
          console.log(`${label}: federation enqueued`, {
            jobId: federationJob.jobId,
            recipients: federationJob.recipients.length,
          });
        }
      } catch (err) {
        if (DEV) {
          console.error(`${label}: federation enqueue failed`, err);
        }
        // Don't fail the whole request if federation fails
      }
    }

    setStatus(200);
    set("ok", true);
    set("activity", created.activity);
    set("result", created.result?.created || created.result);
    if (createdId) set("createdId", createdId);
    set("federate", !!created.federate);
    if (federationJob) {
      set("federationJob", {
        jobId: federationJob.jobId,
        recipients: federationJob.recipients.length,
        counts: federationJob.counts,
      });
    }

    if (DEV) {
      console.log(`${label}: success`, {
        status: 200,
        createdId: createdId || null,
        federate: !!created.federate,
        federationJob: federationJob?.jobId || null,
      });
    }
    console.timeEnd(label);
  },
  { allowUnauthCreateUser: true, label: "OUTBOX" }
);
