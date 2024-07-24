const Logo = () => (
<div className="relative z-20 flex items-center">
  <img 
    src="/logo.svg" 
    alt="OArmour Logo" 
    className="w-16 h-16 mr-4 dark:invert" 
    style={{ 
      'logoColor': '#FFFFFF',
    }}
  />
</div>
);

export default Logo;