/* eslint-disable array-callback-return */
/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import { useSelector, useDispatch } from "react-redux";
import { addActor } from "../../store/user";
import { togglePostEditor, toggleProfileEditor } from "../../store/ui";
import { useEffect, useState } from "react";
import {FiEdit2} from "react-icons/fi"
import endpoints from "../../lib/endpoints";
import Kowloon from "../../lib/Kowloon";
import PostEditor from "../PostEditor";
import ProfileEditor from "../ProfileEditor";
const Layout = ({ children }) => {
    const dispatch = useDispatch();
    const title = useSelector((state) => state.settings.settings.title);
    const user = useSelector((state) => state.user.user);
    let actors = useSelector((state) => state.user.actors);
    const [drawerOpen, toggleDrawerOpen] = useState(false);
    const users = [];



    useEffect(() => {
        
        const getFriends = async () => {
            if (user.actor) {
                let cached = {};
                user.actor.circles.forEach(c => {
                        c.items.forEach(i => cached[i] = {})
                        // c.items.map(async i => {
                        //     await dispatch(addActor(i))
                        // })
    
                })
                await Kowloon.loadActors(cached);
            }
        }
        
        getFriends()
    }, [user])

    return (
        <>
            <PostEditor />
            <ProfileEditor />
            <main className="overflow-y-hidden h-screen">
<div className="drawer min-h-screen">
  <input id="nav-drawer" type="checkbox" className="drawer-toggle" checked={drawerOpen} readOnly /> 
                <div className="drawer-content flex flex-col">

    {/* Navbar */}
    <div className="w-full navbar">
      <div className="flex-none">
                            {user && <label onClick={() => toggleDrawerOpen(!drawerOpen)} htmlFor="nav-drawer" className="btn btn-square btn-ghost">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="inline-block w-6 h-6 stroke-current"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                            </label>}
      </div> 
                        <div className="site-title uppercase flex-1 px-2 mx-2">{title}</div>
      <div className="flex-none hidden lg:block">
        <ul className="menu menu-horizontal">
                                {/* Navbar menu content here */}

          <li><a href="/login">Login</a></li>
        </ul>
      </div>
                    </div>
    {/* Page content here */}
    {children}
  </div> 
  <div className="drawer-side">
    <label htmlFor="nav-drawer" className="drawer-overlay" onClick={() => toggleDrawerOpen(false)}></label> 
    <ul className="p-4 w-full lg:w-1/4 bg-base-200 min-h-screen">
                        {/* Sidebar content here */}
                        <div className="w-full text-right"><button className="btn btn-ghost btn-circle" onClick={() => toggleDrawerOpen(false)}>X</button></div>
                        {user && user.actor && (
                            <>
                                <div className="mb-4">
                                        <div className="bg-slate-200 p-4 rounded-lg">
                                            <div className="text-right"><button className="btn btn-circle" onClick={() => { toggleDrawerOpen(false); dispatch(toggleProfileEditor()) }}><FiEdit2 /></button></div>
                                            <div className="flex w-full">
                                        <div className="flex-none w-1/4 mr-4">
                                            <img src={user.actor.icon.url} className="avatar rounded-full" />
                                            </div>
                                            <div className="flex-none w-3/4">
                                            <div className="text-2xl font-light">{user.actor.name}</div>
                                            <div className="text-xs">({user.actor.id})</div>
                                            <div className="text-xs mb-4">{user.actor.location.name}</div>
                                            <div className="text-sm">{user.actor.summary}</div>
                                            <div className="text-sm">{Object.values(user.actor.pronouns).slice(0,2).join("/")}</div>
                                            </div>

                                        <div className="float-none clear-both w-full"></div>    

                                        </div>
                                    </div>
                                </div>
                                <div className="text-center"><button className="btn btn-success" onClick={() => { toggleDrawerOpen(false); dispatch(togglePostEditor()) }}>+ New Post</button></div>
                                <li>Circles
                                    <ul>
                                        {user.actor.circles.map((c, i) => 
                                             (<li key={`circle-${i}`} className="collapse collapse-arrow">
                                                 <input type="checkbox" />
                                                <div className="collapse-title">{c.name}</div>
                                            <div className="collapse-content">
                                                <ul className="h-48 overflow-y-scroll">
                                                    {c.items.map((f, j) => {
                                                        if(actors[f])
                                                        return (
                                                            <li key={`circle-${i}-friend=${j}`} className="group text-sm rounded p-2 hover:font-bold cursor-pointer" title={actors[f].id}>

                                                                <a href={`/${f}`}>
                                                                    <img className="avatar w-8 rounded-full" src={actors[f].icon.url} /> {actors[f].name}
                                                                    </a>
                                                            </li>
                                                        )
                                                    })
                                                    }    
                                                    </ul>
                                            </div>
                                        </li>
                                            )
                                        )}
                                    </ul>
                              
                                </li>
                                </>
                                     ) }
      <li><a href="/logout">Logout</a></li>
      
    </ul>
    
  </div>
</div>
</main>
            </>
)


}

export default Layout;