# Design System Strategy: The Digital Atelier

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Digital Atelier."** 

We are not building a standard utility app; we are crafting a private, high-end dressing room. The aesthetic philosophy merges the precision of **Apple’s Human Interface Design** with the editorial, rhythmic whitespace of **Zara’s digital presence**. We move beyond the "template" look by embracing **intentional asymmetry** and **tonal depth**. 

By utilizing the provided spacing scale and surface hierarchy, we create an interface that feels like a physical space—layered, textured, and curated. This is a "quiet luxury" approach: confidence through breathing room, bespoke typography scales, and the total absence of harsh structural lines.

---

## 2. Colors & Surface Philosophy
The palette is rooted in the depth of `surface` (#131315). We treat color not as a decoration, but as a structural material.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to define sections. Layout boundaries must be defined solely through:
1.  **Background Color Shifts:** Placing a `surface-container-low` section against the base `surface`.
2.  **Tonal Transitions:** Using the `surface-container` tiers to imply hierarchy.
3.  **Negative Space:** Using the larger end of the spacing scale (`8` to `12`) to separate conceptual blocks.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, premium materials (frosted glass, matte carbon, brushed silk). 
- **The Base:** Everything sits on `surface` (#131315).
- **The Inset:** Use `surface-container-lowest` (#0E0E10) for recessed areas like search bars or secondary content wells.
- **The Elevation:** Use `surface-container-high` (#2A2A2C) for cards or panels that need to feel "closer" to the user.

### The "Glass & Gradient" Rule
To achieve "Apple-level" quality, floating elements (modals, navigation bars) must utilize **Glassmorphism**. 
- **Implementation:** Use `surface-variant` at 60% opacity with a `20px` to `40px` backdrop-blur.
- **CTAs:** For primary actions, move beyond flat orange. Apply a subtle linear gradient from `primary` (#FFB68B) to `on-primary-container` (#C45C00) at a 135-degree angle to give the button "soul" and a slight metallic sheen.

---

## 3. Typography: The Editorial Voice
We use a dual-typeface system to balance tech-forward precision with high-fashion elegance.

- **The Display/Headline (Manrope):** This is our "Editorial" voice. Use `display-lg` and `headline-lg` with tight letter-spacing (-0.02em) to create an authoritative, Pinterest-inspired look. Headlines should often be asymmetric—don't feel the need to center-align everything.
- **The UI/Body (Inter):** This is our "Functional" voice. Inter provides the Apple-level legibility required for AI interactions. Use `body-md` for standard AI responses and `label-sm` (all caps, tracked out +10%) for category headers to mimic fashion tags.

---

## 4. Elevation & Depth
In this design system, shadows are atmospheric, not structural.

- **The Layering Principle:** Depth is achieved by stacking. A `surface-container-highest` card placed on a `surface-container-low` background creates a natural lift.
- **Ambient Shadows:** For "floating" elements like luxury product cards, use extra-diffused shadows: `0px 20px 40px rgba(0, 0, 0, 0.4)`. The shadow color should never be pure black; it should be a tinted version of the surface color to maintain the "charcoal" warmth.
- **The "Ghost Border" Fallback:** If a container requires definition against a similar background, use a **Ghost Border**. Apply `outline-variant` (#47464A) at **15% opacity**. This provides a whisper of an edge without breaking the "No-Line" rule.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `on-primary-container`), `xl` (1.5rem) roundedness. Text is `title-sm` in `on-primary-fixed` (#321200).
- **Secondary:** `surface-container-highest` fill with no border. High-end, subtle, and tactile.
- **Tertiary:** Pure text using `tertiary` (#D3C5AD) with a `label-md` weight.

### Input Fields
- **Style:** Use `surface-container-lowest` as the fill. No border.
- **Focus State:** Instead of a thick border, use a 1px "Ghost Border" of `primary` at 40% and a subtle `0.5` spacing inner-glow.

### Cards & Lists
- **The Forbid Rule:** **No dividers.** To separate items in a list, use a `2` (0.7rem) vertical spacing gap or alternate the background color between `surface-container-low` and `surface-container-high`.
- **Pinterest-Inspired Grid:** Use asymmetric heights for image-heavy cards to create a "Curated" feel rather than a rigid "Shop" feel.

### Selection Chips
- **Style:** `full` (9999px) roundedness. 
- **Unselected:** `surface-container-high`.
- **Selected:** `primary` fill with `on-primary` text.

### Luxury AI Chat Bubbles
- **User:** `surface-container-highest` with `xl` rounding. 
- **AI (Sense AI):** Use a subtle glassmorphic effect with a `tertiary-fixed-dim` accent on the left edge (2px wide) to signify the "Curator" is speaking.

---

## 6. Do's and Don'ts

### Do:
- **Do** use `24` (8.5rem) spacing at the bottom of pages to allow content to "float" off the screen.
- **Do** use "Champagne Beige" (`tertiary`) for high-end metadata like price, material, or AI confidence scores.
- **Do** lean into `xl` (1.5rem) and `full` roundedness for a soft, premium feel.

### Don't:
- **Don't** use 100% white (#FFFFFF). All "white" text should be `on-surface` (#E5E1E4) or `secondary-fixed` (#E4E1E6) to maintain the charcoal atmosphere.
- **Don't** use standard "Drop Shadows" from a UI kit. They must be custom, large-blur, and low-opacity.
- **Don't** clutter the screen. If a section feels "busy," double the spacing between elements. In luxury, space is the ultimate feature.