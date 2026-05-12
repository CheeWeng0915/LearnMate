"use client";

import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

const inputBase =
  "w-full px-4 py-2.5 border border-hairline-strong rounded-md bg-canvas text-ink placeholder:text-stone focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none disabled:opacity-50 transition-colors text-[14px]";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const fieldId = id || props.name;
    return (
      <div>
        {label && (
          <label
            htmlFor={fieldId}
            className="block text-[13px] font-semibold mb-1.5 text-charcoal"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={fieldId}
          className={`${inputBase} h-11 ${error ? "border-error focus:border-error focus:ring-error/20" : ""} ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-[12px] text-error">{error}</p>}
        {!error && hint && (
          <p className="mt-1.5 text-[12px] text-steel">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const fieldId = id || props.name;
    return (
      <div>
        {label && (
          <label
            htmlFor={fieldId}
            className="block text-[13px] font-semibold mb-1.5 text-charcoal"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          className={`${inputBase} resize-none ${error ? "border-error focus:border-error" : ""} ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-[12px] text-error">{error}</p>}
        {!error && hint && (
          <p className="mt-1.5 text-[12px] text-steel">{hint}</p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

type PasswordInputProps = Omit<InputProps, "type">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const [show, setShow] = useState(false);
    const fieldId = id || props.name;
    return (
      <div>
        {label && (
          <label
            htmlFor={fieldId}
            className="block text-[13px] font-semibold mb-1.5 text-charcoal"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={fieldId}
            type={show ? "text" : "password"}
            className={`${inputBase} h-11 pr-11 ${error ? "border-error focus:border-error focus:ring-error/20" : ""} ${className}`}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            tabIndex={-1}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-3 flex items-center text-stone hover:text-charcoal transition-colors"
          >
            {show ? (
              // Eye-off icon
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              // Eye icon
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {error && <p className="mt-1.5 text-[12px] text-error">{error}</p>}
        {!error && hint && (
          <p className="mt-1.5 text-[12px] text-steel">{hint}</p>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";
