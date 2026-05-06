type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  themeColor: string;
};

export function Switch({ checked, onChange, themeColor }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        !checked ? "bg-gray-300/50" : ""
      }`}
      style={checked ? { backgroundColor: themeColor } : {}}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}
