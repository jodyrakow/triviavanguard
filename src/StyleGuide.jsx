import React, { useState } from "react";
import { colors, effects, tokens } from "./styles/theme";
import Display from "./Display";
import {
  Button,
  ButtonPrimary,
  ButtonSecondary,
  ButtonDanger,
  IconButton,
  GridButton,
  TabButton,
  Input,
  SearchInput,
  Select,
  Textarea,
  NumberInput,
  Field,
  Checkbox,
  Row,
  Stack,
  Toolbar,
  Card,
  Panel,
  Pill,
  Tooltip,
  Kbd,
  StatusDot,
  Toast,
  Status,
  Segmented,
  SegmentButton,
  ToggleCell,
  Modal,
  ImageOverlay,
} from "./styles/ui";

// ---------- Style guide scaffolding ----------

const Section = ({ title, children }) => (
  <section style={{ marginBottom: tokens.spacing.xl * 2 }}>
    <h2
      style={{
        fontFamily: tokens.font.display,
        fontSize: "1.5rem",
        color: colors.white,
        background: colors.dark,
        padding: `${tokens.spacing.sm}px ${tokens.spacing.md}px`,
        borderLeft: `${tokens.border.thick} ${colors.accent}`,
        margin: `0 0 ${tokens.spacing.lg}px`,
        letterSpacing: "0.04em",
      }}
    >
      {title}
    </h2>
    <div style={{ padding: `0 ${tokens.spacing.md}px` }}>{children}</div>
  </section>
);

const Row2 = ({ label, children }) => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "160px 1fr",
      gap: tokens.spacing.md,
      alignItems: "start",
      marginBottom: tokens.spacing.md,
    }}
  >
    <div
      style={{
        fontFamily: tokens.font.body,
        fontSize: "0.8rem",
        color: colors.dark,
        opacity: 0.6,
        paddingTop: 6,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {label}
    </div>
    <div>{children}</div>
  </div>
);

const Swatch = ({ name, value, text = colors.white }) => (
  <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, marginRight: tokens.spacing.md, marginBottom: tokens.spacing.sm }}>
    <div
      style={{
        width: 80,
        height: 56,
        background: value,
        borderRadius: tokens.radius.md,
        border: `1px solid rgba(0,0,0,0.1)`,
        display: "flex",
        alignItems: "flex-end",
        padding: 6,
      }}
    >
      <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: text, background: "rgba(0,0,0,0.25)", padding: "1px 4px", borderRadius: 3 }}>
        {value}
      </span>
    </div>
    <div style={{ fontFamily: tokens.font.body, fontSize: "0.75rem", color: colors.dark }}>{name}</div>
  </div>
);

// ---------- Style Guide ----------

export default function StyleGuide() {
  const [activeTab, setActiveTab] = useState("scoring");
  const [activeSegment, setActiveSegment] = useState("list");
  const [toggleStates, setToggleStates] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [displayPreviewMode, setDisplayPreviewMode] = useState(0);

  const toggleCell = (key) =>
    setToggleStates((s) => ({ ...s, [key]: !s[key] }));

  return (
    <div
      style={{
        background: effects.pageBg,
        minHeight: "100vh",
        fontFamily: tokens.font.body,
        color: colors.dark,
      }}
    >
      {/* Header */}
      <div
        style={{
          background: colors.dark,
          borderBottom: `4px solid ${colors.accent}`,
          padding: `${tokens.spacing.lg}px ${tokens.spacing.xl}px`,
          marginBottom: tokens.spacing.xl,
        }}
      >
        <div style={{ fontFamily: tokens.font.display, fontSize: "2.25rem", color: colors.accent, letterSpacing: "0.05em" }}>
          TriviaVanguard
        </div>
        <div style={{ fontFamily: tokens.font.body, fontSize: "1rem", color: colors.white, opacity: 0.7, marginTop: 4 }}>
          UI Style Guide
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: `0 ${tokens.spacing.xl}px ${tokens.spacing.xl * 2}px` }}>

        {/* ── Colors ── */}
        <Section title="Colors">
          <Row2 label="Brand">
            <Swatch name="dark" value={colors.dark} />
            <Swatch name="accent" value={colors.accent} />
            <Swatch name="white" value={colors.white} text={colors.dark} />
            <Swatch name="gray" value={colors.gray} text={colors.dark} />
          </Row2>
          <Row2 label="Semantic">
            <Swatch name="success" value={colors.success} />
            <Swatch name="error" value={colors.error} />
            <Swatch name="teal (reserved accent)" value={colors.teal} />
          </Row2>
          <Row2 label="Effects">
            <Swatch name="pageBg" value={effects.pageBg} text={colors.dark} />
            <Swatch name="accentSoft" value={effects.accentSoft} text={colors.dark} />
            <Swatch name="darkSoft" value={effects.darkSoft} text={colors.dark} />
            <Swatch name="overlay" value={effects.overlay} />
          </Row2>
        </Section>

        {/* ── Typography ── */}
        <Section title="Typography">
          <Row2 label="Display — Antonio">
            <div style={{ fontFamily: tokens.font.display, fontSize: "2rem", color: colors.dark }}>
              Round 3 — Music Trivia
            </div>
          </Row2>
          <Row2 label="Body — Questrial">
            <div style={{ fontFamily: tokens.font.body, fontSize: "1rem", color: colors.dark }}>
              The quick brown fox jumps over the lazy dog. 0123456789
            </div>
          </Row2>
          <Row2 label="Flavor — Lora">
            <div style={{ fontFamily: tokens.font.flavor, fontSize: "1rem", fontStyle: "italic", color: colors.dark }}>
              Bonus question: Name the album released in 1971.
            </div>
          </Row2>
          <Row2 label="Sizes">
            <Stack style={{ gap: tokens.spacing.xs }}>
              {["2rem", "1.5rem", "1.25rem", "1rem", "0.85rem", "0.75rem"].map((s) => (
                <div key={s} style={{ fontSize: s, color: colors.dark }}>
                  {s} — TriviaVanguard Host App
                </div>
              ))}
            </Stack>
          </Row2>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Buttons">
          <Row2 label="Button">
            <Row style={{ flexWrap: "wrap", gap: tokens.spacing.sm }}>
              <Button>Default</Button>
              <Button icon="★">With Icon</Button>
              <Button active>Active</Button>
              <Button disabled>Disabled</Button>
            </Row>
          </Row2>
          <Row2 label="ButtonPrimary">
            <Row style={{ flexWrap: "wrap", gap: tokens.spacing.sm }}>
              <ButtonPrimary>Save Changes</ButtonPrimary>
              <ButtonPrimary disabled>Disabled</ButtonPrimary>
            </Row>
          </Row2>
          <Row2 label="ButtonSecondary">
            <Row style={{ flexWrap: "wrap", gap: tokens.spacing.sm }}>
              <ButtonSecondary>Cancel</ButtonSecondary>
              <ButtonSecondary disabled>Disabled</ButtonSecondary>
            </Row>
          </Row2>
          <Row2 label="ButtonDanger">
            <Row style={{ flexWrap: "wrap", gap: tokens.spacing.sm }}>
              <ButtonDanger>Delete Show</ButtonDanger>
              <ButtonDanger disabled>Disabled</ButtonDanger>
            </Row>
          </Row2>
          <Row2 label="IconButton">
            <Row style={{ gap: tokens.spacing.sm }}>
              <IconButton label="Settings">⚙</IconButton>
              <IconButton label="Star" active>★</IconButton>
              <IconButton label="Close">✕</IconButton>
            </Row>
          </Row2>
          <Row2 label="GridButton">
            <Row style={{ gap: tokens.spacing.xs }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <GridButton key={n} active={n === 3}>{n}</GridButton>
              ))}
            </Row>
          </Row2>
          <Row2 label="TabButton">
            <Row style={{ gap: 0, alignItems: "flex-end" }}>
              {["Scoring", "Questions", "Display"].map((t) => (
                <TabButton
                  key={t}
                  active={activeTab === t.toLowerCase()}
                  onClick={() => setActiveTab(t.toLowerCase())}
                >
                  {t}
                </TabButton>
              ))}
            </Row>
          </Row2>
        </Section>

        {/* ── Segmented Controls ── */}
        <Section title="Segmented Controls">
          <Row2 label="Segmented">
            <Segmented>
              {["List", "Grid", "Map"].map((opt) => (
                <SegmentButton
                  key={opt}
                  active={activeSegment === opt.toLowerCase()}
                  onClick={() => setActiveSegment(opt.toLowerCase())}
                >
                  {opt}
                </SegmentButton>
              ))}
            </Segmented>
          </Row2>
        </Section>

        {/* ── Form Controls ── */}
        <Section title="Form Controls">
          <Row2 label="Input">
            <Input placeholder="Team name..." style={{ maxWidth: 300 }} />
          </Row2>
          <Row2 label="SearchInput">
            <SearchInput style={{ maxWidth: 300 }} />
          </Row2>
          <Row2 label="NumberInput">
            <NumberInput defaultValue={3} style={{ maxWidth: 80 }} />
          </Row2>
          <Row2 label="Select">
            <Select style={{ maxWidth: 300 }}>
              <option>Round 1 — General Knowledge</option>
              <option>Round 2 — Music</option>
              <option>Round 3 — Sports</option>
            </Select>
          </Row2>
          <Row2 label="Textarea">
            <Textarea
              placeholder="Enter question text..."
              style={{ maxWidth: 400 }}
            />
          </Row2>
          <Row2 label="Checkbox">
            <Stack style={{ gap: tokens.spacing.xs }}>
              <Checkbox
                label="Show scores live"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
              />
              <Checkbox label="Lock answers" defaultChecked />
              <Checkbox label="Allow late entries" disabled />
            </Stack>
          </Row2>
          <Row2 label="Field — default">
            <Field label="Venue name" helper="Appears on the team check-in screen" style={{ maxWidth: 360 }}>
              <Input placeholder="e.g. The Rusty Anchor" />
            </Field>
          </Row2>
          <Row2 label="Field — error">
            <Field label="Host name" error="Required" style={{ maxWidth: 360 }}>
              <Input placeholder="Your name" />
            </Field>
          </Row2>
        </Section>

        {/* ── Layout ── */}
        <Section title="Layout">
          <Row2 label="Toolbar">
            <Toolbar>
              <IconButton label="Undo">↩</IconButton>
              <IconButton label="Redo">↪</IconButton>
              <ButtonSecondary>Export</ButtonSecondary>
              <ButtonPrimary>Publish</ButtonPrimary>
            </Toolbar>
          </Row2>
          <Row2 label="Card">
            <Card style={{ maxWidth: 360 }}>
              <div style={{ fontFamily: tokens.font.display, fontSize: "1.1rem", marginBottom: tokens.spacing.xs }}>
                The Rusty Anchor
              </div>
              <div style={{ fontSize: "0.9rem", opacity: 0.7 }}>Thursday Night Trivia · 7 teams checked in</div>
            </Card>
          </Row2>
          <Row2 label="Panel">
            <Panel
              title="Mission Control"
              icon="🎯"
              actions={<ButtonSecondary style={{ fontSize: "0.8rem", padding: "0.3rem 0.65rem" }}>Edit</ButtonSecondary>}
              style={{ maxWidth: 420 }}
            >
              <Stack style={{ gap: tokens.spacing.sm }}>
                <div>Round 2 of 5 — Music</div>
                <div>Question 3 of 8</div>
                <ButtonPrimary style={{ width: "100%" }}>Next Question →</ButtonPrimary>
              </Stack>
            </Panel>
          </Row2>
        </Section>

        {/* ── Small UI ── */}
        <Section title="Small UI Pieces">
          <Row2 label="Pill">
            <Row style={{ flexWrap: "wrap", gap: tokens.spacing.sm }}>
              <Pill>Inactive</Pill>
              <Pill active>Active</Pill>
              <Pill>Round 1</Pill>
            </Row>
          </Row2>
          <Row2 label="Kbd">
            <Row style={{ gap: tokens.spacing.xs }}>
              <Kbd>⌘</Kbd>
              <span style={{ fontSize: "0.9rem" }}>+</span>
              <Kbd>K</Kbd>
              <span style={{ fontSize: "0.9rem", marginLeft: tokens.spacing.sm }}>Open commands</span>
            </Row>
          </Row2>
          <Row2 label="StatusDot">
            <Row style={{ gap: tokens.spacing.lg }}>
              <StatusDot tone="success" label="Connected" />
              <StatusDot tone="error" label="Disconnected" />
            </Row>
          </Row2>
          <Row2 label="Status">
            <Row style={{ gap: tokens.spacing.sm }}>
              <Status tone="success" icon="✓">Published</Status>
              <Status tone="error" icon="✕">Failed</Status>
            </Row>
          </Row2>
          <Row2 label="Toast">
            <Stack style={{ gap: tokens.spacing.sm }}>
              <Toast tone="success" icon="✓" onClose={() => {}}>
                Show saved successfully.
              </Toast>
              <Toast tone="error" icon="✕" onClose={() => {}}>
                Failed to connect to Supabase.
              </Toast>
            </Stack>
          </Row2>
          <Row2 label="Tooltip">
            <Tooltip label="This shows a native tooltip on hover">
              <ButtonSecondary>Hover me</ButtonSecondary>
            </Tooltip>
          </Row2>
        </Section>

        {/* ── Scoring Grid ── */}
        <Section title="Scoring Grid">
          <Row2 label="ToggleCell">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(8, 1fr)",
                gap: 4,
                maxWidth: 400,
              }}
            >
              {Array.from({ length: 8 }, (_, i) => (
                <ToggleCell
                  key={i}
                  active={!!toggleStates[i]}
                  onClick={() => toggleCell(i)}
                >
                  Q{i + 1}
                </ToggleCell>
              ))}
            </div>
          </Row2>
          <Row2 label="GridButton (on dark)">
            <div
              style={{
                background: colors.dark,
                display: "inline-flex",
                gap: 4,
                padding: tokens.spacing.sm,
                borderRadius: tokens.radius.md,
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <GridButton key={n} onDark active={n <= 3}>{n}</GridButton>
              ))}
            </div>
          </Row2>
        </Section>

        {/* ── Overlays ── */}
        <Section title="Overlays">
          <Row2 label="Modal">
            <ButtonSecondary onClick={() => setModalOpen(true)}>
              Open Modal
            </ButtonSecondary>
            <Modal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Confirm Archive"
              style={{ width: 400 }}
            >
              <Stack>
                <div>Are you sure you want to archive this show? This cannot be undone from the host app.</div>
                <Row style={{ justifyContent: "flex-end", gap: tokens.spacing.sm }}>
                  <ButtonSecondary onClick={() => setModalOpen(false)}>Cancel</ButtonSecondary>
                  <ButtonDanger onClick={() => setModalOpen(false)}>Archive</ButtonDanger>
                </Row>
              </Stack>
            </Modal>
          </Row2>
          <Row2 label="ImageOverlay">
            <ButtonSecondary onClick={() => setOverlayOpen(true)}>
              Open Image Overlay
            </ButtonSecondary>
            <ImageOverlay
              isOpen={overlayOpen}
              onClose={() => setOverlayOpen(false)}
              src="https://via.placeholder.com/800x500/2B394A/DC6A24?text=Question+Image"
              alt="Example question image"
            />
          </Row2>
        </Section>

        {/* ── Spacing & Radius tokens ── */}
        <Section title="Spacing & Radius Tokens">
          <Row2 label="Spacing">
            <Row style={{ alignItems: "flex-end", gap: tokens.spacing.lg, flexWrap: "wrap" }}>
              {Object.entries(tokens.spacing).map(([name, val]) => (
                <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: val, height: val, background: colors.accent, borderRadius: 2, minWidth: 4 }} />
                  <div style={{ fontSize: "0.7rem", color: colors.dark, opacity: 0.7 }}>{name}</div>
                  <div style={{ fontSize: "0.7rem", fontFamily: "monospace", color: colors.dark }}>{val}px</div>
                </div>
              ))}
            </Row>
          </Row2>
          <Row2 label="Border radius">
            <Row style={{ alignItems: "flex-end", gap: tokens.spacing.lg, flexWrap: "wrap" }}>
              {Object.entries(tokens.radius).map(([name, val]) => (
                <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div
                    style={{
                      width: 56,
                      height: 36,
                      background: effects.accentSoft,
                      border: `2px solid ${colors.accent}`,
                      borderRadius: val,
                    }}
                  />
                  <div style={{ fontSize: "0.7rem", color: colors.dark, opacity: 0.7 }}>{name}</div>
                  <div style={{ fontSize: "0.7rem", fontFamily: "monospace", color: colors.dark }}>{val === 999 ? "pill" : `${val}px`}</div>
                </div>
              ))}
            </Row>
          </Row2>
        </Section>

        {/* ── Display ── */}
        <Section title="Display">
          {(() => {
            const SCALE = 0.44;
            const modes = [
              { label: "Standby", state: { mode: "standby" } },
              {
                label: "Category",
                state: {
                  mode: "category",
                  item: {
                    category: "Music of the 80s",
                    text: "Name the artist, band, album, or song — whatever the question asks for. No partial credit unless stated.",
                  },
                },
              },
              {
                label: "Question (no image)",
                state: {
                  mode: "question",
                  item: {
                    category: "Music of the 80s",
                    label: "3",
                    text: 'Which British rock band released the album "The Joshua Tree" in 1987?',
                    answer: "U2",
                    imageAttachments: null,
                  },
                },
              },
              {
                label: "Question + Answer",
                state: {
                  mode: "question_answer",
                  item: {
                    category: "Music of the 80s",
                    label: "3",
                    text: 'Which British rock band released the album "The Joshua Tree" in 1987?',
                    answer: "U2",
                    imageAttachments: null,
                  },
                },
              },
              {
                label: "Question + Answer + Stats",
                state: {
                  mode: "question_answer_stats",
                  item: {
                    category: "Music of the 80s",
                    label: "3",
                    text: 'Which British rock band released the album "The Joshua Tree" in 1987?',
                    answer: "U2",
                    imageAttachments: null,
                  },
                  stats: { correct: 6, total: 9, pointValue: 10 },
                },
              },
              {
                label: "Question with image",
                state: {
                  mode: "question",
                  item: {
                    category: "Visual Round",
                    label: "B",
                    text: "Name this album.",
                    answer: "The Joshua Tree",
                    imageAttachments: [{ url: "https://placehold.co/960x650/2B394A/DC6A24?text=Question+Image" }],
                  },
                },
              },
            ];

            const current = modes[displayPreviewMode];

            return (
              <>
                <div style={{ display: "flex", gap: tokens.spacing.sm, flexWrap: "wrap", marginBottom: tokens.spacing.md }}>
                  {modes.map((m, i) => (
                    <button
                      key={m.label}
                      onClick={() => setDisplayPreviewMode(i)}
                      style={{
                        fontFamily: tokens.font.body,
                        fontSize: "0.8rem",
                        padding: "0.35rem 0.75rem",
                        border: `1px solid ${i === displayPreviewMode ? colors.accent : colors.gray}`,
                        borderRadius: tokens.radius.sm,
                        background: i === displayPreviewMode ? colors.accent : colors.white,
                        color: i === displayPreviewMode ? colors.white : colors.dark,
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <div
                  style={{
                    width: 1920 * SCALE,
                    height: 1080 * SCALE,
                    overflow: "hidden",
                    border: `1px solid ${colors.gray}`,
                    borderRadius: tokens.radius.md,
                  }}
                >
                  <div style={{ transform: `scale(${SCALE})`, transformOrigin: "top left", width: 1920, height: 1080 }}>
                    <Display state={current.state} />
                  </div>
                </div>
              </>
            );
          })()}
        </Section>

      </div>
    </div>
  );
}