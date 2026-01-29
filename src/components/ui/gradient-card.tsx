import { cn } from "@/lib/utils";
import { Card } from "./card";

import gradientOrange from "@/assets/gradients/gradient-orange.png";
import gradientPurple from "@/assets/gradients/gradient-purple.png";
import gradientGreen from "@/assets/gradients/gradient-green.png";
import gradientPolar from "@/assets/gradients/gradient-polar.jpeg";
import gradientWarm from "@/assets/gradients/gradient-warm.jpeg";

export type GradientVariant = "orange" | "purple" | "green" | "polar" | "warm";

const gradientImages: Record<GradientVariant, string> = {
  orange: gradientOrange,
  purple: gradientPurple,
  green: gradientGreen,
  polar: gradientPolar,
  warm: gradientWarm,
};

interface GradientCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: GradientVariant;
  children: React.ReactNode;
}

export function GradientCard({ 
  variant = "orange", 
  children, 
  className,
  ...props 
}: GradientCardProps) {
  return (
    <Card className={cn("relative overflow-hidden", className)} {...props}>
      {/* Background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center opacity-50"
        style={{ backgroundImage: `url(${gradientImages[variant]})` }}
      />
      
      {/* Blur overlay - reduced blur for more visibility */}
      <div className="absolute inset-0 backdrop-blur-md bg-background/40" />
      
      {/* Content */}
      <div className="relative z-10">
        {children}
      </div>
    </Card>
  );
}
