export const FILTERS = ['All', 'Active', 'Completed'];

export function FilterBar({ current, onChange, counts }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onChange(f)}
            aria-pressed={current === f}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              current === f
                ? 'bg-blue-900 text-white'
                : 'text-blue-700 hover:bg-blue-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <span className="text-xs text-blue-700">
        {counts.active} left
      </span>
    </div>
  );
}
