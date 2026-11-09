type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  rows?: number;
};

export function TextInputSection({ label, value, onChange, placeholder, rows = 8 }: Props) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none ring-blue-600 focus:ring-2"
      />
    </label>
  );
}
