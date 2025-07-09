import { useSelector, useDispatch } from "react-redux";
import { toggleArticles, toggleLinks, toggleMedia, toggleNotes } from "../../store/timeline"
import { FaRegStickyNote, FaRegCircle, FaCaretDown } from "react-icons/fa";
import { GrDocumentText } from "react-icons/gr";
import { FaLink, FaRegCirclePlay } from "react-icons/fa6";


const TimelineFilter = (props) => {

    const dispatch = useDispatch();
    const showNotes = useSelector(state => state.timeline.notes);
    const showArticles = useSelector(state => state.timeline.articles);
    const showLinks = useSelector(state => state.timeline.links);
    const showMedia = useSelector(state => state.timeline.media);


    return (
        <ul className="timelineFilter flex-none text-2xl">
        <li className="flex-1 tooltip cursor-pointer" data-tip="Click to show/hide Notes"><FaRegStickyNote className={`inline -mt-1 ml-2 ${showNotes === true ? "text-note" : "text-gray-300"}`} onClick={(e) => dispatch(toggleNotes())} /></li>
        <li className="flex-1 tooltip cursor-pointer" data-tip="Click to show/hide Articles"><GrDocumentText className={`inline -mt-1 ml-2 ${showArticles === true ? "text-article" : "text-gray-300"}`} onClick={(e) => dispatch(toggleArticles())} /></li>
        <li className="flex-1 tooltip cursor-pointer" data-tip="Click to show/hide Links"><FaLink className={`inline -mt-1 ml-2 ${showLinks === true ? "text-link" : "text-gray-300"}`} onClick={(e) => dispatch(toggleLinks())} /></li>
        <li className="flex-1 tooltip cursor-pointer" data-tip="Click to show/hide Media"><FaRegCirclePlay className={`inline -mt-1 ml-2 ${showMedia === true ? "text-media" : "text-gray-300"}`} onClick={(e) => dispatch(toggleMedia())} /></li>
   </ul>
   )
}

export default TimelineFilter