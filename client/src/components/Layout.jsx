/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import Kowloon from "../lib/Kowloon";
import Profile from "./Profile";
import { changeTheme, togglePostEditor } from "../store/ui";
import { useDispatch, useSelector } from "react-redux";


const Layout = ({ children }) => {

    const dispatch = useDispatch();

    const user = Kowloon.user;
    const actors = useSelector(state => state.ui.actors);
    const currentTheme = useSelector(state => state.ui.theme);
    const themeOptions = useSelector(state => state.ui.themeOptions);

    return (<>
        <div className="navbar main-nav pt-8">
            <div className="flex-1">
                <label htmlFor="left-sidebar" className="btn btn-ghost drawer-button lg:hidden">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-6 h-6 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      
            </label>
                <a className="btn btn-ghost normal-case text-xl" href="/">{Kowloon.settings.title}</a>
            </div>
            <div className="flex-none">
                {!Kowloon.user && <a href="/login">Login</a>}
                {Kowloon.user && (
                    <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost btn-circle avatar">
                            <img className="w-10 rounded-full" src={user.actor.icon.url} />
                        </label>
                        <ul tabIndex={0} className="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                            <li className="w-48 bg-slate-100 rounded-mg"><span className="font-bold">{user.actor.name} ({user.username})</span></li>
                            <li>Select Theme: <select defaultValue={currentTheme} onChange={e => dispatch(changeTheme(e.target.value))}>
                                {themeOptions && themeOptions.map((theme) => (<option key={theme} value={theme}>{theme}</option>))}</select></li>
                            <li><span className="cursor-pointer" onClick={() => Kowloon.logout()}>Logout</span></li>
                        </ul>
                    </div>)}
                </div>
        </div>
        <main>
            <div className="lg:grid lg:grid-cols-4 gap-8">
            <div className="drawer lg:drawer-open lg:grid-cols-1 z-[9999]">
  <input id="left-sidebar" type="checkbox" className="drawer-toggle" />
  <div className="drawer-content flex flex-col items-center justify-center">
    {/* Page content here */}

  
  </div> 
  <div className="drawer-side">
    <label htmlFor="left-sidebar" className="drawer-overlay"></label> 
    <div className="p-4 w-[80%] lg:w-full min-h-screen bg-base-200 text-base-content">
                            {user && <Profile user={user} />}
                            {user && (
                                <>
                                <div className="w-full mb-8 text-center">
                                <div className="addPostButton" onClick={e => dispatch(togglePostEditor())}>
                                    + Add Post
                                    </div>
                                </div>
                                
                                        <h2>Circles</h2>
                                        <ul className="circle-list">
                                        {user.actor.circles.map(circle => (
                                            <li key={circle.id}>
                                            <span>{circle.name}</span></li>
                                        ))}
                                            </ul>

                                    </>
                            )}

                            {actors && (
                                <>
                                    <h2>People</h2>
                                <ul className="actor-list">
                                    {Object.keys(actors).map(id => {
                                        const actor = actors[id];
                                        return (
                                            <a key={id} className="text-black hover:text-black hover:font-bold" href={actor.profile} title={actor.id}>
                                            <li>
                                            <span className="avatar h-8 align-middle mr-2"><img src={actor.icon.url} className="rounded-full" /></span>
                                            <span>{actor.name}</span>

                                                </li>
                                                </a>
                                                )
                                    })}
                                    </ul>
                                    </>
                            )}
    </div>
  
  </div>
                </div>
                <div className="lg:col-span-2">
                    {children}
                    </div>
                </div>
        </main>
    </>)
    
    }
    
    export default Layout;