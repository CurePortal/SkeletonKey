// inputfield.tsx
import {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  ReactNode,
} from "react";

// Base props common to both input and textarea
interface BaseFieldProps {
  label?: string;
  labelClassName?: string; // Added: For custom styling of the label
  error?: string;
  helpText?: string;
  helpTextClassName?: string; // Added: For custom styling of the help text
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  containerClassName?: string;
  className?: string; // Keep className for direct styling of the input/textarea element
  id?: string;
}

// Props for standard <input>
interface StandardInputFieldProps
  extends BaseFieldProps,
    Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  as?: "input";
}

// Props for <textarea>
interface TextAreaFieldProps
  extends BaseFieldProps,
    Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  as: "textarea";
}

// Union type for all possible InputField props
export type InputFieldProps = StandardInputFieldProps | TextAreaFieldProps;

const InputField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputFieldProps
>(
  (
    {
      label,
      labelClassName, // Destructured
      error,
      helpText,
      helpTextClassName, // Destructured
      leftIcon,
      rightIcon,
      fullWidth = true,
      containerClassName = "",
      className = "",
      id,
      as,
      ...rest
    },
    ref,
  ) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

    const inputBaseClasses =
      "bg-white dark:bg-gray-700 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-0";
    const stateClasses = error
      ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600 dark:text-red-100"
      : "border-gray-300 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:text-white";
    const paddingClasses = leftIcon ? "pl-10" : rightIcon ? "pr-10" : "px-4";
    const widthClasses = fullWidth ? "w-full" : "";

    const elementClasses = [
      inputBaseClasses,
      stateClasses,
      paddingClasses,
      "py-2 text-sm",
      widthClasses,
      className,
    ].join(" ");

    const textareaSpecificClasses = as === "textarea" ? "min-h-[60px]" : "";

    const commonProps = {
      ref: ref as any,
      id: inputId,
      className: `${elementClasses} ${textareaSpecificClasses}`.trim(),
      "aria-invalid": error
        ? "true"
        : ("false" as "false" | "true" | undefined),
      "aria-describedby": error
        ? `${inputId}-error`
        : helpText
          ? `${inputId}-help`
          : undefined,
    };

    // Default classes (can be overridden by props)
    const defaultLabelClass =
      "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
    const defaultHelpTextClass =
      "mt-1 text-xs text-gray-500 dark:text-gray-400";

    return (
      <div className={`${fullWidth ? "w-full" : ""} ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className={labelClassName || defaultLabelClass} // Apply labelClassName or default
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              {leftIcon}
            </div>
          )}

          {as === "textarea" ? (
            <textarea
              {...commonProps}
              {...(rest as Omit<
                TextareaHTMLAttributes<HTMLTextAreaElement>,
                keyof BaseFieldProps | "as"
              >)}
            />
          ) : (
            <input
              {...commonProps}
              type={
                (rest as InputHTMLAttributes<HTMLInputElement>).type || "text"
              }
              {...(rest as Omit<
                InputHTMLAttributes<HTMLInputElement>,
                keyof BaseFieldProps | "as" | "type"
              >)}
            />
          )}

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1 text-xs text-red-600 dark:text-red-400" // Error styling is specific
          >
            {error}
          </p>
        )}

        {helpText && !error && (
          <p
            id={`${inputId}-help`}
            className={helpTextClassName || defaultHelpTextClass} // Apply helpTextClassName or default
          >
            {helpText}
          </p>
        )}
      </div>
    );
  },
);

InputField.displayName = "InputField";

export default InputField;
