import Image from "next/image";

export default function Logo() {
  return <div className="relative z-20 flex items-center">
    <Image
      src="/logo.svg"
      alt="OArmour Logo"
      width={40}
      height={40}
      className="w-10 h-10 mr-4 dark:invert"
    />
  </div>
}