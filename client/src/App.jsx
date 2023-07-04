/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react'
import './App.css'
import Layout from './components/Layout';
import Kowloon from './lib/Kowloon';
import store from './store';
import { Provider, useSelector, useDispatch } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

const pages = import.meta.glob("./pages/**/*.jsx", { eager: true });


const routes = [];
for (const path of Object.keys(pages)) {
  const fileName = path.match(/\.\/pages\/(.*)\.jsx$/)?.[1];
  if (!fileName) {
    continue;
  }

  const normalizedPathName = fileName.includes("$")
    ? fileName.replace("$", ":")
    : fileName.replace(/\/index/, "");

  routes.push({
    path: fileName === "index" ? "/" : `/${normalizedPathName.toLowerCase()}`,
    Element: pages[path].default,
    loader: pages[path]?.loader,
    action: pages[path]?.action,
    ErrorBoundary: pages[path]?.ErrorBoundary,
  });
}

const router = createBrowserRouter(
  routes.map(({ Element, ErrorBoundary, ...rest }) => ({
    ...rest,
    element: <Layout><Element /></Layout>,
    ...(ErrorBoundary && { errorElement: <ErrorBoundary /> }),
  }))
);

function App() {
  
  useEffect(() => {
   
    if (document.title !== Kowloon.settings.title) document.title = Kowloon.settings.title;


 },[])

  return (
    <Provider store={store}>
    <div className='app'>
        <RouterProvider router={router}>
      </RouterProvider>

      </div>
      </Provider>
      );
}

export default App
