import React from 'react';

export default function ClassroomBanner({ name, code, bgColor, backgroundImage }) {
  const innerStyle = {};
  if (backgroundImage) {
    innerStyle.backgroundImage = `url("${backgroundImage}")`;
    innerStyle.backgroundSize = 'cover';
    innerStyle.backgroundPosition = 'center';
    innerStyle.backgroundRepeat = 'no-repeat';
  } else {
    innerStyle.backgroundColor = bgColor || '#22c55e';
  }

  return (
    <div className="py-6 px-4">
      <div
        className="mx-auto w-full max-w-3xl rounded-lg overflow-hidden shadow-sm relative"
        style={innerStyle}
      >
        {/* Overlay to improve text contrast on image backgrounds */}
        {backgroundImage && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.35))',
              // fallback for older browsers
              pointerEvents: 'none'
            }}
          />
        )}

        <div className="py-10 px-6 text-center relative z-10">
          <h1
            className="text-3xl font-bold break-words"
            style={{ color: backgroundImage ? '#ffffff' : undefined, textShadow: backgroundImage ? '0 1px 2px rgba(0,0,0,0.6)' : undefined }}
          >
            {name}
            {code ? ` (${code})` : ''}
          </h1>
        </div>
      </div>
    </div>
  );
}