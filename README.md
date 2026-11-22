# RE:CLASS

RE:CLASS is a Vietnamese marketplace for school supplies. Firebase Authentication handles email verification and passwords. The Node server uses Firestore for profiles, listings and their tags, saved listings, trades, chat, and moderation. Cloud Storage holds re-encoded photos. Firestore listeners notify the website about marketplace and chat changes through same-origin server-sent events.

Registration requires a full name, date of birth, phone number, student number, and ID photo, along with an email, password, school, and display name. The display name and school can appear on the marketplace. Access to the other registration details is restricted to authorized cloud services and administrators through `privateAccounts` and the `identity/` bucket prefix. An email confirmation establishes the login, and the existing one-time school invite verifies student status for posting and trading.

## Local development

Install Node.js 24, the Firebase CLI, and the Java version required by that CLI. Use test identities and synthetic photos in the emulators.

```powershell
npm.cmd ci
firebase emulators:start --project demo-reclass --only auth,firestore,storage
```

In another terminal, run `npm.cmd run dev` and open [http://127.0.0.1:4173](http://127.0.0.1:4173). The Auth emulator prints the email verification links in its terminal. Use `RECLASS_PORT` if the default port is occupied. For a local moderator, supply a random `MODERATOR_CODE` of at least 32 characters before starting the server, then claim the role from **Tài khoản → Quyền kiểm duyệt**. The same server can connect to a dedicated Firebase development project using `.env` and Google Application Default Credentials.

With the emulators running, `npm.cmd test` checks registration, private data, browser cookie attributes, role enforcement, concurrent trades, and live updates across sessions. `npm.cmd run build` packages the Sites Worker.

## Firebase and hosting

1. Sign in to the [Firebase console](https://console.firebase.google.com/) with the Gmail account that will own the project. In a dedicated project, enable Firebase Authentication with the email/password provider, create a Firestore database in Native mode, and provision a Cloud Storage bucket. Add the website's hostname to the Auth authorized domains. Use the web API key from Project Settings. The project needs a billing configuration that supports Cloud Storage and Cloud Run. [Cloud Storage billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) · [Cloud Run source deployment](https://docs.cloud.google.com/run/docs/quickstarts/build-and-deploy/deploy-nodejs-service)
2. Disable client-side account creation using the Identity Platform project setting `client.permissions.disabledUserSignup`. RE:CLASS creates users through the Admin SDK after validating the full application form. Enable email enumeration protection and configure the Auth password policy to match the app's 12-character minimum. [Identity Platform project settings](https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config)
3. Deploy the checked-in rules and indexes with `firebase deploy --project PROJECT_ID --only firestore:rules,firestore:indexes,storage`. The rules deny all direct client access. Turn on uniform bucket-level access and public access prevention for the bucket, and give the runtime service account object access scoped to this bucket. [Uniform bucket-level access](https://docs.cloud.google.com/storage/docs/using-uniform-bucket-level-access) · [Public access prevention](https://docs.cloud.google.com/storage/docs/using-public-access-prevention)
4. Deploy the Node app with `npm start` on Cloud Run or an equivalent HTTPS Node host. Set the environment variables in `.env.example`. Give the runtime service account Firestore write access, Firebase Auth user management, and Storage object access. Use platform-managed credentials and a secret store for runtime secrets. Configure the host to forward event streams without buffering and to permit requests of at least 60 seconds. [Firebase Admin credentials](https://firebase.google.com/docs/admin/setup)
5. To keep the existing ChatGPT Sites address and audience, set `RECLASS_ORIGINS` on the Node server to the exact Sites HTTPS origin. Configure `RECLASS_BACKEND_URL` on the Sites Worker with the Node service's HTTPS origin, and set the same random `RECLASS_PROXY_SECRET` of at least 32 characters in both runtimes. That secret gates access at the Node server, including on its direct URL. Publish the Worker output from `npm run build` after the backend is ready. For a standalone deployment, use the Node service's public HTTPS origin and leave `RECLASS_PROXY_SECRET` unset.

The server sets a seven-day, revocable HttpOnly cookie. Each device gets its own session when it signs in to the same email account. Signing out clears that session. Firebase user IDs link the account, shop, trades, and saved listings across devices. The Firebase-backed server starts with an empty project plus labeled sample listings. Existing Sites D1/R2 records and ChatGPT identities require a separate data export and explicit account mapping before they can be carried over.
