import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./routes/Home";
import ErrorPage from "./routes/ErrorPage";
import Login from "./components/Login";
import Setup from "./routes/Setup";
import Actor from "./routes/Actor";
import Layout from "./components/Layout";
import Loader from "./components/Loader";
import { loader } from "./routes/Actor";
import Kowloon from "./lib/Kowloon";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
    errorElement: <ErrorPage />,
  },
  {
    path: "login",
    element: <Login />,
  },

  {
    path: "setup",
    element: <Setup />,
  },
  {
    path: "/:actor",
    element: <Actor />,
    loader: loader,
  },
]);
console.log(await Kowloon.login("jzellis", "***REMOVED***"));
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <Loader>
        <Layout>
          <RouterProvider router={router} />{" "}
        </Layout>
      </Loader>
    </Provider>
  </React.StrictMode>
);
