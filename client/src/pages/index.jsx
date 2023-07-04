/* eslint-disable react-hooks/exhaustive-deps */
import Kowloon from "../lib/Kowloon";
import Timeline from "../components/Timeline";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

const Home = () => {

    const [user] = useState(Kowloon.user || null);
    const posts = useSelector((state) => state.ui.posts);
    const theme = useSelector(state => state.ui.theme);

    useEffect(() => { 

        const getTimeline = async () => { 
            if (user) await Kowloon.getUserTimeline();
            if (!user) await Kowloon.getPublicTimeline();
            document.querySelector("html").setAttribute("data-theme", theme);
        };

        getTimeline();

    }, []);

    return (<>
        <Timeline activities={posts} />
    </>)

}

export default Home;