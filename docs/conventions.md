# Conventions

## IDs
All objects in Kowloon have an ID that is universally unique. All IDs end with **@_server.name_**. The convention is as follows:
| Type | Prefix | Example |
| --- | --- | --- |
| User | @ | @admin@kowloon.social |
| Activity | activity: | activity:66913a1eadd6b95270795cfa@kowloon.social |
| Post | post: | post:66913a1eadd6b95270795cfa@kowloon.social |
| Circle | circle: | circle:66913a1eadd6b95270795cfa@kowloon.social |
| Bookmark | bookmark: | bookmark:66913a1eadd6b95270795cfa@kowloon.social |
| Group | group: | group:66913a1eadd6b95270795cfa@kowloon.social |
| React | like: | like:66913a1eadd6b95270795cfa@kowloon.social |
| Feed | feed: | feed:66913a1eadd6b95270795cfa@kowloon.social |

You can access each of these objects at their respective endpoints:

- Users: `https://kowloon.social/users/`_[username or id]_
- Activities: `https://kowloon.social/activities/`_[id]_
- Posts: `https://kowloon.social/posts/`_[id]_
- Circles (your own or public): `https://kowloon.social/circles/`_[id]_
- Bookmarks: `https://kowloon.social/bookmarks/`_[id]_
- Groups: `https://kowloon.social/groups/`_[id]_

## Public Endpoints
A server's root URL, i.e. `https://kowloon.social/`, returns public information about the server itself. Other public URLs are:
- `/posts/` - For all users or viewers (logged in or otherwise), returns all of the server's public posts. If the user is logged in and a member of the server, they will also see server-only posts addressed to server members only.
- `/users/` - For all users or viewers (logged in or otherwise), returns all of the server's public users.
- `/circles/` - For all users or viewers (logged in or otherwise), returns all of the server's public Circles.
- `/groups/` - For all users or viewers (logged in or otherwise), returns all of the server's public Groups.
- `/bookmarks/` - For all users or viewers (logged in or otherwise), returns all of the server's public Bookmarks.
- `/activities/` - For all users or viewers (logged in or otherwise), returns all of the server's public Activities.

## Private Endpoints
- `https://server.name/users/`[_my username_]`/feed` - This shows you your own feed of posts by users or servers or RSS sources you follow. You can also use the `page` query parameter to paginate through your feed, filter posts by `type`, or show only posts from users in specific Circles.

Example:
- `https://kowloon.social/users/admin/feed?page=2&type=Article&type=Image&circle=circle:66913a1eadd6b95270795cfa@kowloon.social` - This will show you the second page of Article and Image posts from anyone in your Circle with the ID `circle:66913a1eadd6b95270795cfa@kowloon.social`.

### Filtering ###
You can paginate each of these endpoints using the `page` query parameter. Each page returns 20 results. For example, if you retrieved `https://kowloon.social/posts/?page=2` you would get posts 21-41, ordered from newest to oldest.

**Activities** and **Posts** can be filtered by the `type` query parameter. For example, `https://kowloon.social/posts/?type=Note` will return only public posts of the **Note** type; `https://kowloon.social/posts/?type=Note&type=Link` will return only public posts of the **Note** and **Link** types (as well as server-only posts if the user is a logged in server member). `https://kowloon.social/activities/?type=React` will return only React activities.


## Addressing
Activities and posts are addressed to their recipient or audience. Recipients are other users, audiences are Circles or Groups.

There are four address fields: `to`, `bto`, `cc` and `bcc`. Each have particular uses:
- `to` is intended for tagging users or replying to their posts. It's also used to designate **public** posts (posts which are visible to anyone either via the user's feed, the server's feed or the server's homepage) or **server only** posts (posts which are only visible to users who belong to the server). These are designated by addressing the post or activity to **_public@[_server.name_]** or **_server@[_server.name_]**. So for example, if your server is `kowloon.com` and you want your post to be visible to anyone who views your feed or the collective public feed at the frontpage of `kowloon.com`, you would address it to `_public@kowloon.com`. If you want the post to only be visible to logged-in users of `kowloon.com`, you would address it to `_server@kowloon.com`.

- `bto` is for addressing posts to Circles. People who you've added to a Circle will be able to see these posts, but not what Circle you've added them to, nor be notified that you've added them. So if, for example, you've added your cousin `@bob@myfamily.net` to a circle called **Annoying Family Members** with the ID `circle:66913a1eadd6b95270795cfa@kowloon.social`, and you address a post with the `bto` field to `circle:66913a1eadd6b95270795cfa@kowloon.social`, if **@bob@myfamily.net** views your feed when they're logged in, they'll be able to see the post but not that they're in a Circle called **Annoying Family Members**.

- `cc` is for posting public posts to public Groups. For example, if you want to post to a public group called **Venture Bros Fans** with the ID `group:66913a1eadd6b95270795cfa@kowloon.social`, you would address the post `cc` field to `group:66913a1eadd6b95270795cfa@kowloon.social`. Anyone who views **Venture Bros Fans** will be able to see your post in the group's timeline whether they're logged in or not.

- `bcc` is for addressing private posts to public Groups or private posts Groups. For example, if you belong to a private Group called **Rusty Venture Erotic Fanfic** with the ID `group:66913a1eadd6b95270795cfa@kowloon.social` and you address a post's `bcc` to `group:66913a1eadd6b95270795cfa@kowloon.social`, the post will only be visible to members of that group. Even if the visibility of the Group is changed to public in the future, only members will be able to see that post.

You can address posts to multiple recipients and combine these fields, though some combinations will cancel each other out. For example, if you address a post **to** `_public@kowloon.com` and **bcc** it to `circle:66913a1eadd6b95270795cfa@kowloon.social`, the post will be publicly visible, which defeats the purpose of the **bcc**. It's _allowed_ by Kowloon, but it's silly.

