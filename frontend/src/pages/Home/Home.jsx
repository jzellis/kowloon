import { useSelector } from 'react-redux';
import Menu from '../../components/Menu/Menu.jsx'
import { Outlet } from 'react-router-dom';


import Timeline from '../../components/Timeline/Timeline.jsx';
import PostEditor from '../../components/PostEditor/PostEditor.jsx';


const Home = () => {
  const loading = useSelector((state) => state.global.loading);
  const postEditorVisible = useSelector((state) => state.global.postEditorVisible);



  
  return (
    <div className='container mx-auto h-screen'>
      {loading && <div>Loading...</div>}
      {postEditorVisible && <PostEditor />}
      <Menu />
      <Outlet />
      </div>
  )
}

export default Home
