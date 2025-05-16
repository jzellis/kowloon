import { useSelector, useDispatch } from "react-redux"
import { useState } from "react";
import PageTree from "../PageTree";
import CircleList from "../CircleList";
const Sidebar = () => {
    
    const server = useSelector((state) => state.server.server);
    const pages = useSelector((state) => state.server.pages);
    const circles = useSelector((state) => state.server.circles);
    
    
    return (<>
        <div className="relative bottom-0 max-h-screen overflow-x-hidden overflow-y-auto p-8 pb-40">
            <div className="description mb-8 card shadow-lg rounded-lg"><div className="card-body" dangerouslySetInnerHTML={{ __html: server?.profile?.description }}></div></div>
            <h2 className="font-bold text-xl mb-8">Pages <a  href="/pages"className="text-sm font-normal">Show All</a></h2>
            <PageTree items={pages} />
            <div className="mt-8">
            <h2 className="font-bold text-xl mb-8">Circles <a  href="/circles"className="text-sm font-normal">Show All</a></h2>
                <CircleList title={""} circles={circles.slice(0, 5)} />
                </div>
        </div></>)
}

export default Sidebar