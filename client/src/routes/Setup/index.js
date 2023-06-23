/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import endpoints from "../../lib/endpoints";
import Kowloon from "../../lib/Kowloon";
// import { useRouter } from "next/router";
import { useSelector, useDispatch } from "react-redux";
import { setUser } from "../../store/user";

export default function Handler() {
  const defaultPronouns = {
    plural: {
      subject: "they",
      object: "them",
      possAdj: "their",
      possPro: "theirs",
      reflexive: "themselves",
    },
    masculine: {
      subject: "he",
      object: "him",
      possAdj: "his",
      possPro: "his",
      reflexive: "himself",
    },
    feminine: {
      subject: "she",
      object: "her",
      possAdj: "hers",
      possPro: "hers",
      reflexive: "herself",
    },
  };

  const settings = useSelector((state) => state.settings.settings);
  const [title, setTitle] = useState(settings.title);
  const [domain, setDomain] = useState(settings.domain);
  const [fDomain, setFdomain] = useState(settings.apDomain);
  const [siteSummary, setSiteSummary] = useState("");
  const [siteIcon, setSiteIcon] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState("");
  const [name, setName] = useState("");
  const [urls, setUrls] = useState([]);

  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [pronounSet, setPronounSet] = useState("plural");
  const [pronouns, setPronouns] = useState(defaultPronouns[pronounSet]);
  const [pronounsSubject, setPronounsSubject] = useState(
    defaultPronouns[pronounSet].subject
  );
  const [pronounsObject, setPronounsObject] = useState(
    defaultPronouns[pronounSet].object
  );
  const [pronounsPossAdj, setPronounsPossAdj] = useState(
    defaultPronouns[pronounSet].possAdj
  );
  const [pronounsPossPro, setPronounsPossPro] = useState(
    defaultPronouns[pronounSet].possPro
  );
  const [pronounsReflexive, setPronounsReflexive] = useState(
    defaultPronouns[pronounSet].reflexive
  );
  const [showPronouns, setShowPronouns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTitle(settings.title);
    setDomain(settings.domain);
    setFdomain(settings.apDomain);
  }, [settings]);
  const checkUsername = async (e) => {};

  const checkEmail = async (e) => {};

  const changePronouns = (e) => {
    if (e.target.value !== "other") {
      setShowPronouns(false);
      setPronounSet(e.target.value);
      setPronouns(defaultPronouns[e.target.value]);
      setPronounsSubject(defaultPronouns[e.target.value].subject);
      setPronounsObject(defaultPronouns[e.target.value].object);
      setPronounsPossAdj(defaultPronouns[e.target.value].possAdj);
      setPronounsPossPro(defaultPronouns[e.target.value].possPro);
      setPronounsReflexive(defaultPronouns[e.target.value].reflexive);
    } else {
      setShowPronouns(true);
    }
  };

  const doSetup = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const newUser = {
      username,
      password,
      name,
      email,
      summary,
      location,
      urls,
      isAdmin: true,
      pronouns: {
        object: pronounsObject,
        subject: pronounsSubject,
        possAdj: pronounsPossAdj,
        possPro: pronounsPossPro,
        reflexive: pronounsReflexive,
      },
    };

    let user = await Kowloon.post({ url: endpoints.settings, body: newUser });
  };

  return (
    <>
      <h1 className="text-2xl font-thin mb-8">Setup Kowloon</h1>
      <form className="overflow-y-scroll h-auto">
        <div className="mx-48 grid grid-cols-2 gap-48 overflow-y-scroll">
          <div>
            <h2 className="text-lg mb-8">Server Info</h2>

            <div className="form-control mb-8">
              <span className="label-text">Title</span>
              <input
                id="title"
                name="title"
                className="input input-bordered"
                placeholder="Title"
                defaultValue={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <div class="text-sm text-right">
                This is the title of your Kowloon server.
              </div>
            </div>
            <div className="form-control mb-8">
              <label for="domain">
                <span className="label-text">Domain</span>
              </label>
              <input
                id="domain"
                name="domain"
                className="input input-bordered"
                placeholder="Domain"
                defaultValue={domain}
                onChange={(e) => setDomain(e.target.value)}
              />
              <span class="text-sm text-right">
                This is the domain for your Kowloon server.
              </span>
            </div>
            <div className="form-control mb-8">
              <label for="domain">
                <span className="label-text">Domain</span>
              </label>
              <input
                id="fdomain"
                name="fdomain"
                className="input input-bordered"
                placeholder="Fediverse Domain"
                defaultValue={fDomain}
                onChange={(e) => setFdomain(e.target.value)}
              />
              <span class="text-sm text-right">
                This is the Fediverse domain for your Kowloon server.
              </span>
            </div>
            <div className="form-control mb-8">
              <span className="label-text">Bio</span>
              <textarea
                id="sitesummary"
                name="sitesummary"
                className="textarea textarea-bordered h-48"
                placeholder="A description of your site"
                defaultValue={siteSummary}
                onChange={(e) => setSiteSummary(e.target.value)}
              ></textarea>
            </div>
            <div className="form-control mb-8">
              <label className="label cursor-pointer">
                <span className="label-text">
                  Registration open/invite-only?{" "}
                </span>
                <input
                  type="checkbox"
                  id="open"
                  name="open"
                  className="toggle toggle-success"
                  placeholder="Open"
                  checked={open}
                  onChange={(e) => setOpen(!open)}
                />
              </label>
              <span class="text-sm text-right">
                Is registration on your server open to anyone, or is it
                invite-only?
              </span>
            </div>
          </div>
          <div>
            <h2 className="text-lg mb-8">Your Admin Account</h2>
            <div className="form-control mb-8">
              <span className="label-text">Username</span>
              <input
                id="username"
                name="username"
                className="input input-bordered"
                placeholder="Username"
                defaultValue={username}
                onBlur={checkUsername}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div
                className={`${
                  usernameError && usernameError.length > 1
                    ? "visible"
                    : "hidden"
                }`}
              >
                {usernameError}
              </div>
            </div>
            <div className="form-control mb-8">
              <span className="label-text">Password</span>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                className="input input-bordered"
                placeholder="Password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <div class="text-sm text-right">
                <label htmlFor="showPassword">
                  <span className="label-text">Show Password</span>{" "}
                  <input
                    name="showPassword"
                    id="showPassword"
                    type="checkbox"
                    className="toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </label>
              </div>
            </div>

            <div className="form-control mb-8">
              <span className="label-text">Name</span>
              <input
                id="name"
                name="name"
                className="input input-bordered"
                placeholder="Your name"
                defaultValue={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="form-control mb-8">
              <span className="label-text">Email</span>
              <input
                type="email"
                id="email"
                name="email"
                className="input input-bordered"
                placeholder="Your email"
                defaultValue={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-control mb-8">
              <span className="label-text">Bio</span>
              <textarea
                id="summary"
                name="summary"
                className="textarea textarea-bordered h-48"
                placeholder="Your bio"
                defaultValue={summary}
                onChange={(e) => setSummary(e.target.value)}
              ></textarea>
            </div>
            <div className="form-control mb-8">
              <span className="label-text">Location</span>
              <input
                id="location"
                name="location"
                className="input input-bordered"
                placeholder="Location"
                defaultValue={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="form-control mb-8">
              <span className="label-text">Pronouns</span>
              <select
                id="pronouns"
                name="pronouns"
                className="select select-bordered"
                placeholder="Pronouns"
                defaultValue={pronounSet}
                onChange={changePronouns}
              >
                <option value="plural">They/Them</option>

                <option value="masculine">He/Him</option>
                <option value="feminine">She/Her</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div
              className={`form-control mb-8 ${
                showPronouns ? "visible" : "hidden"
              }`}
            >
              <span className="label-text">Pronouns</span>
              <input
                className="input input-bordered mb-2"
                name="subject"
                placeholder="Subject (i.e. he/her/they)"
                value={pronounsSubject}
                onChange={(e) => setPronounsSubject(e.target.value)}
              />
              <input
                className="input input-bordered mb-2"
                name="object"
                placeholder="Object (i.e. he/her/they)"
                value={pronounsObject}
                onChange={(e) => setPronounsObject(e.target.value)}
              />
              <input
                className="input input-bordered mb-2"
                placeholder="Possessive adjective (i.e. his/hers/their)"
                value={pronounsPossAdj}
                onChange={(e) => setPronounsPossAdj(e.target.value)}
              />
              <input
                className="input input-bordered mb-2"
                placeholder="Possessive adjective (i.e. his/hers/their)"
                value={pronounsPossPro}
                onChange={(e) => setPronounsPossPro(e.target.value)}
              />
              <input
                className="input input-bordered"
                placeholder="Possessive adjective (i.e. his/hers/their)"
                value={pronounsReflexive}
                onChange={(e) => setPronounsReflexive(e.target.value)}
              />
            </div>

            <div className="form-control">
              <button
                className={`btn btn-primary text-white ${
                  submitting && "btn-disabled text-gray-300"
                }`}
                onClick={doSetup}
              >
                Complete Setup
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
