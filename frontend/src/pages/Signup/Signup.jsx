import React, { useState, useEffect, createRef, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import Kowloon from "../../lib/kowloon";
    
const doSignup = (e) => {
    e.preventDefault();
}
const Signup = () => {
    const [username, setUsername] = useState("");
    const [usernameExists, setUsernameExists] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [location, setLocation] = "";
    const [urls, setUrls] = useState([]);
    const [bio, setBio] = useState("");
    const [icon, setIcon] = useState("");
    const [iconPreview, setIconPreview] = useState(null);
    const [submitActive, setSubmitActive] = useState(true);
    const [error, setError] = useState(null);
    const [pronouns, setPronouns] = useState(Kowloon.pronouns.nonbinary);
    const [showCustomPronouns, setShowCustomPronouns] = useState(false);

    const domain = useSelector((state) => state.global.settings.domain);

    const checkUsername = async (e) => {
        e.preventDefault();
        let data = await Kowloon.get(`${Kowloon.baseUrl}/checkUsername?username=${username}`);
        setUsernameExists(data.exists);
        setSubmitActive(data.exists ? false : true);
    }

    const generateRandomPassword = (e) => {
        e.preventDefault();
        setPasswordVisible(true);
        setPassword(Kowloon.generateRandomPassword());
    }

    const selectPronouns = (p) => {
        switch (p) {

            case "m":
                setShowCustomPronouns(false);
                setPronouns(Kowloon.pronouns.male);
                break;
            case "f":
                setShowCustomPronouns(false);
                    setPronouns(Kowloon.pronouns.female);
                break;
            case "n":
                setShowCustomPronouns(false);
                setPronouns(Kowloon.pronouns.nonbinary);
                break;
            case "o":
                setShowCustomPronouns(true);
                break;
        }
    }

    const doSignup = async (e) => {
        e.preventDefault();

        let user = {
            username,
            password,
            email,
            name,
            location,
            icon,
            bio,
            urls: urls.length > 0 ? urls.trim().split("\\s*,\\s*"):"",
            pronouns
        }
        console.log(user);
    }

        return <form onSubmit={doSignup} className=" w-1/2 mx-auto">
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text font-bold">Username *</span>
                    <span className="label-text-alt">@{username}@{domain}</span>
                </label>
                <input placeholder="Username" className="input input-bordered" type="text" value={username} onChange={(e) => setUsername(e.target.value)} onBlur={checkUsername} />
            </div>
            {usernameExists && <p className="text-red-600">Username already exists</p>}
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text font-bold">Password *</span>
                    <span className="label-text-alt"><button className="btn btn-sm" onClick={generateRandomPassword}>Generate random password</button></span>
                </label>
                <div className="join w-full">
                    <input placeholder="Password" className="input input-bordered join-item w-full" type={passwordVisible ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button className="btn  join-item rounded-r-lg" type="button" onClick={() => setPasswordVisible(!passwordVisible)}>{passwordVisible ? <AiFillEye /> : <AiFillEyeInvisible /> }</button>
                    </div>
            </div>
            <div className="form-control mb-8">
                <label className="label">
                    <span className="label-text font-bold">Email *</span>
                </label>
                <input placeholder="Email" className="input input-bordered" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="divider my-16">Profile</div>
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text font-bold">Full/Display Name *</span>
                    <span className="label-text-alt">This does not have to be your real name</span>
                </label>
                <input placeholder="Name" className="input input-bordered" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
  
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Location</span>
                </label>
                <input placeholder="Location" className="input input-bordered" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Icon</span>
                </label>
                <input placeholder="Icon" className="input input-bordered" type="text" value={icon} onChange={(e) => setIcon(e.target.value)} />
            </div>
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Bio</span>
                </label>
                <textarea placeholder="Bio" className="textarea textarea-bordered h-24" type="text" value={bio} onChange={(e) => setBio(e.target.value)}></textarea>
            </div>
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Urls</span>
                    <span className="label-text-alt">Comma separated, like "https://example.com, https://example2.com"</span>
                </label>
                <input placeholder="Urls" className="input input-bordered" type="text" value={urls} onChange={(e) => setUrls(e.target.value)} />
            </div>
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Pronouns</span>
                </label>
                <select className="select select-bordered" defaultValue="n" onChange={(e) => selectPronouns(e.target.value)}>
                    <option value="m">Male (he/him)</option>
                    <option value="f">Female (she/her)</option>
                    <option value="n">Nonbinary (they/them)</option>
                    <option value="o">Other</option>
                </select>
            </div>
            {showCustomPronouns && (
                <div className="mx-4 grid grid-cols-2 gap-2">
                    <div className="form-control mb-2">
                        <label className="label">
                            <span className="label-text">Object</span>
                        </label>
                    <input name="object" className="input input-bordered" placeholder="them" />
                </div>
                <div className="form-control mb-2">
                        <label className="label">
                            <span className="label-text">Subject</span>
                        </label>
                    <input name="subject" className="input input-bordered" placeholder="they"/>
                </div>
                <div className="form-control mb-2">
                        <label className="label">
                            <span className="label-text">Possessive Adjective</span>
                        </label>
                    <input name="possadj" className="input input-bordered" placeholder="their"/>
                </div>
                <div className="form-control mb-2">
                        <label className="label">
                            <span className="label-text">Possessive Pronoun</span>
                        </label>
                    <input name="posspro" className="input input-bordered" placeholder="theirs"/>
                </div>
                <div className="form-control mb-2">
                        <label className="label">
                            <span className="label-text">Reflexive</span>
                        </label>
                    <input name="reflexive" className="input input-bordered" placeholder="themselves"/>
                </div>
                </div>
            )}
            <div className="form-control mt-8">
                <button className="btn btn-primary" type="submit" disabled={!submitActive}>Signup</button>
            </div>
        </form>;
    };
    export default Signup;