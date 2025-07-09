import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux";
import { setPosts } from "../../store/timeline";
import Timeline from "../../components/Timeline";
const Home = () => {

// const [posts, setPosts] = useState([]);
  // const user = useSelector(state => state.user.user);
  // const posts = useSelector(state => state.timeline.posts);
  const dispatch = useDispatch();
// useEffect(() => {
// const getPublicTimeline = async () => {
//   let res = await Kowloon.getPosts();
//   dispatch(setPosts(res.items));
// }
// getPublicTimeline();
// }, []);

  return (
    <>
      <div className="pr-[33%] mx-auto relative bottom-0 max-h-screen overflow-x-hidden overflow-y-auto px-8 mt-8">
        Home
        {/* <Timeline showCirclesFilter={true} title={`${user ? "Public/Server" : "Public"} Posts`} posts={posts} /> */}
        </div>
      </>
    )
  }
  
  export default Home