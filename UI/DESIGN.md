# Design System Specification: The Translucent Desktop

## 1. Overview & Creative North Star: "The Crystalline Utility"
The goal of this design system is to move beyond the rigid, opaque windows of the past. Our Creative North Star is **The Crystalline Utility**. This system treats the desktop interface as a high-end, optical instrument. We are not building "boxes"; we are arranging layers of precision-cut, frosted glass that feel weightless yet structurally sound. 

By leveraging the Windows 11 Mica-inspired philosophy, we reject the "web-app-in-a-box" aesthetic. Instead, we embrace **intentional depth and atmospheric integration**. The UI should feel like it belongs to the OS, pulling the user's desktop wallpaper through its veins while maintaining a sophisticated, editorial clarity through Segoe UI Variable and high-contrast typographic scales.

---

## 2. Color & Atmospheric Surface
The palette is rooted in professional neutrals with a high-precision Blue accent (`primary`). We avoid flat color blocks in favor of "Atmospheric Surfaces."

### The "No-Line" Rule
**Standard 1px solid borders are strictly prohibited for sectioning.** 
Structural boundaries must be defined solely through background tonal shifts. Use `surface-container-low` for secondary content areas sitting on a `surface` background. If you feel the need for a line, you haven't used your surface tokens correctly.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack. Each "inner" container must feel like it is either carved into or floating atop its parent.
- **Base Layer:** `surface` (The foundation).
- **Sub-sections:** `surface-container-low` (Recessed areas).
- **Floating Cards/Panels:** `surface-container-lowest` (The "lifted" feel).
- **Interactive Popovers:** `surface-container-highest` (The most immediate layer).

### The "Glass & Gradient" Rule
To achieve the premium Windows 11 feel, use `surface-tint` at 5-10% opacity over a `backdrop-blur` of 30px. 
- **Signature Gradient:** For primary CTAs and active Sliders, use a subtle linear gradient from `primary` (#005eb1) to `primary_dim` (#00529c) at a 135-degree angle. This provides "soul" and depth that prevents the app from looking like a flat prototype.

---

## 3. Typography: Segoe UI Precision
We utilize **Segoe UI Variable** (mapped to `inter` in the tokens) to bridge the gap between technical utility and editorial elegance.

*   **Display & Headlines:** Use `display-md` or `headline-lg` for dashboard summaries. These should have a slight negative letter-spacing (-0.02em) to feel "pressed" and authoritative.
*   **Body:** `body-md` is our workhorse. Ensure a line-height of 1.5 to maintain breathability against the semi-transparent backgrounds.
*   **Labels:** `label-md` and `label-sm` should be used for data points. To increase "Utility" feel, these can be set in `secondary` color to recede, allowing the user's data to take center stage in `on_surface`.

---

## 4. Elevation & Depth
Depth is achieved through physics, not just aesthetics.

### The Layering Principle
Stacking tokens is the only way to achieve hierarchy:
1.  **Window Frame:** Mica Material (Applied at OS level).
2.  **App Sidebar:** `surface-container-low`.
3.  **Main Content Area:** `surface`.
4.  **Utility Cards:** `surface-container-lowest`.

### Ambient Shadows & "Ghost Borders"
*   **Shadows:** Shadows are only permitted on floating modals. Use a `32px` blur, `0px` offset, and 6% opacity of `on_surface`.
*   **The Ghost Border Fallback:** If accessibility requires a border, use `outline_variant` at **15% opacity**. This creates a "light-catching edge" rather than a hard stroke.

---

## 5. Components

### Buttons & Interaction
*   **Primary Button:** Uses the `primary` to `primary_dim` gradient. Corner radius is strictly `DEFAULT` (0.5rem / 8px).
*   **Secondary/Ghost:** No background. Use `on_surface` text with a `surface_variant` hover state.
*   **Sliders:** The track uses `secondary_container`, while the active fill and thumb use `primary`. The thumb should have a `surface_container_lowest` inner glow.

### Input Fields
*   **Styling:** Forbid 4-sided borders. Use a `surface_container_high` background with a 2px `primary` bottom-accent that appears only on focus.
*   **Glass Inputs:** For "Quick Search" bars, use `surface_container_low` with a 20px backdrop blur to allow the background content to peek through.

### Cards & Lists
*   **The Divider Ban:** Do not use `<hr>` or border-bottom. Separate list items using the `spacing["3"]` (0.6rem) vertical gap or alternating `surface` and `surface_container_low` backgrounds.
*   **Selection States:** Selected list items should use `primary_container` with `on_primary_container` text.

### Tooltips
*   **Design:** Use `inverse_surface` with `inverse_on_surface` text. Apply `lg` (1rem) roundedness to make them feel distinct from the sharp 8px utility grid.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use `surface_bright` for active hover states on dark backgrounds to create a "bloom" effect.
*   **Do** respect the `0.5rem` (8px) corner radius for all containers to maintain the Windows 11 signature.
*   **Do** use `on_surface_variant` for helper text—it provides enough contrast for utility without cluttering the visual field.

### Don’t:
*   **Don’t** use pure black (#000) or pure white (#FFF) for backgrounds. Always use the `surface` tokens to ensure the "Mica" translucency feels natural.
*   **Don’t** use shadows on nested cards. Use tonal shifts (`surface-container-low` to `surface-container-lowest`) instead.
*   **Don’t** allow high-contrast borders to break the fluid "glass" look. If a section feels muddy, increase the `spacing` scale rather than adding a line.