import { useParams } from "react-router-dom"
import { useState, useEffect, use } from "react";
import Kowloon from "../../lib/Kowloon";
import dayjs from "dayjs";
import "./index.css";
const Page = () => {

  let {id} = useParams();
  let [page, setPage] = useState(null);

  useEffect(() => {


    const getPage = async (id) => {
      let req = await Kowloon.getPage(id);
      setPage(req.page);
    }
    getPage(id);
  }, []);

  console.log(page);

  return (
    <>
      <div className="page w-2/3 mx-auto p-8 relative bottom-0 max-h-screen overflow-x-hidden overflow-y-auto">
      {page?.image && (<div class={`w-full h-[400px] overflow-hidden relative inline-block align-middle rounded-lg bg-gray-400 my-8`}>
              <img
                src={page.image}
                      alt={page.title}
                class="absolute top-1/2 left-1/2 w-auto h-full -translate-x-1/2 -translate-y-1/2 object-cover"
              />
            </div>)}

        <div className="border-b border-gray-400 pb-4"><div className="title font-bold text-3xl align-middle">{page?.title}</div><div className="text-right text-sm"><span className="font-bold">{page?.actor?.id}</span> <span>{dayjs(page?.createdAt).format("MMM DD, YYYY [@] h:mm a zzz")}</span></div></div>
        <div className="body  pt-[1em] mt-8 mb-40" dangerouslySetInnerHTML={{ __html: page?.body }}></div>
        </div>
      </>
    )
  }
  
  export default Page