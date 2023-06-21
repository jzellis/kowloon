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

    const doKowloonStuff = async () => {

      await Kowloon.loadSettings();
      await Kowloon.loadUser();

    }

    doKowloonStuff();
    // const getSettings = async () => {
    //   try {

    //           const settings = await Kowloon.get(endpoints.root,{token: null});
    //         dispatch(setSettings(settings));
    //         console.log(settings)
    //     document.title = settings.title;
        
    //       } catch (e) {
    //           console.log(e)
    //       }
    // };

    // const getUser = async () => {
    //     let user = JSON.parse(localStorage.getItem("user"));
    //     if (user) dispatch(setUser(user));

    // };

    // getSettings();
    // getUser();
  }, []);

  return <>          {children}</>;
};

export default Loader;
