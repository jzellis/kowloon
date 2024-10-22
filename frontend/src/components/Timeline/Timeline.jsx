import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import Kowloon from "../../lib/kowloon";
import TimelineItem from "./TimelineItem";

const Timeline = () => {

    const [posts, setPosts] = useState([]);

    const getPosts = async () => {
        setPosts(await Kowloon.getPublicPosts());
    }

    useEffect(() => {
        getPosts();
        console.log(posts);
    }, []);
    return <div className="timeline">
        <ul>
            {posts?.items?.map((post) => <TimelineItem key={post.id} post={post} />) }</ul>    
    </div>;
};

export default Timeline;