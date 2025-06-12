import Kowloon from "../../lib/Kowloon";
import { useState, useCallback, useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {togglePostEditor, showPostEditor, hidePostEditor} from "../../store/ui"
import { GrDocumentText } from "react-icons/gr";
import { FaL, FaLink, FaLinkSlash, FaRegCirclePlay } from "react-icons/fa6";
import { FaRegStickyNote, FaReply, FaRegHeart, FaRegEye, FaRegImage, FaCaretRight, FaCaretDown } from "react-icons/fa";
import { FaBold, FaItalic, FaUnderline, FaIndent } from "react-icons/fa";
import { BsTypeH1, BsTypeH2, BsTypeH3 } from "react-icons/bs";
// This is the TipTap editor stuff
import { useEditor, EditorContent, FloatingMenu, BubbleMenu } from '@tiptap/react'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import StarterKit from '@tiptap/starter-kit'
import CharacterCount from "@tiptap/extension-character-count";
import "./index.css"

const PostEditor = (props) => {

  const maxNoteLength = 280;

    let user = useSelector((state) => state.user.user);
    let circles = useSelector((state) => state.user.circles);
    let server = useSelector((state) => state.server.server);
    let postEditorOpen = useSelector((state) => state.ui.showPostEditor);
    let dispatch = useDispatch();

    const [postType, setPostType] = useState(user?.prefs?.defaultPostType || props.postType || "Note");
    const [title, setTitle] = useState(props.title || "");
    const [to, setTo] = useState(user?.prefs?.defaultTo || props.to || "@public");
    const [toLabel, setToLabel] = useState(user?.prefs?.defaultTo || props.to || "Public");
  const [advanced, showAdvanced] = useState(false);
    const [replyTo, setReplyTo] = useState(user?.prefs?.defaultReplyTo || props.replyTo || "@public");
    const [replyToLabel, setReplyToLabel] = useState(user?.prefs?.defaultReplyTo || props.replyTo || "Public");
  const [reactTo, setReactTo] = useState(user?.prefs?.defaultReactTo || props.reactTo || "@public");
  const [reactToLabel, setReactToLabel] = useState(user?.prefs?.defaultReactTo || props.reactTo || "Public");

  const [content, setContent] = useState(props.content || "");
    const [wordCount, setWordCount] = useState(props.wordCount || 0);
    const [charCount, setCharCount] = useState(props.charCount || 0);
    const [href, setHref] = useState(props.href || "");
    const [image, setImage] = useState(props.image || "");
    const [imagePreview, setImagePreview] = useState(props.image || "");

  const [attachments, setAttachments] = useState(props.attachments || []);
  const [tags, setTags] = useState([]);
  const [statusText, setStatusText] = useState("");
  const [showAudienceModal, setShowAudienceModal] = useState(false);
  const inputRef = useRef(null);

  const closePostEditor = (finished = false) => {
    if (!finished && editor.state.doc.textContent.length > 0 || image ? confirm("Are you sure you want to close the post editor? You will lose all ") : true) {
        dispatch(hidePostEditor());

        editor.commands.setContent("");
        setTitle("");
        setImage(null);
        setImagePreview(null);
        setPostType(user?.prefs?.defaultPostType || props.postType || "Note");
        setTo(user?.prefs?.defaultTo || props.to || "@public");
        setReactTo(user?.prefs?.defaultReactTo || props.to || "@public");
        setReplyTo(user?.prefs?.defaultReplyTo || props.to || "@public");
        setWordCount(0);
        setCharCount(0);
        setTags([]);
        setAttachments([]);
        showAdvanced(false);
      }

  }

    const changePostType = (type) => {
        setPostType(type);
        if (type != "Link") setHref("");
        if (type === "Note") {
          setTitle("");
          // setImage("");
          //   setImagePreview("");
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
        setImagePreview(preview.image || "");
        setContent(preview.summary || ""); editor.commands.setContent(preview.summary || "", true)
    }
  
  const changeImage = (files) => {
    let file = files[0];
    let imageFile = URL.createObjectURL(file);
    setImage(file);
    setImagePreview(imageFile);
  }

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
  }

  const createPost = async (e) => {
    e.preventDefault();
    const activity = {
      type: "Create",
      actorId: user.id,
      to,
      replyTo,
      reactTo,
      objectType: "Post",
      object: {
        type: postType,
        actorId: user.id,
        to,
        replyTo,
        reactTo,
        title,
        source: {
          mediaType: "text/html",
          content,
        },
        wordCount,
        charCount,
        href : href || undefined,
        image,
        // attachments,
        tags,
      },
    };

    let response = await Kowloon.createActivity(activity);
    console.log(response);
    closePostEditor(true);
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
      CharacterCount.configure({
          limit: 0
        })
    ]

    const editor = useEditor({
        extensions,
        content,
      onUpdate: ({ editor }) => {
        console.log(editor.getHTML());
        if (postType === "Note" && editor.state.doc.textContent.length >= maxNoteLength) {
          editor.commands.setContent(editor.state.doc.textContent.slice(0,maxNoteLength))
          }
          setContent(editor.getHTML());
          setWordCount(editor.state.doc.textContent.trim().split(" ").length);
          setCharCount(editor.state.doc.textContent.length);
        
        },
        editorProps: {
            attributes: {
                placeholder: "Type something...",
                class: `bg-white p-4 w-full focus:outline-none rounded-md border border-${postType.toLowerCase()} ${postType === "Article" ? "min-h-60" : "min-h-40"}`
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
        <div className="absolute bottom-10 right-10 tooltip z-[9999]" data-tip="Create New Post"><div className="btn btn-lg btn-primary rounded-full shadow-2xl" onClick={() => dispatch(showPostEditor())}>+</div></div>
        <div id="postEditor" className={`${postType} modal modal-top sm:modal-middle ${postEditorOpen ? "modal-open" : ""}`}>
        <div className={`modal-box ${postType === "Article" ? "w-full max-w-5xl" :""}`}>
            <div className="text-right w-full pb-8"><button className="absolute right-2 top-2 btn btn-sm btn-circle btn-ghost" onClick={closePostEditor}>✕</button></div>

                <div className="flex justify-between">
            <h3 className={`text-2xl flex-1 text-${postType.toLowerCase()}`}>Create New {postType}</h3>
                    <div className="flex-none text-2xl">
                        <FaRegStickyNote className={`inline mr-2 cursor-pointer ${postType === "Note" ? "text-note" : "text-gray-300"}`} onMouseOver={() => setStatusText("A <b>Note</b> is a simple post of up to 280 characters.")} onMouseOut={() => setStatusText("")} onClick={() => { changePostType("Note") }} />
                        <GrDocumentText className={`inline mr-2 cursor-pointer ${postType === "Article" ? "text-article" : "text-gray-300"}`} onMouseOver={() => setStatusText("An <b>Article</b> is like a blog post, with an optional title and featured image and tags. It can be as long as you like.")} onMouseOut={() => setStatusText("")}onClick={() => { changePostType("Article") }} />
                        <FaLink className={`inline mr-2 cursor-pointer ${postType === "Link" ? "text-link" : "text-gray-300"}`} onMouseOver={() => setStatusText("A <b>Link</b> is a link to another URL or Kowloon post, with an optional description and image. If you paste a URL into the link box, it'll try to retrieve a preview for you.")} onMouseOut={() => setStatusText("")} onClick={() => { changePostType("Link") }} />
                        <FaRegCirclePlay className={`inline mr-2 cursor-pointer ${postType === "Media" ? "text-media" : "text-gray-300"}`} onMouseOver={() => setStatusText("<b>Media</b> is one or more images, audio files or videos, with an optional title and description.")} onMouseOut={() => setStatusText("")} onClick={() => { changePostType("Media") }} />
                    </div>
                </div>
                {postType == "Link" && (<fieldset className="form-control mt-4">
                    <input className="border border-link rounded-md bg-white p-4 w-full font-mono" value={href} placeholder={`Add your linked URL here` } onChange={(e) => setHref(e.target.value)} onBlur={getLinkPreview} />
            </fieldset>
                )
                }

                {postType != "Note" && (<fieldset className="form-control mt-4">
            <input className={`bg-white border-1 border-${postType.toLowerCase()} p-2 text-lg rounded-md  w-full`} value={title} placeholder={`Add your ${postType.toLowerCase()}'s title here` }  onMouseOver={() => setStatusText(`Add a title to your ${postType}. Notes don't have titles.`)} onMouseOut={() => setStatusText("")}  onChange={(e) => setTitle(e.target.value)} />
            </fieldset>
                )
          }
          {postType != "Note" && !imagePreview && <div className="my-4"></div>}
          {postType != "Note" && imagePreview && <div className={`image mt-4 w-full h-${postType === "Article" ? "[400px]" : "60"} overflow-hidden relative rounded-lg group`}>
            <img src={imagePreview} className="absolute top-1/2 left-1/2 w-full h-auto -translate-x-1/2 -translate-y-1/2 object-cover " />
            <span onClick={clearImage} className="absolute top-5 right-5 btn btn-circle opacity-0 group-hover:opacity-100 transition-all duration-300">X</span>

          </div>}
                <div className="editor my-8">
            <ul className={`editor-toolbar join mb-2 mx-auto`}>
              {postType != "Note" && !imagePreview && <li className="btn btn-sm join-item"  onMouseOver={() => setStatusText(`Add a header image to your ${postType}. Notes can't have header images.`)} onMouseOut={() => setStatusText("")}  onClick={() => inputRef.current.click()}><FaRegImage className="inline" /> Add Header Image<input className="hidden" type="file" ref={inputRef} onChange={(e) => changeImage(e.target.files)} /></li>}
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('bold') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()}><FaBold /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('italic') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()}><FaItalic /></li>
                        <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('underline') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleUnderline().run()} disabled={!editor.can().chain().focus().toggleUnderline().run()}><FaUnderline /></li>
              {postType == "Article" && <><li className={`btn btn-sm join-item hover:text-black ${editor.isActive('blockquote') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={!editor.can().chain().focus().toggleBlockquote().run()}><FaIndent /></li>
                <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('heading', { level: 1 }) ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} ><BsTypeH1 /></li>
                <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('heading', { level: 2 }) ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} ><BsTypeH2 /></li>
                <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('heading', { level: 3 }) ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} ><BsTypeH3 /></li>
                {!editor.isActive("link") && <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('link') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={setLink} ><FaLink /></li>}
                {editor.isActive("link") && <li className={`btn btn-sm join-item hover:text-black ${editor.isActive('link') ? 'text-black btn-active' : 'text-gray-600'}`} onClick={() => editor.chain().focus().unsetLink().run()} ><FaLinkSlash /></li>}
              </>}
                    </ul>
                    <EditorContent
                        editor={editor}
    
                    >
                        <FloatingMenu editor={editor}></FloatingMenu>
                        <BubbleMenu editor={editor}></BubbleMenu>
                    </EditorContent>
            <div className="text-right text-xs w-full">
              {postType === "Note" ?
                (<span className={`${charCount === maxNoteLength ? "text-red-600" : charCount >= maxNoteLength * 0.9 ? "text-yellow-400" : ""}`}>{charCount}</span>)
                :
                <>Word Count: {wordCount}</>}
            </div>
                    
                </div>

                <div>
                    <fieldset><label className="input w-full"><span className="label"><FaRegEye className="inline" /></span><select className=" select w-full focus:outline-0" value={to} defaultValue={to} onMouseOver={() => setStatusText("This is who can see your post. You can make it public, only visible to logged-in members of this server, or to any of your Circles.")} onMouseOut={() => setStatusText("")} onChange={(e) => {
              setTo(e.target.value);
              setToLabel(e.target.options[e.target.selectedIndex].text);
                        if (!advanced) {
                          setReplyTo(e.target.value);
                          setReactTo(e.target.value);
                          setReplyToLabel(e.target.options[e.target.selectedIndex].text)
                          setReactToLabel(e.target.options[e.target.selectedIndex].text)

                        }
                    }}>
                        <option value="@public">Public</option>
                        <option value={server.id}>Server</option>
                        {circles.filter(c => ![user.blocked,user.muted].includes(c.id)).map((c, i) => {
                            return (
                                <option key={i} value={c.id}>{c.name}</option>
                        )})}
            </select></label>
              <div className="w-full text-right cursor-pointer text-xs text-gray-500" onClick={() => setShowAudienceModal(true)}>What does this mean?</div>
                    </fieldset>
            <div className="cursor-pointer my-4 text-sm text-right w-full" onClick={() => showAdvanced(!advanced)}><div className={`inline`}>{advanced ? <FaCaretDown className="inline -mt-1" /> : <FaCaretRight className="inline -mt-1" />}</div> Advanced Settings</div></div>
          <div className={`${advanced ? "visible" : "hidden"}`}>
          {postType != "Note" && <div className="mt-2 mb-8"><label className="input w-full"><span className="label">Tags</span><input className="input w-full focus:outline-0" placeholder="Tags" onMouseOver={() => setStatusText(`Add tags to your ${postType} as a comma-separated list.`)} onMouseOut={() => setStatusText("")} onChange={(e) => { setTags(e.target.value.split(",").map(v => v.trim())) }} /></label></div>}
                    <fieldset className="mb-2">
                    <div className=" w-full"><label className="input w-full"><span className="label"><FaReply className="inline" /></span><select className=" select w-full focus:outline-0" defaultValue={replyTo} value={replyTo} onMouseOver={() => setStatusText("This is who can reply to your post. You can make replies public, only available to logged-in members of this server, or to any of your Circles.")} onMouseOut={() => setStatusText("")} onChange={(e) => {
                setReplyTo(e.target.value);
                setReplyToLabel(e.target.options[e.target.selectedIndex].text);
                    }}>
                        <option value="@public">Public</option>
                        <option value={server.id}>Server</option>
                        {circles.filter(c => ![user.blocked,user.muted].includes(c.id)).map((c, i) => {
                            return (
                                <option key={i} value={c.id}>{c.name}</option>
                        )})}
              </select>
                </label>
                    </div>
                    </fieldset>
                    <fieldset>
                    <div className=" w-full"><label className="input w-full"><span className="label"><FaRegHeart className="inline" /></span><select className=" select w-full focus:outline-0" defaultValue={reactTo} value={reactTo} onMouseOver={() => setStatusText("This is who can react to your post. You can make reacts public, only available to logged-in members of this server, or to any of your Circles.")} onMouseOut={() => setStatusText("")} onChange={(e) => {
                setReactTo(e.target.value);
                setReactToLabel(e.target.options[e.target.selectedIndex].text);
                    }}>
                        <option value="@public">Public</option>
                        <option value={server.id}>Server</option>
                        {circles.filter(c => ![user.blocked,user.muted].includes(c.id)).map((c, i) => {
                            return (
                                <option key={i} value={c.id}>{c.name}</option>
                        )})}
              </select>
                </label>
                    </div>
            </fieldset>
            <div className="text-right my-2">
              
              <ul className="text-xs">
                <li className={`inline-block mr-2 `}>Post type: <span className={`font-bold text-${postType.toLowerCase()}`}>{postType}</span></li>
                <li className="inline-block mr-2"> <FaRegEye className="inline" /> {toLabel}</li>
                <li className="inline-block mr-2"><FaReply className="inline" /> {replyToLabel}</li>
                <li className="inline-block mr-2"> <FaRegHeart className="inline mr-2" /> {reactToLabel}</li>
                <li className="inline-block"  onMouseOver={() => setStatusText(`When you create new posts, they'll by default be ${postType}${postType != "Media" && "s"}, visible to ${toLabel}.`)} onMouseOut={() => setStatusText("")} ><span className="btn btn-sm">Set As Default</span></li>
              </ul>
              
            </div>
                </div>
                <div className="text-right mt-8">
            <span className={`btn btn-${postType.toLowerCase()} mr-4`} onClick={createPost}>Create New {postType}</span>
                    <button className="btn" onClick={closePostEditor}>Close</button>
          </div>
          <div className="text-xs py-4 h-[4em] text-gray-600 min-h-[4em]" dangerouslySetInnerHTML={{ __html: statusText }}></div>
            </div>
      </div>
      
      <dialog id="audience-modal" className={`modal ${showAudienceModal && "modal-open"}`}>
        <div className="modal-box max-w-4xl">
          <h2 className="text-xl font-bold mb-4">Audience</h2>
          <p>Everything in Kowloon -- posts, bookmarks, groups, circles and even users -- has an <b>audience</b>: who can see, reply and react to it. You can choose to make something visible to:</p>
            <ul className="m-4 list-disc">
              <li><b>The public</b>. Anyone can see this item either via an app or your community's Web server.</li>
              <li><b>The server</b>. Only logged in members of this server/community can see this item.</li>
              <li><b>A Circle</b>. Anyone you've added to this Circle can see this item, but nobody else.</li>
          </ul>
          <p>You can set different audiences to be able to see an item, reply to it and react to it. So for example, you can make a post publicly <i>visible</i> to anyone but allow no one but server members to <i>react</i> to it and only members of one of your Circles to actually <i>reply</i>.</p>
            <div className="modal-action"><span className="btn" onClick={() => setShowAudienceModal(false)}>Close</span></div>
  </div>
</dialog>
    </>)
}

export default PostEditor;