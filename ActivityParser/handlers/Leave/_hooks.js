// Optional lifecycle hooks for the Create verb
export async function before({ activity }, ctx) {
  // e.g., extra validation, rate limits, audit
}

export async function after({ result }, ctx) {
  // e.g., centralized fan-out, notifications, job enqueue
}
