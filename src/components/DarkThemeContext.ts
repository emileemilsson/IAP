import React, { useContext } from 'react';

const DarkThemeContext = React.createContext(false);

export const DarkThemeProvider = DarkThemeContext.Provider;

export const GetSpriteCssClass = () => {
    const isDarkTheme = useContext(DarkThemeContext);
    return isDarkTheme ? 'sprite-light' : 'sprite-dark';
}

export default DarkThemeContext;