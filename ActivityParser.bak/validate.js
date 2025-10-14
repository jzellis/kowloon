// Minimal verb contracts for Kowloon v1
// Throws fast 4xx-style errors if required fields are missing/invalid.

const VERBS = new Set([
  "Create",
  "Update",
  "Delete",
  "Reply",
  "React",
  "Follow",
  "Unfollow",
  "Block",
  "Mute",
  "Join",
  "Leave",
  "Invite",
  "Accept",
  "Reject",
  "Add",
  "Remove",
  "Upload",
  "Undo",
  "Flag",
]);

function req(cond, msg) {
  if (!cond) throw new Error(msg);
}

function has(v) {
  return v !== undefined && v !== null;
}
function isStr(v) {
  return typeof v === "string" && v.trim().length > 0;
}

export default function validateActivity(a) {
  req(a && typeof a === "object", "Invalid activity payload");
  req(VERBS.has(a.type), `Unsupported activity.type: ${a.type}`);

  // If an object is present, we require objectType (strict schema rule)
  if (has(a.object)) {
    req(
      isStr(a.objectType),
      "Invalid activity: object present but objectType missing"
    );
    // if (a.object && typeof a.object === "object" && a.object.type) {
    //   req(
    //     a.object.type === a.objectType,
    //     `Invalid activity: object.type (${a.object.type}) != objectType (${a.objectType})`
    //   );
    // }
  }

  switch (a.type) {
    case "Create": {
      req(has(a.object), "Create requires object");
      req(isStr(a.objectType), "Create requires objectType");
      break;
    }

    case "Update": {
      // allow either a patch in object or a target reference (or both)
      req(has(a.object) || isStr(a.target), "Update requires object or target");
      if (has(a.object))
        req(
          isStr(a.objectType),
          "Update requires objectType when object present"
        );
      break;
    }

    case "Delete": {
      req(isStr(a.target), "Delete requires target");
      req(isStr(a.objectType), "Delete requires objectType");
      break;
    }

    case "Reply": {
      // Explicit verb for replies: objectType should be "Reply", and target is the parent
      req(has(a.object), "Reply requires object");
      req(a.objectType === "Reply", "Reply requires objectType = 'Reply'");
      req(
        isStr(a.target) ||
          isStr(a.object?.target) ||
          isStr(a.object?.inReplyTo),
        "Reply requires a target (activity.target or object.target/inReplyTo)"
      );
      break;
    }

    case "React": {
      // objectType is the type of the thing being reacted to; target is that thing; object is the reaction
      req(isStr(a.objectType), "React requires objectType (of target)");
      req(isStr(a.target), "React requires target (id being reacted to)");
      req(has(a.object), "React requires object (reaction payload)");
      break;
    }

    case "Follow":
    case "Unfollow": {
      // object = user/server id; optional target = circle id
      req(isStr(a.object), `${a.type} requires object (user/server id)`);
      // objectType optional (User|Server) -- you can enforce if you prefer:
      // req(["User","Server"].includes(a.objectType), `${a.type} requires objectType User or Server`);
      break;
    }

    case "Block":
    case "Mute": {
      // may target Users or Servers
      req(isStr(a.object), `${a.type} requires object (user/server id)`);
      break;
    }

    case "Join":
    case "Leave": {
      // operates on Group/Event (not Circles)
      req(isStr(a.objectType), `${a.type} requires objectType (Group/Event)`);
      req(isStr(a.target), `${a.type} requires target (resource id)`);
      break;
    }

    case "Invite": {
      // invitee(s) in object; resource in target
      req(has(a.object), "Invite requires object (invitee)");
      req(isStr(a.target), "Invite requires target (Group/Event id)");
      break;
    }

    case "Accept":
    case "Reject": {
      // Accept/Reject a Follow/Invite/Join, etc. -- must reference something
      req(
        isStr(a.target) || isStr(a.object),
        `${a.type} requires target (or object)`
      );
      break;
    }

    case "Add":
    case "Remove": {
      // membership role mgmt on Group/Event
      // target = user id, object = memberlist key, to = resource id
      req(isStr(a.target), `${a.type} requires target (user id)`);
      req(isStr(a.object), `${a.type} requires object (memberlist key)`);
      req(isStr(a.to), `${a.type} requires to (resource id)`);
      break;
    }

    case "Upload": {
      // file metadata in object (or target to attach)
      req(
        has(a.object) || isStr(a.target),
        "Upload requires object (file meta) or target"
      );
      // If object present, expect objectType === "File"
      if (has(a.object))
        req(
          a.objectType === "File",
          "Upload with object requires objectType = 'File'"
        );
      break;
    }

    case "Undo": {
      // undo some prior action -- must reference it
      req(
        isStr(a.target) || isStr(a.object),
        "Undo requires target (or object) of the original action"
      );
      break;
    }

    case "Flag": {
      // report content/user/server -- minimal: which thing?
      req(isStr(a.target), "Flag requires target (id being reported)");
      // you can optionally require object as details/reason
      break;
    }
  }

  return true;
}
