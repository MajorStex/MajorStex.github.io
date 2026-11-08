# Noćna Straža / Night Watch — Rights and Security
Copyright © 2026 Noćna Straža. All rights reserved.

No permission to copy, commercially distribute, resell, or publish modified versions of the original game source, designs, and artwork is granted by this repository. Obtain written permission from the rights holder before any such use.

## Actual technical limitations

The complete HTML/JavaScript bundle runs on the player's device. Its bytes can be extracted by anyone with developer tools. Obfuscation, domain locks, and client-side "license verification" are not strong copy protection, and can break offline or APK support.

## V107 hardening

- Only the authoritative host may approve rewards, market purchases, timed selection ownership, rejoin identity, and kicking players.
- Clients have durable locally held 192-bit random identities. They are not present in invitation links, only the room code is shared.
- Repeated input flooding and unauthenticated game command packets are filtered on the host connection.
- Disconnected lobby seats are held for up to 60 seconds, and reconnecting players reuse their existing slot.
- Marketplace and reward selections expire automatically to prevent any one player from stalling the match.
- Saved friends, friend IDs and progress remain local or in user-controlled cloud sync. Clearing browser storage without synchronized account recovery can erase them.

## Stronger protection for a commercial release

Secure payment entitlements and scarce currencies in a server-controlled, authenticated database; verify purchases through a payment provider's server-to-server event and issue short-lived signed sessions. Protect the relay with verified account identity, origin allowlists, IP/device rate limits, message size limits and abuse monitoring. Move competitive leaderboard score validation and value-bearing game logic away from the player's browser. Avoid embedding secrets in public JavaScript.

These are defensive design notes. They are not a claim that HTML source cannot be copied.
