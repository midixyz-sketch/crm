# Design Guidelines for WhatsApp-Integrated CRM System

## Design Approach

**Selected Approach:** Design System-Based (Productivity Application)

**Primary References:** Linear's clean aesthetic, Notion's data organization, Slack's messaging patterns

**Rationale:** This is a utility-focused, data-intensive CRM application requiring clarity, efficiency, and professional appearance over visual flair. The design prioritizes information density, quick scanning, and task completion.

---

## Core Design Principles

1. **Clarity Over Decoration** - Every element serves a functional purpose
2. **Consistent Information Hierarchy** - Clear visual weight for data importance
3. **Familiar Messaging Patterns** - WhatsApp-style chat interface for user comfort
4. **Status Awareness** - Always-visible connection indicators
5. **RTL Support** - Accommodate Hebrew and other RTL languages

---

## Color Palette

### Light Mode
- **Background Primary:** 0 0% 100% (pure white)
- **Background Secondary:** 220 14% 96% (light gray)
- **Background Tertiary:** 220 13% 91% (subtle gray)
- **Text Primary:** 222 47% 11% (near black)
- **Text Secondary:** 215 16% 47% (medium gray)
- **Text Tertiary:** 215 14% 71% (light gray)

### Dark Mode
- **Background Primary:** 222 47% 11% (dark slate)
- **Background Secondary:** 217 33% 17% (slightly lighter slate)
- **Background Tertiary:** 215 25% 27% (medium slate)
- **Text Primary:** 210 40% 98% (near white)
- **Text Secondary:** 217 11% 65% (light gray)
- **Text Tertiary:** 215 14% 34% (medium gray)

### Brand & Accent Colors
- **Primary (WhatsApp Green):** 142 71% 45% (for WhatsApp-related actions)
- **Secondary (Blue):** 221 83% 53% (for CRM actions, links)
- **Success:** 142 76% 36% (for successful operations)
- **Warning:** 38 92% 50% (for connection issues)
- **Error:** 0 84% 60% (for errors, failed messages)
- **Info:** 199 89% 48% (for informational badges)

### Semantic Colors
- **Online Status:** 142 71% 45% (green)
- **Offline Status:** 0 0% 60% (gray)
- **Pending Status:** 38 92% 50% (amber)
- **Message Sent:** 142 71% 45% (green)
- **Message Failed:** 0 84% 60% (red)

---

## Typography

**Primary Font Family:** Inter (Google Fonts)
- Clean, highly legible at small sizes
- Excellent for data-dense interfaces
- Wide language support including Hebrew

**Secondary Font (Monospace):** JetBrains Mono (for phone numbers, IDs)

### Type Scale
- **Display (Headings):** 
  - H1: 2rem (32px), font-weight: 700, line-height: 1.2
  - H2: 1.5rem (24px), font-weight: 600, line-height: 1.3
  - H3: 1.25rem (20px), font-weight: 600, line-height: 1.4

- **Body Text:**
  - Large: 1rem (16px), font-weight: 400, line-height: 1.5
  - Base: 0.875rem (14px), font-weight: 400, line-height: 1.5
  - Small: 0.75rem (12px), font-weight: 400, line-height: 1.4

- **UI Elements:**
  - Buttons: 0.875rem (14px), font-weight: 500
  - Labels: 0.75rem (12px), font-weight: 500, uppercase tracking
  - Captions: 0.6875rem (11px), font-weight: 400

---

## Layout System

**Spacing Scale:** Consistent 4px base unit
- Common spacing values: 2 (8px), 3 (12px), 4 (16px), 6 (24px), 8 (32px), 12 (48px), 16 (64px)
- Use these units consistently: p-4, gap-6, space-y-8

**Container Widths:**
- Main content: max-w-7xl (1280px)
- Sidebar: w-64 (256px) on desktop, full-width drawer on mobile
- Message panel: w-96 (384px) fixed width or responsive
- Forms: max-w-2xl (672px) for optimal readability

**Grid System:**
- Candidate cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Dashboard stats: grid-cols-2 md:grid-cols-4
- Message history: Single column, full-width with max-w-4xl

---

## Component Library

### Navigation
**Top Navigation Bar:**
- Fixed position with backdrop blur
- Height: h-16 (64px)
- Logo left, connection status center, user menu right
- Real-time WhatsApp connection indicator (green dot = connected, red = disconnected, amber = reconnecting)
- Dark/light mode toggle

**Sidebar Navigation:**
- Collapsible on mobile
- Icon + label for main sections: Dashboard, Candidates, Messages, Settings
- Active state: subtle background + accent border-left
- Section headers with dividers

### Data Display

**Candidate Cards:**
- White/dark background with subtle shadow
- Border radius: rounded-lg (8px)
- Padding: p-6
- Structure: Header (name, status badge), body (contact info, tags), footer (action buttons)
- Hover state: slight elevation increase

**Data Tables:**
- Alternating row backgrounds for scanability
- Sticky header row
- Sortable columns with chevron indicators
- Row hover: subtle background change
- Responsive: stack to cards on mobile

**Message History Component:**
- WhatsApp-style bubble design
- Outgoing: aligned right, green background (142 71% 45%)
- Incoming: aligned left, gray background
- Timestamps below each message
- Delivery status icons (sent, delivered, read)
- Border radius: rounded-2xl for message bubbles

### Forms & Inputs

**Text Inputs:**
- Height: h-10 (40px)
- Border: 1px solid with focus ring
- Rounded: rounded-md
- Padding: px-3 py-2
- Dark mode: consistent background treatment

**Buttons:**
- Primary: WhatsApp green background, white text
- Secondary: Blue background, white text
- Outline: Border with transparent background
- Ghost: No border or background until hover
- Sizes: sm (h-8), md (h-10), lg (h-12)

**Select Dropdowns:**
- Match input styling
- Clear dropdown indicators
- Max-height with scroll for long lists

### Status Indicators

**Connection Badge:**
- Pill-shaped badge in header
- Icon + text: "Connected" / "Disconnected" / "Reconnecting..."
- Animated pulse for "Reconnecting"
- Color-coded by status

**Message Status Icons:**
- Single check: sent
- Double check: delivered  
- Double check (blue): read
- Clock icon: pending
- Alert icon: failed

### Cards & Panels

**Dashboard Stats Cards:**
- Clean white/dark cards
- Large number display (3rem, font-weight: 700)
- Label below (text-sm, text-secondary)
- Optional icon top-right
- Subtle shadow and hover elevation

**Message Panel:**
- Fixed-width sidebar or modal overlay
- Header: candidate info + close button
- Body: scrollable message history
- Footer: message input + send button (sticky)
- WhatsApp-style interface for familiarity

### Modals & Overlays

**Modal Dialogs:**
- Centered overlay with backdrop blur
- Max-width: max-w-lg to max-w-2xl depending on content
- Rounded corners: rounded-xl
- Shadow: strong shadow for elevation
- Header with title + close button
- Footer with action buttons (right-aligned)

---

## Special Considerations

### RTL Support
- Layout automatically flips for Hebrew and Arabic
- Messaging bubbles: incoming right, outgoing left (reversed)
- Sidebar and navigation adjust accordingly
- Test with `dir="rtl"` on root element

### WhatsApp QR Code Display
- Large QR code centered in modal or dedicated page
- Clear instructions in Hebrew and English
- Auto-refresh if QR expires
- Progress indicator during authentication

### Empty States
- Centered icon + message + optional CTA button
- Use for: No candidates, no messages, disconnected state
- Friendly, helpful tone in copy

### Loading States
- Skeleton screens for data tables and cards
- Spinner for actions (sending messages)
- Progress bars for batch operations
- Maintain layout stability

---

## Animation & Motion

**Use Sparingly** - Functional motion only:
- Page transitions: 200ms fade
- Dropdown menus: 150ms slide-down
- Modal appearance: 250ms scale + fade
- Hover states: 150ms property changes
- Connection status changes: 300ms color transition with subtle pulse

**Avoid:** Gratuitous animations, auto-playing elements, complex scroll-triggered effects

---

## Accessibility

- WCAG 2.1 AA contrast ratios minimum (4.5:1 for text)
- Focus indicators on all interactive elements
- Keyboard navigation support throughout
- Screen reader labels for icons and status indicators
- Dark mode with consistent treatment of form inputs
- Error messages with clear, actionable text

---

## Images

**No hero images required** for this utility application. 

**Profile/Avatar Placeholders:**
- Use colored circles with initials
- Consistent 32px, 40px, 48px sizes
- Color generated from name hash for consistency

**Empty State Illustrations:**
- Simple line-art illustrations for empty states
- Neutral, professional tone
- Keep file sizes small