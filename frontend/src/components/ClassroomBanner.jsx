import React from 'react';

export default function ClassroomBanner({ name, bgColor, backgroundImage }) {
    const style = {};
    if (backgroundImage) {
        style.backgroundImage = `url(${backgroundImage})`;
        style.backgroundSize = 'cover';
        style.backgroundPosition = 'center';
    } else if (bgColor) {
        style.backgroundColor = bgColor;
    }

    return (
        <div style={style} className="py-12 px-6 text-white text-center">
            <h1 className="text-3xl font-bold">{name}</h1>
        </div>
    );
}