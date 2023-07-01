/* eslint-disable jsx-a11y/alt-text */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import endpoints from '../../lib/endpoints';
import Kowloon from '../../lib/Kowloon';
import { useSelector } from 'react-redux';
import Post from '../../components/Post';

export async function loader({ params }) {
  const actor = params.actor;
  return actor ;
}

export default function Handler(){

  const id = useLoaderData();
  const [actor, setActor] = useState({});
  const [posts, setPosts] = useState([]);
  const user = useSelector(state => state.user);
  const [isFollowing, setIsFollowing] = useState(false);
  const loadActor = async (id) => {

    setActor(await Kowloon.get(endpoints.profile(id)));

  }

  const loadPosts = async (id) => {

    setPosts((await Kowloon.get(endpoints.outbox(id))).items);

  }


  useEffect(() => {
    loadActor(id);
  }, []);

  useEffect(() => {
    loadPosts(id)
  }, [actor]);
  
  


  useEffect(() => {
    if (user.actor && actor) {
      setIsFollowing(user.actor.following.items.indexOf(actor.id) !== -1);
    }
   }, [user, actor]);
  
  return (
    <div className="lg:w-2/5 mx-2 lg:mx-auto h-screen overflow-y-scroll pb-48">
      <div className='grid grid-cols-4 w-full'>
      {actor.icon && <div className='mr-4'><img className='avatar rounded-full' src={actor.icon.url} /></div>}
        <div className='col-span-3'>
          <div className='text-lg font-bold'>  {actor.name}</div>
          <div className='text-sm italic mb-4'>{actor.id}</div>
          {actor.location && <div className='mb-4'>{actor.location.name}</div>}
          <div>{actor.summary}</div>
          <div><button className={`btn btn-sm ${!isFollowing && "btn-success"}`}>{isFollowing ? "Following" : "+ Follow"}</button></div>
        </div>
      </div>
      <h2 className='mt-16 mb-8 text-lg'>Posts</h2>
      {posts && <ul className='posts'>
        {posts.map((activity, idx) => {
          activity.actor = actor;
          return (
          
            <li
              key={`post-${activity.id}-${idx}`}
              className={`post ${activity.object.type}  bg-white shadow-lg rounded-lg p-8`}
            >
              <Post
                activity={activity}
                className={activity.object.type}
                actor={actor}
              />
            </li>
          )
        })}
      </ul>}
      </div>
    );
  
}
