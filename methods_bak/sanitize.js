const fields = ["id", "password", "accessToken", "keys.private", "bto", "bcc"];

function sanitizeObj(data) {
  for (const field of fields) {
    delete data[field];
    data[field] = undefined;
  }
}

export default function (data) {
  if (Array.isArray(data)) {
    data.forEach((item) => sanitizeObj(item));
  } else if (typeof data === "object" && data !== null) {
    sanitizeObj(data);
  } else {
    throw new Error("Input data must be an array or an object");
  }
  return data;
}
