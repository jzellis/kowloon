import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setServer } from './store/server';
import { setUser, setToken, setCircles } from './store/user';
import { setcurrentUrl } from './store/ui';
import { createBrowserRouter, RouterProvider, useLocation } from 'react-router-dom';
import PageTracker from "./components/PageTracker";
import Layout from './components/Layout';
import Home from './pages/Home';
import User from './pages/User';
import Page from './pages/Page';
import Post from './pages/Post';
import Login from './pages/Login';
import "./App.css";
import Kowloon from './lib/KowloonClient';



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

  
  useEffect(() => {

    let getServer = async () => {
      let server = JSON.parse(localStorage.getItem("server"));
      if (!server) {
        let serverRequest = await Kowloon.getServer();

        if (serverRequest.server) {
          server = serverRequest.server;
          localStorage.setItem("server", JSON.stringify(server)); 
      }

  
      }
      dispatch(setServer(server));
      document.title = server.profile.name;

    }

    let getUser = async () => {
      localStorage.getItem("user") && dispatch(setUser(JSON.parse(localStorage.getItem("user"))));
      localStorage.getItem("token") && dispatch(setToken(localStorage.getItem("token")));
      localStorage.getItem("circles") && dispatch(setCircles(JSON.parse(localStorage.getItem("circles"))));

    }

    getServer();
    getUser();
  }, []);

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