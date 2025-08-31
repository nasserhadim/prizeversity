import React from 'react';

export default function ClassroomBanner({ name, bgColor, backgroundImage }) {
    const style = {};
    if (backgroundImage) {
        style.backgroundImage = `url(${backgroundImage})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
    } else {
        // use provided color, or default to Tailwind’s green-500
        style.backgroundColor = bgColor || '#22c55e';
    }

    return (
        <div style={style} className="py-12 px-6 text-white text-center">
            {/* show name + code when provided */}
            <h1 className="text-3xl font-bold">
                {name}{/* keep name */}
                {typeof arguments[0]?.code !== 'undefined' && arguments[0]?.code
                    ? ` (${arguments[0].code})`
                    : ''}
            </h1>
        </div>
    );
}