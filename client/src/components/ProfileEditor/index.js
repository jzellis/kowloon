/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toggleProfileEditor } from "../../store/ui";

export default function ProfileEditor(props) {
  const user = useSelector((state) => state.user.user);
  const showEditor = useSelector((state) => state.ui.profileEditorOpen);
  const [username, setUsername] = useState(
    user && user.username ? user.username : null
  );
  const [password, setPassword] = useState("");
  const [showPassword, toggleShowPassword] = useState(false);

  const [email, setEmail] = useState(user && user.email ? user.email : null);
  const [name, setName] = useState(user && user.actor ? user.actor.name : null);
  const [summary, setSummary] = useState(
    user && user.actor ? user.actor.summary : null
  );
  const [location, setLocation] = useState(
    user && user.actor ? user.actor.location.name : null
  );
  const [urls, setUrls] = useState(user && user.actor ? user.actor.url : []);
  const [prefs, setPrefs] = useState(user ? user.prefs : {});

  const dispatch = useDispatch();

  useEffect(() => {
    setUsername(user.username);
    setEmail(user.email);
    setName(user.actor && user.actor.name);
    setSummary(user.actor && user.actor.summary);
    setLocation(user.actor && user.actor.location.name);
    setUrls(user.actor && user.actor.url.map((a) => a.href));
    setPrefs(user.prefs);
  }, [user]);

  const addLink = (e) => {
    e.preventDefault();
    setUrls([...urls, ""]);
  };

  const updateProfile = async () => {
    const updatedUser = {
      username,
      email,
      prefs: prefs,
      actor: {
        name,
        summary,
        url: urls.map((u) => {
          return u.length > 0 ? { href: u } : undefined;
        }),
      },
    };

    console.log(updatedUser);
  };

  return (
    <div
      className={`postEditorModal ${!showEditor && "hidden"}`}
      onClick={() => {}}
    >
      <div className={`profileEditorBox w-full lg:w-1/2`}>
        <div className="profileEditorWrapper">
          <div className="form-control">
            <label className="label" htmlFor="username">
              <span className="label-text">Username</span>
            </label>
            <input
              name="username"
              className="input input-bordered"
              defaultValue={username}
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="password">
              <span className="label-text">Password</span>
            </label>

            <input
              name="password"
              className="input input-bordered"
              type={showPassword ? "text" : "password"}
            />
            <div className="text-right mt-2">
              <label className="label cursor-pointer" htmlFor="showPassword">
                <span className="label-text">Show Password</span>

                <input
                  id="showPassword"
                  name="showPassword"
                  type="checkbox"
                  className="toggle"
                  onChange={() => toggleShowPassword(!showPassword)}
                />
              </label>
            </div>
          </div>
          <div className="form-control">
            <label className="label" htmlFor="name">
              <span className="label-text">Name</span>
            </label>
            <input
              name="name"
              className="input input-bordered"
              defaultValue={name}
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="email">
              <span className="label-text">Email</span>
            </label>
            <input
              type="email"
              name="email"
              className="input input-bordered"
              defaultValue={email}
            />
          </div>
          <div className="form-control">
            <label className="label" htmlFor="summary">
              <span className="label-text">Bio</span>
            </label>
            <textarea
              name="summary"
              className="textarea textarea-bordered h-24"
              defaultValue={summary}
            ></textarea>
          </div>
          <div className="form-control">
            <label className="label" htmlFor="email">
              <span className="label-text">Links</span>
            </label>

            {urls && (
              <div>
                {urls.map((u, i) => (
                  <div className="flex mb-2">
                    <input
                      key={`urls-${i}`}
                      name="urls"
                      className="input input-bordered flex-1"
                      placeholder="http://www.yoursite.com"
                      defaultValue={urls[i]}
                      onChange={(e) => {
                        let newurls = urls;
                        newurls[i] = e.target.value;
                        setUrls(newurls);
                      }}
                    />
                    <button
                      className="flex-none ml-2 btn btn-success btn-circle"
                      onClick={addLink}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {prefs && (
            <>
              <h2>Preferences </h2>
              <div className="form-control">
                <label className="label" htmlFor="defaultPostType">
                  <span className="label-text">Default Post Type</span>
                </label>
                <select
                  className="select select-bordered"
                  defaultValue={prefs && prefs.defaultPostType}
                  onChange={(e) => {
                    setPrefs({ ...prefs, defaultPostType: e.target.value });
                  }}
                >
                  <option value="Note">Note</option>
                  <option value="Article">Article</option>
                  <option value="Media">Media</option>
                  <option value="Link">Link</option>
                </select>
              </div>
              <h2>Privacy</h2>
              <div className="form-control">
                <label className="label" htmlFor="postsArePublic">
                  <span className="label-text">
                    Posts are public by default?
                  </span>
                  <input
                    name="postsArePublic"
                    type="checkbox"
                    className="toggle"
                    checked={prefs && prefs.defaultIsPublic}
                    onChange={(e) => {
                      setPrefs({
                        ...prefs,
                        defaultIsPublic: !prefs.defaultIsPublic,
                      });
                    }}
                  />
                </label>
              </div>
              <div className="form-control">
                <label className="label" htmlFor="postsArePublic">
                  <span className="label-text">Follower list is public?</span>
                  <input
                    name="postsArePublic"
                    type="checkbox"
                    className="toggle"
                    checked={prefs && prefs.publicFollowers}
                    onChange={(e) => {
                      setPrefs({
                        ...prefs,
                        publicFollowers: !prefs.publicFollowers,
                      });
                    }}
                  />
                </label>
              </div>
              <div className="form-control">
                <label className="label" htmlFor="postsArePublic">
                  <span className="label-text">Following list is public?</span>
                  <input
                    name="postsArePublic"
                    type="checkbox"
                    className="toggle"
                    checked={prefs && prefs.publicFollowing}
                    onChange={(e) => {
                      setPrefs({
                        ...prefs,
                        publicFollowing: !prefs.publicFollowing,
                      });
                    }}
                  />
                </label>
              </div>
            </>
          )}
          <div className="modal-action">
            <label
              htmlFor="my_modal_6"
              className="btn btn-ghost"
              onClick={() => {
                dispatch(toggleProfileEditor());
              }}
            >
              Cancel
            </label>
            <button onClick={() => updateProfile()} className="btn btn-success">
              Update Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
