// Phase 2: Create all local content on each server (parallel across servers).
// Canonical order: circles → bookmark folders → media pool → groups →
//   group memberships → posts → replies → reacts → bookmarks

import fs from 'fs';
import path from 'path';
import { SERVERS, SCALE } from '../config.js';
import { addGroup, addPost, addFile, saveState, pick, pickN, rand } from '../state.js';
import { clientFor, anonClient, batch } from '../client.js';
import { generatePost, pickPostType, pickReaction } from '../fixtures/content.js';
import { generateCircleName, generateGroupName } from '../fixtures/names.js';
import { pickImages } from '../fixtures/images.js';

export async function runPhase2(state, { concurrency } = {}) {
  console.log('\n=== Phase 2: Local content ===');

  await Promise.all(SERVERS.map(server =>
    buildLocalContent(server, state.servers[server.name], { concurrency })
  ));

  state.phase = Math.max(state.phase, 2);
  saveState();
  console.log('\nPhase 2 complete.');
}

async function buildLocalContent(server, serverState, { concurrency }) {
  const sn = server.name;
  const users = serverState.users;
  console.log(`\n[${sn}] Building local content for ${users.length} users...`);

  // ── Step 1: Circles ────────────────────────────────────────────────────────
  console.log(`  [${sn}] Creating circles...`);
  let circleCount = 0;
  await batch(users, async (user) => {
    const client = clientFor(sn, user.id);
    const n = rand(SCALE.circlesPerUser.min, SCALE.circlesPerUser.max);
    for (let i = 0; i < n; i++) {
      try {
        const r = await client.activities.createCircle({
          name: generateCircleName(i),
          description: `Circle ${i + 1}`,
          to: '@public',
        });
        user.userCircles.push({ id: r.result?.id || r.item?.id, name: generateCircleName(i) });
        circleCount++;
      } catch (e) {
        console.warn(`    WARN [${sn}] circle for ${user.username}: ${e.message}`);
      }
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${circleCount} circles created`);

  // ── Step 2: Bookmark folders ────────────────────────────────────────────────
  console.log(`  [${sn}] Creating bookmark folders...`);
  let folderCount = 0;
  await batch(users, async (user) => {
    const client = clientFor(sn, user.id);
    const n = rand(SCALE.bookmarkFoldersPerUser.min, SCALE.bookmarkFoldersPerUser.max);
    for (let i = 0; i < n; i++) {
      try {
        const r = await client.activities.createBookmark({
          type: 'Folder',
          title: ['Saved Links', 'Reading List', 'References', 'Archive', 'Favourites'][i % 5],
          to: '@public',
        });
        user.bookmarkFolders.push({ id: r.result?.id || r.item?.id });
        folderCount++;
      } catch (e) {
        console.warn(`    WARN [${sn}] folder for ${user.username}: ${e.message}`);
      }
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${folderCount} bookmark folders created`);

  // ── Step 3: Media pool upload ───────────────────────────────────────────────
  console.log(`  [${sn}] Uploading media pool (${SCALE.mediaPoolPerServer} files)...`);
  const imagePaths = pickImages(SCALE.mediaPoolPerServer, rand);
  let uploadCount = 0;

  if (imagePaths.length === 0) {
    console.warn(`    WARN [${sn}] No images found — Media posts will be skipped`);
  } else {
    const uploaderPool = pickN(users, Math.min(10, users.length));
    await batch(imagePaths, async (imgPath) => {
      const uploader = pick(uploaderPool);
      const client = clientFor(sn, uploader.id);
      try {
        const buffer = fs.readFileSync(imgPath);
        const filename = path.basename(imgPath);
        const r = await client.activities.upload({
          file: buffer,
          filename,
          contentType: 'image/jpeg',
          title: filename,
          to: '@public',
        });
        const fileId = r.file?.id || r.result?.id;
        if (fileId) {
          addFile(sn, { id: fileId, ownerId: uploader.id, filename });
          uploadCount++;
        }
      } catch (e) {
        console.warn(`    WARN [${sn}] upload ${path.basename(imgPath)}: ${e.message}`);
      }
    }, { concurrency: 5 }); // lower concurrency for uploads
  }
  saveState();
  console.log(`    [${sn}] ${uploadCount} files uploaded`);

  // ── Step 4: Groups ──────────────────────────────────────────────────────────
  console.log(`  [${sn}] Creating ${SCALE.groupsPerServer} groups...`);
  const ownerPool = pickN(users, Math.min(10, users.length));
  let groupCount = 0;

  await batch(
    Array.from({ length: SCALE.groupsPerServer }, (_, i) => i),
    async (i) => {
      const owner = pick(ownerPool);
      const client = clientFor(sn, owner.id);
      const policy = ['open', 'open', 'open', 'serverOpen', 'serverOpen'][i % 5];
      try {
        const r = await client.activities.createGroup({
          name: generateGroupName(i),
          description: `A group for ${generateGroupName(i).toLowerCase()}`,
          to: policy === 'serverOpen' ? `@${server.domain}` : '@public',
          membershipPolicy: policy,
        });
        const g = r.result || r.item;
        addGroup(sn, {
          id: g.id,
          name: generateGroupName(i),
          ownerId: owner.id,
          membershipPolicy: policy,
          members: [owner.id],
        });
        groupCount++;
      } catch (e) {
        console.warn(`    WARN [${sn}] group ${i}: ${e.message}`);
      }
    },
    { concurrency }
  );
  saveState();
  console.log(`    [${sn}] ${groupCount} groups created`);

  // ── Step 5: Local group memberships ────────────────────────────────────────
  console.log(`  [${sn}] Adding members to groups...`);
  let joinCount = 0;
  const groups = serverState.groups;

  await batch(groups, async (group) => {
    const candidateUsers = users.filter(u => u.id !== group.ownerId);
    const targetCount = rand(SCALE.groupMembersMin, Math.min(SCALE.groupMembersMax, candidateUsers.length));
    const members = pickN(candidateUsers, targetCount);

    for (const user of members) {
      const client = clientFor(sn, user.id);
      try {
        await client.activities.joinGroup({ groupId: group.id });
        group.members.push(user.id);
        joinCount++;
      } catch (e) {
        // Join failures are non-fatal
      }
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${joinCount} group memberships created`);

  // ── Step 6: Posts ──────────────────────────────────────────────────────────
  console.log(`  [${sn}] Creating posts...`);
  const fileIds = serverState.files.map(f => f.id);
  let postCount = 0;

  await batch(users, async (user) => {
    const client = clientFor(sn, user.id);
    const userGroups = groups.filter(g => g.members.includes(user.id));
    const n = rand(SCALE.postsPerUser.min, SCALE.postsPerUser.max);

    for (let i = 0; i < n; i++) {
      // 30% group posts, 70% timeline posts
      const isGroupPost = userGroups.length > 0 && rand(0, 9) < 3;
      const postType = (fileIds.length > 0) ? pickPostType(rand) : (rand(0, 2) === 0 ? 'Article' : 'Note');
      const postData = generatePost(postType, { fileIds, rand });

      let to, canReply, canReact;
      if (isGroupPost) {
        const group = pick(userGroups);
        to = group.id;
        canReply = group.id;
        canReact = group.id;
      } else {
        const vis = rand(0, 9);
        if (vis < 5) { // 50% public
          to = '@public'; canReply = '@public'; canReact = '@public';
        } else if (vis < 8) { // 30% server
          to = `@${server.domain}`; canReply = `@${server.domain}`; canReact = '@public';
        } else { // 20% circle
          const circle = user.userCircles.length > 0 ? pick(user.userCircles) : null;
          if (circle) {
            to = circle.id; canReply = circle.id; canReact = circle.id;
          } else {
            to = '@public'; canReply = '@public'; canReact = '@public';
          }
        }
      }

      try {
        const r = await client.activities.createPost({
          ...postData,
          to,
          canReply,
          canReact,
        });
        const post = r.result || r.item;
        if (post?.id) {
          addPost(sn, {
            id: post.id,
            authorId: user.id,
            type: postType,
            to,
            isGroupPost,
            groupId: isGroupPost ? to : null,
          });
          postCount++;
        }
      } catch (e) {
        console.warn(`    WARN [${sn}] post for ${user.username}: ${e.message}`);
      }
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${postCount} posts created`);

  // ── Step 7: Replies ────────────────────────────────────────────────────────
  console.log(`  [${sn}] Creating replies...`);
  const publicPosts = serverState.posts.filter(p => p.to === '@public');
  const replyTargets = pickN(publicPosts, Math.min(50, publicPosts.length));
  let replyCount = 0;

  await batch(replyTargets, async (post) => {
    const replier = pick(users.filter(u => u.id !== post.authorId));
    if (!replier) return;
    const client = clientFor(sn, replier.id);
    try {
      await client.activities.createReply({
        toItemId: post.id,
        body: pick([
          'Really interesting point.',
          'Thanks for sharing this.',
          'I had a similar experience.',
          'This resonates with me.',
          'Agreed.',
          'Worth reading.',
          'Good to know.',
          'Hadn\'t thought of it that way.',
        ]),
      });
      replyCount++;
    } catch (e) {
      // Non-fatal
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${replyCount} replies created`);

  // ── Step 8: Reacts ────────────────────────────────────────────────────────
  console.log(`  [${sn}] Creating reacts...`);
  const reactTargets = pickN(publicPosts, Math.min(80, publicPosts.length));
  let reactCount = 0;

  await batch(reactTargets, async (post) => {
    const reactor = pick(users.filter(u => u.id !== post.authorId));
    if (!reactor) return;
    const client = clientFor(sn, reactor.id);
    try {
      await client.activities.react({
        postId: post.id,
        emoji: pickReaction(rand),
      });
      reactCount++;
    } catch (e) {
      // Non-fatal
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${reactCount} reacts created`);

  // ── Step 9: Bookmarks ─────────────────────────────────────────────────────
  console.log(`  [${sn}] Creating bookmarks...`);
  let bookmarkCount = 0;

  await batch(users, async (user) => {
    const client = clientFor(sn, user.id);
    const folder = user.bookmarkFolders.length > 0 ? pick(user.bookmarkFolders) : null;
    const n = rand(SCALE.bookmarksPerUser.min, SCALE.bookmarksPerUser.max);
    const targets = pickN(publicPosts.filter(p => p.authorId !== user.id), n);

    for (const post of targets) {
      try {
        await client.activities.createBookmark({
          type: 'Bookmark',
          href: `http://${server.domain}/posts/${encodeURIComponent(post.id)}`,
          title: `Saved post`,
          to: '@public',
          ...(folder ? { parentFolder: folder.id } : {}),
        });
        bookmarkCount++;
      } catch (e) {
        // Non-fatal
      }
    }
  }, { concurrency });
  saveState();
  console.log(`    [${sn}] ${bookmarkCount} bookmarks created`);

  console.log(`  [${sn}] Local content complete.`);
}
