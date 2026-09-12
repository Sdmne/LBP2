import {
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import "./sliding-tabs.css";

export type SlidingTabOption<Value extends string | number> = {
  value: Value;
  label: ReactNode;
  id?: string;
  controls?: string;
  disabled?: boolean;
};

type SlidingTabsProps<Value extends string | number> = {
  options: readonly SlidingTabOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  label: string;
  className?: string;
};

export function SlidingTabs<Value extends string | number>({
  options,
  value,
  onChange,
  label,
  className = "",
}: SlidingTabsProps<Value>) {
  const generatedId = useId();
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<Value, HTMLButtonElement>());
  const currentValue = useRef(value);
  currentValue.current = value;
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [animate, setAnimate] = useState(false);
  const optionKeys = options.map((option) => String(option.value)).join("\u0000");
  const enabled = options.filter((option) => !option.disabled);
  const focusValue = enabled.some((option) => option.value === value)
    ? value
    : enabled[0]?.value;

  const measure = useCallback(() => {
    const button = buttons.current.get(currentValue.current);
    const next = button && !button.disabled
      ? { left: button.offsetLeft, width: button.offsetWidth }
      : { left: 0, width: 0 };
    setIndicator((previous) =>
      previous.left === next.left && previous.width === next.width
        ? previous
        : next,
    );
  }, []);

  // Measure before paint so the first selected tab never slides in from zero.
  useLayoutEffect(measure);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    buttons.current.forEach((button) => observer.observe(button));
    let disposed = false;
    const onFontsLoaded = () => {
      if (!disposed) measure();
    };
    document.fonts?.addEventListener("loadingdone", onFontsLoaded);
    void document.fonts?.ready.then(onFontsLoaded);
    const frame = requestAnimationFrame(() => setAnimate(true));
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", onFontsLoaded);
    };
  }, [measure, optionKeys]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: Value) => {
    const index = enabled.findIndex((option) => option.value === key);
    if (index < 0 || !enabled.length) return;
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % enabled.length;
    else if (event.key === "ArrowLeft")
      next = (index + enabled.length - 1) % enabled.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = enabled.length - 1;
    else return;
    event.preventDefault();
    const option = enabled[next];
    onChange(option.value);
    const button = buttons.current.get(option.value);
    button?.focus({ preventScroll: true });
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  return (
    <div
      ref={root}
      className={`sliding-tabs ${className}`.trim()}
      role="tablist"
      aria-label={label}
    >
      <div
        className="sliding-tabs__indicator"
        data-animated={animate ? "true" : "false"}
        aria-hidden="true"
        hidden={!indicator.width}
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(button) => {
            if (button) buttons.current.set(option.value, button);
            else buttons.current.delete(option.value);
          }}
          type="button"
          className="sliding-tabs__tab"
          id={option.id ?? `${generatedId}-tab-${index}`}
          role="tab"
          aria-selected={option.value === value}
          aria-controls={option.controls}
          disabled={option.disabled}
          tabIndex={option.value === focusValue ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
