/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

import { useSelector, useDispatch } from "react-redux";
import {
  togglePostEditor,
  showNotification,
  setPosts,
  setActors,
} from "../../store/ui";
import Kowloon from "../../lib/Kowloon";

const modules = {
  toolbar: [
    [{ header: [1, 2, false] }],
    ["bold", "italic", "underline", "strike", "blockquote"],
    [
      { list: "ordered" },
      { list: "bullet" },
      { indent: "-1" },
      { indent: "+1" },
    ],
    ["link", "image"],
    ["clean"],
  ],
};
// End Draft

export default function PostEditor(props) {
  const dispatch = useDispatch();
  const showEditor = useSelector((state) => state.ui.postEditorOpen);
  const user = useSelector((state) => state.user);
  const actor = useSelector((state) => state.user.actor);
  const [activityType, setActivityType] = useState("Create");
  const [postType, setPostType] = useState("Note");
  const [name, setName] = useState();
  const [image, setImage] = useState();
  const [content, setContent] = useState();
  const [url, setUrl] = useState();
  const [tags, setTags] = useState([]);
  const [isPublic, setIsPublic] = useState(false);
  const [publicCanComment, setPublicCanComment] = useState(false);
  const [canComment, setCanComment] = useState([]);
  const [circles, setCircles] = useState([]);

  const [to, setTo] = useState([]);
  const [bto, setBto] = useState([]);
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [inReplyTo, setInReplyTo] = useState(undefined);

  useEffect(() => {
    if (user.actor) setCircles(user.actor.circles);
    if (user.actor) setTo([user.actor.id]);
  }, [user]);

  const updateContent = (e) => {
    setContent(e);
    localStorage.setItem("draft", e);
  };

  const changePostType = (e) => {
    setPostType(e.target.value);
    if (e.target.value === "Note") {
      setImage(null);
      setName(null);
      setUrl(null);
      setTags(null);
    }
  };
  const addPost = async (e) => {
    e.preventDefault();
    const activity = {
      type: activityType,
      actor: actor.id,
      object: {
        inReplyTo,
        type: postType,
        actor: actor.id,
        name,
        source: { content },
        url: url && url,
        tags,
        image: image
          ? {
              mediaType: `text/${
                image.split(".")[image.split(".").length - 1]
              }`,
              url: image,
            }
          : undefined,
      },
      to: [actor.id],
      bto,
      cc,
      bcc,
      public: isPublic,
      publicCanComment,
      whoCanComment: canComment && canComment,
    };
    let addResponse = await Kowloon.post({
      url: user.actor.outbox,
      body: activity,
    });

    setName();
    setContent("");
    setPostType(user.prefs.defaultPostType);
    setIsPublic(user.prefs.defaultIsPublic);
    setPublicCanComment(user.prefs.defaultPublicCanComment);
    setTo([]);
    setBto([]);
    setCc([]);
    setBcc([]);
    localStorage.setItem("draft", "");
    dispatch(
      showNotification({
        type: "success",
        message: addResponse.summary.actor,
      })
    );
    dispatch(togglePostEditor());
    // reload the timeline
    window.scrollTo(0, 0);
    window.location.reload();
  };

  // useEffect(() => {
  //   let user = JSON.parse(localStorage.getItem("user"));
  //   setUser(user);
  //   user && setActor(user.actor);
  //   setContent(localStorage.getItem("draft"));
  //   user && setIsPublic(user.prefs.defaultIsPublic || false);
  //   user && setPublicCanComment(user.prefs.defaultPublicCanComment || false);
  //   user && setCircles(user.actor.circles);

  //   const getCircles = async () => {
  //     if (actor) {
  //       const token = localStorage.getItem("token");
  //       const creq = await fetch(actor.id + "/c/", {
  //         headers: {
  //           authorization: "Bearer " + token,
  //         },
  //       });
  //       let collection = await creq.json();
  //       console.log(collection);
  //       setCircles(collection.items);
  //     }
  //   };

  //   getCircles();
  // }, []);

  const linkPreview = async (e) => {
    const preview = await (
      await fetch("http://localhost:3001/api/preview?url=" + e.target.value)
    ).json();
    console.log(preview);
    setUrl(e.target.value);
    setName(preview.title);
    setContent(preview.description);
    setImage(preview.images ? preview.images[0] : undefined);
  };

  return (
    <div
      data-te-animation-init
      data-te-animation-reset="true"
      data-te-animation="[slide-right_1s_ease-in-out]"
      className={`postEditorModal ${showEditor === false && "hidden"}`}
      onClick={() => dispatch(togglePostEditor)}
    >
      <div
        className={`postEditorBox w-full ${
          postType !== "Article"
            ? "sm:w-1/3 sm:max-w-1/3"
            : "sm:w-1/2 sm:max-w-1/2"
        } `}
      >
        <div className="postEditorWrapper">
          <div className="form-control mb-8 grid grid-cols-2">
            <label className="label text-right col=span-1">
              <span className="label-text text-right">Add New</span>
            </label>
            <div className="col-span-1">
              <select
                className="select"
                defaultValue={postType}
                onChange={changePostType}
              >
                <option value="Note">Note</option>
                <option value="Article">Article</option>
                <option value="Media">Media</option>
                <option value="Link">Link</option>
              </select>
            </div>
          </div>
          <div className="postEditorEditorWrapper">
            <div
              className={`${postType === "Link" ? "visible" : "hidden"} mb-4`}
            >
              <input
                className="input input-bordered w-full"
                placeholder="Link"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={linkPreview}
              ></input>
            </div>
            <div
              className={`${postType !== "Note" ? "visible" : "hidden"} mb-4`}
            >
              <input
                className="input input-bordered w-full"
                placeholder="Post Title (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              ></input>
            </div>
            <div className={`image ${!image && "hidden"}`}>
              <img src={image} alt="" />
            </div>
            <ReactQuill
              theme="snow"
              className={`postEditor ${postType}`}
              value={content}
              modules={modules}
              onChange={(e) => updateContent(e)}
            ></ReactQuill>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Public</span>{" "}
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={isPublic}
                onChange={(e) => setIsPublic(!isPublic)}
              />
            </label>
            <label className="label">
              <span className="label-text">Public Can Comment</span>{" "}
              <input
                type="checkbox"
                className="toggle toggle-success"
                checked={publicCanComment}
                onChange={(e) => setPublicCanComment(!publicCanComment)}
              />
            </label>
          </div>
          <div
            className={`${
              isPublic === false ? "visible" : "hidden"
            } grid grid-cols-2`}
          >
            <label className="label">View Circles</label>
            <select
              className="select select-bordered"
              multiple
              onChange={(e) =>
                setBcc((oldBcc) =>
                  [].concat(oldBcc, circles[e.target.value].items)
                )
              }
            >
              {circles.map((c, i) => (
                <option key={`circle-${i}`} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
            <label className="label">Comment Circles</label>
            <select
              className="select select-bordered"
              multiple
              onChange={(e) =>
                setCanComment((oldCanComment) =>
                  [].concat(oldCanComment, circles[e.target.value].items)
                )
              }
            >
              {circles.map((c, i) => (
                <option key={`circle-${i}`} value={i}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-action">
            <label
              htmlFor="my_modal_6"
              className="btn btn-ghost"
              onClick={() => dispatch(togglePostEditor())}
            >
              Cancel
            </label>
            <button onClick={addPost} className="btn btn-success">
              Add {postType}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
