/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable no-unused-vars */
import store from "../../store";
import { Provider, useSelector, useDispatch } from "react-redux";
import { useEffect } from "react";
import { setSettings } from "../../store/settings";
import { setUser } from "../../store/user";
import Kowloon from "../../lib/Kowloon";
import endpoints from "../../lib/endpoints";



const Loader = ({children}) => {
  const dispatch = useDispatch();



  useEffect(() => {
    Kowloon.loadSettings();
    Kowloon.loadUser();

  }, []);

  return <>          {children}</>;
};

export default Loader;
