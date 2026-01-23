import Image from "next/image";

export default function Logo() {
  return <div className="relative z-20 flex items-center">
    <Image
      src="/logo.svg"
      alt="OArmour Logo"
      width={64}
      height={64}
      className="w-16 h-16 mr-4 dark:invert"
    />
  </div>
}