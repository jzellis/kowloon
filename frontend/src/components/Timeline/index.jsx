import { useSelector, useDispatch } from "react-redux";
import Note from "../../components/Posts/Note";
import Article from "../../components/Posts/Article";
import Link from "../../components/Posts/Link";
import Media from "../../components/Posts/Media";

const componentMap = { Note, Article, Link, Media };

const endpointMap = {
  home: {
    endpoint: "getServerOutbox",
    params: {},
  }
}


const Timeline = (props) => {

  const user = useSelector((state) => state.user.user);
  const server = useSelector((state) => state.server);
  const posts = props.posts;
  const dispatch = useDispatch();

  const showNotes = useSelector(state => state.timeline.notes);
  const showArticles = useSelector(state => state.timeline.articles);
  const showLinks = useSelector(state => state.timeline.links);
  const showMedia = useSelector(state => state.timeline.media);

  
  return (<>
          
<ul className="Timeline mx-auto pb-40 mb-40">
{posts && posts.length > 0 && posts?.map((post) => {
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