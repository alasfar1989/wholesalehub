# WholesaleHub

B2B Wholesale Electronics Marketplace - Mobile app for iOS & Android.

Connects wholesale electronics traders with WTS (Want to Sell) and WTB (Want to Buy) listings, in-app messaging, reputation scoring, and an admin dashboard.

## Tech Stack

- **Frontend:** React Native (Expo)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Auth:** JWT (JSON Web Tokens)
- **Target:** iOS + Android app stores

## Features

- Phone-based signup/login with JWT auth
- WTS/WTB listings with search & filters (keyword, city, category, type)
- Featured listings (3 WTS + 3 WTB, admin-managed)
- User profiles with business info, ratings, and references
- 1-5 star rating system with comments
- Manual references (name + phone)
- In-app messaging between traders
- Admin dashboard (stats, user management, featured listings)

## Project Structure

```
wholesalehub/
├── backend/
│   ├── src/
│   │   ├── config/database.js      # PostgreSQL connection pool
│   │   ├── middleware/auth.js       # JWT auth + admin middleware
│   │   ├── middleware/validate.js   # Request validation
│   │   ├── routes/auth.js           # Signup & login
│   │   ├── routes/users.js          # User profiles
│   │   ├── routes/listings.js       # CRUD + search for listings
│   │   ├── routes/references.js     # User references
│   │   ├── routes/ratings.js        # Star ratings
│   │   ├── routes/messages.js       # In-app chat
│   │   ├── routes/admin.js          # Admin dashboard & management
│   │   └── index.js                 # Express app entry point
│   ├── migrations/
│   │   ├── run.js                   # Database schema migration
│   │   └── seed.js                  # Sample data seeder
│   └── package.json
├── mobile/
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── context/AuthContext.js    # Auth state management
│   │   ├── navigation/              # React Navigation setup
│   │   ├── screens/                 # All app screens
│   │   ├── services/api.js          # API client
│   │   └── utils/theme.js           # Colors, fonts, spacing
│   ├── App.js                       # App entry point
│   ├── app.json                     # Expo configuration
│   ├── eas.json                     # EAS Build configuration
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Environment Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (for builds): `npm install -g eas-cli`

### 1. Clone & Install

```bash
git clone https://github.com/alasfar1989/wholesalehub.git
cd wholesalehub

# Backend
cd backend
npm install
cp .env.example .env   # Edit .env with your values

# Mobile
cd ../mobile
npm install
```

### 2. Configure Environment

Copy `.env.example` to `backend/.env` and update:

```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/wholesalehub
JWT_SECRET=your-random-secret-key-here
JWT_EXPIRES_IN=30d
ADMIN_PHONE=+your-phone-number
```

### 3. Database Setup

```bash
# Create the database
createdb wholesalehub

# Run migrations (creates all tables + indexes)
cd backend
npm run migrate

# (Optional) Seed sample data
npm run seed
```

### 4. Start Backend

```bash
cd backend
npm run dev    # Development with auto-reload
# or
npm start      # Production
```

API runs at `http://localhost:3000`. Test with:
```bash
curl http://localhost:3000/health
```

### 5. Start Mobile App

```bash
cd mobile
npx expo start
```

- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app for physical device

**Important:** Update the API URL in `mobile/app.json` > `extra.apiUrl` to point to your backend.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /auth/signup | No | Create account |
| POST | /auth/login | No | Login |
| GET | /users/me | Yes | Get current user |
| PUT | /users/me | Yes | Update profile |
| GET | /users/:id | No | Get user profile |
| GET | /listings | No | List all (paginated) |
| GET | /listings/featured | No | Featured listings |
| GET | /listings/search | No | Search with filters |
| GET | /listings/mine | Yes | My listings |
| GET | /listings/:id | No | Listing detail |
| POST | /listings | Yes | Create listing |
| PUT | /listings/:id | Yes | Update listing |
| DELETE | /listings/:id | Yes | Delete listing |
| GET | /references/:userId | No | User references |
| POST | /references/:userId | Yes | Add reference |
| DELETE | /references/:id | Yes | Delete reference |
| GET | /ratings/:userId | No | User ratings |
| POST | /ratings | Yes | Rate a user |
| GET | /messages/conversations | Yes | List conversations |
| GET | /messages/:userId | Yes | Get messages |
| POST | /messages | Yes | Send message |
| GET | /admin/dashboard | Admin | Dashboard stats |
| GET | /admin/users | Admin | All users |
| PUT | /admin/users/:id/suspend | Admin | Toggle suspend |
| GET | /admin/listings | Admin | All listings |
| PUT | /admin/listings/:id/feature | Admin | Toggle featured |
| DELETE | /admin/listings/:id | Admin | Delete listing |

## Building for App Stores

### iOS

```bash
cd mobile

# Configure EAS
eas login
eas build:configure

# Build for App Store
eas build -p ios --profile production

# Submit to App Store
eas submit -p ios
```

### Android

```bash
cd mobile

# Build APK for testing
eas build -p android --profile preview

# Build AAB for Play Store
eas build -p android --profile production

# Submit to Play Store
eas submit -p android
```

### Before Submitting

1. Update `app.json` with final app name, icons, and splash screen
2. Replace placeholder images in `mobile/assets/`
3. Update `eas.json` with your Apple/Google credentials
4. Set production API URL in `app.json` > `extra.apiUrl`
5. Test thoroughly on both platforms

## App Store Submission Checklist

### iOS (Apple App Store)
- [ ] Apple Developer Account ($99/year)
- [ ] App icons (1024x1024)
- [ ] Screenshots for required device sizes
- [ ] Privacy policy URL
- [ ] App description & keywords
- [ ] Age rating questionnaire
- [ ] Export compliance info

### Android (Google Play Store)
- [ ] Google Play Developer Account ($25 one-time)
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots for phone and tablet
- [ ] Privacy policy URL
- [ ] Content rating questionnaire
- [ ] Target audience declaration

## Deployment (Conway Cloud)

### Backend

1. Create a sandbox on Conway
2. Set environment variables (DATABASE_URL, JWT_SECRET, etc.)
3. Deploy the `backend/` directory
4. Run migrations: `npm run migrate`
5. Note the public URL for the mobile app

### Database

Use a managed PostgreSQL service (e.g., Neon, Supabase, Railway) or provision one in Conway.

## Admin Access

The phone number set in `ADMIN_PHONE` env var gets admin privileges on signup. The admin can:
- View dashboard with platform stats
- Manage featured listings (max 3 WTS + 3 WTB)
- Suspend/unsuspend users
- View and delete any listing

## Security

- Passwords hashed with bcrypt (12 rounds)
- JWT-based authentication
- Helmet.js security headers
- Rate limiting on auth endpoints
- Input validation on all endpoints
- SQL injection protection via parameterized queries
- CORS enabled
