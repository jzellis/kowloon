import React, { useState, useEffect } from "react";
import { BsCardText, BsFileText, BsImage, BsLink45Deg } from "react-icons/bs";

const TimelineItem = (props) => {
    let post = props.post;
    return <li className={`post ${post.type}`} key={post.key}>
        <div className="grid grid-cols-12 gap-4">
            <div className="col-span-1 pt-2"><a className="cursor-pointer" href={`/users/${post.actor?.username}`}><img className="avatar w-full rounded-full" src={post.actor?.profile.avatar} alt={post.actor?.id} /></a></div>
            <div className="postContent col-span-11">
        <div className="meta flex z-50">
            <div className="user flex-1"><a href={`/users/${post.actor?.username}`}><span className="font-bold">{post.actor?.profile.name}</span> <span className="text-gray-400 ml-1">({post.actor?.id})</span></a></div>
            <div className="postType flex-none">
                {post.type === "Note" ? <BsCardText /> : null}
                {post.type === "Article" ? <BsFileText /> : null}
                {post.type === "Media" ? <BsImage /> : null}
                {post.type === "Link" ? <BsLink45Deg /> : null}
            </div>
        </div>

        {post.image && <div className="postImage">
            <img src={post.image} alt={post.id} />
            <div className="absolute inset-0"><div className="title">{post.title}</div></div>
        </div>}
        {!post.image && <div className="title">{post.title}</div>}
       

        <div className='content' dangerouslySetInnerHTML={{ __html: post.source.content }}></div>
        <ul className="actions">
            <li><a>{post.replyCount > 1 ? "Replies" : "Reply"} <span className="text-xs">({post.replyCount})</span></a></li>
        <li><a>React <span className="text-xs">({post.reactCount})</span></a></li>
        <li><a>Share <span className="text-xs">({post.shareCount})</span></a></li>

                </ul>
                </div>
            </div>
    </li>;
};

export default TimelineItem;