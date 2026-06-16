/**
 * Material Color Utilities — Minimal Implementation
 * Based on Google's @material/material-color-utilities for Material Design 3
 *
 * Implements:
 * - sRGB ↔ HSL color space conversions
 * - Tonal palette generation (tones 0–100)
 * - Material You color scheme generation (light/dark)
 * - Theme application as CSS custom properties
 */
(function (root) {
    'use strict';

    // ── Color Space Conversions ──────────────────────────────────────

    function hexToRgb(hex) {
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
        return {
            r: parseInt(hex.substring(0, 2), 16),
            g: parseInt(hex.substring(2, 4), 16),
            b: parseInt(hex.substring(4, 6), 16)
        };
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(function (c) {
            var h = Math.round(Math.max(0, Math.min(255, c))).toString(16);
            return h.length === 1 ? '0' + h : h;
        }).join('');
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;
        if (max === min) {
            h = s = 0;
        } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return { h: h * 360, s: s * 100, l: l * 100 };
    }

    function hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            var hue2rgb = function (p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    // ── WCAG Contrast ────────────────────────────────────────────────

    function relativeLuminance(r, g, b) {
        var arr = [r, g, b].map(function (c) {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * arr[0] + 0.7152 * arr[1] + 0.0722 * arr[2];
    }

    function contrastRatio(rgb1, rgb2) {
        var l1 = relativeLuminance(rgb1.r, rgb1.g, rgb1.b);
        var l2 = relativeLuminance(rgb2.r, rgb2.g, rgb2.b);
        var lighter = Math.max(l1, l2);
        var darker  = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    // ── Tonal Palette ────────────────────────────────────────────────
    // Material Design 3 defines 26 standard tones:
    //   0, 4, 6, 10, 12, 17, 20, 22, 24, 25, 30, 35, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100
    // We generate them by varying HSL lightness while preserving hue and adjusting saturation
    // for perceptual consistency (a simplified approximation of HCT behavior).

    var TONES = [0, 4, 6, 10, 12, 17, 20, 22, 24, 25, 30, 35, 40, 50, 60, 70, 80, 87, 90, 92, 94, 95, 96, 98, 99, 100];

    function generateTonalPalette(hex) {
        var rgb = hexToRgb(hex);
        var hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        var palette = {};

        TONES.forEach(function (tone) {
            // Adjust saturation: reduce at extremes of lightness for more natural colors
            var sat = hsl.s;
            if (tone <= 20) {
                sat = Math.max(0, sat * (tone / 20));
            } else if (tone >= 80) {
                sat = Math.max(0, sat * ((100 - tone) / 20));
            }
            // Slightly boost chroma in mid-tones for vibrancy
            if (tone >= 30 && tone <= 60) {
                sat = Math.min(100, sat * 1.1);
            }
            var c = hslToRgb(hsl.h, sat, tone);
            palette[tone] = rgbToHex(c.r, c.g, c.b);
        });

        return palette;
    }

    // ── Material You Scheme Generation ───────────────────────────────
    //
    // Maps tonal palette tones to Material Design 3 color roles.
    // Reference: https://m3.material.io/styles/color/system

    function generateScheme(sourceHex, isDark) {
        var primary        = generateTonalPalette(sourceHex);
        var rgb            = hexToRgb(sourceHex);
        var hsl            = rgbToHsl(rgb.r, rgb.g, rgb.b);

        // onPrimary: derive from source color luminance for proper contrast
        // (dark source → white text, light source → dark text)
        var onPrimaryColor = relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.5 ? '#1C1B1F' : '#FFFFFF';

        // Secondary: hue +60°, reduced saturation
        var secRgb = hslToRgb((hsl.h + 60) % 360, Math.min(100, hsl.s * 0.5), hsl.l);
        var secondary = generateTonalPalette(rgbToHex(secRgb.r, secRgb.g, secRgb.b));

        // Tertiary: hue +120°, moderate saturation
        var terRgb = hslToRgb((hsl.h + 120) % 360, Math.min(100, hsl.s * 0.8), hsl.l);
        var tertiary = generateTonalPalette(rgbToHex(terRgb.r, terRgb.g, terRgb.b));

        // Error: Material standard red
        var error = generateTonalPalette('#BA1A1A');

        // Neutral: very low saturation version of primary
        var neuRgb = hslToRgb(hsl.h, Math.min(8, hsl.s * 0.15), hsl.l);
        var neutral = generateTonalPalette(rgbToHex(neuRgb.r, neuRgb.g, neuRgb.b));

        // Neutral Variant: low saturation version of primary
        var nvRgb = hslToRgb(hsl.h, Math.min(20, hsl.s * 0.35), hsl.l);
        var neutralVariant = generateTonalPalette(rgbToHex(nvRgb.r, nvRgb.g, nvRgb.b));

        if (isDark) {
            return {
                primary:               sourceHex,
                onPrimary:             onPrimaryColor,
                primaryContainer:      primary[30],
                onPrimaryContainer:    primary[90],

                secondary:             secondary[40],
                onSecondary:           secondary[80],
                secondaryContainer:    secondary[30],
                onSecondaryContainer:  secondary[90],

                tertiary:              tertiary[40],
                onTertiary:            tertiary[80],
                tertiaryContainer:     tertiary[30],
                onTertiaryContainer:   tertiary[90],

                error:                 error[40],
                onError:               error[80],
                errorContainer:        error[30],
                onErrorContainer:      error[90],

                background:            neutral[6],
                onBackground:          neutral[90],
                surface:               neutral[6],
                onSurface:             neutral[90],
                surfaceVariant:        neutralVariant[30],
                onSurfaceVariant:      neutralVariant[80],

                outline:               neutralVariant[60],
                outlineVariant:        neutralVariant[30],

                surfaceContainerLowest:  neutral[4],
                surfaceContainerLow:     neutral[10],
                surfaceContainer:        neutral[12],
                surfaceContainerHigh:    neutral[17],
                surfaceContainerHighest: neutral[22],

                inverseSurface:        neutral[90],
                inverseOnSurface:      neutral[20],
                inversePrimary:        primary[80],

                shadow:                '#000000',
                scrim:                 '#000000',
            };
        }

        // Light scheme
        return {
            primary:               sourceHex,
            onPrimary:             onPrimaryColor,
            primaryContainer:      primary[90],
            onPrimaryContainer:    primary[10],

            secondary:             secondary[40],
            onSecondary:           '#FFFFFF',
            secondaryContainer:    secondary[90],
            onSecondaryContainer:  secondary[10],

            tertiary:              tertiary[40],
            onTertiary:            '#FFFFFF',
            tertiaryContainer:     tertiary[90],
            onTertiaryContainer:   tertiary[10],

            error:                 error[40],
            onError:               '#FFFFFF',
            errorContainer:        error[90],
            onErrorContainer:      error[10],

            background:            neutral[98],
            onBackground:          neutral[10],
            surface:               neutral[98],
            onSurface:             neutral[10],
            surfaceVariant:        neutralVariant[90],
            onSurfaceVariant:      neutralVariant[30],

            outline:               neutralVariant[50],
            outlineVariant:        neutralVariant[80],

            surfaceContainerLowest:  '#FFFFFF',
            surfaceContainerLow:     neutral[96],
            surfaceContainer:        neutral[94],
            surfaceContainerHigh:    neutral[92],
            surfaceContainerHighest: neutral[90],

            inverseSurface:        neutral[20],
            inverseOnSurface:      neutral[95],
            inversePrimary:        primary[80],

            shadow:                '#000000',
            scrim:                 '#000000',
        };
    }

    // ── Theme Application ────────────────────────────────────────────
    //
    // Generates a Material You scheme from the source hex color and
    // applies it as CSS custom properties on :root.
    //
    // CSS variables follow the pattern:
    //   --md-sys-color-primary, --md-sys-color-on-primary, etc.

    var _currentScheme = null;

    function applyTheme(sourceHex, isDark) {
        var scheme = generateScheme(sourceHex, isDark);
        _currentScheme = scheme;
        var root = document.documentElement;

        Object.keys(scheme).forEach(function (key) {
            var cssVar = '--md-sys-color-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
            root.style.setProperty(cssVar, scheme[key]);
        });

        // Backward compatibility
        root.style.setProperty('--primary', scheme.primary);

        return scheme;
    }

    function getScheme() {
        return _currentScheme;
    }

    // ── Public API ───────────────────────────────────────────────────

    root.MaterialColorUtils = {
        hexToRgb:        hexToRgb,
        rgbToHex:        rgbToHex,
        rgbToHsl:        rgbToHsl,
        hslToRgb:        hslToRgb,
        relativeLuminance: relativeLuminance,
        contrastRatio:   contrastRatio,
        generateTonalPalette: generateTonalPalette,
        generateScheme:  generateScheme,
        applyTheme:      applyTheme,
        getScheme:       getScheme,
        TONES:           TONES,
    };

})(window);
