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
import Kowloon from "../../lib/Kowloon";
import endpoints from "../../lib/endpoints";
dayjs.extend(relativeTime);
export default function Post(props) {
  let { actor, className, activity } = props;
  const [showContent, toggleContent] = useState(false);
  const [showImageModal, toggleImageModal] = useState(false);
  const [showReplies, toggleReplies] = useState(false);
  const user = useSelector((state) => state.user);
  const [post, setPost] = useState(activity.object);
  if (actor) post.actor = actor;
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

    let addResponse = await Kowloon.post({
      url: user.actor.outbox,
      body: commentActivity,
    });
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
      actor: user.actor.id,
      target: post.id,
    };

    let likeResponse = await Kowloon.post({
      url: user.actor.outbox,
      body: likeActivity,
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
      <div
        className={`post-image-modal cursor-pointer top-0 left-0 w-screen h-screen ${
          showImageModal ? "absolute visible" : "relative hidden"
        }`}
        onClick={() => toggleImageModal(false)}
      >
        <div className="absolute w-full text-center mx-auto flex justify-center items-center">
          <img
            src={image}
            className="absolute top-0 mx-auto h-screen z-[9999] opacity-100 "
          />
        </div>
        <div className="absolute z-[9998] post-image-modal-overlay top-0 left-0 w-full h-full bg-black opacity-50"></div>
      </div>

      {post.name && (
        <div className={`title ${post.url ? "hover:underline" : ""}`}>
          <a href={post.url}>{post.name}</a>
        </div>
      )}
      <div className={`mb-4 flex rounded p-2 `}>
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
            <a
              href={`${post.id}`}
              className="hover:link"
              title={dayjs(published).format("MMM DD, YYYY hh:mma")}
            >
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
        <div
          title="Click to expand"
          onClick={() => {
            toggleImageModal(!showImageModal);
          }}
        >
          <img src={image} className="rounded-xl w-full cursor-pointer" />
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
      <div className={`mt-4 tooltip`} data-tip="Click to expand">
        <div
          className={`body text-left ${
            showContent === false && "line-clamp-[12]"
          }`}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
        <div
          className={`text-right text-xs cursor-pointer pt-4 hover:underline ${
            post.content.length < 600 && "hidden"
          }`}
          onClick={(e) => toggleContent(!showContent)}
        >
          Show {showContent ? "Less" : "More"}
        </div>
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
        <ul className="comments my-4 lg:mx-8">
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
                    <div className="font-bold">
                      {comment.actor && comment.actor.name}
                    </div>
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
