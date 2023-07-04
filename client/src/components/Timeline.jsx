/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import Post from "./Post";
import { useDispatch, useSelector } from "react-redux";
import { PiNotepadBold } from "react-icons/pi"
import {AiFillCaretDown, AiFillCaretUp, AiFillEye} from "react-icons/ai"
import { useState, useEffect, useRef } from "react";
import { toggleShowNotes, toggleShowArticles, toggleShowLinks, toggleShowMedia, incrementCurrentPage, toggleShowRead } from "../store/ui";
import Kowloon from "../lib/Kowloon";

const Timeline = (props) => {

    const dispatch = useDispatch();
    const user = useState(Kowloon.user || null);
    const activities = useSelector(state => state.ui.posts) || null;
    const showNotes = useSelector(state => state.ui.showNotes)
    const showArticles = useSelector(state => state.ui.showArticles)
    const showMedia = useSelector(state => state.ui.showMedia)
    const showLinks = useSelector(state => state.ui.showLinks)
    const showRead = useSelector(state => state.ui.showRead)

    const currentPage = useSelector(state => state.ui.currentPage)
    const [showFilters, setShowFilters] = useState(false);
    const [timelineIsScrolled, setTimelineIsScrolled] = useState(false);
    const [totalItems, setTotalItems] = useState(activities ? activities.length : 0);
    const [loaded, setLoaded] = useState(false);
    const bottom = useRef(null);
    const timeline = useRef(null);
    const activityRefs = useRef(new Array());

    const loadTimeline = async () => {
        if (user) await Kowloon.getUserTimeline();
        if (!user) await Kowloon.getPublicTimeline();
        setTotalItems(activities.length);
        setLoaded(true);
      };

    useEffect(() => {
        const bottomObserver = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
              dispatch(incrementCurrentPage());
              loadTimeline();
              
          }
        });
        bottomObserver.observe(bottom.current)

    
        timeline.current.addEventListener("scroll", (e) => {
          if (e.currentTarget.scrollTop > 100) {
            setTimelineIsScrolled(true);
          } else {
            setTimelineIsScrolled(false);
          }
        });


    }, []);
    
    useEffect(() => {
        console.log(activityRefs)
     }, [activityRefs]);
    
      const scrollToTop = () => {
        timeline.current.scrollTop = 0;
        setTimelineIsScrolled(false);
      };

    return (
        <div className="timeline">
            <div className="text-right text-sm"><span id="showFilterButton" className={`${showFilters && "font-bold"}`} onClick={() => setShowFilters(!showFilters)}><AiFillEye className="inline align-text-center -mt-1" /> Filters {showFilters ? <AiFillCaretUp className="inline" /> : <AiFillCaretDown className="inline" />} </span></div>
            <div className={`timeline-filters ${!showFilters && "hidden"}`}>
                <label className="label">Show:</label>
                <div className="w-full flex">
                    <div className={`flex-1 mr-4 cursor-pointer ${!showNotes && "opacity-50"}`} onClick={() => dispatch(toggleShowNotes())}><PiNotepadBold className="inline" /> Notes</div>
            <div className={`flex-1 mr-4 cursor-pointer ${!showArticles && "opacity-50"}`} onClick={() => dispatch(toggleShowArticles())}><PiNotepadBold className="inline" /> Articles</div>
            <div className={`flex-1 mr-4 cursor-pointer ${!showMedia && "opacity-50"}`} onClick={() => dispatch(toggleShowMedia())}><PiNotepadBold className="inline" /> Media</div>
            <div className={`flex-1 mr-4 cursor-pointer ${!showLinks && "opacity-50"}`} onClick={() => dispatch(toggleShowLinks())}><PiNotepadBold className="inline" /> Links</div>
            <div className={`flex-1 mr-4 cursor-pointer ${!showRead && "opacity-50"}`} onClick={() => dispatch(toggleShowRead())}><AiFillEye className="inline" /> Read</div>
                </div>
            </div>
        <ul ref={timeline}>
                {activities && activities.map((activity) => (
                    <Post key={activity.id} activity={activity} ref={(element) => { console.log(element); activityRefs.push(element) }} />
        ))}
            <div ref={bottom} className="mt-96 clear-both"></div>
    
            </ul>
            </div>
    )
 }

export default Timeline;