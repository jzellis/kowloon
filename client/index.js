import Kowloon from "./kowloon.js";

await Kowloon.login("admin", "admin");
let postRequest = await Kowloon.getInbox();
let postList = document.getElementById("posts");
postList.innerHTML = "";
postRequest.items.map((i) => {
  postList.innerHTML += `<li class="mb-10 post" id=${i.id}>
  <div class="text-sm">${i.type}</div>
  <div class="font-bold">
    <img src="${i.actor.profile.icon}" class="w-10 h-auto mr-2 float-left" />${i.actor.profile.name} (${i.actor.id})
</div>`;
  if (i.title) {
    if (i.href) {
      postList.innerHTML += `<div class="text-lg font-bold"><a href="${i.href}" target="_blank">${i.title}</a></div>`;
    } else {
      postList.innerHTML += `<div class="text-lg font-bold"${i.title}</div>`;
    }
  }
  if (i.image) {
    postList.innerHTML += `<div class="ml-12 text-center image"><img class="w-full h-auto rounded-lg" src="${i.image}" /></div>  `;
  }
  postList.innerHTML += `<div class="ml-12 ">${i.body}</div>
  <div class='w-full columns-4 text-center'><div>Replies: ${i.reactCount}</div>
  <div>Reacts: ${i.reactCount}</div>
  <div><span class="${i.isPublic ? "" : "text-gray-300"}">Share</span></div>
  <div>Column</div></div>
<div class="btn bg-slate-100 rounded-md p-2 m-4 text-center text-sm cursor-pointer" onclick="document.getElementById(\'${
    i.id
  }-src\').classList.toggle(\'hidden\')">Show/Hide JSON</div>
<div id="${i.id}-src" class="ml-12 text-sm hidden"><pre>${JSON.stringify(
    i,
    null,
    2
  )}</pre></div>
  </li>`;
});
