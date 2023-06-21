/* eslint-disable no-unused-vars */
/* eslint-disable jsx-a11y/alt-text */
import { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { GrArticle, GrMultimedia, GrMore, GrLike } from "react-icons/gr";
import {
  FaStickyNote,
  FaLink,
  FaLock,
  FaComment,
  FaShare,
  FaBookmark,
  FaRegBookmark,
} from "react-icons/fa";
dayjs.extend(relativeTime);
export default function Note(props) {
  let { actor, className, activity } = props;
  const [showContent, toggleContent] = useState(false);
  const [showReplies, toggleReplies] = useState(false);
  const user = useSelector((state) => state.user.user);
  const [post, setPost] = useState(activity.object);
  const [image, setImage] = useState(
    activity.object.image ? activity.object.image.url : ""
  );

  const published = activity.published,
    isPublic = activity.public;
  const [commentBody, setCommentBody] = useState("");

  const addComment = async (e) => {
    e.preventDefault();
    const commentActivity = {
      type: "Create",
      actor: user.actor,
      object: {
        type: "Note",
        inReplyTo: post.id,
        source: { content: commentBody },
        published: Date.now(),
      },
      public: post.public,
      publicCanComment: false,
    };

    let addResponse = await fetch(user.actor.outbox, {
      method: "POST",
      headers: {
        authorization: "Bearer " + localStorage.getItem("token"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commentActivity),
    });
    let createdComment = await addResponse.json();
    commentActivity.object.content = commentActivity.object.source.content;
    commentActivity.object.actor = user.actor;

    setPost((currentPost) => {
      return {
        ...currentPost,
        replies: {
          items: currentPost.replies.items.concat(commentActivity.object),
        },
      };
    });
    setCommentBody("");
  };

  const addLike = async (e) => {
    e.preventDefault();
    const likeActivity = {
      type: "Like",
      actor: user.actor,
      target: post.id,
      // object: {
      //   type: "Note",
      //   inReplyTo: post.id,
      //   source: { content: commentBody },
      //   published: Date.now(),
      // },
      // _kowloon: {
      //   isPublic: activity.public,
      //   canComment: true,
      //   publicCanComment: activity.public,
      // },
    };
    console.log(likeActivity);

    let likeResponse = await fetch(user.actor.outbox, {
      method: "POST",
      headers: {
        authorization: "Bearer " + localStorage.getItem("token"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(likeActivity),
    });
    setPost((currentPost) => {
      return {
        ...currentPost,
        likes: {
          totalItems: currentPost.likes.totalItems
            ? parseInt(currentPost.likes.totalItems) + 1
            : 1,
        },
      };
    });
  };
  return (
    <>
      {post.name && (
        <div className={`title ${post.url ? "hover:underline" : ""}`}>
          <a href={post.url}>{post.name}</a>
        </div>
      )}
      <div
        className={`mb-4 flex rounded p-2 
        

        `}
      >
        <div className="flex-none">
          {post.actor && post.actor.icon && (
            <a href={post.actor.id}>
              <img
                src={post.actor.icon.url}
                className={`avatar rounded-full w-12 mr-2 border-4 ${
                  post.type === "Note" && "border-green-200"
                }
                ${post.type === "Article" && "border-yellow-200"}
                ${post.type === "Image" && "border-blue-200"}
                ${post.type === "Link" && "border-purple-200"}`}
                alt={post.actor.name}
              />
            </a>
          )}
        </div>

        <div className="flex-1">
          <div className="text-sm author font-semibold">
            {post.type === "Note" && (
              <FaStickyNote
                className="avatar  mr-2 tooltip"
                data-tip={post.type}
              />
            )}
            {post.type === "Article" && (
              <GrArticle className="avatar mr-2 tooltip" data-tip={post.type} />
            )}
            {post.type === "Image" && <GrMultimedia className="avatar mr-2" />}
            {post.type === "Link" && <FaLink className="avatar mr-2" />}
            {isPublic === false && <FaLock className="avatar mr-2" />}
            <a href={`/@${post.actor && post.actor.preferredUsername}`}>
              {post.actor && post.actor.name}
            </a>
          </div>

          <div className=" text-sm date mr-2">
            <a href={`${post.id}`} className="hover:link">
              {dayjs(published).fromNow()}
            </a>
          </div>
        </div>
        <div className="text-right flex-1">
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-ghost">
              <GrMore />
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-xl border border-gray-200 bg-base-100 w-48 text-sm z-50"
            >
              <li className="cursor-pointer hover:font-bold">Edit Post</li>
              <li className="cursor-pointer hover:font-bold">Delete Post</li>
              <li className="cursor-pointer hover:font-bold">Bookmark Post</li>
              <li className="cursor-pointer hover:font-bold">
                Mark Post As Read
              </li>
            </ul>
          </div>
        </div>
      </div>
      {image && (
        <div>
          <a href={post.url && post.url}>
            <img src={image} className="rounded-xl w-full" />
          </a>
        </div>
      )}
      {post.attachment && (
        <div className="grid grid-cols-3 gap-2 mt-2 justify-items-center mx-auto">
          {post.attachment.map((a, i) => (
            <img
              key={`image-${i}`}
              src={a.url}
              className="h-full cursor-pointer rounded-lg"
              onClick={() => setImage(a.url)}
            />
          ))}
        </div>
      )}
      {post.url && (
        <div className="text-gray-400 text-sm text-center">
          <a href={post.url}>{post.url}</a>
        </div>
      )}
      <div
        className={`mt-4 tooltip`}
        data-tip="Click to expand"
        onClick={(e) => toggleContent(!showContent)}
      >
        <div
          className={`body text-left ${
            showContent === false && "line-clamp-6"
          }`}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
      </div>
      <div className="actions flex w-4/5 mx-auto justify-items-stretch text-center mt-2 text-gray-500 text-sm">
        <div
          className={`flex-1 ${
            activity.public
              ? "hover:text-black cursor-pointer"
              : "text-gray-200 cursor-default"
          } `}
          title="Comments"
          onClick={() =>
            activity.public ? toggleReplies(!showReplies) : false
          }
        >
          <FaComment className="avatar" /> (
          {post.replies ? post.replies.items.length : "0"})
        </div>
        <div
          className="flex-1 hover:text-black cursor-pointer"
          title="Likes"
          onClick={addLike}
        >
          <GrLike className="avatar" /> ({post.likes && post.likes.totalItems})
        </div>
        <div className="flex-1 hover:text-black cursor-pointer" title="Share">
          <FaShare className="avatar" />
        </div>
        <div
          className="flex-1 hover:text-black cursor-pointer"
          title="Bookmark"
        >
          <FaRegBookmark className="avatar" />
        </div>
      </div>
      <div className={`comments mt-4 ${!showReplies && "hidden"}`}>
        Comments ({post.replies ? post.replies.items.length : "0"})
        <ul className="comments my-4 mx-8">
          {post.replies &&
            post.replies.items.map((comment, idx) => {
              return (
                <li
                  key={`comment-${idx}`}
                  className="flex bg-gray-200 rounded-lg p-2 text-sm mb-2"
                >
                  <div className="flex-none mr-2">
                    {comment.actor && comment.actor.icon && (
                      <img
                        src={comment.actor.icon.url}
                        className="avatar h-12"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold">{comment.actor.name}</div>
                    <div
                      dangerouslySetInnerHTML={{ __html: comment.content }}
                    ></div>
                    <div className="text-right text-xs text-gray-400">
                      {dayjs(comment.published).fromNow()}
                    </div>
                  </div>
                </li>
              );
            })}
        </ul>
        <div className="commentForm mx-8">
          <textarea
            className="w-full textarea textarea-bordered"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
          ></textarea>
          <div className="text-right mt-2">
            <button
              disabled={commentBody.length < 1}
              className="btn btn-xs"
              onClick={addComment}
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
