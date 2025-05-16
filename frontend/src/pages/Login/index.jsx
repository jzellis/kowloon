import { useState } from "react";
import Kowloon from "../../lib/Kowloon";
import { useSelector, useDispatch } from 'react-redux'
import { setUser, setTimestamp, setSignature, setCircles } from "../../store/user";
import { useNavigate } from "react-router-dom";
const Login = (props) => {

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const user = useSelector((state) => state.user.user);
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const doLogin = async (e) => {
        e.preventDefault();
        let res = await Kowloon.login(username, password);
        if (res.user) {
            
            dispatch(setUser(res.user));
            dispatch(setTimestamp(res.timestamp));
            dispatch(setSignature(res.signature));
                let circles = await Kowloon.getUserCircles(res.user.id);
                dispatch(setCircles(circles.items));
                localStorage.setItem("circles", JSON.stringify(circles.items));

            navigate("/");
        }
    }
    return (
        <>
            <form onSubmit={doLogin}>
                <fieldset>
                    <input className="input" type="text" placeholder="username" value={username} onChange={(e) => setUsername(e.target.value)}/>
                </fieldset>
                <fieldset>
                    <div className="join">
                    <input className="input join-item" type={showPassword ? "text" : "password"} placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        <div className="btn"><input className="checkbox join-item" type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} /> Show Password</div>
                        </div>
                </fieldset>
                <fieldset  className="mt-8">
                    <button className="btn btn-primary" type="submit">Login</button>
                    </fieldset>

            </form>
            </>
    )
  }
  
  export default Login