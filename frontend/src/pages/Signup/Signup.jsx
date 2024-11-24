import React, { useState, useEffect, createRef, useRef } from "react";
import {useNavigate} from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AiFillEye, AiFillEyeInvisible } from "react-icons/ai";
import Kowloon from "../../lib/kowloon";
    
const doSignup = (e) => {
    e.preventDefault();
}
const Signup = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [usernameExists, setUsernameExists] = useState(false);
    const [password, setPassword] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [location, setLocation] = useState({});
    const [locationLabel, setLocationLabel] = useState("");
    const [locationOptions, setLocationOptions] = useState([]);
    const [urls, setUrls] = useState([]);
    const [bio, setBio] = useState("");
    const [icon, setIcon] = useState("");
    const [iconPreview, setIconPreview] = useState(null);
    const [submitActive, setSubmitActive] = useState(true);
    const [error, setError] = useState(null);
    const [pronouns, setPronouns] = useState(Kowloon.pronouns.nonbinary);
    const [showCustomPronouns, setShowCustomPronouns] = useState(false);
    const googleMapsAPIKey = useSelector((state) => state.global.settings.googleMapsAPIKey);

    const domain = useSelector((state) => state.global.settings.domain);

    const handleIconChange = (e) => {
        setIcon(e.target.files[0]);
        const reader = new FileReader();
        reader.addEventListener("load", () => {
            setIconPreview(reader.result);
        });
        reader.readAsDataURL(e.target.files[0]);
    }
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

    const getLocation = async (e) => {
        setLocationLabel(e.target.value);
        if(e.target.value.length < 4) setLocationOptions([])

        let mapped = [];
        if (locationLabel.length > 3 && googleMapsAPIKey) {
            let options = await (await fetch(new URL(`https://maps.googleapis.com/maps/api/geocode/json?address=${locationLabel.split(" ").join("+")}&key=${googleMapsAPIKey}`))).json();
            if (options.status === "OK") {
                // setLocationOptions();
                mapped = options.results.map(o => { return { type: "Point", name: o.formatted_address, latitude: o.geometry.location.lat, longitude: o.geometry.location.lng } });
            //     
            } else {
                setLocationOptions([])
            }
            
        }
        if (mapped.length > 0) setLocationOptions(mapped);
    }

    const doSignup = async (e) => {
        e.preventDefault();

        let activity = {
                type: "Signup",
                object: {
                    username,
                    password,
                    email,
                    profile: {
                        name,
                        location,
                        bio,
                        urls: urls.length > 0 ? urls.trim().split(",") : "",
                        pronouns
                    },
                }
            
        }
        let response = await Kowloon.signup(activity, icon);
        if (response.error) { alert(response.error); } else {
            let res = await Kowloon.login(username, password);
            if (res.key) {
                navigate("../");
        }
        }
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
                    <span className="label-text-alt">This does not have to be your legal name</span>
                </label>
                <input placeholder="Name" className="input input-bordered" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
  
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Location</span>
                </label>
                <input placeholder="Location" className="input input-bordered relative" type="text" value={locationLabel} onChange={(e) => getLocation(e) } />
                <ul className={`${locationOptions.length > 0 ? "visible" : "hidden"} absolute bg-white border border-gray-300 p-4 rounded-md`}>
                    {locationOptions.map((l, idx) => (<li key={idx} className="cursor-pointer hover:font-bold" onClick={() => { setLocation(l); setLocationLabel(l.name); setLocationOptions([]) }}>{l.name}</li>))}
                </ul>
            </div>
            <div className="form-control mb-2">
                <label className="label">
                    <span className="label-text">Icon</span>
                </label>
                <input type="file" className="file-input file-input-bordered w-full max-w-xs" onChange={(e) => handleIconChange(e)} />
                <img src={iconPreview} className="w-24 h-24" />
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