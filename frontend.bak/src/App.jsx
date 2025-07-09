import { Component, useEffect } from 'react';
import { useSelector,useDispatch } from 'react-redux';
import { setCircles, setUser } from './store/user';
import { setCurrentPage } from './store/ui';
import { createBrowserRouter, RouterProvider, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import User from './pages/User';
import Page from './pages/Page';
import Post from './pages/Post';
import Login from './pages/Login';
import "./App.css";
import Kowloon from './lib/Kowloon';
// import { setServer, setServerCircles, setTimestamp, setSignature, setPages } from './store/server';
import PageTracker from "./components/PageTracker";



const router = createBrowserRouter(
[
    {
      path: "/",
      Component: Layout,
      children: [
        { index: true, Component: Home },
        { path: "users/:id", Component: User },
        { path: "pages/:id" , Component: Page},
        { path: "posts/:id" , Component: Post},
        { path: "login", Component: Login },
    ]
  },

]
)
function App({ routes }) {
  // const user = useSelector((state) => state.user.user);
  // const serverName = useSelector((state) => state.server?.profile?.name) || "";
const dispatch = useDispatch();

  
  // useEffect(() => {

  //   const getSettings = async () => {
  //     let res = await Kowloon.getServer(Kowloon.server);
  //     console.log(res);
  //     dispatch(setServer(res.server));
  //     dispatch(setTimestamp(res.server.timestamp));
  //     dispatch(setSignature(res.server.signature));
  //     dispatch(setPages(res.pages));
  //     dispatch(setServerCircles(res.circles));
  //     localStorage.setItem("server", JSON.stringify(res.server));
  //     localStorage.setItem("serverLocation", JSON.stringify(res.server.profile.location));
  //     localStorage.setItem("serverTimestamp", res.timestamp);
  //     localStorage.setItem("serverSignature", res.signature);
  //     localStorage.setItem("serverPages", JSON.stringify(res.pages));
  //     localStorage.setItem("serverCircles", JSON.stringify(res.circles));
  //     document.title = res.server.profile.name;
  //   }

  //   let user = JSON.parse(localStorage.getItem("user"));
  //   if (user) {
  //     dispatch(setUser(user));
  //   }
  //   let circles = JSON.parse(localStorage.getItem("circles"));
  //   if (circles) {
  //     dispatch(setCircles(circles));
  //   }

  //   let serverCircles = JSON.parse(localStorage.getItem("serverCircles"));
  //   if (serverCircles) {
  //     dispatch(setServerCircles(serverCircles));
  //   }
  //   let serverName = JSON.parse(localStorage.getItem("server"));
  //   getSettings();
  //   document.title = serverName || "Kowloon";

  // }, []);

  return (
    <>
      {/* <div id="body-bg"></div> */}
      <div className='relative'>
        <RouterProvider router={router} />
        </div>
    </>
  );
}

export default App