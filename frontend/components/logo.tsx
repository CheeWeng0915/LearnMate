import Image from "next/image";
import Link from "next/link";

type LogoProps = {
  href?: string;
  className?: string;
  imageClassName?: string;
};

export function Logo({
  href = "/",
  className = "",
  imageClassName = "h-10 w-auto",
}: LogoProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center shrink-0 ${className}`}
      aria-label="LearnMate home"
    >
      <Image
        src="/logo.svg"
        alt="LearnMate"
        className={imageClassName}
        width={1780}
        height={500}
        priority
      />
    </Link>
  );
}
