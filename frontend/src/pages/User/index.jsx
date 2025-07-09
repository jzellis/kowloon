import Kowloon from "../../lib/KowloonClient";
import { useParams } from "react-router-dom"
import { useState, useEffect,} from "react";
import { NavLink } from "react-router-dom";
import "./index.css";
import { useSelector, useDispatch } from "react-redux";
import { setPosts, setTimelineView } from "../../store/timeline";
import Timeline from "../../components/Timeline";

import { FaLocationDot, FaLink, FaTransgender  } from "react-icons/fa6";
import CircleList from "../../components/CircleList";
import { use } from "react";
const User = () => {

  let { id } = useParams();
  let [user, setUser] = useState({});
  let [posts, setPosts] = useState([]);
  let [activeTab, setActiveTab] = useState("posts");
  const dispatch = useDispatch();


  const getUser = async (id) => {
    let response = await Kowloon.getUser(id);
    console.log(response.user);
    setUser(response.user);
  }

  const getPosts = async (id) => {
    let response = await Kowloon.getUserPosts(id);
    console.log(response.user);
    setPosts(response.items);
  }

  useEffect(() => {
    getUser(id);
    getPosts(id);
  }, []);

  return (
    <>
      {user && user.id && (
      <div className="user-profile w-2/3 mx-auto h-screen mt-8">
      <div className="w-full grid grid-cols-12 gap-4">
        <div className="col-span-2">
          <img className="w-full h-auto" src={user?.profile.icon} />
        </div>
        <div className="col-span-10">
          <h1 className="text-2xl font-bold w-full">
              {user?.profile.name} <span className="text-sm">({user?.id})</span>
                <div className="italic font-light text-lg">{user?.profile.subtitle}</div> 
            </h1>

          <div className="w-full font-bold text-sm">
            <FaLocationDot className="inline mr-2" /><a href={`https://maps.google.com/?q=${user?.profile.location?.latitude},${user?.profile.location?.longitude}`} target="_blank">{user?.profile.location?.name}</a>
          </div>
          <div className="w-full text-sm font-bold ">
            <FaLink style={{strokeWidth: "1em"}} className="inline font-bold mr-2" /> 
            {user?.profile.urls.map((url, i) => {
              return (<span key={i}><a href={url} className="hover:underline decoration-dotted" target="_blank">{url}</a>{i < user?.profile.urls.length - 1 && " | "}</span>)
            })}
          </div>

          <div className="w-full text-sm font-bold">
          <FaTransgender className="inline mr-2" />{user?.profile.pronouns.subject}/{user?.profile.pronouns.object}
            </div>
            <div className="w-full ml-6 mt-2 font-light">
            {user?.profile.description}
          </div>

        </div>

        </div>
        <div role="tablist" className="tabs tabs-lift">
            <a className={`tab tab-lifted ${activeTab === "posts" && "tab-active"}`} onClick={(e) => setActiveTab("posts")}>Posts</a>
            <a className={`tab tab-lifted ${activeTab === "circles" && "tab-active"}`} onClick={(e) => setActiveTab("circles")}>Circles</a>
          </div>
        <div className="mt-8 relative bottom-0 max-h-screen overflow-x-hidden overflow-y-auto px-8">
          {activeTab === "posts" && <Timeline showCirclesFilter={false} title={`${user?.profile?.name}'s Posts`} posts={posts} />}
          {activeTab === "circles" && <CircleList title={`${user?.profile?.name}'s Public Circles`} circles={circles} />}
        </div>
        </div>
        )}
      </>
    )
  }
  
  export default User