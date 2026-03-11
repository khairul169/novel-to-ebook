import React from "react";
import { Button } from "./button";
import { Link, useNavigate } from "react-router";

type Props = Omit<React.ComponentProps<typeof Button>, "asChild"> & {
  to: string;
};

export default function BackButton({ to, children, ...props }: Props) {
  const navigate = useNavigate();

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();

    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(to, { replace: true });
    }
  };

  return (
    <Button asChild onClick={handleBack} {...props}>
      <Link to={to}>{children}</Link>
    </Button>
  );
}
