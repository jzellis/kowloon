import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toggleArticles, toggleLinks, toggleMedia, toggleNotes, setFilteredByCircle, toggleTimelineControls } from "../../store/timeline";
import Note from "../../components/Posts/Note";
import Article from "../../components/Posts/Article";
import Link from "../../components/Posts/Link";
import Media from "../../components/Posts/Media";
import { FaRegStickyNote, FaRegCircle, FaCaretDown } from "react-icons/fa";
import { GrDocumentText } from "react-icons/gr";
import { FaLink, FaRegCirclePlay } from "react-icons/fa6";

const componentMap = {Note, Article, Link, Media};

const Timeline = (props) => {

  const user = useSelector((state) => state.user.user);
  const circles = useSelector((state) => state.user.circles);
  const showNotes = useSelector((state => state.timeline.notes));
  const showArticles = useSelector((state => state.timeline.articles));
  const showLinks = useSelector((state => state.timeline.links));
  const showMedia = useSelector((state => state.timeline.media));
  const filteredByCircle = useSelector(state => state.timeline.filteredByCircle);
  const showTimelineControls = useSelector(state => state.timeline.showTimelineControls);

 
  const posts = props.posts;
  const title = props.title;
  const dispatch = useDispatch();

  
  return (<>
          

    <div className="flex"><h3 className="text-xl font-bold mb-4 flex-1">{title || "Posts"}</h3>
<ul className="flex-none">
<li className="flex-1 tooltip cursor-pointer"  data-tip="Click to show/hide Notes"><FaRegStickyNote className={`inline -mt-1 ml-2 ${showNotes === true ? "text-black" : "text-gray-300"}`} onClick={(e)=> dispatch(toggleNotes())} /></li>
<li className="flex-1 tooltip cursor-pointer"  data-tip="Click to show/hide Articles"><GrDocumentText className={`inline -mt-1 ml-2 ${showArticles === true ? "text-black" : "text-gray-300"}`} onClick={(e)=> dispatch(toggleArticles())} /></li>
<li className="flex-1 tooltip cursor-pointer"  data-tip="Click to show/hide Links"><FaLink className={`inline -mt-1 ml-2 ${showLinks === true ? "text-black" : "text-gray-300"}`} onClick={(e)=> dispatch(toggleLinks())} /></li>
<li className="flex-1 tooltip cursor-pointer"  data-tip="Click to show/hide Media"><FaRegCirclePlay className={`inline -mt-1 ml-2 ${showMedia === true ? "text-black" : "text-gray-300"}`} onClick={(e)=> dispatch(toggleMedia())} /></li>
        </ul>
      {(props.showCirclesFilter === true) &&
        <div className={`flex-none tooltip ${filteredByCircle ? "font-black" : "text-gray-300"}`} data-tip="Filter timeline by Circle"><FaRegCircle className={`inline -mt-1 ml-4`} onClick={(e) => { dispatch(setFilteredByCircle(!filteredByCircle)); dispatch(toggleTimelineControls()) }} /></div>
      }
    </div>
    {(props.showCirclesFilter === true) && <div className={`timeline-controls mb-4 text-right ${showTimelineControls ? "" : "hidden"}`}>
    <FaRegCircle className="inline mr-2" /> <select className="select select-sm focus:outline-none">
        <option value="">All Circles</option>
        {circles && circles.map((circle, i) => {
          if(!["blocked","muted"].some(s => circle.name.toLowerCase().includes(s)))
          return (<option key={i}>{circle.name}</option>)
        })}
      </select><br/>
      <div className="btn btn-sm">Set As Default</div>
    </div>
    }
<ul className="posts mx-auto pb-40 mb-40">
{posts?.map((post) => {
  const Component = componentMap[post.type];

  if ((post.type === "Note" && showNotes === true) || 
    (post.type === "Article" && showArticles === true) ||
    (post.type === "Link" && showLinks === true) ||
    (post.type === "Media" && showMedia === true))
return  (
    <Component key={post.id} post={post} />
  )
})}
    </ul>
    </>
  )
  
}

export default Timeline