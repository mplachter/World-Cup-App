import { color, space, radius, fontSize, fontWeight } from '../design/tokens';
import {
  Stack,
  Row,
  Text,
  Badge,
  StatusDot,
  Panel,
  FilterButton,
  SectionLabel,
} from '../design/components';
import { useState } from 'preact/hooks';

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginBottom: space.xl }}>
      <div
        style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.semibold,
          color: color.textMuted,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: space.md,
          borderBottom: `1px solid ${color.border2}`,
          paddingBottom: space.xs,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  const isGradient = value.includes('gradient') || value.includes('(');
  const showSwatch = !value.includes('gradient') || value.startsWith('linear');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBottom: space.xs }}>
      {showSwatch && (
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: radius.xs,
            background: value,
            border: `1px solid ${color.border2}`,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontSize: fontSize.sm,
          color: color.textSecondary,
          fontFamily: 'monospace',
          minWidth: '220px',
        }}
      >
        {name}
      </span>
      <span style={{ fontSize: fontSize.xs, color: color.textMuted, fontFamily: 'monospace' }}>
        {value}
      </span>
    </div>
  );
}

export function CatalogView() {
  const [activeFilter, setActiveFilter] = useState('All');
  const filterOptions = ['All', 'Group', 'R32', 'R16', 'QF', 'SF', 'Final'];

  return (
    <div
      style={{
        background: color.bg,
        minHeight: '100vh',
        padding: space.xl,
        color: color.textPrimary,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px' }}>
          <h1
            style={{
              fontSize: fontSize['2xl'],
              fontWeight: fontWeight.bold,
              color: color.textWhite,
              marginBottom: space.xs,
            }}
          >
            Design System Catalog
          </h1>
          <p style={{ fontSize: fontSize.body, color: color.textMuted }}>
            All components and design tokens for the World Cup app.
          </p>
        </div>

        {/* ── COLORS ────────────────────────────────────────── */}
        <Section title="Colors — Text">
          <Swatch name="color.textWhite" value={color.textWhite} />
          <Swatch name="color.textPrimary" value={color.textPrimary} />
          <Swatch name="color.textSecondary" value={color.textSecondary} />
          <Swatch name="color.textMuted" value={color.textMuted} />
          <Swatch name="color.textDim" value={color.textDim} />
          <Swatch name="color.textFaint" value={color.textFaint} />
        </Section>

        <Section title="Colors — Semantic">
          <Row gap="sm" wrap style={{ marginBottom: space.sm }}>
            <div
              style={{
                padding: `${space.xs} ${space.sm}`,
                background: color.accentSurface,
                border: `1px solid ${color.accentBorder}`,
                borderRadius: radius.md,
                fontSize: fontSize.md,
                color: color.accentText,
              }}
            >
              accent
            </div>
            <div
              style={{
                padding: `${space.xs} ${space.sm}`,
                background: color.liveSurface,
                border: `1px solid ${color.liveBorder}`,
                borderRadius: radius.md,
                fontSize: fontSize.md,
                color: color.liveText,
              }}
            >
              live
            </div>
            <div
              style={{
                padding: `${space.xs} ${space.sm}`,
                background: color.todaySurface,
                border: `1px solid ${color.todayBorder}`,
                borderRadius: radius.md,
                fontSize: fontSize.md,
                color: color.todayText,
              }}
            >
              today
            </div>
            <div
              style={{
                padding: `${space.xs} ${space.sm}`,
                background: color.successSurface,
                border: `1px solid ${color.successBorder}`,
                borderRadius: radius.md,
                fontSize: fontSize.md,
                color: color.successText,
              }}
            >
              success
            </div>
            <div
              style={{
                padding: `${space.xs} ${space.sm}`,
                background: color.predSurface,
                border: `1px solid ${color.predBorder}`,
                borderRadius: radius.md,
                fontSize: fontSize.md,
                color: color.predText,
              }}
            >
              pred
            </div>
          </Row>
        </Section>

        {/* ── TYPOGRAPHY ────────────────────────────────────── */}
        <Section title="Typography — Text variants">
          <Stack gap="sm">
            <Text variant="heading" as="div">
              heading · {fontSize.lg} bold
            </Text>
            <Text variant="body" as="div">
              body · {fontSize.body} regular
            </Text>
            <Text variant="sm" as="div">
              sm · {fontSize.base} secondary
            </Text>
            <Text variant="xs" as="div">
              xs · {fontSize.sm} muted
            </Text>
            <Text variant="label" as="div">
              label · uppercase semibold
            </Text>
            <Text variant="mono" as="div">
              mono · {fontSize.base} monospace
            </Text>
          </Stack>
        </Section>

        {/* ── BADGES ────────────────────────────────────────── */}
        <Section title="Badge — All variants">
          <Row gap="sm" wrap>
            <Badge variant="live">LIVE</Badge>
            <Badge variant="today">TODAY</Badge>
            <Badge variant="played">FT</Badge>
            <Badge variant="upcoming">UPCOMING</Badge>
            <Badge variant="locked" mono>
              LOCKED
            </Badge>
            <Badge variant="projected" mono>
              PROJ
            </Badge>
            <Badge variant="pred" mono>
              PRED
            </Badge>
            <Badge variant="stage">GROUP A</Badge>
            <Badge variant="neutral">NEUTRAL</Badge>
          </Row>
        </Section>

        {/* ── STATUS DOT ────────────────────────────────────── */}
        <Section title="StatusDot">
          <Row gap="lg">
            <Row gap="xs">
              <StatusDot live size="sm" />
              <Text variant="sm" as="span">
                live sm
              </Text>
            </Row>
            <Row gap="xs">
              <StatusDot live size="md" />
              <Text variant="sm" as="span">
                live md
              </Text>
            </Row>
            <Row gap="xs">
              <StatusDot live={false} size="md" />
              <Text variant="sm" as="span">
                inactive
              </Text>
            </Row>
          </Row>
        </Section>

        {/* ── PANEL ─────────────────────────────────────────── */}
        <Section title="Panel — All variants">
          <Stack gap="sm">
            {(['base', 'accent', 'live', 'today', 'success', 'pred'] as const).map((v) => (
              <Panel key={v} variant={v}>
                <Text variant="sm" as="div">
                  Panel variant="{v}"
                </Text>
              </Panel>
            ))}
          </Stack>
        </Section>

        {/* ── FILTER BUTTON ─────────────────────────────────── */}
        <Section title="FilterButton">
          <Row gap="xs" wrap>
            {filterOptions.map((opt) => (
              <FilterButton
                key={opt}
                active={activeFilter === opt}
                onClick={() => setActiveFilter(opt)}
              >
                {opt}
              </FilterButton>
            ))}
          </Row>
          <Text variant="xs" as="div" style={{ marginTop: space.sm }}>
            Active: {activeFilter}
          </Text>
        </Section>

        {/* ── SECTION LABEL ─────────────────────────────────── */}
        <Section title="SectionLabel">
          <SectionLabel>Group Stage</SectionLabel>
          <SectionLabel>Round of 32</SectionLabel>
          <SectionLabel>Squad Roster</SectionLabel>
        </Section>

        {/* ── LAYOUT ────────────────────────────────────────── */}
        <Section title="Stack (flex column)">
          <Stack
            gap="xs"
            style={{
              background: color.surface1,
              padding: space.sm,
              borderRadius: radius.lg,
              border: `1px solid ${color.border2}`,
            }}
          >
            <div
              style={{
                background: color.accentSurface,
                padding: space.xs,
                borderRadius: radius.sm,
                fontSize: fontSize.sm,
                color: color.accentText,
              }}
            >
              Item 1
            </div>
            <div
              style={{
                background: color.accentSurface,
                padding: space.xs,
                borderRadius: radius.sm,
                fontSize: fontSize.sm,
                color: color.accentText,
              }}
            >
              Item 2
            </div>
            <div
              style={{
                background: color.accentSurface,
                padding: space.xs,
                borderRadius: radius.sm,
                fontSize: fontSize.sm,
                color: color.accentText,
              }}
            >
              Item 3
            </div>
          </Stack>
        </Section>

        <Section title="Row (flex row)">
          <Row
            gap="sm"
            justify="space-between"
            style={{
              background: color.surface1,
              padding: space.sm,
              borderRadius: radius.lg,
              border: `1px solid ${color.border2}`,
            }}
          >
            <div
              style={{
                background: color.accentSurface,
                padding: space.xs,
                borderRadius: radius.sm,
                fontSize: fontSize.sm,
                color: color.accentText,
              }}
            >
              Left
            </div>
            <div
              style={{
                background: color.surface3,
                padding: space.xs,
                borderRadius: radius.sm,
                fontSize: fontSize.sm,
                color: color.textSecondary,
              }}
            >
              Center
            </div>
            <div
              style={{
                background: color.liveSurface,
                padding: space.xs,
                borderRadius: radius.sm,
                fontSize: fontSize.sm,
                color: color.liveText,
              }}
            >
              Right
            </div>
          </Row>
        </Section>
      </div>
    </div>
  );
}
