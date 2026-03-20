# Design System Specification: High-Tech Luxury Editorial

## 1. Overview & Creative North Star
**Creative North Star: The Digital Atelier**
This design system rejects the "templated" nature of modern SaaS in favor of a high-end editorial experience. It merges the precision of high-tech minimalism (Apple-inspired) with the emotive, spacious storytelling of luxury fashion. 

To break the "standard grid" feel, the system utilizes **Intentional Asymmetry**. Elements should not always sit in a rigid 12-column cage; instead, use the spacing scale to create "breathing pockets." Overlap high-quality imagery with floating glass containers to create a sense of three-dimensional physical depth. This is not just a UI; it is a curated gallery.

---

## 2. Colors & Surface Logic
The palette is rooted in deep blacks and crisp whites, using a singular, high-voltage orange (`#FF4500`) to guide the eye with surgical precision.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Traditional dividers are prohibited. Separation must be achieved through:
1.  **Background Shifts:** Transitioning from `surface` (#131313) to `surface_container_low` (#1B1B1B).
2.  **Spaciousness:** Using the Spacing Scale (specifically `8`, `12`, and `16`) to create mental boundaries.

### Surface Hierarchy & Nesting
Treat the interface as a series of physical layers. Use the following tiers to define importance:
*   **Base Layer:** `surface` (#131313) for the overall canvas.
*   **Secondary Content:** `surface_container_low` (#1B1B1B) for large background sections.
*   **Interactive Cards:** `surface_container` (#1F1F1F) or `surface_container_high` (#2A2A2A) to lift items toward the user.

### The Glass & Gradient Rule
For primary CTAs or hero headers, avoid "flat" orange. Use a subtle linear gradient from `primary_container` (#FF5625) to `primary` (#FFB5A0) at a 135° angle to give the accent "soul." For floating navigation or modals, use **Glassmorphism**: a background of `surface_container` at 70% opacity with a `24px` backdrop-blur.

---

## 3. Typography
We utilize **Inter** to achieve a "San Francisco" aesthetic. Hierarchy is the primary tool for luxury—extreme contrast between display sizes and body text is encouraged.

*   **Display (lg/md):** Used for "Statement Headers." Tracking should be set to `-0.02em` for a tighter, premium feel.
*   **Headline (lg/md):** Used for secondary storytelling. 
*   **Body (lg):** The workhorse. Always ensure a line-height of `1.6` to maintain the editorial vibe.
*   **Label (md/sm):** Used for technical metadata or "Overlines" (small caps, slightly tracked out) above headlines.

**Tone:** Typography should feel authoritative yet breathable. Never crowd a headline; give it 2x the padding you think it needs.

---

## 4. Elevation & Depth
In this system, depth is "felt," not "seen."

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface_container_highest` (#353535) card on top of a `surface_container_low` (#1B1B1B) section. This creates a soft, natural lift without the "dirtiness" of heavy shadows.
*   **Ambient Shadows:** When a shadow is required (e.g., a floating modal), use: `0px 24px 48px rgba(0, 0, 0, 0.4)`. The shadow must be wide and soft.
*   **The Ghost Border:** If a container sits on a background of the same color, use the `outline_variant` (#5D4038) at **15% opacity**. This creates a "suggestion" of an edge rather than a hard line.
*   **Glassmorphism:** Use `surface_bright` (#393939) at 40% opacity with a `blur(12px)` for utility elements like tooltips or floating action bars.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary_container` to `primary`), `9999px` radius (pill), `label-md` bold text.
*   **Secondary:** Glass background (`surface_bright` at 20%), white text, `9999px` radius.
*   **Tertiary:** No background. Bold orange text (`primary`) with a subtle `3px` bottom margin that expands on hover.

### Cards & Lists
*   **The Rule:** No dividers. Separate list items using `1.4rem` (`4`) of vertical padding.
*   **Radius:** Always use `xl` (3rem) for large image cards and `lg` (2rem) for standard content cards.
*   **Hover State:** Cards should subtly scale (1.02x) and shift from `surface_container` to `surface_container_high`.

### Input Fields
*   **Style:** Minimalist underline or "Soft Fill." Use `surface_container_lowest` for the field background with an `xl` corner radius.
*   **Focus State:** The `outline` token (#AD887E) appears at 30% opacity as a soft outer glow, never a sharp 1px box.

### Signature Component: The "Editorial Hero"
A combination of a `display-lg` headline, a `primary` (orange) label-sm overline, and a high-resolution image with a `lg` radius, overlapping the text slightly to create a 3D layered effect.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use extreme white space. If a section feels "full," double the padding.
*   **Do** use `primary` (#FF4500) sparingly. It should be the "diamond in the dark"—only for the most important actions.
*   **Do** use high-quality, high-contrast photography (Black & White photos with the orange accent work exceptionally well).

### Don’t:
*   **Don’t** use 1px solid borders. It breaks the "luxury" illusion and feels like a bootstrap template.
*   **Don’t** use pure `#000000` for backgrounds. Use `surface` (#131313) to allow for depth and subtle shadows to remain visible.
*   **Don’t** center-align long blocks of text. Stick to left-aligned editorial layouts for better readability and a modern feel.