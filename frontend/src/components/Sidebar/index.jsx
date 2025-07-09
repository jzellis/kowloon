import { useSelector, useDispatch } from "react-redux"
import { useState, useEffect } from "react";
import { setPages } from "../../store/server";
import Kowloon from "../../lib/KowloonClient";
import PageTree from "../PageTree";
import CircleList from "../CircleList";
const Sidebar = () => {
    
    const server = useSelector((state) => state.server);
    const pages = useSelector((state) => state.server.pages);
    // const circles = useSelector((state) => state.server.circles);

    const dispatch = useDispatch();
    
useEffect(() => {
    const getPages = async () => {
        let pages = JSON.parse(localStorage.getItem("pages"));
        if (!pages) {
            let pageRequest = await Kowloon.getPages();
            if (pageRequest.items) {
             pages = pageRequest.items;   
            }
        }
        dispatch(setPages(pages));
    }

    getPages();
}, [])
    
    return (<>
        <div id="sidebar-left">
            <h2 className="text-xl font-bold mb-[2rem]">{server?.profile?.name}</h2>
            <div className="mb-[2rem]" dangerouslySetInnerHTML={{ __html: server?.profile?.description }}></div>
            {!pages && <>Loading Pages...</>}
            {pages?.length > 0 && <PageTree items={pages} />}
        </div>
    </>)
}

export default Sidebar