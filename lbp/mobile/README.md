# LetsBeParents mobile

React Native application using Expo SDK 57. Use a Node.js version supported by that SDK, install the locked dependencies with `npm ci`, and run `npm run typecheck` before building.

## Configuration

Copy `.env.example` to a private `.env` file. Never publish actual environment files or signing credentials. The API base is an HTTPS origin without a path. An optional trailing `/api` is normalized; individual API calls already include `/api`.

Development, preview and production build profiles currently all target the test environment at `https://test.letsbeparents.com`. The production profile name does not mean that the production website API has been configured. Change this explicitly only after confirming the destination API contract.

Google and Apple sign-in require the client configuration and OAuth identifiers for Firebase project `parents-698f8`. Empty client configuration disables social sign-in; email authentication remains available. Firebase ID tokens are exchanged through `/api/auth/firebase` for a backend `sessionToken`. Email login and signup also return this token. It is persisted in SecureStore and sent as Bearer authentication; only an expired or rejected session is cleared during startup, not a temporary connection failure.

## Builds

Use an EAS development build for native testing, then a preview build for device acceptance. WebRTC calling requires native modules and cannot be validated in Expo Go. The supplied welcome video uses the SDK-compatible `expo-video` module.

API environment values are embedded at build time. Updating this repository or the website does not update an installed APK or iOS application. A new native build is required after dependency changes or to replace an application compiled with a wrong API address.

## Shared features

Family Room provides shared notes, checklists and private documents for active matched profiles with Premium access. Private documents are downloaded from the API using the session token and opened through the system share interface. Temporary cache files are removed when the interface closes.

Compatibility answers and reports use `/api/member/compatibility/questions`, `/api/member/compatibility/answers` and `/api/member/compatibility-report/{profileId}`. Priority Support and these Premium features currently use the backend's shared Premium entitlement; a separate Family Builder Pro billing entitlement is not implemented.

Before distributing a build, verify email signup/login, configured social sign-in, session restoration and logout, file opening, notifications, microphone/camera permissions, and voice/video calls on real devices. Type checking is not a substitute for native device acceptance.
