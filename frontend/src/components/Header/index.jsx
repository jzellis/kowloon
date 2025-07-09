import { useSelector, useDispatch } from 'react-redux';
import {setUser, setToken} from '../../store/user';
import { NavLink, useNavigate } from 'react-router-dom';
import Kowloon from '../../lib/Kowloon';
import "./index.css"
const Header = () => {
    const user = useSelector((state) => state.user.user);
    const server = useSelector((state) => state.server);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    
    const logout = () => {
        dispatch(setUser(null));
        dispatch(setTimestamp(null));
        dispatch(setSignature(null));
        Kowloon.logout();
        navigate("/");
    }

    return (
        <>
            <h1 className=''><img src="/logo-256x.png" className='w-24 h-24 inline' / ><NavLink to="/" className="uppercase font-bold text-2xl">{server?.profile?.name ? server?.profile?.name : "Kowloon"}</NavLink></h1>
            <div id="header" className="navbar w-full">
            <NavLink to="/login">Login</NavLink>
{/* 
                <div className='flex-1 ml-8'>
                    <h1 className=''><img src="/logo-256x.png" className='w-24 h-24 inline' / ><NavLink to="/" className="uppercase font-bold text-2xl">{server?.profile?.name ? server?.profile?.name : "Kowloon"}</NavLink></h1>
                    <div className='text-sm ml-4'>{server?.profile?.subtitle}</div></div>
                
                <div className='flex-none'>

                    {user?.id ? (
                        <div className='dropdown dropdown-end '>
                            <div tabIndex={0} role="button" className="m-1 cursor-pointer">
                                <div className='flex items-center'><img src={user.profile.icon} className="flex-1 w-12 h-12 rounded-full inline mr-2" /><div className='flex-none'><div className='font-bold'>{user.profile.name}</div><div className='text-sm'>{user.id}</div></div></div></div>
                            <ul tabIndex={0} className="menu dropdown-content bg-white z-1 w-52 p-2 shadow-sm">
                                <li className='font-bold text-center'>
                                <a href={`/users/${user.id}`}><img src={user.profile.icon} className="avatar inline mr-2" />
                                   {user.profile.name}</a>
                                </li>
                                <li><NavLink to={`/users/${user.id}/circles`}>Circles</NavLink></li>
                                <li><NavLink to={`/users/${user.id}/groups`}>Groups</NavLink></li>

                                <li className='mt-4'><button className='btn' onClick={logout}>Logout</button>
                                </li></ul>
                        </div>
                    ) : (<NavLink to="/login">Login</NavLink>)}
                    </div> */}
                    </div>


            </>
    )
  }
  
  export default Header