import React, { CSSProperties } from 'react';

const Logo = () => (
    <img
       src="/logo.svg" 
       alt="OArmour Logo" 
       className="w-20 h-20 mr-4" 
       style={{ '--logo-color': '#FFFFFF' }}
    />
);

export default Logo;