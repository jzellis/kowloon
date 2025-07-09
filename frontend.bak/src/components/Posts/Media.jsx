
import { FaReply, FaRegHeart } from "react-icons/fa";
import { FaRegCirclePlay } from "react-icons/fa6";
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
const Media = (post) => {

    post = post.post;
    const dispatch = useDispatch();
    const showPostMedia = ({src,type}) => {
        dispatch(setCurrentMedia({src,type}));
        dispatch(showImageModal());
    }
    return (<>
        <li key={post.key} className="post Media card w-full shadow-sm p-4 border border-media-100 bg-white">
        <div className="card-body">
            <UserBar actor={post.actor} />
        <h4 className="title font-bold text-lg mb-4"><NavLink className="hover:underline decoration-dotted" to={`/posts/${post.id}`}>{post.title}</NavLink></h4>
            {post.image && <div className="relative h-64 overflow-hidden w-auto rounded-lg"><img className="absolute top-1/2 left-0 w-full -translate-y-1/2" src={post.image} onClick={() => showPostMedia({src:post.image,type:"image"}) } /></div>}
                <div className="my-4 attachments flex gap-4 mb-8">{post.attachments?.map((a, i) => <div key={i}  className="flex-1"><img className="w-full rounded-md" src={a.url} /></div>)}</div>
            <div className="body" dangerouslySetInnerHTML={{ __html: post.body }}></div>
            <div className="meta text-xs flex mt-4">
                <div className="flex-1 font-bold">
                    <FaRegCirclePlay className="inline text-gray-500 mr-8" title="Media" />
                    <span className="mr-8 "><FaReply className="inline" title="Reply" /> {post.replyCount}</span>
                    <FaRegHeart className="inline" title="React" /> {post.reactCount}

                </div>
                    <div className="flex-none text-right " title={dayjs(post.createdAt).format("ddd MMM DD, YYYY [at] h:mm a zzz")}> <NavLink className="hover:underline decoration-dotted" to={`/posts/${post.id}`}>{dayjs().to(post.createdAt)}</NavLink></div></div>
                </div>
        </li>
    </>)
}

export default Media;