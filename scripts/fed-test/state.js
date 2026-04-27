import fs from 'fs';
import { STATE_FILE, SERVERS } from './config.js';

const emptyServer = (server) => ({
  baseUrl: server.baseUrl,
  domain: server.domain,
  users: [],
  groups: [],
  posts: [],
  files: [],
});

export let state = {
  phase: 0,
  servers: Object.fromEntries(SERVERS.map(s => [s.name, emptyServer(s)])),
  federation: {
    follows: [],
    groupJoins: [],
    crossPosts: [],
    crossReplies: [],
    crossReacts: [],
    fanoutTests: [],
    results: [],
  },
};

export function initState() {
  state = {
    phase: 0,
    servers: Object.fromEntries(SERVERS.map(s => [s.name, emptyServer(s)])),
    federation: {
      follows: [],
      groupJoins: [],
      crossPosts: [],
      crossReplies: [],
      crossReacts: [],
      fanoutTests: [],
      results: [],
    },
  };
  saveState();
}

export function loadState(snapshotName) {
  const filePath = snapshotName
    ? STATE_FILE.replace('state.json', `snapshots/${snapshotName}/state.json`)
    : STATE_FILE;

  if (!fs.existsSync(filePath)) return false;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    Object.assign(state, data);
    return true;
  } catch {
    return false;
  }
}

export function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function serverState(name) {
  return state.servers[name];
}

export function addUser(serverName, user) {
  state.servers[serverName].users.push(user);
}

export function addGroup(serverName, group) {
  state.servers[serverName].groups.push(group);
}

export function addPost(serverName, post) {
  state.servers[serverName].posts.push(post);
}

export function addFile(serverName, file) {
  state.servers[serverName].files.push(file);
}

export function recordResult(result) {
  state.federation.results.push({ ...result, ts: Date.now() });
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

export function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
