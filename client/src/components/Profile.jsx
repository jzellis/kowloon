/* eslint-disable no-unused-vars */
/* eslint-disable react/prop-types */
import { useState, useEffect } from "react"

const Profile = ({ user }) => {
    const [editMode, setEditMode] = useState(false);
    const [bio, setBio] = useState(user.actor.summary);

    useEffect

return (                                <div className="profile flex">
    <div className="user-avatar flex-none"><img src={user.actor.icon.url} title={user.actor.name} /></div>
    <div className="flex-1">
<div className="user-name">{user.actor.name}</div>
        <div className="user-id">{user.actor.id}</div>
        <div>
            <div className={`user-bio p-2 ${editMode && "bg-white"}`} tabIndex={editMode ? 1 : 0} contentEditable={editMode} onClick={e => setEditMode(true)} onInput={e => setBio(e.currentTarget.textContent)} onBlur={e => setEditMode(false)}>{bio}</div>
            {editMode && <div className="text-right mt-2"><span className={`btn btn-xs btn-primary`}>Update bio</span></div>}
            </div>
    </div>
</div>
)

}

export default Profile