# PaperNote for iPad

The iPad target reuses the existing note editor in a Capacitor iOS app. Notes and settings stay on the iPad in its app storage. Import a `.papernote` backup from Files to move notes from Windows; PDF, PNG, and backup exports use the iPad share sheet.

Google Drive sign-in is not connected in the iPad build yet. The Windows OAuth client is not used on iOS.

## Build an unsigned IPA with Codemagic

1. Push this project to a private Git repository and add it to Codemagic.
2. Run the `papernote-ipad` workflow from `codemagic.yaml` and download `PaperNote-unsigned.ipa` from the build artifacts.

The workflow builds with Capacitor 8 and Xcode without Apple signing credentials. Install the unsigned IPA with your existing sideload method. After changing the web app, Codemagic refreshes the generated iOS assets automatically before building.
