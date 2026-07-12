import React, { useEffect, useState, useRef } from "react";

interface FlashValueProps {
  value: number | undefined;
  unit?: string;
  className?: string;
  decimals?: number;
  format?: (val: number) => string;
}

export const FlashValue: React.FC<FlashValueProps> = ({ value, unit, className, decimals = 2, format }) => {
  const [flash, setFlash] = useState(false);
  const prevValueRef = useRef<number | undefined>(value);

  useEffect(() => {
    if (value !== undefined && prevValueRef.current !== undefined && prevValueRef.current !== value) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      prevValueRef.current = value;
      return () => clearTimeout(timer);
    } else if (value !== undefined && prevValueRef.current === undefined) {
      prevValueRef.current = value;
    }
  }, [value]);

  if (value === undefined) {
    return <span className={className}>N/A</span>;
  }

  return (
    <span className={`value-flash ${flash ? "flash-active" : ""} ${className || ""}`}>
      {format ? format(value) : value.toFixed(decimals)}
      {unit && <span className="item-unit">{unit}</span>}
    </span>
  );
};
