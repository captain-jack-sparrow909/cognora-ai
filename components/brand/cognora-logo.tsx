import Image from "next/image";

type CognoraLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
};

export function CognoraLogo({ size = 38, className = "", alt = "" }: CognoraLogoProps) {
  return (
    <Image
      className={`brand-mark ${className}`.trim()}
      src="/brand/cognora-logo-google.png"
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      unoptimized
    />
  );
}
