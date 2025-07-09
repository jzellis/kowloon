import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { hideImageModal } from "../../store/ui";
const ImageModal = (props) => {

    const isOpen = useSelector((state) => state.ui.showImageModal);
    const currentMedia = useSelector((state) => state.ui.currentMedia);
    const dispatch = useDispatch();
    const [imageZoomed, setImageZoomed] = useState(false);

    return (
        <>
            <div className={`absolute top-0 left-0 right-0 bottom-0 bg-[rgba(0,0,0,.9)] z-50 ${isOpen === false && "hidden"}`} id="imageModal" onClick={() => dispatch(hideImageModal())}>
                <div className="relative max-w-screen max-h-screen mx-auto my-auto"  onClick={() => setImageZoomed(!imageZoomed)}>
                    <div className="">
                        {currentMedia?.type?.includes("image") && <img className={!imageZoomed ? "max-w-[calc(100vw-40px)] max-h-[calc(100vh-40px)] w-auto h-auto mx-auto my-[20px]" : "w-full h-full"} src={currentMedia?.src || ""} alt={currentMedia?.description} />}
                    {currentMedia?.type?.includes("video") && <video controls><source src={currentMedia?.src} /></video>}
                        {currentMedia?.type?.includes("audio") && <audio controls><source src={currentMedia?.src} /></audio>}
                        </div>
                </div>
            </div>
        </>
    )
}

export default ImageModal;