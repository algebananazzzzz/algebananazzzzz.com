import React, { useEffect, useState } from 'react'

const VideoPopupComponent = ({ popup, setPopup }) => {
    const [videoSrc, setVideoSrc] = useState(null);

    useEffect(() => {
        if (popup) {
            import(`../../static/${popup}`)
                .then(module => {
                    setVideoSrc(module.default);
                })
                .catch(error => {
                    console.error('Error loading video:', error);
                });
        }
    }, [popup]);

    return <> {popup && <div className="w-full h-full fixed top-0 left-0 z-[60]">
        <div className="max-w-7xl max-h-screen py-4 px-2 sm:px-4 lg:px-6 mx-auto">
            <div className="p-2 sm:p-4 md:p-6 relative flex flex-col bg-white border dark:border-gray-600 shadow-lg rounded-md dark:bg-gray-800">
                <iframe title='demo' className="aspect-video" src={videoSrc} type="video/mp4" />
                <button onClick={() => { setPopup(null) }} className="mt-3 py-2 px-3 inline-flex justify-center items-center rounded-md bg-gray-200 font-semibold text-gray-500 hover:text-white hover:bg-gray-500 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all text-sm dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-600 dark:text-white dark:focus:ring-offset-gray-800">
                    Close
                </button>
            </div>
        </div>
    </div>}
    </>
}

export default VideoPopupComponent