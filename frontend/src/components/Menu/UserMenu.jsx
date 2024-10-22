import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { logout } from "../../store/user";
import { IoAddCircleOutline } from "react-icons/io5";
import { FaCaretDown } from "react-icons/fa";
import { setPostType, togglePostEditor } from "../../store/global";
import { BsCardText, BsFileText, BsImage, BsLink45Deg } from "react-icons/bs";

const UserMenu = () => {
    const user = useSelector((state) => state.user.user);
    const postEditorVisible = useSelector((state) => state.global.postEditorVisible);
    const [loggedIn, setLoggedIn] = useState(false);
    const dispatch = useDispatch();

    const logoutUser = (e) => {
        e.preventDefault();
        dispatch(logout());
    };
    return (
        <>

    <div className="form-control">
                <div className="join">
                    <button className="btn btn-rounded-full join-item" onClick={(e) => {dispatch(togglePostEditor())}}><IoAddCircleOutline /> New {user.prefs.defaultPostType}</button>
                    <details className="dropdown dropdown-hover dropdown-end join-item">
                        <summary className="btn"><FaCaretDown /></summary>
                        <ul className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52">
                            <li><a onClick={(e) => { dispatch(setPostType("Note")); dispatch(togglePostEditor()) }}><BsCardText  /> New Note</a></li>
                            <li><a onClick={(e) => { dispatch(setPostType("Article")); dispatch(togglePostEditor()) }}><BsFileText /> New Article</a></li>
                            <li><a onClick={(e) => { dispatch(setPostType("Media")); dispatch(togglePostEditor()) }}><BsImage /> New Media</a></li>
                            <li><a onClick={(e) => { dispatch(setPostType("Link")); dispatch(togglePostEditor()) }}><BsLink45Deg /> New Link</a></li>
                        </ul>
                    </details>
                </div>
    </div>
            <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
        <div className="w-10 rounded-full">
          <img
            alt={user.username}
            src={user.profile.icon} />
        </div>
      </div>
      <ul
        tabIndex={0}
        className="menu menu-sm dropdown-content bg-base-100 rounded-box z-[1] mt-3 w-64 p-2 shadow">
            <li><a href={`/users/${user.username}`}><span className="font-bold inline">{user.profile.name}</span> ({user.username})</a></li>
        <li><a>Settings</a></li>
        <li><a onClick={logoutUser}>Logout</a></li>
      </ul>
    </div>

            </>
    //     <ul className="menu menu-horizontal p-0">
    //         <li>Add Post</li>
    //         <li>
    //     <details>
    //                 <summary><span className="font-bold">{user.profile.name}</span>({user.username}) <img src={user.profile.icon} alt={user.username} /></summary>
    //       <ul className="bg-base-100 rounded-t-none p-2">
    //                     <li><a href={`/users/${user.username}`}>Profile</a></li>
    //         <li><a onClick={logoutUser}>Logout</a></li>
    //       </ul>
    //     </details>
    //   </li>
    //         </ul>
    )
}

export default UserMenu;