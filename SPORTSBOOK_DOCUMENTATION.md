# Sportsbook Module Documentation

## Overview

The Sportsbook module provides integration with Betby, a third-party sports betting platform. This module handles all sports betting operations including bet placement, settlement, refunds, and player management through a secure JWT-based API.

## Architecture

### Core Components

- **SportsbookModule**: Main module that orchestrates all sportsbook functionality
- **BetbyController**: REST API controller handling all Betby webhook endpoints
- **BetbyService**: Core business logic for bet operations and player management
- **BetbyJwtService**: JWT token generation and validation for secure communication
- **BetbyExternalApiService**: External API communication with Betby services
- **BetbyJwtInterceptor**: Request interceptor for JWT validation

### Database Schema

The module uses the `SportsbookBetEntity` to store bet information in the `games.sportsbook_bets` table with the following key fields:

- **User Management**: Links to `UserEntity` via `userId`
- **Bet Details**: Amount, odds, potential winnings, currency
- **Status Tracking**: Current bet status (pending, active, won, lost, etc.)
- **Selection Data**: JSONB field storing detailed bet selections
- **Bonus Integration**: Support for various bonus types and comboboost multipliers

## API Endpoints

### Authentication & Health

#### `GET /sportsbook/betby/ping`

Health check endpoint that returns current timestamp for Betby availability verification.

#### `POST /sportsbook/betby/token/generate`

Generates JWT token for authenticated users to access Betby platform. Requires user authentication and accepts optional language parameter.

### Bet Operations

#### `POST /sportsbook/betby/bet/make`

Creates a new bet for a player. Validates user existence, balance sufficiency, and bet details. Deducts bet amount from player balance and creates bet record in database with PENDING status.

#### `POST /sportsbook/betby/bet/commit`

Commits a previously made bet (optional operation). Accepts transaction ID to finalize a bet that was previously created.

#### `POST /sportsbook/betby/bet/settlement`

Settles a bet with final results. Updates bet status based on event outcomes and processes winnings or losses accordingly.

#### `POST /sportsbook/betby/bet/win`

Processes a winning bet. Adds winnings to player balance and updates bet status to WON. Handles cashout scenarios and bonus-related winnings.

#### `POST /sportsbook/betby/bet/lost`

Processes a losing bet. Updates bet status to LOST and records the loss in the database without affecting player balance.

#### `POST /sportsbook/betby/bet/refund`

Processes a bet refund. Returns the original bet amount to player balance and updates bet status to REFUND.

#### `POST /sportsbook/betby/bet/rollback`

Rolls back a bet transaction. Reverses the bet operation and restores the original player balance.

#### `POST /sportsbook/betby/bet/discard`

Discards a bet. Removes the bet from active status and marks it as discarded.

### Player Management

#### `PUT /sportsbook/betby/player/segment`

Updates player segment information. Allows modification of player's segment classification for personalized betting experiences.

## Automated QA Backend Tests

This section describes how to run backend tests locally for Betby QA integration testing.

### Prerequisites

1. **Install Docker**
   - Follow the official guide: [Install Docker Engine](https://docs.docker.com/engine/install/)

2. **Log in to the registry**
   ```bash
   docker login -u prod-reader -p "6c[Gw|ux(cCAG(0t" registry-ext-38dnwdhjh32.sptpub-infra.com
   ```

### Running the QA Portal

1. **Start the QA portal container**

   ```bash
   docker run --pull always -p 3000:3000 registry-ext-38dnwdhjh32.sptpub-infra.com/bb-production/oi:latest
   ```

2. **Access the portal**
   - Navigate to http://localhost:3000 or http://127.0.0.1:3000
   - Fill in all required fields to configure and run tests

### Test Configuration

**Important Notes:**

- All bets made during local tests won't appear in Betby's back office or be reflected in reports
- This application simulates Betby's backend behavior for testing purposes only
- Recommended minimum bet amount is 0.1 USD (or equivalent)

**Required Configuration Fields:**

- **Brand ID**: Unique Partner's website ID assigned by Betby during onboarding
- **Operator ID**: Unique Partner's ID assigned by Betby during onboarding
- **API URL**: Partner's endpoint where requests will be sent
- **Player ID (Betby)**: User's ID assigned by Betby
- **External Player ID (Operator)**: User's ID assigned by Partner
- **User Session ID (Token JTI)**: Authorization token ID
- **Currency**: User's currency
- **Min Bet Amount**: Preferred bet amount; balance should be at least 10× this value
- **Is Bet Commit**: Set to true if the partner implemented the bet/commit method
- **Private Key**: RSA256 private key used to encode requests

### Key Generation

Generate a pair of RSA256 keys:

- Paste the private key in the "Private key" field (used to encode requests)
- Use the public key to verify requests

### Running Tests

1. Click **Run** to start the tests
2. The process may take several minutes to complete
3. Once finished, click **Output: Download Results** to download the test report

### Localhost Testing

To run tests against a localhost instance:

1. Use your host IP address as the URL in the portal
2. Example: If your host URL is `http://localhost:8080` and your IP is `192.168.0.3`, set the portal URL to `http://192.168.0.3:8080/`
3. **Important**: The trailing slash `/` is required

## Future Enhancements

Potential areas for future development:

1. **Advanced Bonus System**: Enhanced bonus management and tracking
2. **Live Betting**: Real-time odds updates and live bet management
3. **Risk Management**: Advanced risk assessment and limits
4. **Analytics**: Detailed betting analytics and reporting
5. **Multi-Currency**: Enhanced multi-currency support
6. **Mobile API**: Optimized mobile-specific endpoints
