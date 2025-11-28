# Postman Collections for Testing Zetik Casino API

## Collections

1. **zetik-casino.postman_collection.json** - Combined collection for testing authentication, payments, users, and admin endpoints

## How to Use

### Importing the Collection

1. Open Postman
2. Click "Import" in the top left corner
3. Drag and drop the collection file (`postman/zetik-casino.postman_collection.json`) or click "Upload Files" and select it.
4. Click "Import"

### Setting Up Environment Variables

1. Import the provided environment file:
   - `postman/zetik-casino.postman_environment.json`
2. Select the imported environment (`Zetik Casino Local`) in the top-right dropdown.

### Sequence of Requests for Testing Authentication

1. **Register by Email** - Register a new user
   - Uses static credentials for testing:
     - Email: test@example.com
     - Username: testuser
     - Password: TestPassword123
   - Automatically saves tokens to collection variables

2. **Login by Email** - Authenticate an existing user
   - Preconfigured with the same email and password as the register request
   - Saves new tokens to collection variables

3. **Get Profile** - Get current user profile
   - Uses JWT token from the `accessToken` variable
   - Returns only ID and username

4. **Refresh Token** - Refresh authentication tokens
   - Uses refresh_token from the `refreshToken` variable
   - Saves new tokens to collection variables

5. **Logout** - Sign out of the system
   - Clears access_token and refresh_token cookies

## Testing Workflow

1. Run the **Register by Email** request first (only needed once)
2. Then you can test **Login by Email** using the same credentials
3. Use **Get Profile** to verify authentication is working
4. Test token refresh with **Refresh Token**
5. Finally, test **Logout** to clear authentication

## Cookie Authentication Features

This API uses two authentication methods:

1. **JWT tokens in response body** - for client applications
2. **HttpOnly cookies** - for secure authentication in web applications

The collection tests both methods:

- Saves JWT tokens from response body to variables
- Checks for presence and validity of cookies in tests after requests

### Sequence of Requests for Admin Endpoints

1. **Setup Password** - Set initial password for `superadmin`
2. **Login** - Authenticate as `superadmin`, saves `accessToken` & `refreshToken` to environment
3. **Refresh Tokens** - Use `refreshToken` to get new tokens
4. **Protected** - Call protected admin route with `Authorization: Bearer {{accessToken}}`

## Balance Management

The Balance section provides endpoints for managing user wallets and viewing balance-related operations:

### Primary Wallet Management

**Switch Primary Wallet** - `PATCH /v1/balance/primary`

- Sets the specified asset as the user's primary wallet
- Creates a new wallet with zero balance if it doesn't exist for the asset
- Ensures only one wallet per user is marked as primary
- Uses the `assetType` collection variable (default: BTC)
- Returns array of all user wallets with updated `isPrimary` flags

**Request Body:**

```json
{
  "asset": "BTC"
}
```

**Response:**

```json
[
  {
    "userId": "user-id",
    "asset": "BTC",
    "balance": "0.12345678",
    "isPrimary": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  },
  {
    "userId": "user-id",
    "asset": "ETH",
    "balance": "1.5",
    "isPrimary": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Balance History

**Get Balance History** - `GET /v1/balance/history`

- Retrieves paginated list of balance operations (deposits, withdrawals, bets, wins, etc.)
- Filter by asset type, operation type
- Supports pagination with `limit` and `offset` parameters

### Balance Statistics

**Get Balance Statistics** - `GET /v1/balance/statistics`

- Aggregated statistics by asset: total deposits, withdrawals, bets, wins, net profit
- Filter by specific asset or retrieve all assets
- Useful for analytics dashboards and user portfolio overview

## Variables Used

- `baseUrl` - API base URL (default: http://localhost:3000)
- `accessToken` - JWT access token for authentication
- `assetType` - Asset type for balance operations (default: BTC)
- `adminAccessToken` - Admin JWT token for admin endpoints
