import type { SVGProps } from "react";

/**
 * Inlined for the same reason as `GithubIcon` - and the source file's
 * `stroke="#000"` is replaced with `currentColor` here, since a hardcoded
 * stroke color wouldn't theme even once inlined.
 */
export function McpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" fill="none" {...props}>
      <g stroke="currentColor" strokeLinecap="round" strokeWidth="15">
        <path d="m18 84.853 67.882-67.882c9.3726-9.3726 24.569-9.3726 33.941 0 9.373 9.3725 9.373 24.568 0 33.941l-51.265 51.265" />
        <path d="m69.265 101.47 50.558-50.558c9.373-9.3726 24.569-9.3726 33.942 0l0.353 0.3535c9.373 9.3726 9.373 24.569 0 33.941l-61.393 61.394c-3.1242 3.124-3.1242 8.189 0 11.313l12.606 12.607" />
        <path d="m102.85 33.941-50.205 50.205c-9.3726 9.3726-9.3726 24.568 0 33.941 9.3726 9.372 24.568 9.372 33.941 0l50.205-50.205" />
      </g>
    </svg>
  );
}
