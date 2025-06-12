
import { FaReply, FaRegHeart } from "react-icons/fa";
import { FaLink } from "react-icons/fa6";
import { FaExternalLinkAlt } from "react-icons/fa";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import advancedFormat from "dayjs/plugin/advancedFormat";
import { NavLink } from "react-router-dom";
import UserBar from "./UserBar";
import { useSelector, useDispatch } from "react-redux";
import { showImageModal, setCurrentMedia } from "../../store/ui";

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(advancedFormat);
const Link = (post) => {

    post = post.post;
    const dispatch = useDispatch();
    const showPostMedia = ({src,type}) => {
        dispatch(setCurrentMedia({src,type}));
        dispatch(showImageModal());
    }

    return (<>
        <li key={post.key} className="post Link card w-full shadow-sm p-4 border border-link-100 bg-white">

            <div className="card-body">
            <UserBar actor={post.actor} />
            <h4 className="title font-bold text-lg mb-4"><a href={post.href} target="_blank" rel="noopener noreferrer" title={post.href}><FaLink className="inline" /> <span className="group">{post.title} <FaExternalLinkAlt className="inline opacity-0 group-hover:opacity-100 transition duration-300 -mt-1" /></span></a></h4>
            {post.image && <div className="relative h-64 overflow-hidden w-auto rounded-lg mb-8"><img className="absolute top-1/2 left-0 w-full -translate-y-1/2" src={post.image} onClick={() => showPostMedia({src:post.image,type:"image"}) } /></div>}
            <div className="body" dangerouslySetInnerHTML={{ __html: post.body }}></div>
            <div className="meta text-xs flex mt-4">
                <div className="flex-1 font-bold">
                    <FaLink className="inline text-gray-500 mr-8" title="Link" />
                    <span className="mr-8 "><FaReply className="inline" title="Reply" /> {post.replyCount}</span>
                    <FaRegHeart className="inline" title="React" /> {post.reactCount}

                </div>
                    <div className="flex-none text-right " title={dayjs(post.createdAt).format("ddd MMM DD, YYYY [at] h:mm a zzz")}> <NavLink className="hover:underline decoration-dotted" to={`/posts/${post.id}`}>{dayjs().to(post.createdAt)}</NavLink></div></div>
                </div>
        </li>
    </>)
}

export default Link;