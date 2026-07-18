import React, { useEffect, useState, useRef } from "react";

interface FlashValueProps {
  value: number | string | undefined;
  unit?: string;
  className?: string;
  decimals?: number;
  format?: (val: any) => string;
}

export const FlashValue: React.FC<FlashValueProps> = ({ value, unit, className, decimals = 2, format }) => {
  const [flash, setFlash] = useState(false);
  const prevValueRef = useRef<number | string | undefined>(value);

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

  const displayedValue = format
    ? format(value)
    : typeof value === "number"
      ? value.toFixed(decimals)
      : String(value);

  return (
    <span className={`value-flash ${flash ? "flash-active" : ""} ${className || ""}`}>
      {displayedValue}
      {unit && <span className="item-unit">{unit}</span>}
    </span>
  );
};
