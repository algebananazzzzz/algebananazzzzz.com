import * as React from 'react';
import parse from 'html-react-parser';
import SvgContent from '../../content/contact-svgs.yml'
import { ThemeContext } from '../theme/theme-context';

const ContactButton = ({ svgName, link }) => {
    const { theme } = React.useContext(ThemeContext)
    const [svgSrc, setSvgSrc] = React.useState(null);

    React.useEffect(() => {
        const svgContent = SvgContent[svgName];
        let updatedSvgSrc = svgContent;

        if (theme) {
            updatedSvgSrc = svgContent.dark;
        } else {
            updatedSvgSrc = svgContent.light;
        }
        setSvgSrc(updatedSvgSrc);
    }, [svgName, theme]);

    return <a href={link} target='blank' className='inline-flex justify-center items-center h-[2rem] w-[2rem] md:h-[2.375rem] md:w-[2.375rem] text-center text-gray-600 hover:bg-gray-100 rounded-full dark:text-gray-400 dark:hover:bg-gray-800'>
        <div className={`w-4 md:w-5`}>
            {svgSrc && parse(svgSrc)}
        </div >
    </a>
}
export default ContactButton