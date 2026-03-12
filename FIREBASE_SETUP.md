# Firebase Setup Instructions

Your app is showing "client is offline" errors because **Firestore security rules need to be configured**.

## Step 1: Configure Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **employee-ms-3e835**
3. Navigate to **Firestore Database** → **Rules**
4. Replace the existing rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read all documents
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

5. Click **Publish**

## Step 2: Enable Google Sign-In (Optional)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **employee-ms-3e835**
3. Navigate to **Authentication** → **Sign-in method**
4. Click on **Google**
5. Toggle **Enable**
6. Select a support email (your email)
7. Click **Save**

## Step 3: Add Authorized Domains

1. In **Authentication** → **Settings** → **Authorized domains**
2. Make sure `localhost` is in the list (it should be by default)

## Step 4: Fix Existing User (if needed)

If you already created a user with email/password and it's not working:

1. Go to **Firestore Database** → **Data**
2. Find the `users` collection
3. Find your user document
4. Update/add these fields:
   - `isActive`: `true` (boolean, not string)
   - `displayName`: Your name (string)
   - `role`: `owner` (string)

OR simply delete the user and sign up again:

1. Go to **Authentication** → **Users**
2. Delete your user
3. Sign up again on the app

## Troubleshooting

### "Failed to get document because the client is offline"
This error means Firestore rules are blocking access. Follow Step 1 above.

### "Cross-Origin-Opener-Policy policy would block the window.closed call"
This is a known warning in development and usually doesn't block functionality.

### Google Sign-In popup not working
Make sure you've enabled Google sign-in provider in Firebase Console (Step 2).

### Account deactivated error
Your user document has `isActive: false`. Update it in Firestore or delete and recreate the user.
