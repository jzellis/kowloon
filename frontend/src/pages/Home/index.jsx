import Kowloon from "../../lib/Kowloon"
import { useSelector } from "react-redux";
import { useState, useEffect } from "react"
import { NavLink } from "react-router-dom";
import Timeline from "../../components/Timeline";
const Home = () => {

const [posts, setPosts] = useState([]);
const user = useSelector(state => state.user.user);
useEffect(() => {
const getPublicTimeline = async () => {
  let res = await Kowloon.getPosts();
  setPosts(res.items);
}
getPublicTimeline();
}, []);

  return (
    <>
      <div className="w-2/3 mx-auto relative bottom-0 max-h-screen overflow-x-hidden overflow-y-auto px-8 mt-8">
        <Timeline showCirclesFilter={true} title={`${user ? "Public/Server" : "Public"} Posts`} posts={posts} />
        </div>
      </>
    )
  }
  
  export default Home