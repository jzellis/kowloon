import { StrictMode, useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux';
import Home from './pages/Home/Home.jsx';
import { setLoading, setTitle, setDescription } from './store/global.jsx';
import Kowloon from './lib/kowloon.js';
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import Timeline from './components/Timeline/Timeline.jsx';
import Signup from './pages/Signup/Signup.jsx';

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    children: [
    {index: true, element: <Timeline />},
      {
        path: "/signup",
        element: <Signup />,
      },
    ]
  },
  
]);

const App = () => {
  const title = useSelector((state) => state.global.title);
  const description = useSelector((state) => state.global.description);
  const loading = useSelector((state) => state.global.loading);
  const postEditorVisible = useSelector((state) => state.global.postEditorVisible);
  const dispatch = useDispatch();

 useEffect(() => {
   Kowloon.init();
 }, []);

const loadData = async () => {
  try {
    const response = await fetch('http://localhost:3000/api');
    const server = (await response.json()).server;
    if(server)dispatch(setLoading(false));

    dispatch(setTitle(server.name));
    dispatch(setDescription(server.description));
    await Kowloon.getPublicPosts();
  } catch (e) {
    console.error(e);
  }
};

useEffect(() => {
  loadData();
}, []);
  
  return (
    <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
  )
  
  // return (
  //   <div className='container mx-auto h-screen'>
  //     {loading && <div>Loading...</div>}
  //     {postEditorVisible && <PostEditor />}
  //     <Menu />
  //     <Timeline />

  //   </div>
  // )
}

export default App
