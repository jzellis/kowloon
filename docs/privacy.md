Most Fediverse networks use a *push-based* federation system: User A is followed by users B, C and D, and every time A posts something, that something is *pushed* to B, C and D. When the network is based on a follower -> following or friend &lt;-&gt; friend model,. this is the most efficient way of doing things.

Kowloon does things a little differently. It uses a hybrid *push-and-pull* based model. This is necessary due to Kowloon's unique relationship and privacy model, which essentially comes down to three rules:

- **No one should have access to your eyeballs unless you want them to;**
- **No one should see anything you don't want them to see;**
- **No one should be able to use your data for their own profit.**
  
In real human relationships, friendships are not binary, nor do we keep a tally of how many people "follow" us or vice versa. Most of these metrics in social media are used for commercial and marketing purposes. Kowloon is neither commercial nor designed to be a marketing tool -- it's meant to be a way for people to share and communicate, and so there are a few big differences in how it works:

- You have no idea how many people "follow" you.
- You can't push anything on anyone who hasn't asked for it.
- You don't ever have to see anything you don't want to see.

It may seem counterintuitive for you to not know who follows you in a privacy-oriented system, but Kowloon's addressing system ensures that no one can see anything you don't want them to.

## Circles ##

Every single thing in Kowloon can be addressed to one of a few audiences:

- **Public**: Public in Kowloon means *public*. If you make something public, it can be seen by any logged-in Kowloon user, but it can also be seen via the Web. When you make something public, you're publishing it like an article in a newspaper - you have no control over who sees it.
-  **Community**: If something is marked *community*, it can only be seen by logged-in members of your own Kowloon community. No one else can see it - and if you've blocked members of your own community for any reason, they can't see it either.
-  **Group** or **Event**: if you post to a Group you belong to or to the wall of an Event, your post is automatically visible to whomever the Group/Event is visible to. If it's a private Group or Event , no one but other Group members or Event attendees can see it; if it's public, anyone can. It will always be very clear which is which, though.
-  **Circle**: If you post something to one of your Circles, only people/community in that Circle will be able to see it.

### What is a Circle? ###

Circles are the heart of how Kowloon works. In essence, they're like playlists in a music app, but for people and communities. You can add other people within your community or outside it to a Circle, and you can also add other entire communities to them. (You can also add RSS feeds to them, but if you don't know what that means, don't worry about it yet.) You can make as many Circles as you like, though when you create an account in a Kowloon community, a default "Following" Circle is created for you.

Circles serve three distinct purposes in Kowloon: they let you **choose who can see your content**, they let you **filter your feed**, and they let you **introduce other people to new people to follow**... or filter. 

If you create a Circle and add Kowloon users to it - whether they're in your community or another one - and you address a post or bookmark or anything to that Circle, it means that anyone in that Circle - and **only in that Circle** - can see that post. Not even other people in your community can see it... unless you've added your community itself to the Circle (more on this in a moment). 

Crucially, if you add people to a Circle and address a post to them, it doesn't necessarily mean they'll see it: they have to be following *you* as well. If they don't follow you, it'll always be *available* to them if they look at your timeline or add you to one of their own Circles, but otherwise they won't. It's sort of like sending someone a letter addressed to "general delivery": if they show up at the post free) office to pick it up, great. If not, it'll just sit there waiting. 

If this sounds odd, consider what would happen the second a spammer got ahold of Kowloon: they'd add everyone they could find to a Circle and send boner pill or crypto ads to everyone. And that would violate the first rule of Kowloon Club:

**No one should have access to your eyeballs unless you want them to.**

Secondly, Circles are used to decide what you're seeing in your own feed at any given moment. When you first open Kowloon, your default view is everyone in your default Following Circle, which includes everyone in every one of your Circles. At first that'll be what you want, because you won't follow many people or communities. 

Oh, yes: you can add an entire community to a Circle, as I mentioned. That means you're adding *the feed of all public posts by all users on that community* to your Circle. So if, say, you're a tech nerd and Hacker News creates a Kowloon community and you add @hackernews.com to your "Tech Stuff" Circle, you'll see all public posts to Hacker News mixed into your "Tech Stuff" Circle feed, along with anyone or any other communities you follow. This is really useful for following communities who are dedicated to a particular topic or purpose, whether it's a news outlet or an activist group or *Babylon 5* fans or anything and everything. 

So how do you know *who* to follow, if you don't know who's following *you*? Well, the first way is that **your Circles can also be public, community or visible to another Circle**. So when you first sign up to a Kowloon community, you can browse people's public/community Circles for cool people or communities to follow. You can pick people/communities from their Circles to add to your own or even copy their Circle outright. 

And Circles aren't ust for following: your **block and mute lists are *also* Circles**. When you block someone or mute them, all you're really doing is adding them to one of those Circles... which you can *also* make public if you choose. And you can block or mute *communities* as well as *individuals*. If you do, nothing anyone from any of those communities posts will appear in your feed, they won't be able to reply or react to your posts - even the public ones, as replies and reacts can only be done by logged-in Kowloon users. It'll be like they're reading your article in a newspaper but any letters to the editor they send get shredded before they ever reach your desk. 

So, for example, you could create a Circle called "Nazis and Fascists* and add a list of openly racist or fascist people and communities, and make it public, and anyone could just add those people to their own blocklist *en masse*. But you could *also* make one called Great Musicians or YouTubers I Follow and make it public, and anyone could clone it. (Dynamic shared and collaborative Circles are coming soon!)

So you sign up for Kowloon, go find a few people  and communities to follow, and soon you'll organize them into different Circles: Friends, Close Friends, Family, Family I Actually Like, Work Friends, Work Not Friends, Cool Bands, Deep Thinkers, World News... whatever. And with one click of a menu, you'll switch your Kowloon feed to just see posts from members of that Circle.

You can also filter your timeline by post Type, so you could choose to only see Media from Cool Bands or Family, or short Notes from Work Friends... whatever you choose to see right now. 

## Behind The Scenes (tech stuff ##

Kowloon uses, as mentioned above, a hybrid push/pull federation model. Most Activities are delivered via pull based federation, but some - anything that specifically relates to an external object, such as replying or reacting to a remote Post or joining a remote Group - are delivered to the target server. 

When a user's feed of a given Circle is refreshed - either by the user or via a cron job - their server requests anything that's visible to *that* user from the remote servers of each member of their Circle. The remote server goes through and looks to see what Circles of local users that user is in, if any, and what new items are addressed to those Circles, and returns them. **The requesting user/server have no information about which Circles on the remote server they're in**. The closest metaphor might be going to the post office and asking for any new mail for you. You know who sent you a Christmas card, but not their entire mailing list of everyone they sent a Christmas card to. 

In this sense, Kowloon is far closer to an old school pub/sub model in the traditional sense like RSS syndication than the more prevalent push-based federation used by most Fediverse networks. 

The rationale behind this is *ambiguity*. The switch from syndication (authorized or otherwise) to push-based internal data models in social networks was to build a discrete, quantifiable social graph between users that could be exploited to build social models and analytics of those users. **Kowloon not only doesn't have a social graph, the architecture deliberately discourages i**t. You can't link followers to following except by pure inference. You don't know who's paying attention to you, only who you *choose* to give access to yourself to... if they're listening. 

This is meant to more accurately model real-world human relationships, in which very little is quantified and made plain to all parties. Alice doesn't *know* if Bob regards her as an acquaintance, a buddy or a close friend, or how he compartmentalizes her in his mind at all... except by inference. If he tells her private information and secrets, she can assume he thinks of her as a trusted friend. But in the real world, nobody passes out badges with Circles on them to everyone they know... so neither does Kowloon. 

Unfortunately, this limits security in one sense: it is functionally impossible to do server-side in-data-store encryption of content. A server admin can view anything on the database via raw access. This is only a problem if the server/community admin is untrustworthy, of course. I am actively interested in finding alternative architectures to watch the watchmen; if you can think of a way to encrypt data with an ambiguous audience, please do share. (All user requests are done by their server on their behalf and authenticated by their server, and every post has a cryptographic signature to verify it was posted by the user account it claims to be posted by, but beyond that, I don't know how to protect data any further than that.)