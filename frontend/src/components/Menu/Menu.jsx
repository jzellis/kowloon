import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import Login from "../Login/Login.jsx";
import UserMenu from "./UserMenu.jsx";
import { Link } from "react-router-dom";

const Menu = ({ }) => {
  const title = useSelector((state) => state.global.title);
  const description = useSelector((state) => state.global.description);
  const loading = useSelector((state) => state.global.loading);
  const user = useSelector((state) => state.user.user);
  const postEditorVisible = useSelector((state) => state.global.postEditorVisible);

  const dispatch = useDispatch();

  addEventListener("storage", (e) => {
    if (e.key === "user") {
      setUser(JSON.parse(e.newValue));
    }
  });
  return (
    <>
      <nav className="navbar bg-base-100">
        <div className="flex-1">
          <div><h1 className="title w-full"><Link to={"/"}>{title}</Link></h1>
          <div className="description w-full text-sm font-thin">{description}</div>
          </div>
          </div>
        <div className="flex-none">
          {!loading && !user?.username && <><Login /><Link to={"/signup"}>Signup</Link></>}
          {!loading && user?.username && <UserMenu />}
          
        </div>
      </nav>

    </>
  );
};

export default Menu;
