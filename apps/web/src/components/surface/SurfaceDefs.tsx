import React from "react";

export function SurfaceDefs() {
  return (
    <svg
      width="0"
      height="0"
      className="absolute pointer-events-none -z-50 invisible"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="gSkin" x1="0" x2="1">
          <stop offset="0" stopColor="#B97D57" />
          <stop offset="0.35" stopColor="#E2AF88" />
          <stop offset="0.6" stopColor="#EBC09A" />
          <stop offset="1" stopColor="#BF855E" />
        </linearGradient>
        <linearGradient id="gDress" x1="0" x2="1">
          <stop offset="0" stopColor="#D3CFC5" />
          <stop offset="0.18" stopColor="#F1EFE9" />
          <stop offset="0.42" stopColor="#FFFFFF" />
          <stop offset="0.68" stopColor="#FAF9F6" />
          <stop offset="1" stopColor="#D0CCC1" />
        </linearGradient>
        <linearGradient id="gHair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4A3326" />
          <stop offset="1" stopColor="#1D130D" />
        </linearGradient>
        <linearGradient id="gCar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#F6F5F1" />
          <stop offset="0.8" stopColor="#E2DFD7" />
          <stop offset="1" stopColor="#C6C2B8" />
        </linearGradient>
        <linearGradient id="gGlass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#43505F" />
          <stop offset="0.55" stopColor="#1B222B" />
          <stop offset="1" stopColor="#0F1318" />
        </linearGradient>
        <radialGradient id="gRim">
          <stop offset="0" stopColor="#F4F4F4" />
          <stop offset="0.7" stopColor="#BDBDBD" />
          <stop offset="1" stopColor="#8A8A8A" />
        </radialGradient>
        <linearGradient id="gFab" x1="0" x2="1">
          <stop offset="0" stopColor="#D7D4CC" />
          <stop offset="0.2" stopColor="#F3F1EC" />
          <stop offset="0.5" stopColor="#FFFFFF" />
          <stop offset="0.8" stopColor="#F3F1EC" />
          <stop offset="1" stopColor="#D7D4CC" />
        </linearGradient>
        <filter id="fBlur" x="-20%" y="-200%" width="140%" height="500%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id="fSoft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
    </svg>
  );
}
