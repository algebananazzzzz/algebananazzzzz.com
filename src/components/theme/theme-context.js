import React, { createContext, useState, useEffect } from 'react';

export const ThemeValues = {
    dark: true,
    light: false,
};

export const ThemeContext = createContext(
    ThemeValues.dark,
)

const ThemeProvider = (props) => {
    const [theme, setTheme] = useState(ThemeValues.dark);

    function changeTheme(theme) {
        setTheme(theme);
    }

    useEffect(() => {
        switch (theme) {
            case ThemeValues.light:
                document.body.classList.remove('dark');
                break;
            case ThemeValues.dark:
                document.body.classList.add('dark');
                break;
            default:
                document.body.classList.add('dark');
                break;
        }
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, changeTheme }}>
            {props.children}
        </ThemeContext.Provider>
    );
}

export default ThemeProvider