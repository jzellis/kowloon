import React, { useState, createRef, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { togglePostEditor, setPostType, setPostTitle, setPostLink } from "../../store/global";
import { Editor } from "react-draft-wysiwyg";
import { EditorState, ContentState, convertToRaw } from "draft-js";
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';
import "react-draft-wysiwyg/dist/react-draft-wysiwyg.css";
import Kowloon from "../../lib/kowloon";
const postEditor = (props) => {


    const dispatch = useDispatch();
    const defaultPostAudience = useSelector((state) => state.user.user.prefs.defaultPostAudience);
    const postType = useSelector((state) => state.global.postType);
    const postTitle = useSelector((state) => state.global.postTitle);
    const postLink = useSelector((state) => state.global.postLink);
    const [postContent, setPostContent] = useState("");
    const [postCharCount, setPostCharCount] = useState(0);
    const [postWordCount, setPostWordCount] = useState(0);
    const [postAudience, setPostAudience] = useState(defaultPostAudience);
    const [postReplyAudience, setPostReplyAudience] = useState(defaultPostAudience);
    const [noteLengthWarning, showNoteLengthWarning] = useState(false);
    const [submitActive, setSubmitActive] = useState(false);

    const [postImage, setPostImage] = useState(null);
    const [postImagePreview, setPostImagePreview] = useState(null);
    const [postAttachments, setPostAttachments] = useState([]);
    const [postAttachmentPreviews, setPostAttachmentPreviews] = useState([]);
    const [postAttachmentTitles, setPostAttachmentTitles] = useState([]);
    const [postAttachmentDescriptions, setPostAttachmentDescriptions] = useState([]);
    const user = useSelector((state) => state.user.user);

    const [editorState, setEditorState] = useState(EditorState.createEmpty());
    let imageInput = createRef();
    let attachmentInput = createRef();


    const setEditorStateAndContent = (editorState) => {
        setEditorState(editorState);
        setPostContent(draftToHtml(convertToRaw(editorState.getCurrentContent())))
        setPostCharCount(editorState.getCurrentContent().getPlainText().length);
        setPostWordCount(editorState.getCurrentContent().getPlainText()
            .split(/\S+/)
            .length - 1);
        setSubmitActive(postCharCount > 0 && postWordCount > 0);
        if (postType === "Note" && postCharCount > 500) {
            setSubmitActive(false); 
            showNoteLengthWarning(true);
        } else {
            showNoteLengthWarning(false);
        }
    }

    const resetEditor = () => {
        setEditorState(EditorState.createEmpty());
        dispatch(setPostType(user.prefs.defaultPostType));
        dispatch(setPostTitle(""));
        dispatch(setPostLink(""));
        dispatch(togglePostEditor());
        setPostCharCount(0);
        setPostWordCount(0);
        setPostImage(null);
        setPostImagePreview(null);
        setPostAttachments([]);
        setPostAttachmentPreviews([]);
    }

    const clearImage = () => {
        setPostImage(null);
        setPostImagePreview(null);
    }

    const clearAttachments = () => {
        setPostAttachments([]);
        setPostAttachmentPreviews([]);
    }
    const getPreview = async (url) => {
        if (url.length > 3) {
            let preview = await Kowloon.getUrlPreview(url);
            dispatch(setPostLink(url));
            dispatch(setPostTitle(preview.title));
            if(preview.description){
                const blocksFromHtml = htmlToDraft(preview.description);
                const { contentBlocks, entityMap } = blocksFromHtml;
                const contentState = ContentState.createFromBlockArray(
                contentBlocks,
                entityMap
                );
                setEditorState(EditorState.createWithContent(contentState))
            }
        }
    }

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        setPostImage(file);
        setPostImagePreview(URL.createObjectURL(file));
    }

    const handleAttachmentUpload = (e) => {
        let files = e.target.files;
        const newAttachments = Array.from(postAttachments);
        const newAttachmentPreviews = Array.from(postAttachmentPreviews);
        const newAttachmentTitles = Array.from(postAttachmentTitles);
        const newAttachmentDescriptions = Array.from(postAttachmentDescriptions);

        Array.from(files).map(file => {
            newAttachments.push(file);
            newAttachmentPreviews.push(URL.createObjectURL(file));
            newAttachmentTitles.push(file.name);
            newAttachmentDescriptions.push(file.name);
        })
        setPostAttachments(newAttachments);
        setPostAttachmentPreviews(newAttachmentPreviews);
        setPostAttachmentTitles(newAttachmentTitles);
        setPostAttachmentDescriptions(newAttachmentDescriptions);
        return true;

    }

    const setPostAttachmentTitle = (e, index) => {
        let newAttachmentTitles = Array.from(postAttachmentTitles);
        newAttachmentTitles[index] = e.target.value;
        setPostAttachmentTitles(newAttachmentTitles);
    }

    const setPostAttachmentDescription = (e, index) => {
        let newAttachmentDescriptions = Array.from(postAttachmentDescriptions);
        newAttachmentDescriptions[index] = e.target.value;
        setPostAttachmentDescriptions(newAttachmentDescriptions);
    }

    const removePostAttachment = (index) => {
        let newAttachments = Array.from(postAttachments);
        let newAttachmentPreviews = Array.from(postAttachmentPreviews);
        let newAttachmentTitles = Array.from(postAttachmentTitles);
        let newAttachmentDescriptions = Array.from(postAttachmentDescriptions);
        newAttachments.splice(index, 1);
        newAttachmentPreviews.splice(index, 1);
        newAttachmentTitles.splice(index, 1);
        newAttachmentDescriptions.splice(index, 1);
        setPostAttachments(newAttachments);
        setPostAttachmentPreviews(newAttachmentPreviews);
        setPostAttachmentTitles(newAttachmentTitles);
        setPostAttachmentDescriptions(newAttachmentDescriptions);
        return true;
    }

    const submitPost = async (e) => {
        e.preventDefault();

        let image = postImage ? (await Kowloon.uploadImage(postImage))?.file : null;        
        const rawContentState = convertToRaw(editorState.getCurrentContent());
        const hashtagConfig = {
            trigger: '#',
            separator: ' ',
          }
        const markup = draftToHtml(
        rawContentState, 
        hashtagConfig, 
        // directional, 
        // customEntityTransform
        );

        let activity = {
            type: "Create",
            actorId: user.id,
            bcc: [postAudience],
            object: {
                actorId: user.id,
                type: postType,
                title: postTitle.length > 1 ? postTitle : undefined,
                image: image ? image : undefined,
                source: {
                    content: markup.trim(),
                    mediaType: "text/html"
                },
                bcc: [postAudience],
                replyAudience: postReplyAudience

            }
        }
        console.log(activity);
    }

    return (
        <div className="postEditor modal modal-open modal-scroll h-full">
            <div className="modal-box w-1/2 mx-auto border border-black">
                <h1 className="mb-2">New <select className="select select-ghost select-md" onChange={(e) => { dispatch(setPostType(e.target.value)); if(e.target.value != "Link") dispatch(setPostLink("")) }} value={postType}>
                    <option value="Note">Note</option>
                    <option value="Article">Article</option>
                    <option value="Media">Media</option>
                    <option value="Link">Link</option>
                </select></h1>
                {postType != "Note" && <div className="title mb-2">
                    <input placeholder="Title" className="input input-bordered w-full" type="text" value={postTitle} onChange={(e) => dispatch(setPostTitle(e.target.value))} />
                </div>}
                {postType == "Link" && <div className="link mb-2">
                    <input placeholder="Link URL" className="input input-bordered w-full" type="text" value={postLink} onChange={(e) => dispatch(setPostLink(e.target.value))} onBlur={(e) => getPreview(e.target.value)} />
                </div>}

                {postType == "Media" && <div className="media">

                    <ul className="grid grid-cols-2 gap-2">
                        {postAttachments.map((attachment, index) =>
                            <li key={index} className="card card-compact shadow-xl w-full">
                                {attachment.type.split("/")[0].toLowerCase() === "image" &&
                                    <figure>
                                        <button  onClick={() => removePostAttachment(index)} className="btn btn-sm btn-circle bg-red-500 hover:bg-red-500 text-black hover:text-white border-black absolute right-2 top-2">✕</button>
                                                                    <img src={postAttachmentPreviews[index]} alt=""  /></figure>}
                                <div className="card-body">

                                {attachment.type.split("/")[0].toLowerCase() === "video" && <video src={postAttachmentPreviews[index]} alt="" className="rounded-md mx-auto max-h-40" type={attachment.type} controls />}
                                    {attachment.type.split("/")[0].toLowerCase() === "audio" && <audio src={postAttachmentPreviews[index]} alt="" className="rounded-md mx-auto max-h-40" type={attachment.type} controls />}
                                    <input placeholder="Title" className=" input input-bordered w-full" type="text" value={postAttachmentTitles[index]} onChange={(e) => setPostAttachmentTitle(e, index)} />

                                </div>
                            </li>
                            )}
                    </ul>
                
                    <input type="file" multiple accept="image/*, video/*, audio/*" className="hidden" ref={attachmentInput} onChange={handleAttachmentUpload} />
                    <button onClick={() => attachmentInput.current.click()} className="btn btn-default">Add Media</button>
                </div>
                }
                {postImage && <div className="image mb-2"><img src={postImagePreview} alt="" className="rounded-md mx-auto max-h-40" /><button onClick={clearImage} className="btn btn-default">Remove</button></div>}
                <div className="content mb-2 mt-5">
                    <Editor
                        editorState={editorState}
                        onEditorStateChange={setEditorStateAndContent}
                        editorClassName="postContentEditor"
                        toolbarClassName="postContentEditorToolbar"
                        // toolbarHidden={postType === "Note"}
                        toolbar={
                            {
                                options: ['inline', 'list', 'link'],
                                inline: {
                                inDropdown: false,
                                className: undefined,
                                component: undefined,
                                dropdownClassName: undefined,
                                options: ['bold', 'italic', 'underline', 'monospace'],
                            },
                                list: {
                                  inDropdown: false,
                                  className: undefined,
                                  component: undefined,
                                  dropdownClassName: undefined,
                                  options: ['unordered', 'ordered', 'indent', 'outdent'],
                                },
                              }
                        }
                    />
                </div>
                {postType === "Article" && <div>Word count: {postWordCount}</div>}
                {postType != "Media" && <div className="imageUploader">
                    <input type="file" className="hidden" ref={imageInput} onChange={handleImageUpload} accept="image/*" />
                    <button onClick={() => imageInput.current.click()} className="btn btn-default">Upload Image</button>
                </div>
                }
                <div className="audience flex max-w-fit">
                <select className="select w-full" value={postAudience} onChange={(e) => setPostAudience(e.target.value)}>
                        <option value="@_public">Public</option>
                        <option value="@_server">Server Only</option>
                        {user.circles.map((c) => <option key={c.id} value={`${c.id}`}>{c.name}</option>)}

                    </select>
                    
                </div>

                <div className="replyAudience flex max-w-fit">
                <select className="select w-full" value={postReplyAudience} onChange={(e) => setPostReplyAudience(e.target.value)}>
                        <option value="@_public">Public</option>
                        <option value="@_server">Server Only</option>
                        {user.circles.map((c) => <option key={c.id} value={`${c.id}`}>{c.name}</option>)}

                    </select>
                    
                </div>               
                <div>
                    <span className={`${noteLengthWarning ? "text-error" : "hidden"}`}>Notes can only be 500 characters max.</span>
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={resetEditor} className="btn btn-default">Cancel</button>
                    <button disabled={!submitActive} onClick={submitPost} className="btn btn-primary">Post</button>

                </div>
            </div>
        </div>
    );
}

export default postEditor;