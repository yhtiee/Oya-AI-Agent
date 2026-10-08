import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/*
 * Oya button (SPEC §14.6, Appendix E): pill-shaped, DM Sans bold, tokens only.
 * Orange is a fill with forest text (6.63:1); never orange text on cream.
 * Every size keeps a 44px minimum tap target (§14.10).
 */
const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-sans font-bold whitespace-nowrap transition-colors duration-150 ease-[var(--ease-oya)] disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-[1.15em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-orange text-forest hover:bg-orange-soft",
        secondary: "border-2 border-hairline bg-transparent text-forest hover:border-forest",
        "secondary-on-dark": "border-2 border-forest-edge bg-transparent text-cream hover:border-cream",
        quiet: "bg-transparent text-forest underline-offset-4 hover:underline",
        action: "rounded-[14px] bg-forest text-cream hover:bg-forest-card",
      },
      size: {
        md: "px-6 py-3 text-base",
        sm: "px-4 py-2 text-sm",
        lg: "min-h-14 px-8 py-4 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
