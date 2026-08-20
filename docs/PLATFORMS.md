# Supported Platforms

## Web

Primary browser-based wallet interface.

Planned technology:

- Next.js
- React
- TypeScript

## Mobile

Platforms:

- iOS
- Android

Planned technology:

- React Native
- TypeScript

## Desktop

Platforms:

- Windows
- macOS
- Linux

Planned technology:

- Electron
- TypeScript

## Browser Extension

Supported browser-extension architecture.

Initial focus:

- Chrome-compatible browsers

Future:

- Firefox
- Other Chromium-based browsers

## Shared Code

The following functionality should be shared whenever possible:

- Wallet domain models
- Chain abstractions
- Cryptographic interfaces
- Validation
- Serialization
- Shared types
- UI primitives where appropriate

Platform-specific security storage must remain platform-specific.