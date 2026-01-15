import { MessageCircle } from "lucide-react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
}

const sizes = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
};

const iconSizes = {
  sm: 24,
  md: 32,
  lg: 40,
};

export function Logo({ size = "md", showText = true }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${sizes[size]} bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg`}>
        <MessageCircle className="text-white" size={iconSizes[size] * 0.6} fill="white" />
      </div>
      {showText && (
        <span className="text-xl font-bold text-foreground">
          WhatsApp<span className="text-gradient">Shop</span>
        </span>
      )}
    </div>
  );
}
