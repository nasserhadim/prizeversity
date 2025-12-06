import React, { useRef, useEffect, useContext } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { ThemeContext } from '../context/ThemeContext';

const EmojiPicker = ({ onSelect, onClose }) => {
  const { theme } = useContext(ThemeContext);
  const isDark = theme === 'dark';
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-theme={theme}
      className={`absolute z-50 mt-2 p-2 rounded-lg shadow border ${
        isDark ? 'bg-base-200 border-base-300' : 'bg-base-100 border-base-300'
      }`}
      style={{ width: 320 }}
    >
      <Picker
        data={data}
        theme={isDark ? 'dark' : 'light'}
        previewPosition="none"
        navPosition="none"
        perLine={9}
        skinTonePosition="search"
        onEmojiSelect={(e) => {
          onSelect?.(e.native);
          onClose?.();
        }}
      />
    </div>
  );
};

export default EmojiPicker;