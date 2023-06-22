/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import Post from "../Post/";
import { BiRefresh } from "react-icons/bi";
import { BsFillArrowUpCircleFill } from "react-icons/bs";
import { IconContext } from "react-icons";
import { AiFillEye } from "react-icons/ai";
import { BsFilterRight } from "react-icons/bs";
import { CgSpinner } from "react-icons/cg";
import { FaStickyNote, FaLink } from "react-icons/fa";
import { GrArticle, GrMultimedia } from "react-icons/gr";
import { setPosts, setActors } from "../../store/ui";
import Kowloon from "../../lib/Kowloon";
import {
  togglePostEditor,
  toggleShowRead,
  toggleShowNotes,
  toggleShowArticles,
  toggleShowMedia,
  toggleShowLinks,
  incrementTimelineCurrentPage,
  resetTimelineCurrentPage,
  resetPosts,
} from "../../store/ui";

export default function Timeline(props) {
  const settings = useSelector((state) => state.settings.settings);
  const user = useSelector((state) => state.user.user);
  const posts = useSelector((state) => state.ui.posts);
  const actors = useSelector((state) => state.user.actors);
  const [totalItems, setTotalItems] = useState(posts.length);
  const currentPage = useSelector((state) => state.ui.timelineCurrentPage);
  const [retrieveTime, setRetrieveTime] = useState(0);
  const showRead = useSelector((state) => state.ui.showRead);
  const showNotes = useSelector((state) => state.ui.showNotes);
  const showArticles = useSelector((state) => state.ui.showArticles);
  const showMedia = useSelector((state) => state.ui.showMedia);
  const showLinks = useSelector((state) => state.ui.showLinks);
  const showPostEditor = useSelector((state) => state.ui.showPostEditor);
  const [loaded, setLoaded] = useState(false);
  const [showFilters, toggleFilters] = useState(false);
  const [timelineIsScrolled, setTimelineIsScrolled] = useState(false);
  const bottom = useRef(null);
  const timeline = useRef(null);
  let dispatch = useDispatch();

  const toggleShowType = (e) => {};

  const loadTimeline = async () => {
    let startTime = Date.now();
    await Kowloon.getUserTimeline();
    setTotalItems(posts.length);
    let endTime = Date.now();
    setRetrieveTime((endTime - startTime) / 1000);
    console.log(retrieveTime);
    setLoaded(true);
  };

  useEffect(() => {
    setLoaded(false);
  }, [user]);

  useEffect(() => {
    if (loaded === false) loadTimeline();
  }, [user]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        dispatch(incrementTimelineCurrentPage(currentPage + 1));
        console.log("Page:", currentPage);
        loadTimeline();
      }
    });
    observer.observe(bottom.current);
  }, []);

  useEffect(() => {
    timeline.current.addEventListener("scroll", (e) => {
      if (e.currentTarget.scrollTop > 100) {
        setTimelineIsScrolled(true);
      } else {
        setTimelineIsScrolled(false);
      }
    });
  }, []);

  // useEffect(() => {
  //   if (timeline && timeline.current)
  //     timeline.current.addEventListener("scroll", (e) => {
  //       console.log(e.currentTarget.scrollTop);
  //     });
  // }, []);

  const scrollToTop = () => {
    timeline.current.scrollTop = 0;
    setTimelineIsScrolled(false);
  };

  return (
    <div className={`${props.className} timelineWrapper`}>
      <div className="text-right">
        <div className="join text-right">
          <button
            className="btn join-item btn-success"
            onClick={() => dispatch(togglePostEditor())}
          >
            + New Post
          </button>
          <button
            className="btn join-item"
            onClick={() => {
              dispatch(resetTimelineCurrentPage());
              dispatch(resetPosts());

              Kowloon.getUserTimeline();
            }}
          >
            <BiRefresh /> Reload
          </button>
          <span
            className={`btn join-item  ${
              showFilters === true
                ? "bg-gray-200 rounded-t-lg rounded-b-none"
                : "rounded-lg"
            } font-bold uppercase mb-0 cursor-pointer`}
            onClick={() => toggleFilters(!showFilters)}
          >
            <IconContext.Provider value={{ color: "#000" }}>
              <BsFilterRight className="avatar mr-2" />
            </IconContext.Provider>
            View Filters
          </span>
        </div>
        <div
          className={`timelineControls ${
            !showFilters && "hidden md:visible"
          } bg-gray-200 p-2 rounded-l-lg rounded-br-lg mb-4 mt-0`}
        >
          <div className="items-stretch w-full text-left">
            <div className="ml-12 mb-2 text-xs uppercase font-bold">Show</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 sm:shrink-0 sm:justify-items-center justify-items-start mb-4">
              <span
                onClick={(e) => {
                  dispatch(toggleShowNotes());
                }}
                className={`cursor-pointer ${
                  showNotes === true ? "opacity-100" : "opacity-50"
                }`}
              >
                {" "}
                <FaStickyNote className="avatar inline-block clear-none mx-2 h-full" />
                Notes
              </span>
              <span
                onClick={(e) => {
                  dispatch(toggleShowArticles());
                }}
                className={`cursor-pointer ${
                  showArticles === true ? "opacity-100" : "opacity-50"
                }`}
              >
                {" "}
                <GrArticle className="avatar inline-block clear-none mx-2 h-full" />
                Articles
              </span>
              <span
                onClick={(e) => {
                  dispatch(toggleShowMedia());
                }}
                className={`cursor-pointer ${
                  showMedia === true ? "opacity-100" : "opacity-50"
                }`}
              >
                {" "}
                <GrMultimedia className="avatar inline-block clear-none mx-2 h-full" />
                Media
              </span>
              <span
                onClick={(e) => {
                  dispatch(toggleShowLinks());
                }}
                className={`cursor-pointer ${
                  showLinks === true ? "opacity-100" : "opacity-50"
                }`}
              >
                {" "}
                <FaLink className="avatar inline-block clear-none mx-2 h-full" />
                Links
              </span>
              <span></span>
            </div>
            {/* <span
              onClick={(e) => {
                dispatch(toggleShowRead());
              }}
              className={`cursor-pointer ${
                showRead === true ? "opacity-100" : "opacity-50"
              }`}
            >
              <AiFillEye className="avatar inline-block clear-none mx-2 h-full" />{" "}
              Read
            </span> */}
          </div>
        </div>
      </div>
      {/* <div className="text-right">
        {totalItems} post{totalItems > 1 && "s"}
        <br />
        Retrieval time: {retrieveTime} seconds
      </div> */}
      <div
        className={`text-right ${
          !timelineIsScrolled
            ? "opacity-0"
            : "opacity-100 lg:opacity-50 lg: hover:opacity-100 focus:opacity-100"
        }`}
      >
        <button className="mt-4 btn btn-sm btn-ghost" onClick={scrollToTop}>
          <BsFillArrowUpCircleFill /> Scroll To Top
        </button>
      </div>
      <ul
        className="timeline mt-8 max-h-screen overflow-y-auto pb-96"
        ref={timeline}
      >
        {!posts ||
          (posts.length === 0 && (
            <div className="text-center text-lg">
              <CgSpinner className="avatar animate-spin" /> Loading Timeline...
            </div>
          ))}
        {posts &&
          posts.length > 0 &&
          posts.map((activity, idx) => {
            return (
              <li
                key={`post-${activity.id}-${idx}`}
                className={`post ${activity.object.type} ${
                  (activity.object.type === "Note" && !showNotes) ||
                  (activity.object.type === "Article" && !showArticles) ||
                  (activity.object.type === "Image" && !showMedia) ||
                  (activity.object.type === "Link" && !showLinks)
                    ? "hidden"
                    : "visible"
                } bg-white shadow-lg rounded-lg p-8`}
              >
                <Post
                  activity={activity}
                  className={activity.object.type}
                  actor={actors[activity.object.actor]}
                />
              </li>
            );
          })}
        <div ref={bottom} className="mt-96 clear-both" />
      </ul>
    </div>
  );
}
