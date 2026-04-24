"use client";

import { useId } from "react";

interface AppleSwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function AppleSwitch({ checked, onCheckedChange, disabled, label }: AppleSwitchProps) {
  const id = useId();
  return (
    <div className="relative inline-block h-[25px] w-[50px] select-none">
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
        aria-label={label}
      />
      <label
        htmlFor={id}
        className={`
          absolute inset-0 cursor-pointer rounded-full transition-all duration-300
          bg-gradient-to-b from-[#b3b3b3] to-[#e6e6e6]
          peer-checked:from-[#4cd964] peer-checked:to-[#5de24e]
          peer-disabled:cursor-not-allowed peer-disabled:opacity-50
          after:absolute after:top-px after:left-px
          after:h-[23px] after:w-[23px] after:rounded-full
          after:bg-white after:shadow-[0_1px_3px_rgba(0,0,0,0.3)]
          after:transition-transform after:duration-300
          peer-checked:after:translate-x-[25px]
        `}
      />
    </div>
  );
}
