import React, { useState, useEffect } from 'react';

const A = ({ link, asset, text }) => {
    const [actionLink, setActionLink] = useState(link)
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

    return <a href={actionLink} target="blank" >
        {text}
    </a>
}

export default A