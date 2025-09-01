import React from 'react';

export default function ClassroomBanner({ name, code, bgColor, backgroundImage }) {
  // style applied to the centered inner box that contains the image/color
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
    // Outer wrapper keeps full-width spacing; inner box is limited to max-w-3xl
    <div className="py-6 px-4">
      <div
        className="mx-auto w-full max-w-3xl rounded-lg overflow-hidden shadow-sm"
        style={innerStyle}
      >
        <div className="py-10 px-6 text-white text-center">
          <h1 className="text-3xl font-bold break-words">
            {name}
            {code ? ` (${code})` : ''}
          </h1>
        </div>
      </div>
    </div>
  );
}