
import { FaRegStickyNote, FaReply, FaRegHeart } from "react-icons/fa";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { NavLink } from "react-router-dom";
import UserBar from "./UserBar";
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
const Note = (post) => {

    post = post.post;
    return (<>
        <li key={post.key} className="post Note card w-full shadow-sm p-4 border border-note-100  bg-white">
        <div className="card-body">
                <UserBar actor={post.actor} />
            <div className="body" dangerouslySetInnerHTML={{ __html: post.body }}></div>
            <div className="meta text-xs flex mt-4">
                <div className="flex-1 font-bold">
                    <FaRegStickyNote className="inline text-gray-500 mr-8" title="Note" />
                    <span className="mr-8 "><FaReply className="inline" title="Reply" /> {post.replyCount}</span>
                    <FaRegHeart className="inline" title="React" /> {post.reactCount}

                </div>
                    <div className="flex-none text-right " title={dayjs(post.createdAt).format("ddd MMM DD, YYYY [at] h:mm a zzz")}> <NavLink className="hover:underline decoration-dotted" to={`/posts/${post.id}`}>{dayjs().to(post.createdAt)}</NavLink></div></div>
                    </div>
        </li>
    </>)
}

export default Note;