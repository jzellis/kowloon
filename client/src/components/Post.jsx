/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime";
import { FaLink, FaReply } from "react-icons/fa"
import {BiLike, BiSolidLike} from "react-icons/bi"
import Kowloon from "../lib/Kowloon";
import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";
dayjs.extend(relativeTime)
const Post = ({ activity, className }) => {

    const user = Kowloon.user;
    const postRef = useRef(null);
    const showNotes = useSelector(state => state.ui.showNotes)
    const showArticles = useSelector(state => state.ui.showArticles)
    const showMedia = useSelector(state => state.ui.showMedia)
    const showLinks = useSelector(state => state.ui.showLinks)
    const showRead = useSelector(state => state.ui.showRead)
    const [showContent, toggleShowContent] = useState(false);

    useEffect(() => { 
        if (user) {
            const postObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) Kowloon.markActivityAsRead(activity.id);
            });
            postObserver.observe(postRef.current);
        }
    }, []);

    return (<li className={`post ${activity.object && activity.object.type} 
    ${(activity.object.type == "Note" && !showNotes) && "hidden"}
    ${(activity.object.type == "Article" && !showArticles) && "hidden"}
    ${(activity.object.type == "Media" && !showMedia) && "hidden"}
    ${(activity.object.type == "Link" && !showLinks) && "hidden"}

`} key={activity.id} data-id={activity.object.id}>
        
        <div className="flex">
            {activity.object.actor.icon && <div className="flex-none w-12 mr-2">
                <img src={activity.object.actor.icon.url} className="avatar w-full h-auto rounded-full" />
            </div>}
            <div className="flex-1 mr-8">
                <div className="post-author-name"><a href={activity.object.actor.profile}>{activity.object.actor.name}</a></div>

                <div className="post-author-id">{activity.object.actor.id}</div>
            <div className="post-meta">
                <a href={activity.object.id} title={dayjs(activity.object.published).format("MMM D, YYYY @ h:mma")}>
                    <FaLink className="inline" /> {dayjs(activity.object.published).fromNow()}
                </a>
            </div>
            {activity.object.name && <div className="post-title"><a href={activity.object.id}>{activity.object.name}</a></div>}

                <div className={`post-body w-full flex-none ${
            showContent === false && "line-clamp-[8]"
                    }`} dangerouslySetInnerHTML={{ __html: activity.object.content }} />
                {(activity.object.content.length > 660) && <div className="mt-4 text-right text-xs cursor-pointer" onClick={() => toggleShowContent(!showContent)}>Click to show {showContent ? "less" : "more"}...</div>}
                <div className="post-footer">
            <div className={`${activity.publicCanComment ? "cursor-pointer" : "opacity-50"}`}><FaReply className="inline" /> ({activity.object.replies.items.length})</div>
                    <div className="cursor-pointer" onClick={() => Kowloon.likeActivity(activity)}>{(user && user.actor.id) && activity.object.likes.items.indexOf(user.actor.id) >= 0 ? <BiSolidLike className="inline" /> : <BiLike className="inline" />}  ({activity.object.likes.items.length})</div>
            <div>Share</div>

                </div>
            </div>
            
        </div>
        <div className="relative -bottom-48" ref={postRef}></div>

    </li>)

}

export default Post;