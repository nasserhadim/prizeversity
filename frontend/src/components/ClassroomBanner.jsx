import React from 'react';

export default function ClassroomBanner({ name, bgColor = 'bg-green-500' }) {
    return (
        <div className={`${bgColor} p-6 text-white text-center`}>
            <h1 className="text-3xl font-bold">{name}</h1>
        </div>
    );
}