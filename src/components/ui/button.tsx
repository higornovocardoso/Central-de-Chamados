import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.625rem] text-sm font-medium cursor-pointer transition-[background-color,border-color,box-shadow,color,transform,filter] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Relevo de vidro: luz no topo, sombra curta e um halo da própria
        // cor; no hover o halo cresce e um brilho atravessa o botão.
        default:
          "btn-sheen bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary)_84%,white),var(--primary))] text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(11_16_34/0.2),0_6px_16px_-8px_var(--primary)] hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_1px_2px_rgb(11_16_34/0.2),0_12px_26px_-10px_var(--primary)]",
        destructive:
          "btn-sheen bg-[linear-gradient(180deg,color-mix(in_oklab,var(--destructive)_86%,white),var(--destructive))] text-destructive-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(11_16_34/0.2),0_6px_16px_-8px_var(--destructive)] hover:brightness-[1.06]",
        outline:
          "border border-input bg-surface shadow-[inset_0_1px_0_rgb(255_255_255/0.7),0_1px_2px_rgb(11_16_34/0.05)] hover:border-primary/40 hover:bg-hover dark:bg-white/[0.03] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] dark:hover:bg-white/[0.06]",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/75",
        ghost: "hover:bg-hover hover:text-foreground",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-[0.8125rem]",
        lg: "h-11 rounded-xl px-6",
        icon: "h-9 w-9 rounded-[0.625rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
