import { READINGS_STROKE_WIDTHS } from "@/app/lib/readings/readings.constants";

export type ReadingsControlChevronIconProps = {
  className?: string;
};

export function ReadingsControlChevronIcon({
  className,
}: ReadingsControlChevronIconProps) {
  return (
    <svg
      className={className}
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden
    >
      <path
        d="M2.5 4.25L6 7.75L9.5 4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth={READINGS_STROKE_WIDTHS.controlChevron}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
