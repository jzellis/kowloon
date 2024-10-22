import React, {useState} from "react";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import { useSelector, useDispatch } from "react-redux";
import Kowloon from "../../lib/kowloon";
const Login = (props) => {

    const [loggingIn, setLoggingIn] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const dispatch = useDispatch();

    const doLogin = async (e) => {
    
        e.preventDefault();
        setLoggingIn(true);
        setLoggingIn(true);
        let res = await Kowloon.login(username, password);
        if (res.key) {
            setLoggingIn(false);
            document.getElementById("login").close();
        }
    }
    return (
        <>
            <span className="btn btn-primary" onClick={(e) =>{ document.getElementById("login").showModal() }}>Login</span>
        <dialog id="login" className={`modal`}>
            <div className="modal-box">
            <form onSubmit={doLogin}>
                        <div className="form-control mb-2">
                        <input placeholder="Username" className="input input-bordered" type="text" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
                        <div className="form-control mb-4 w-full">
                            <div className="join w-full"><input placeholder="Password" className="input input-bordered join-item w-full" type={passwordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} /><button className="btn  join-item rounded-r-full" type="button" onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <AiFillEyeInvisible /> : <AiFillEye /> }</button></div></div>
                <div className="text-center"><input className="btn btn-primary" type="submit" value="Login" disabled={loggingIn} /></div>
            </form>
            </div>
            <form method="dialog" className="modal-backdrop">
    <button>close</button>
  </form>
            </dialog>
            </>
    )

}

export default Login;