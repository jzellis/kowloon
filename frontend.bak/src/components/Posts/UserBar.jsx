import { NavLink } from "react-router-dom";

const UserBar = ({ actor }) => {
    return (
        <div className="flex items-center gap-2 py-2 pr-2 mb-4">
            <NavLink to={`/users/${actor.id}`} className="hover:underline decoration-dotted"><img className="w-8 h-8 rounded-full inline mr-4" src={actor.profile.icon} />
                <span className="font-bold">{actor.profile.name} ({actor.id})</span>
                </NavLink>
        </div>
    );
}

export default UserBar;