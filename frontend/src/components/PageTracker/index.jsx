import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setcurrentUrl } from '../../store/ui'; // adjust path as needed

const PageTracker = () => {
  const location = useLocation();
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setcurrentUrl(location.pathname));
  }, [location.pathname, dispatch]);

  return null; // this component doesn't render anything
};

export default PageTracker;