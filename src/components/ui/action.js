import React, { useState, useEffect } from 'react';

const Action = ({ link, asset, text, action, color = "indigo" }) => {
    const [actionLink, setActionLink] = useState(null)
    useEffect(() => {
        if (asset) {
            import(`../../static/${asset}`)
                .then(module => {
                    setActionLink(module.default);
                })
                .catch(error => {
                    console.error('Error loading asset:', error);
                });
        } else if (link) {
            setActionLink(link)
        }
    }, [asset, link]);

    return <> {actionLink ?
        <a href={actionLink} target="blank" >
            <span className={`inline-flex items-center py-1.5 px-3 rounded-sm text-sm font-medium bg-${color}-500 hover:bg-${color}-700 dark:bg-${color}-600 dark:hover:bg-${color}-800 text-white`}>{text}</span>
        </a>
        : <button onClick={action} >
            <span className={`inline-flex items-center py-1.5 px-3 rounded-sm text-sm font-medium bg-${color}-500 hover:bg-${color}-700 dark:bg-${color}-600 dark:hover:bg-${color}-800 text-white`}>{text}</span>
        </button>}
    </>
}

export default Action