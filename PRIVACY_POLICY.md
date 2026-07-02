# Privacy Policy for YouTube Kids Flashcards

**Last updated:** July 1, 2026

## Overview

YouTube Kids Flashcards is a Chrome extension that interrupts YouTube Kids videos with educational flashcard-style questions. This extension is designed to make screen time more educational for children.

## Data Collection

### What we collect
- **Answer history**: The extension stores a local log of questions answered (correct/incorrect) to display recent stats in the popup. This data is stored entirely on your device using Chrome's local storage API.

### What we do NOT collect
- No personal information (name, email, age, etc.)
- No browsing history
- No data is sent to external servers
- No analytics or tracking
- No cookies
- No account creation required

## Data Storage

All data is stored locally on your device using `chrome.storage.local`. This data never leaves your browser and is not accessible to the extension developer or any third party.

## Data Sharing

We do not share, sell, or transmit any user data to any third party. Period.

## Permissions Explained

| Permission | Why it's needed |
|---|---|
| `activeTab` | To detect when a YouTube Kids video is playing |
| `scripting` | To inject the flashcard overlay into the page |
| `storage` | To save your settings and answer history locally |
| `host_permissions` (youtubekids.com, youtube.com) | To run on YouTube Kids pages where videos play |

## Children's Privacy

This extension is designed for use by children under parental supervision. We do not knowingly collect any personal information from children or any users. All functionality operates entirely offline and locally.

## Changes to This Policy

If we update this privacy policy, changes will be posted to this page with an updated date.

## Contact

If you have questions about this privacy policy, please open an issue on this repository or contact the developer through GitHub.

**Developer:** [JoeyKenobi](https://github.com/JoeyKenobi)
