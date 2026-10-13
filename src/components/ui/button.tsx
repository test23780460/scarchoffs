import type { ComponentProps } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const buttonVariants = cva('button', {
  variants: {
    variant: {
      primary: 'primary',
      secondary: 'secondary',
      ghost: 'ghost',
      danger: 'danger-text',
    },
  },
  defaultVariants: { variant: 'primary' },
})

type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ variant, className, ...props }: ButtonProps) {
  return <button className={twMerge(clsx(buttonVariants({ variant }), className))} {...props} />
}
