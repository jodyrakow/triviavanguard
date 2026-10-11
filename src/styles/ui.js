// src/styles/ui.js
import React from "react";
import { colors, effects, tokens } from "./theme";
import "./ui.css";

const baseControl = {
  fontFamily: tokens.font.body,
  fontSize: "1rem",
  borderRadius: tokens.radius.sm,
  boxSizing: "border-box",
};

const baseButton = {
  ...baseControl,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: tokens.spacing.xs,
  padding: "0.5rem 0.85rem",
  border: `${tokens.border.thin} ${colors.accent}`,
  cursor: "pointer",
  lineHeight: 1.2,
};

// ---------- Buttons ----------

export const Button = ({
  children,
  icon,
  active = false,
  disabled = false,
  type = "button",
  style,
  ...props
}) => (
  <button
    type={type}
    disabled={disabled}
    aria-pressed={active || undefined}
    className="tv-button tv-focus"
    style={{
      ...baseButton,
      background: active ? colors.accent : colors.white,
      color: active ? colors.white : colors.dark,
      opacity: disabled ? 0.55 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      ...style,
    }}
    {...props}
  >
    {icon && <span>{icon}</span>}
    {children}
  </button>
);

export const ButtonPrimary = ({ style, ...props }) => (
  <Button {...props} style={{ background: colors.accent, color: colors.white, fontWeight: 700, ...style }} />
);

export const ButtonSecondary = ({ style, ...props }) => (
  <Button
    style={{
      borderColor: colors.gray,
      color: colors.dark,
      background: colors.white,
      ...style,
    }}
    {...props}
  />
);

export const ButtonDanger = ({ style, ...props }) => (
  <Button
    {...props}
    style={{
      borderColor: colors.error,
      color: colors.error,
      background: colors.white,
      fontWeight: 700,
      ...style,
    }}
  />
);

export const IconButton = ({
  children,
  label,
  active = false,
  type = "button",
  style,
  ...props
}) => (
  <button
    type={type}
    title={label}
    aria-label={label}
    aria-pressed={active || undefined}
    style={{
      ...baseButton,
      width: 44,
      height: 44,
      padding: 0,
      borderRadius: tokens.radius.md,
      border: `${tokens.border.medium} ${colors.accent}`,
      background: active ? colors.accent : colors.white,
      color: active ? colors.white : colors.dark,
      fontSize: "1.35rem",
      ...style,
    }}
    {...props}
  >
    {children}
  </button>
);

export const GridButton = ({
  children,
  active = false,
  onDark = false,
  type = "button",
  style,
  ...props
}) => (
  <button
    type={type}
    aria-pressed={active}
    style={{
      ...baseButton,
      minWidth: 36,
      height: 30,
      padding: "0 0.45rem",
      borderRadius: tokens.radius.sm,
      background: active ? colors.accent : "transparent",
      color: active ? colors.white : onDark ? colors.white : colors.dark,
      fontSize: "0.9rem",
      ...style,
    }}
    {...props}
  >
    {children}
  </button>
);

export const TabButton = ({
  children,
  active = false,
  type = "button",
  style,
  ...props
}) => (
  <button
    type={type}
    aria-pressed={active}
    style={{
      ...baseButton,
      minWidth: 120,
      padding: "0.6rem 1.25rem",
      borderRadius: `${tokens.radius.md}px ${tokens.radius.md}px 0 0`,
      background: active ? colors.accent : colors.dark,
      color: active ? colors.white : colors.accent,
      fontWeight: 700,
      ...style,
    }}
    {...props}
  >
    {children}
  </button>
);

// ---------- Forms ----------

export const Input = ({ style, ...props }) => (
  <input
    style={{
      ...baseControl,
      width: "100%",
      padding: "0.5rem 0.65rem",
      border: `${tokens.border.thin} ${colors.gray}`,
      background: colors.white,
      color: colors.dark,
      ...style,
    }}
    {...props}
  />
);

export const focusStyle = {
  outline: "none",
  transition: "box-shadow .15s ease",
};

export const SearchInput = (props) => (
  <Input type="search" placeholder="Search..." {...props} />
);

export const Select = ({ children, style, ...props }) => (
  <select
    style={{
      ...baseControl,
      width: "100%",
      padding: "0.5rem 0.65rem",
      border: `${tokens.border.thin} ${colors.gray}`,
      background: colors.white,
      color: colors.dark,
      ...style,
    }}
    {...props}
  >
    {children}
  </select>
);

export const Textarea = ({ style, ...props }) => (
  <textarea
    style={{
      ...baseControl,
      width: "100%",
      minHeight: 90,
      padding: "0.5rem 0.65rem",
      border: `${tokens.border.thin} ${colors.gray}`,
      background: colors.white,
      color: colors.dark,
      resize: "vertical",
      ...style,
    }}
    {...props}
  />
);

export const Field = ({ label, helper, error, children, style }) => (
  <div style={{ display: "grid", gap: tokens.spacing.xs, ...style }}>
    {label && (
      <label
        style={{ fontWeight: 700, color: error ? colors.error : colors.dark }}
      >
        {label}
      </label>
    )}

    {children}

    {helper && !error && (
      <div style={{ fontSize: "0.8rem", color: colors.dark, opacity: 0.75 }}>
        {helper}
      </div>
    )}

    {error && (
      <div style={{ fontSize: "0.8rem", color: colors.error }}>{error}</div>
    )}
  </div>
);

// ---------- Layout ----------

export const Row = ({ children, style }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: tokens.spacing.sm,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Stack = ({ children, style }) => (
  <div
    style={{
      display: "grid",
      gap: tokens.spacing.md,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Toolbar = ({ children, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: tokens.spacing.sm,
      padding: tokens.spacing.xs,
      border: `${tokens.border.medium} ${colors.accent}`,
      borderRadius: tokens.radius.lg,
      background: colors.white,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Card = ({ children, style }) => (
  <div
    style={{
      background: colors.white,
      border: `${tokens.border.thin} ${colors.gray}`,
      borderRadius: tokens.radius.md,
      padding: tokens.spacing.md,
      boxShadow: effects.shadowSm,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Panel = ({ title, icon, actions, children, style }) => (
  <section
    style={{
      background: colors.white,
      border: `${tokens.border.medium} ${colors.accent}`,
      borderRadius: tokens.radius.lg,
      overflow: "hidden",
      ...style,
    }}
  >
    {(title || actions) && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: tokens.spacing.sm,
          padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
          background: colors.dark,
          color: colors.white,
          borderBottom: `${tokens.border.medium} ${colors.accent}`,
        }}
      >
        {icon && <span>{icon}</span>}
        {title && (
          <div style={{ fontFamily: tokens.font.display, fontSize: "1.25rem" }}>
            {title}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {actions}
      </div>
    )}

    <div style={{ padding: tokens.spacing.md }}>{children}</div>
  </section>
);

// ---------- Small UI pieces ----------

export const Pill = ({ children, active = false, style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: tokens.radius.pill,
      padding: "0.35rem 0.85rem",
      border: `${tokens.border.thin} ${active ? colors.dark : colors.gray}`,
      background: active ? colors.dark : colors.white,
      color: active ? colors.white : colors.dark,
      fontWeight: 700,
      ...style,
    }}
  >
    {children}
  </span>
);

export const Tooltip = ({ label, children }) => (
  <span
    title={label}
    style={{
      display: "inline-flex",
      alignItems: "center",
    }}
  >
    {children}
  </span>
);

export const Checkbox = ({ label, style, inputStyle, ...props }) => (
  <label
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: tokens.spacing.sm,
      cursor: "pointer",
      fontFamily: tokens.font.body,
      color: colors.dark,
      ...style,
    }}
  >
    <input
      type="checkbox"
      style={{
        accentColor: colors.accent,
        width: 16,
        height: 16,
        ...inputStyle,
      }}
      {...props}
    />
    {label}
  </label>
);

export const Kbd = ({ children, style }) => (
  <kbd
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: "1.5em",
      padding: "0.1rem 0.4rem",
      borderRadius: tokens.radius.sm,
      border: `${tokens.border.thin} ${colors.gray}`,
      background: colors.white,
      color: colors.dark,
      fontFamily: "monospace",
      fontSize: "0.8rem",
      boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.15)",
      ...style,
    }}
  >
    {children}
  </kbd>
);

export const StatusDot = ({ tone = "success", label, style }) => {
  const color = tone === "error" ? colors.error : colors.success;

  return (
    <span
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacing.xs,
        color: colors.dark,
        ...style,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: tokens.radius.pill,
          background: color,
        }}
      />
      {label && <span>{label}</span>}
    </span>
  );
};

export const Toast = ({ children, tone = "success", icon, onClose, style }) => {
  const color = tone === "error" ? colors.error : colors.success;

  return (
    <div
      role="status"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacing.sm,
        padding: "0.75rem 1rem",
        border: `${tokens.border.thin} ${color}`,
        borderRadius: tokens.radius.md,
        background: colors.white,
        color: colors.dark,
        boxShadow: effects.shadowSm,
        ...style,
      }}
    >
      {icon && <span style={{ color }}>{icon}</span>}
      <span>{children}</span>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notification"
          style={{
            marginLeft: tokens.spacing.md,
            border: "none",
            background: "transparent",
            color: colors.dark,
            fontSize: "1.25rem",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

export const Status = ({ children, tone = "success", icon, style }) => {
  const color = tone === "error" ? colors.error : colors.success;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: tokens.spacing.xs,
        padding: "0.35rem 0.65rem",
        border: `${tokens.border.thin} ${color}`,
        borderRadius: tokens.radius.sm,
        background: colors.white,
        color,
        fontWeight: 700,
        ...style,
      }}
    >
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
};

// ---------- Segmented controls ----------

export const Segmented = ({ children, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      overflow: "hidden",
      background: colors.white,
      border: `${tokens.border.thin} ${colors.accent}`,
      borderRadius: tokens.radius.md,
      ...style,
    }}
  >
    {children}
  </div>
);

export const SegmentButton = ({
  children,
  active = false,
  type = "button",
  style,
  ...props
}) => (
  <button
    type={type}
    aria-pressed={active}
    style={{
      border: "none",
      borderRight: `${tokens.border.thin} ${effects.accentSoft}`,
      background: active ? colors.accent : colors.white,
      color: active ? colors.white : colors.dark,
      padding: "0.45rem 0.75rem",
      minWidth: 42,
      cursor: "pointer",
      fontFamily: tokens.font.body,
      fontSize: "1rem",
      ...style,
    }}
    {...props}
  >
    {children}
  </button>
);

// ---------- Image overlay ----------

export const ImageOverlay = ({ isOpen, onClose, src, alt }) => {
  if (!isOpen) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: effects.overlay,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 9500,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.spacing.md,
        cursor: "pointer",
      }}
    >
      <img
        src={src}
        alt={alt || ""}
        style={{
          maxWidth: "90vw",
          maxHeight: "80vh",
          objectFit: "contain",
          border: `${tokens.border.thick} ${colors.white}`,
          boxShadow: effects.shadowMd,
          marginBottom: tokens.spacing.md,
        }}
      />

      <ButtonPrimary
        onMouseDown={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
      >
        Close
      </ButtonPrimary>
    </div>
  );
};

// ---------- Modal ----------

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  style,
  contentStyle,
}) => {
  if (!isOpen) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: effects.overlay,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: tokens.spacing.md,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title || "Dialog"}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: colors.white,
          borderRadius: tokens.radius.md,
          maxWidth: "90vw",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: effects.shadowMd,
          ...style,
        }}
      >
        {title && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: colors.dark,
              color: colors.white,
              padding: "0.65rem 0.85rem",
              borderBottom: `${tokens.border.medium} ${colors.accent}`,
            }}
          >
            <div
              style={{ fontFamily: tokens.font.display, fontSize: "1.25rem" }}
            >
              {title}
            </div>

            <div style={{ flex: 1 }} />

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: "none",
                  background: "transparent",
                  color: colors.white,
                  fontSize: "1.25rem",
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        <div style={{ padding: tokens.spacing.md, ...contentStyle }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ---------- Scoring grid ----------

export const NumberInput = ({ style, ...props }) => (
  <Input
    type="number"
    inputMode="numeric"
    style={{
      textAlign: "center",
      ...style,
    }}
    {...props}
  />
);

export const ToggleCell = ({
  active = false,
  children,
  type = "button",
  style,
  ...props
}) => (
  <button
    type={type}
    aria-pressed={active}
    className="tv-focus tv-grid-cell"
    style={{
      ...baseButton,
      width: "100%",
      minHeight: 32,
      padding: "0.25rem",
      border: `${tokens.border.thin} ${colors.accent}`,
      borderRadius: tokens.radius.sm,
      background: active ? colors.accent : colors.white,
      color: active ? colors.white : colors.dark,
      fontWeight: 700,
      ...style,
    }}
    {...props}
  >
    {children}
  </button>
);