/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import Kowloon from '../lib/Kowloon';
import { useNavigate } from "react-router-dom";


export default function Handler() {
    const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
    const [showPassword, toggleShowPassword] = useState(false);
    const navigate = useNavigate();

  
    const doLogin = async (e) => {
      e.preventDefault();
      
        await Kowloon.login(username, password);
        navigate("/");
    

      };

    return (
<div className='w-1/3 mx-auto'>
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
