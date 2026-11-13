interface BrandLogoProps {
  className?: string;
  title?: string;
}

/** 渲染首页页头与页脚共用的 LYCOBO 字标。 */
export function BrandLogo({ className = "", title = "LYCOBO" }: BrandLogoProps) {
  return (
    <img
      alt={title}
      className={className}
      height="33"
      src="/brand/lycobo-landing.svg"
      width="108"
    />
  );
}
