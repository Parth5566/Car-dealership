# NCR Wheelz favicon and sharing assets

The owner supplied the favicon bundle in `frontend/public/brandings/`. Its original PNG/ICO files are preserved. The layout links to the supplied ICO, 16/32px PNG icons and 180px Apple icon. `/manifest.webmanifest` and the uploaded `site.webmanifest` reference the 192px and 512px Android icons in the same folder. Compatibility paths for the earlier generated icons and schema logo now contain the owner's artwork.

## Social image

- Final: `frontend/public/brandings/ncr-wheelz-og.png`, PNG, 1200×630.
- Compatibility copy: `frontend/public/images/social-preview.png`.
- Used by: shared Open Graph/Twitter page metadata and the listing fallback when there is no vehicle photo.
- Created with the built-in imagegen tool, using the owner's 512px favicon as the branding reference. Resized to the declared sharing dimensions and visually inspected. Cars are illustrative brand imagery.
- Original: `/Users/parth/.codex/generated_images/01a15906-d8ac-7e73-bc49-79cc201c3205/exec-140ec080-927b-44a2-b98d-a8ecd43b69a7.png`. The project asset is copied into the workspace and has no dependency on this original path.

Prompt:

> Use case: brand social sharing card. Create a finished premium automotive Open Graph image for NCR Wheelz, landscape aspect ratio precisely 1200:630 (1.9048:1), edge-to-edge opaque image. Reference image is the owner's existing favicon/logo: retain its red car silhouette and white italic NW lettermark accurately, as a small square logo in upper left. Do not redesign or spell out the letters as MW. Background charcoal near-black with subtle dark teal shading, premium editorial automotive advertising style. Left 58% is clean negative space with large extremely legible off-white modern sans-serif typography. Exact text hierarchy: upper left beside logo 'NCR WHEELZ'; main headline on two lines 'Your next chapter.' and 'Your next drive.'; smaller subtitle 'Used Cars & Commercial Vehicles'; footer 'Delhi NCR • ncrwheelz.com'. Right 42% features a beautifully lit generic modern silver passenger SUV in front three-quarter view, secondary small light commercial van behind it, subtle reflections and a thin restrained warm-gold route line along the bottom. No manufacturer logos, no visible number plate text, no people. Car images are illustrative brand imagery, not a specific stock listing. Restrained thin red accent picks up red in supplied logo; tiny warm gold accent ties to site. Spacious professional composition with at least 64 px safe margins at target 1200x630. No fake awards, testimonials, promises, buttons, UI mockup frames, watermarks, additional text or other logos. This is a social sharing image, not a screenshot.
