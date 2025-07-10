import { Outlet } from "react-router";
import Header from "../Header";
import Sidebar from "../Sidebar";
import PostEditor from "../PostEditor";
import { useSelector } from "react-redux";
import "./index.css"
import PageTracker from "../PageTracker";
const Layout = () => {

    const user = useSelector((state) => state.user.user);
    return (<>
        {/* {user && user.id && <PostEditor />} */}
        <div className="w-full">
                  <PageTracker />
            <div id="header"><Header /></div>

            <div className="w-full">
                <div className="grid w-full mx-auto grid-cols-12">
                    <div id="sidebar" className="col-span-3">
                    <Sidebar />
                    </div>
                    <div className="col-span-9">
                    <Outlet />
</div>
                    </div>
                </div>
        </div>
        </>
    )
  }
  
  export default Layout