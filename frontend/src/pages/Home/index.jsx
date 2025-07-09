import { useState, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux";
import Kowloon from "../../lib/KowloonClient";
import { setTimelineView } from "../../store/timeline";
import Timeline from "../../components/Timeline";
import TimelineFilter from "../../components/TimelineFilter";
const Home = () => {
  const dispatch = useDispatch();
  const [posts, setPosts] = useState(JSON.parse(localStorage.getItem("posts")) || []);
  const user = useSelector(state => state.user.user);
  const server = useSelector(state => state.server);

  useEffect(() => {

    const getServerOutbox = async () => {
      let request = await Kowloon.getServerOutbox();
      if (request.items) {
        localStorage.setItem("posts", JSON.stringify(request.items));
        setPosts(request.items);
      }
    }
    getServerOutbox();
  }, []);

  return (
    <div className="w-full mx-auto">
      <TimelineFilter />
      {posts && <Timeline posts={posts} title={`${server.profile.name} Posts`} />}
      </div>
    )
  }
  
  export default Home