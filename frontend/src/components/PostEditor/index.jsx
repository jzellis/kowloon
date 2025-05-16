import Kowloon from "../../lib/Kowloon";
import { useState, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import {togglePostEditor, showPostEditor, hidePostEditor} from "../../store/ui"
import { GrDocumentText } from "react-icons/gr";
import { FaL, FaLink, FaLinkSlash, FaRegCirclePlay } from "react-icons/fa6";
import { FaRegStickyNote, FaReply, FaRegHeart, FaRegEye } from "react-icons/fa";
import { FaBold, FaItalic, FaUnderline, FaIndent } from "react-icons/fa";
import { BsTypeH1, BsTypeH2, BsTypeH3 } from "react-icons/bs";
// This is the TipTap editor stuff
import { useEditor, EditorContent, FloatingMenu, BubbleMenu } from '@tiptap/react'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import "./index.css"

const PostEditor = (props) => {

    let user = useSelector((state) => state.user.user);
    let circles = useSelector((state) => state.user.circles);
    let server = useSelector((state) => state.server.server);
    let postEditorOpen = useSelector((state) => state.ui.showPostEditor);
    let dispatch = useDispatch();

    const [postType, setPostType] = useState(user?.prefs?.defaultPostType || props.postType || "Note");
    const [title, setTitle] = useState(props.title || "");
    const [to, setTo] = useState(user?.prefs?.defaultTo || props.to || "@public");
    const [advanced, showAdvanced] = useState(false);
    const [replyTo, setReplyTo] = useState(user?.prefs?.defaultReplyTo || props.replyTo || "@public");
    const [reactTo, setReactTo] = useState(user?.prefs?.defaultReactTo || props.reactTo || "@public");
    const [content, setContent] = useState(props.content || "");
    const [wordCount, setWordCount] = useState(props.wordCount || 0);
    const [charCount, setCharCount] = useState(props.charCount || 0);
    const [href, setHref] = useState(props.href || "");
    const [image, setImage] = useState(props.image || "");
    const [attachments, setAttachments] = useState(props.attachments || []);
    const [tags, setTags] = useState([]);

    const changePostType = (type) => {
        setPostType(type);
        if (type != "Link") setHref("");
        if (type === "Note") {
            setTitle("");
            setImage("");
            setAttachments(null);
            setTags(null);
        }
    }

    const getLinkPreview = async (e) => {
        let url = e.target.value;
        const parsedUrl = url.includes(':') ? new URL(url) : new URL(`https://${url}`);
        setHref(parsedUrl.href);
        let preview = await Kowloon.getLinkPreview(parsedUrl.href);
        console.log(preview);
        setTitle(preview.title || "");
        setImage(preview.image || "");
        setContent(preview.summary || ""); editor.commands.setContent(preview.summary || "", true)
    }
    
    const extensions = [
        StarterKit,
        Underline,
        Link.configure({
            openOnClick: false,
            autolink: postType === "Article",
            defaultProtocol: 'https',
            protocols: ['http', 'https'],
            isAllowedUri: (url, ctx) => {
              try {
                // construct URL
                const parsedUrl = url.includes(':') ? new URL(url) : new URL(`${ctx.defaultProtocol}://${url}`)
    
                // use default validation
                if (!ctx.defaultValidate(parsedUrl.href)) {
                  return false
                }
      
                // disallowed protocols
                const disallowedProtocols = ['ftp', 'file', 'mailto']
                const protocol = parsedUrl.protocol.replace(':', '')
    
                if (disallowedProtocols.includes(protocol)) {
                  return false
                }
    
                // only allow protocols specified in ctx.protocols
                const allowedProtocols = ctx.protocols.map(p => (typeof p === 'string' ? p : p.scheme))
    
                if (!allowedProtocols.includes(protocol)) {
                  return false
                }
    
                // disallowed domains
                const disallowedDomains = ['example-phishing.com', 'malicious-site.net']
                const domain = parsedUrl.hostname
    
                if (disallowedDomains.includes(domain)) {
                  return false
                }
    
                // all checks have passed
                return true
              } catch {
                return false
              }
            },
            shouldAutoLink: url => {
              try {
                // construct URL
                const parsedUrl = url.includes(':') ? new URL(url) : new URL(`https://${url}`)
    
                // only auto-link if the domain is not in the disallowed list
                const disallowedDomains = ['example-no-autolink.com', 'another-no-autolink.com']
                const domain = parsedUrl.hostname
    
                return !disallowedDomains.includes(domain)
              } catch {
                return false
              }
            },
    
          }),
    ]

    const editor = useEditor({
        extensions,
        content,
        onUpdate: ({ editor }) => {
            console.log(editor.state.doc.textContent);
            setContent(editor.getHTML());
            setWordCount(editor.state.doc.textContent.split(" ").length);
            setCharCount(editor.state.doc.textContent.length);
        },
        editorProps: {
            attributes: {
                placeholder: "Type something...",
                class: "textarea w-full focus:outline-none"
            }
        }
    
    })
    
    const setLink = useCallback(() => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)
    
        // cancelled
        if (url === null) {
          return
        }
    
        // empty
        if (url === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink()
            .run()
    
          return
        }
    
        // update link
        try {
          editor.chain().focus().extendMarkRange('link').setLink({ href: url })
            .run()
        } catch (e) {
          alert(e.message)
        }
      }, [editor])
    return (<>
        <div className="absolute bottom-10 right-10 tooltip" data-tip="Create New Post"><div className="btn btn-lg btn-primary rounded-full shadow-2xl z-50" onClick={() => dispatch(showPostEditor())}>+</div></div>
        <div id="postEditor" className={`bg-base-100 ${postType} modal modal-bottom sm:modal-middle ${postEditorOpen ? "modal-open" : ""}`}>
            <div className="modal-box">
            <div className="text-right w-full pb-8"><button className="absolute right-2 top-2 btn btn-sm btn-circle btn-ghost" onClick={() => dispatch(hidePostEditor())}>✕</button></div>

                <div className="flex justify-between">
                    <h3 className="text-2xl flex-1">Create New {postType}</h3>
                    <div className="flex-none text-2xl">
                        <FaRegStickyNote className={`inline mr-2 cursor-pointer ${postType === "Note" ? "text-gray-500" : "text-gray-300"}`} onClick={() => { changePostType("Note") }} />
                        <GrDocumentText className={`inline mr-2 cursor-pointer ${postType === "Article" ? "text-gray-500" : "text-gray-300"}`} onClick={() => { changePostType("Article") }} />
                        <FaLink className={`inline mr-2 cursor-pointer ${postType === "Link" ? "text-gray-500" : "text-gray-300"}`} onClick={() => { changePostType("Link") }} />
                        <FaRegCirclePlay className={`inline mr-2 cursor-pointer ${postType === "Media" ? "text-gray-500" : "text-gray-300"}`} onClick={() => { changePostType("Media") }} />
                    </div>
                </div>
                {postType == "Link" && (<fieldset className="form-control mt-4">
                    <input className="input p-4 w-full font-mono" value={href} placeholder={`Add your linked URL here` } onChange={(e) => setHref(e.target.value)} onBlur={getLinkPreview} />
            </fieldset>
                )
                }

                {postType != "Note" && (<fieldset className="form-control mt-4">
                    <input className="input input-lg w-full" value={title} placeholder={`Add your ${postType.toLowerCase()}'s title here` } onChange={(e) => setTitle(e.target.value)} />
            </fieldset>
                )
                }
                {image && <div className="image mt-4"><img src={image} className="w-full h-auto rounded-lg" /></div>}
                <div className="editor my-8">
                    <ul className={`editor-toolbar join mb-2 ${postType == "Note" && "hidden"}`}>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('bold') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()}><FaBold /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('italic') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()}><FaItalic /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('underline') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!editor.can().chain().focus().toggleUnderline().run()}><FaUnderline /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('blockquote') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={!editor.can().chain().focus().toggleBlockquote().run()}><FaIndent /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('heading',{level:1}) ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleHeading({level:1}).run()} ><BsTypeH1 /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('heading',{level:2}) ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleHeading({level:2}).run()} ><BsTypeH2 /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('heading',{level:3}) ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleHeading({level:3}).run()} ><BsTypeH3 /></li>
                        {!editor.isActive("link") && <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('link') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={setLink} ><FaLink /></li>}
                        {editor.isActive("link") && <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('link') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().unsetLink().run()} ><FaLinkSlash /></li>}
                    </ul>
                    <EditorContent
                        editor={editor}
    
                    >
                        <FloatingMenu editor={editor}></FloatingMenu>
                        <BubbleMenu editor={editor}></BubbleMenu>
                    </EditorContent>
                    <div className="text-right text-xs w-full">{`${postType === "Note" ? charCount  : "Word Count: "+ wordCount}`} </div>
                    
                </div>
                {postType === "Article" && <div className="my-2"><input className="input w-full focus:outline-0" placeholder="Tags" onChange={(e) => { setTags(e.target.value.split(",").map(v => v.trim())) }} /></div>}
                <div>
                    <div className="join w-full"><div className="tooltip tooltip-right join-item btn" data-tip="Post Audience"><FaRegEye className="inline" /></div><select className="join-item select w-full focus:outline-0" value={to} defaultValue={to} onChange={(e) => {
                        setTo(e.target.value);
                        if (!advanced) {
                            setReplyTo(e.target.value);
                            setReactTo(e.target.value);
                        }
                    }}>
                        <option value="@public">Public</option>
                        <option value={server.id}>Server</option>
                        {circles.filter(c => ![user.blocked,user.muted].includes(c.id)).map((c, i) => {
                            return (
                                <option key={i} value={c.id}>{c.name}</option>
                        )})}
                    </select>
                    </div>
                    <div className="cursor-pointer ml-4 text-sm text-right w-full pr-4" onClick={() => showAdvanced(!advanced)}>Advanced</div></div>
                <div className={`${advanced ? "visible" : "hidden"}`}>
                    <fieldset className="mb-2">
                    <div className="join w-full"><div className="tooltip tooltip-right join-item btn"  data-tip="Post Reply Audience (who can reply to this post)"><FaReply className="inline" /></div><select className="join-item select w-full focus:outline-0" defaultValue={replyTo} value={replyTo} onChange={(e) => {
                        setReplyTo(e.target.value);
                    }}>
                        <option value="@public">Public</option>
                        <option value={server.id}>Server</option>
                        {circles.filter(c => ![user.blocked,user.muted].includes(c.id)).map((c, i) => {
                            return (
                                <option key={i} value={c.id}>{c.name}</option>
                        )})}
                    </select>
                    </div>
                    </fieldset>
                    <fieldset>
                    <div className="join w-full"><div className="tooltip tooltip-right z-50 join-item btn"  data-tip="Post React Audience (who can react to this post)"><FaRegHeart className="inline" /></div><select className="join-item select w-full focus:outline-0" defaultValue={reactTo} value={reactTo} onChange={(e) => {
                        setReactTo(e.target.value);
                    }}>
                        <option value="@public">Public</option>
                        <option value={server.id}>Server</option>
                        {circles.filter(c => ![user.blocked,user.muted].includes(c.id)).map((c, i) => {
                            return (
                                <option key={i} value={c.id}>{c.name}</option>
                        )})}
                    </select>
                    </div>
                    </fieldset>
                </div>
                <div className="text-right mt-8">
                    <div className="btn font-bold mr-2">Add New {postType}</div>
                    <button className="btn" onClick={() => dispatch(hidePostEditor())}>Close</button>
                </div>
            </div>
    </div>
    </>)
}

export default PostEditor;