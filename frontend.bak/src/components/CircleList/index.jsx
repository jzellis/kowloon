import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
// import { setCircles } from "../../store/user";
import { NavLink } from "react-router-dom";
import Kowloon from "../../lib/Kowloon";

const CircleList = (props) => {

    // const [currentCircle, setCurrentCircle] = useState({});
    // const user = useSelector(state => state.user.user);
    // const dispatch = useDispatch();

    // const getCircle = async (id) => {
    //     return (await Kowloon.getCircle(id)).circle;
    // }
    // const copyCircle = async (circle) => {
    //     let activity = {
    //         actorId: user?.id,
    //         type: "Create",
    //         objectType: "Circle",
    //         object: { ...circle, actorId: user?.id },
    //         to: circle.to,
    //         replyTo: circle.replyTo,
    //         reactTo: circle.reactTo
    //     }

    //     let createdActivity = await Kowloon.createActivity(activity);
    //     if (createdActivity) {
    //         let circles = await Kowloon.getUserCircles(user?.id);
    //         dispatch(setCircles(circles.items));
    //         document.getElementById('circleModal').hideModal()

    //     }
    //     return activity.error ? activity.error : createdActivity;
    }
    return (
        <>
        <ul className={`circle-list leading-5`}>
                {/* {props.circles?.map((circle, i) => {
            return (circle.id != user?.blocked && <li key={i} className="p-4">
                <h3 className="font-bold text-lg cursor-pointer" onClick={() => { setCurrentCircle(circle); console.log("Current circle: ", currentCircle);  document.getElementById('circleModal').showModal() }}> {circle.icon && <img src={circle.icon} className="avatar inline rounded-sm h-8 w-auto max-w-[2em] mr-2" />}
                    {circle.name} ({circle.memberCount})</h3>
            </li>)
        })} */}
            </ul>

<dialog id="circleModal" className="modal">
  <div className="modal-box">
                    {/* <h3 className="font-bold text-lg"><img src={currentCircle?.icon} className="avatar inline rounded-sm h-8 w-auto max-w-[2em] mr-2" />{currentCircle?.name && currentCircle?.name}</h3>
                    {currentCircle?.description && <div className="text-sm">{currentCircle?.description}</div>}
                    <ul className={`circle-members-list mt-4 ml-4  max-h-80 overflow-y-scroll`}>
        {currentCircle?.members?.map((member, i) => {
            return (<li key={i} className="text-sm mb-2">
                
                <a href={member.url} target="_blank" rel="noopener noreferrer">{member.icon && <img src={member.icon} className="avatar inline rounded-sm h-8 w-auto max-w-[2em] mr-2" />}
                    <span className="font-bold">{member.name}</span> ({member.id})
                    </a>
            </li>)
        })}
            </ul>
    <div className="modal-action">
      <form method="dialog">
        {/* if there is a button in form, it will close the modal */}
                            {user.id === currentCircle.actorId && <span className="btn">Post To Circle</span>} <span className="btn" onClick={() => copyCircle(currentCircle)}>Copy Circle</span> <button className="btn">Close</button>
      </form>
    </div> */}
  </div>
</dialog>
    </>
        );
}

export default CircleList