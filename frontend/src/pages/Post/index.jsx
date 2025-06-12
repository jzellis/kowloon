import { useParams } from "react-router-dom"
import { useState, useEffect, use } from "react";
import Kowloon from "../../lib/Kowloon";
import Reply from "../../components/Reply";
import dayjs from "dayjs";
import "./index.css";
const Post = () => {

  let {id} = useParams();
  let [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);

  useEffect(() => {


    const getPost = async (id) => {
      let req = await Kowloon.getPost(id);
      setPost(req.post);
      req = await Kowloon.getPostReplies(id);
      setReplies(req.items);
    }
    getPost(id);
  }, []);

  console.log(post);

  return (
    <>
      <div className="post w-2/3">
      {post?.image && (<div class={`w-full h-[400px] overflow-hidden relative inline-block align-middle rounded-lg bg-gray-400 my-8`}>
              <img
                src={post.image}
                      alt={post.title}
                class="absolute top-1/2 left-1/2 w-auto h-full -translate-x-1/2 -translate-y-1/2 object-cover"
              />
            </div>)}

        <div className="border-b border-gray-400 pb-4"><div className="title font-bold text-3xl align-middle">{post?.title}</div><div className="text-right text-sm"><span className="font-bold">{post?.actor?.id}</span> <span>{dayjs(post?.createdAt).format("MMM DD, YYYY [@] h:mm a zzz")}</span></div></div>
        <div className="body  pt-[1em] mt-8" dangerouslySetInnerHTML={{ __html: post?.body }}></div>
        <ul id="replies" className="replies text-sm mx-8">
        {replies && replies.map((reply) => <li key={reply.id} className="mb-8"><Reply reply={reply} /></li>)}
      </ul>
      </div>

      </>
    )
  }
  
  export default Post