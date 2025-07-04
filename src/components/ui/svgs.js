import * as React from 'react';
import parse from 'html-react-parser';
import SvgList from '../../content/svgs.yml'

const SvgListed = ({ svgName, redirect = false, svgSizeSm = 3, svgSizeMd = 5 }) => {
    const svg = SvgList[svgName]

    return <> {redirect ?
        <a href={svg.link} target='blank' className='inline-flex justify-center items-center w-10 h-10 text-center text-gray-600 hover:bg-gray-100 rounded-full dark:text-gray-400 dark:hover:bg-gray-800'>
            <svg className={`w-${svgSizeSm} md:w-${svgSizeMd}`} viewBox={svg.viewbox} fill={svg.fill ? svg.fill : "currentColor"} stroke={svg.stroke}>
                {parse(svg.path)}
            </svg>
        </a>
        : <span className='text-gray-600 dark:text-gray-400'>
            <svg className={`w-${svgSizeSm} md:w-${svgSizeMd}`} viewBox={svg.viewbox} fill={svg.fill ? svg.fill : "currentColor"} stroke={svg.stroke}>
                {parse(svg.path)}
            </svg>
        </span>}
    </>
}

export default SvgListed