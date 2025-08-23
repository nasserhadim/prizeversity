import React from 'react';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmButtonClass = "btn-error"
}) => {
  if (!isOpen) return null;

  // ensure onConfirm can be async and always close the modal afterwards
  const handleConfirm = async () => {
    try {
      if (onConfirm) await onConfirm();
    } catch (err) {
      // swallow here; calling code can show its own toast/error
      console.error('ConfirmModal onConfirm error:', err);
    } finally {
      if (onClose) onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
    >
      <div className="w-[90%] max-w-md p-6 rounded-xl shadow-lg
                      bg-white dark:bg-neutral-900
                      border border-gray-200 dark:border-neutral-700
                      text-neutral-900 dark:text-neutral-100">
        <h2 className="text-lg font-semibold mb-4 text-center text-neutral-900 dark:text-neutral-100">
          {title}
        </h2>
        <p className="text-sm mb-6 text-center text-neutral-700 dark:text-neutral-300">
          {message}
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onClose}
            className="btn btn-ghost text-neutral-700 dark:text-neutral-300"
            aria-label={cancelText}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`btn ${confirmButtonClass} shadow-md`}
            aria-label={confirmText}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;