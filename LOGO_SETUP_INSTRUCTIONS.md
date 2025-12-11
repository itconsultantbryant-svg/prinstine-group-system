# Logo Setup Instructions

## Step 1: Save the Logo Image

Please save the Prinstine Group logo image as `prinstine-logo.png` in the following location:

```
client/public/prinstine-logo.png
```

## Step 2: Verify the Logo

After saving the logo, verify it appears in:
- ✅ Login page (top center)
- ✅ Sidebar header (left side navigation)
- ✅ TopBar (top right area)
- ✅ Browser tab/favicon
- ✅ Mobile app icon (if applicable)

## Logo Specifications

The logo should be:
- Format: PNG (with transparency preferred)
- Recommended size: At least 200x120px for best quality
- Aspect ratio: Maintain original proportions

## Fallback

If the logo file is not found, the system will automatically show:
- Building icon on login page
- Building icon in sidebar
- Text-only branding in TopBar

## Testing

1. Save the logo file to `client/public/prinstine-logo.png`
2. Refresh your browser
3. Check all locations mentioned above
4. The logo should appear automatically

## Notes

- The logo is referenced as `/prinstine-logo.png` (public folder path)
- All components have error handling to show fallback icons if logo is missing
- Logo will scale appropriately on different screen sizes

