import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import store from "./store";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Home from "./routes/Home";
import Login from "./routes/Login";
import Setup from "./routes/Setup";
import Layout from "./components/Layout";
import Loader from "./components/Loader";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home />,
  },
  {
    path: "login",
    element: <Login />,
  },
  {
    path: "setup",
    element: <Setup />,
  },
]);

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
