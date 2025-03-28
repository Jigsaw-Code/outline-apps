/*
 * Copyright 2025 The Outline Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Settings, SettingsKey, ThemePreference} from './settings';

export class ThemeManager {
  private mediaQueryList: MediaQueryList | null = null;

  constructor(
    private settings: Settings,
    private document = window.document,
    private darkModeEnabled = true
  ) {
    // Initialize theme immediately during construction
    this.initializeTheme();

    // Only setup system theme listener if dark mode is enabled
    if (this.darkModeEnabled) {
      this.setupSystemThemeListener();
    }

    // Apply theme once the DOM is fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.applyTheme(this.getThemePreference());
      });
    }
  }

  public getThemePreference(): ThemePreference {
    // If dark mode is disabled, always return LIGHT
    if (!this.darkModeEnabled) {
      return ThemePreference.LIGHT;
    }

    const savedTheme = this.settings.get(SettingsKey.THEME_PREFERENCE);
    return (savedTheme as ThemePreference) || ThemePreference.SYSTEM;
  }

  public setThemePreference(theme: ThemePreference): void {
    // Only save theme preference if dark mode is enabled
    if (this.darkModeEnabled) {
      this.settings.set(SettingsKey.THEME_PREFERENCE, theme);
      this.applyTheme(theme);
    }
  }

  private initializeTheme(): void {
    const themePreference = this.getThemePreference();
    this.applyTheme(themePreference);
  }

  private setupSystemThemeListener(): void {
    // Setup listener for system theme changes
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    // Initial check in case the theme is set to SYSTEM
    if (this.getThemePreference() === ThemePreference.SYSTEM) {
      this.applySystemTheme(this.mediaQueryList);
    }

    // Add listener for changes to system theme
    const handleChange = (e: MediaQueryListEvent) => {
      if (this.getThemePreference() === ThemePreference.SYSTEM) {
        this.applySystemTheme(e);
      }
    };

    // Use the appropriate event listener method based on browser support
    if (this.mediaQueryList.addEventListener) {
      this.mediaQueryList.addEventListener('change', handleChange);
    } else if (this.mediaQueryList.addListener) {
      // For older browsers
      this.mediaQueryList.addListener(handleChange);
    }
  }

  private applyTheme(theme: ThemePreference): void {
    console.log('Applying theme:', theme);

    // Remove all theme classes first
    this.document.documentElement.classList.remove(
      'light-theme',
      'dark-theme',
      'system-theme'
    );

    // Force immediate CSS variable update
    this.document.body.style.setProperty('--force-refresh', '1');

    switch (theme) {
      case ThemePreference.LIGHT:
        this.document.documentElement.classList.add('light-theme');
        // Ensure light theme variables are explicitly set
        this.document.documentElement.style.setProperty(
          '--outline-card-background',
          'var(--outline-white)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-card-footer',
          'var(--outline-light-gray)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-text-color',
          'var(--outline-black)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-label-color',
          'var(--outline-medium-gray)'
        );
        // Set input field colors for light mode
        this.document.documentElement.style.setProperty(
          '--outline-input-bg',
          'var(--outline-white)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-input-text',
          'var(--outline-black)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-input-border',
          'var(--outline-medium-gray)'
        );
        break;

      case ThemePreference.DARK:
        this.document.documentElement.classList.add('dark-theme');
        // Ensure dark theme variables are explicitly set using the new dark gray colors
        this.document.documentElement.style.setProperty(
          '--outline-card-background',
          'var(--outline-dark-card)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-card-footer',
          'var(--outline-dark-footer)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-text-color',
          'var(--outline-white)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-label-color',
          'hsl(0, 0%, 70%)'
        );
        // Set input field colors for dark mode
        this.document.documentElement.style.setProperty(
          '--outline-input-bg',
          'var(--outline-dark-bg)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-input-text',
          'var(--outline-white)'
        );
        this.document.documentElement.style.setProperty(
          '--outline-input-border',
          'var(--outline-dark-border)'
        );
        break;

      case ThemePreference.SYSTEM:
      default:
        this.document.documentElement.classList.add('system-theme');
        // Apply the current system theme
        if (this.mediaQueryList) {
          this.applySystemTheme(this.mediaQueryList);
        }
        break;
    }

    // Force repaint to ensure theme is applied immediately
    const bodyEl = this.document.body;
    const originalDisplay = bodyEl.style.display;
    bodyEl.style.display = 'none';
    // Force reflow
    void bodyEl.offsetHeight;
    bodyEl.style.display = originalDisplay;

    console.log(
      'Theme applied:',
      theme,
      'Classes:',
      this.document.documentElement.className
    );
  }

  private applySystemTheme(
    mediaQueryList: MediaQueryList | MediaQueryListEvent
  ): void {
    const isDarkMode = mediaQueryList.matches;
    console.log('System prefers dark mode:', isDarkMode);

    // Leave the system-theme class, but apply the appropriate theme class based on system preference
    if (isDarkMode) {
      this.document.documentElement.classList.add('dark-theme');
      this.document.documentElement.classList.remove('light-theme');

      // Apply dark theme variables directly using the new dark gray colors
      this.document.documentElement.style.setProperty(
        '--outline-card-background',
        'var(--outline-dark-card)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-card-footer',
        'var(--outline-dark-footer)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-text-color',
        'var(--outline-white)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-label-color',
        'hsl(0, 0%, 70%)'
      );
      // Set input field colors for dark mode
      this.document.documentElement.style.setProperty(
        '--outline-input-bg',
        'var(--outline-dark-bg)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-input-text',
        'var(--outline-white)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-input-border',
        'var(--outline-dark-border)'
      );
    } else {
      this.document.documentElement.classList.add('light-theme');
      this.document.documentElement.classList.remove('dark-theme');

      // Apply light theme variables directly
      this.document.documentElement.style.setProperty(
        '--outline-card-background',
        'var(--outline-white)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-card-footer',
        'var(--outline-light-gray)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-text-color',
        'var(--outline-black)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-label-color',
        'var(--outline-medium-gray)'
      );
      // Set input field colors for light mode
      this.document.documentElement.style.setProperty(
        '--outline-input-bg',
        'var(--outline-white)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-input-text',
        'var(--outline-black)'
      );
      this.document.documentElement.style.setProperty(
        '--outline-input-border',
        'var(--outline-medium-gray)'
      );
    }

    console.log(
      'System theme applied. Classes:',
      this.document.documentElement.className
    );
  }
}
