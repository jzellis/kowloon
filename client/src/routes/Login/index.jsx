/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import endpoints from '../../lib/endpoints';
import Kowloon from '../../lib/Kowloon';
// import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { setUser } from "../../store/user";


export default function Handler() {
    
    const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, toggleShowPassword] = useState(false);

  // const router = useRouter();
  const dispatch = useDispatch();
    const doLogin = async (e) => {
      e.preventDefault();
      
      try {
        const { token, user } = await Kowloon.login({ username, password });
    
        if (token && user) {
          
          localStorage.setItem("token", token);
          localStorage.setItem("user", JSON.stringify(user));
          dispatch(setUser(user));
          window.location.href = "/";
          // router.push("/");
        }
      } catch (e) {
        console.log(e)
      }
      };

    return (
        <div className="w-1/3 mx-auto">
            <h1 className='text-xl mb-8'>Login</h1>
        <div className="form-control">
          <input
            className="input input-bordered"
            type="text"
            name="username"
            placeholder="Username"
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="form-control mt-4">
          <input
            className="input input-bordered"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            onChange={(e) => setPassword(e.target.value)}
          />
          <label className='text-right'>
            <span className='label-text mr-2'>Show Password</span>
            <input type="checkbox" checked={showPassword} onChange={(e) => toggleShowPassword(!showPassword)} />
          </label> 
        </div>
        <div className="form-control text-center mt-4">
          <button className="btn btn-primary" type="button" onClick={doLogin}>
            Login
          </button>
        </div>
      </div>
    );
  
}
