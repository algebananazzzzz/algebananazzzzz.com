import * as React from 'react';
import Action from './action';
import Svg from './svg';

const ProjectCard = ({ setPopup, name, date, svgIcons, actions, description, additional_description }) => {

    return <div className={`group flex flex-col bg-white border dark:border-gray-700 shadow-sm rounded-md px-4 md:px-5 dark:bg-gray-800 hover:bg-gray-200 dark:shadow-slate-700/[.7] ${additional_description && "hover:border-gray-300 dark:hover:bg-gray-600 dark:hover:border-gray-500 transition-all duration-250"}`}>
        <div className={`child block py-4 md:py-5 ${additional_description && "group-hover:hidden"}`}>
            {date && <p className="text-sm font-medium text-fuchsia-500 dark:text-fuchsia-500">
                {date}
            </p>}
            <p className="mt-1 font-bold text-lg md:text-xl text-gray-800 dark:text-gray-200">
                {name}
            </p>
            <p className="mt-2 text-base text-gray-700 dark:text-gray-400">
                {description}
            </p>
            {!additional_description && actions && <div className="mt-2 flex gap-x-2">
                {actions.map((value) => {
                    return <Action text={value.text} action={value.video ? () => { setPopup(value.video) } : null} asset={value.asset} link={value.link} color={value.color}></Action>
                })}
            </div>}
            {svgIcons && <div className="mt-2 flex items-center gap-x-1">
                {svgIcons.map((value) => {
                    return <div className='inline-flex justify-center items-center h-[2rem] w-[2rem] md:h-[2.375rem] md:w-[2.375rem] text-center text-gray-600 dark:text-gray-400'>
                        <Svg key={value} svgName={value}></Svg>
                    </div>
                })}
            </div>}
        </div>
        {additional_description && <div className="child hidden group-hover:block py-3 md:py-4">
            <p className="text-gray-800 dark:text-gray-300 text-justify">
                {additional_description}
            </p>
            {actions && <div className="mt-2 flex gap-x-2">
                {actions.map((value) => {
                    return <Action text={value.text} action={value.video ? () => { setPopup(value.video) } : null} asset={value.asset} link={value.link} color={value.color}></Action>
                })}
            </div>}
        </div>}
    </div>
}
export default ProjectCard