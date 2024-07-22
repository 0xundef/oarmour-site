import React, { CSSProperties } from 'react';

const logoStyle: CSSProperties = {
  '--logo-color': '#FFFFFF' as string,
};

const Logo = () => (
    <img
       src="/logo.svg" 
       alt="OArmour Logo" 
       className="w-20 h-20 mr-4" 
      style={logoStyle}
    />
);

export default Logo;
