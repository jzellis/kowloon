/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { toggleProfileEditor } from "../../store/ui";
import ProfileForm from "../ProfileForm";

export default function ProfileEditor(props) {
  const user = useSelector((state) => state.user);
  const showEditor = useSelector((state) => state.ui.profileEditorOpen);

  return (
    <div
      className={`postEditorModal ${!showEditor && "hidden"}`}
      onClick={() => {}}
    >
      <div
        className={`profileEditorBox w-full lg:w-1/2 h-[90%] overflow-y-scroll`}
      >
        <div className="profileEditorWrapper">
          <ProfileForm />
        </div>
      </div>
    </div>
  );
}
