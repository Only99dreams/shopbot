interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-2">
      <img 
        src="/logo.png" 
        alt="ShopAfrica" 
        className={`${sizes[size]} object-contain`}
      />
      {showText && (
        <span className="text-xl font-bold text-foreground">
          shop<span className="text-primary">Africa</span>
        </span>
      )}
    </div>
  );
}
