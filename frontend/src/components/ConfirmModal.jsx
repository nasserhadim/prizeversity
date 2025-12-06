import { useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ThemeContext } from '../context/ThemeContext';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass = 'btn-primary'
}) => {
  if (!isOpen) return null;

  const { theme } = useContext(ThemeContext);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const esc = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  return createPortal(
    <dialog open data-theme={theme} className="modal z-[100000]">
      <div className="modal-box bg-base-100 text-base-content border border-base-300">
        <h2 className="text-lg font-semibold mb-3 text-center">{title}</h2>
        <p className="text-sm mb-6 text-center opacity-80">{message}</p>
        <div className="modal-action justify-center">
          <button className="btn btn-ghost" onClick={onClose} aria-label={cancelText}>
            {cancelText}
          </button>
          <button
            className={`btn ${confirmButtonClass}`}
            onClick={() => onConfirm?.()}
            aria-label={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
      {/* click outside to close */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>,
    document.body
  );
};

export default ConfirmModal;