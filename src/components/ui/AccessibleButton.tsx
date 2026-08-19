import React from "react";

export interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  variant = "primary",
  className = "",
  children,
  ...props
}) => {
  const base = `ml-accessible-btn ml-btn-${variant}`;
  return (
    <button type={props.type ?? "button"} className={`${base} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
};

export default AccessibleButton;
