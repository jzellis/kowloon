function assertTypeFromId(id, expected) {
  const isUser = id.startsWith("@");
  const type = isUser ? "User" : id.split(":")[0].toLowerCase(); // 'post','event',...
  const norm = isUser ? "User" : type.charAt(0).toUpperCase() + type.slice(1);
  if (norm !== expected) {
    throw new Error(`Expected ${expected} id but got ${norm}: ${id}`);
  }
}

export default assertTypeFromId;
