# DOM Patterns

All DOM creation goes through a single `ce` function and its shortcuts in [`src/dom.ts`](../src/dom.ts).

## The `ce` Function

```typescript
function ce(tag: string, attrs?: Attrs, ...children: Children[]): HTMLElement;
```

Creates an element by tag name, applies attributes, and appends children.

**Parameters:**

- `tag: string` — HTML tag (e.g., `'div'`, `'button'`, `'input'`)
- `attrs?: Attrs` — properties and event listeners (see below)
- `...children: Children[]` — nested elements, text, or arrays (recursively flattened)

**Returns:** `HTMLElement` (or more specifically, the element type for that tag if using TypeScript)

### Attributes (`Attrs`)

Type: `Record<string, unknown> | null | undefined`

Special handling for common patterns:

| Attribute               | Handling                                                      |
| ----------------------- | ------------------------------------------------------------- |
| `style`                 | Object: `Object.assign(el.style, {...})`                      |
| `on*` (e.g., `onClick`) | Function: `addEventListener(name.slice(2).toLowerCase(), fn)` |
| `className`             | String: `el.className = ...`                                  |
| `id`                    | String: `el.id = ...`                                         |
| `value`                 | String: `(el as HTMLInputElement).value = ...`                |
| Others                  | `setAttribute(key, String(value))`                            |

**Examples:**

```typescript
// Click listener
ce('button', { onClick: () => alert('Hi') }, 'Click me');

// Styles
ce(
  'div',
  {
    style: {
      backgroundColor: 'red',
      padding: '10px',
      cursor: 'pointer',
    },
  },
  'Styled',
);

// Data attributes
ce('div', { 'data-match-id': '123' }, '...');

// Mixed
ce('input', {
  id: 'search',
  className: 'input-field',
  value: 'default',
  onInput: (e) => console.log(e.target.value),
  placeholder: 'Search...',
});
```

### Children Types

```typescript
type Child = HTMLElement | SVGElement | string | number | null | false;
type Children = Child | Child[];
```

**Behavior:**

- Elements → appended directly
- Strings/numbers → converted to text nodes
- Null/false → skipped (safe for conditionals)
- Arrays → recursively flattened

**Examples:**

```typescript
// Simple
ce('p', null, 'Hello world');

// Multiple children
ce('div', null, ce('h1', null, 'Title'), ce('p', null, 'Paragraph'));

// Arrays (automatically flattened)
const items = [1, 2, 3].map((n) => ce('li', null, String(n)));
ce('ul', null, items); // → <ul><li>1</li><li>2</li><li>3</li></ul>

// Conditionals (null is safe)
ce(
  'div',
  null,
  ce('p', null, 'Header'),
  condition ? ce('p', null, 'Shown') : null,
  ce('p', null, 'Footer'),
);

// Nested arrays
ce(
  'div',
  null,
  [ce('span', null, 'A'), ce('span', null, 'B')],
  [ce('span', null, 'C'), ce('span', null, 'D')],
);
// → <div><span>A</span><span>B</span><span>C</span><span>D</span></div>
```

## Shortcuts

Type-specific helpers that are just `ce` with the tag pre-filled:

```typescript
export const div = (a: Attrs, ...c: Children[]) => ce('div', a, ...c);
export const span = (a: Attrs, ...c: Children[]) => ce('span', a, ...c);
export const btn = (a: Attrs, ...c: Children[]) => ce('button', a, ...c);
export const inp = (a: Attrs) => ce('input', a) as HTMLInputElement;

export const svg = (attrs: Attrs, ...c: Children[]) => {
  /* ... */
};
export const path = (attrs: Attrs) => {
  /* ... */
};
```

**Examples:**

```typescript
// Instead of ce('div', ...) use div(...)
div({ className: 'card' }, span(null, 'Hello'), btn({ onClick: handleClick }, 'Button'));

// Input returns HTMLInputElement for convenience
const input = inp({ id: 'name', value: 'default' });
input.value = 'updated'; // No cast needed
```

---

## Real-World Examples

### Match Card Header

```typescript
const header = div(
  { className: 'match-header' },
  div(
    { className: 'teams' },
    span({ className: 'team home' }, matchTeamHome),
    span({ className: 'divider' }, 'vs'),
    span({ className: 'team away' }, matchTeamAway),
  ),
  div(
    { className: 'score' },
    matchScore ? span(null, matchScore) : span({ className: 'tbd' }, 'TBD'),
  ),
);
```

### Dynamic List

```typescript
function renderMatches(matches) {
  return div(
    { className: 'match-list' },
    matches.map((match) =>
      div(
        { className: 'match-item', key: match.id },
        span(null, match.home),
        span(null, match.score ?? 'vs'),
        span(null, match.away),
      ),
    ),
  );
}
```

### Form

```typescript
const form = div(
  { className: 'form' },
  div(
    { className: 'field' },
    inp({
      id: 'email',
      type: 'email',
      placeholder: 'you@example.com',
      onInput: (e) => handleEmailChange(e.target.value),
    }),
  ),
  div(
    { className: 'field' },
    btn(
      {
        onClick: handleSubmit,
        style: { marginTop: '1rem', cursor: 'pointer' },
      },
      'Submit',
    ),
  ),
);
```

### Bracket Cell (with SVG)

```typescript
function bracketCell(team, probability) {
  return div(
    { className: 'bracket-slot' },
    div({ className: 'team-name' }, team),
    svg(
      { width: '100', height: '20', style: { marginTop: '5px' } },
      path({
        d: `M 0 10 L ${probability * 100} 10`,
        stroke: 'blue',
        strokeWidth: '2',
      }),
    ),
  );
}
```

---

## Event Handling

Event listeners are attached via `on*` attributes:

```typescript
// Click
ce('button', { onClick: (e) => console.log(e) }, 'Click');

// Input
ce('input', { onInput: (e) => console.log(e.target.value) });

// Change
ce('select', { onChange: (e) => console.log(e.target.value) });

// Custom events (any `on*` works)
element.dispatchEvent(new CustomEvent('custom'));
ce('div', { onCustom: (e) => console.log('Custom event!') });
```

**Event handler signature:**

```typescript
type EventHandler = (event: Event) => void;
```

For typed access to `event.target`, cast or use type guards:

```typescript
ce('input', {
  onInput: (e) => {
    const target = e.target as HTMLInputElement;
    console.log(target.value);
  },
});
```

---

## Styling

### Inline Styles

Pass an object to the `style` attribute:

```typescript
ce(
  'div',
  {
    style: {
      backgroundColor: 'blue',
      padding: '10px',
      marginTop: '1rem',
      border: '1px solid gray',
    },
  },
  'Styled',
);
```

CSS properties use camelCase (not kebab-case). `Object.assign` merges them into the element's `.style` object.

### CSS Classes

Use `className`:

```typescript
ce('div', { className: 'card primary large' }, 'Content');

// Dynamic classes (concatenate strings)
const isActive = true;
ce('div', { className: `card ${isActive ? 'active' : ''}` }, '...');

// Multiple classes as template string
ce(
  'div',
  {
    className: ['card', isActive && 'active', isPrimary && 'primary'].filter(Boolean).join(' '),
  },
  '...',
);
```

---

## Accessing Elements After Creation

Since you control the creation, keep a reference:

```typescript
const container = div({ className: 'content' });
const heading = span(null, 'Title');

// Append to container
container.appendChild(heading);

// Update later
heading.textContent = 'New title';
```

Or modify via subscriptions:

```typescript
const container = div({ className: 'content' });

$data.sub((data) => {
  container.innerHTML = ''; // Clear
  if (data) {
    data.all.forEach((match) => {
      container.appendChild(matchCard(match));
    });
  }
});
```

---

## No VDOM, No Reconciliation

Unlike frameworks (React, Vue), updates are **direct DOM mutations**. This is:

- ✅ Fast for small data sets
- ✅ Simple to reason about
- ✅ No library overhead
- ❌ Not efficient for huge lists (1000+ items)

For this app, re-rendering ~50 elements per view is negligible. If that changes, consider virtual scrolling or incremental updates.

---

## TypeScript Tips

All `ce` calls are type-safe:

```typescript
const el = ce('button', { onClick: () => {} }, 'Click');
// el: HTMLButtonElement (not just HTMLElement)

const input = inp({ value: '10' });
// input: HTMLInputElement
// input.value is typed as string
```

If you need a specific element type after creation:

```typescript
const el = ce('input', { type: 'checkbox' }) as HTMLInputElement;
el.checked = true;
```

For attributes with strict typing:

```typescript
interface ButtonAttrs extends Record<string, unknown> {
  onClick?: (e: MouseEvent) => void;
  disabled?: boolean;
}

function button(attrs: ButtonAttrs, ...children: Children[]) {
  return ce('button', attrs, ...children) as HTMLButtonElement;
}
```

---

## Common Pitfalls

### 1. Forgetting the `children` argument is rest params

```typescript
// ❌ Wrong: attrs is treated as a child
ce('div', { className: 'card' }, 'Text 1', 'Text 2');
// Creates: <div class="card">Text 1Text 2</div>

// ✅ Correct: use array if multiple children without nesting
ce('div', { className: 'card' }, ['Text 1', 'Text 2']);
// or
ce('div', { className: 'card' }, 'Text 1', 'Text 2');
```

### 2. Null in children requires `Children` type for conditionals

```typescript
// ✅ Safe
ce('div', null, condition ? ce('p', null, 'Yes') : null);

// ❌ Less ideal (no null coercion for individual items in the rest params)
ce('div', null, condition ? ce('p', null, 'Yes') : false);
// Works but false isn't skipped in rest params; use null instead
```

### 3. Type casting for event targets

```typescript
// Event target is always `EventTarget`, need to cast
ce('input', {
  onInput: (e) => {
    const value = (e.target as HTMLInputElement).value;
  },
});
```

### 4. Modifying returned element

```typescript
// ✅ This works
const el = div({ className: 'container' });
el.setAttribute('data-id', '123');
return el;

// ❌ This doesn't (el is already created and returned)
// Don't try to modify el after returning it from a function
// if the function's return value is used elsewhere
```

---

## Summary

- **`ce(tag, attrs, ...children)`** — single function for all DOM creation
- **Children are typed** — `Child | Child[]`, flattened automatically
- **Attributes are flexible** — `onClick`, `style`, `className`, data attributes, etc.
- **No VDOM** — direct DOM mutations via subscription updates
- **Type-safe** — TypeScript knows element types and attribute contracts
- **Simple** — no library overhead, easy to read and debug
