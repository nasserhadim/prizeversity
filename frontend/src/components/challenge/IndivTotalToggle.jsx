const IndivTotalToggle = ({ value, onChange }) => {
  return (
    <div className="join">
      <button
        className={`btn btn-xs btn-outline join-item ${value === 'individual' ? 'btn-active btn-primary' : ''}`}
        onClick={() => onChange('individual')}
      >
        Indiv
      </button>
      <button
        className={`btn btn-xs btn-outline join-item ${value === 'total' ? 'btn-active btn-primary' : ''}`}
        onClick={() => onChange('total')}
      >
        Total
      </button>
    </div>
  );
};

export default IndivTotalToggle;
