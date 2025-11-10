import React from 'react';

export default function ClassroomBanner({ name, code, bgColor, backgroundImage, fit = 'cover' }) {
  const innerStyle = {};
  if (backgroundImage) {
    innerStyle.backgroundImage = `url("${backgroundImage}")`;

    // map fit modes
    if (fit === 'contain') {
      innerStyle.backgroundSize = 'contain';
      innerStyle.backgroundPosition = 'center center';
      innerStyle.backgroundRepeat = 'no-repeat';
      innerStyle.backgroundColor = '#111'; // optional behind letterbox
    } else if (fit === 'stretch') {
      // force full stretch (may distort, but shows full image)
      innerStyle.backgroundSize = '100% 100%';
      innerStyle.backgroundPosition = 'center center';
      innerStyle.backgroundRepeat = 'no-repeat';
    } else {
      // default: cover (fills, may crop)
      innerStyle.backgroundSize = 'cover';
      innerStyle.backgroundPosition = 'center center';
      innerStyle.backgroundRepeat = 'no-repeat';
    }
  } else {
    innerStyle.backgroundColor = bgColor || '#22c55e';
  }

  // allow a taller banner to reduce vertical cropping for cover
  const heightClass = backgroundImage
    ? (fit === 'cover' ? 'h-48 md:h-56' : 'h-40 md:h-48')
    : '';

  return (
    <div className="py-6 px-4">
      <div
        className={`mx-auto w-full max-w-3xl rounded-lg overflow-hidden shadow-sm relative ${heightClass}`}
        style={innerStyle}
      >
        {backgroundImage && fit === 'cover' && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.45))',
              pointerEvents: 'none'
            }}
          />
        )}

        <div className="absolute inset-0 flex items-center justify-center text-center z-10 p-4">
          <h1
            className="text-3xl font-bold break-words"
            style={{
              color: backgroundImage ? '#ffffff' : undefined,
              textShadow: backgroundImage ? '0 1px 2px rgba(0,0,0,0.6)' : undefined
            }}
          >
            {name}
            {code ? ` (${code})` : ''}
          </h1>
        </div>
      </div>
    </div>
  );
}