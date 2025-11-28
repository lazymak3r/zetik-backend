# Promocodes System - Usage Guide

## Overview

The promocodes system allows users to activate promocodes to receive bonuses on their balance. The system includes:

- **Backend API** for promocode activation
- **Frontend interface** for promocode input
- **Admin panel** for creating and managing promocodes
- **Eligibility checking system** (compliance with requirements)
- **Rate limiting** for protection against abuse

## Architecture

### Backend Components

1. **PromocodesController** (`/promocodes/redeem`) - API endpoint for activation
2. **PromocodesService** - main business logic
3. **PromocodeEligibilityService** - eligibility requirements checking
4. **PromocodesSchedulerService** - automatic promocode expiration

### Frontend Components

1. **RedeemCodeModal** - modal window for promocode input
2. **Promocodes API** - client for backend interaction
3. **Redux store** - promocodes state management

## Usage

### For Users

1. **Opening the modal window:**
   - Log into the system
   - Click on the avatar in the top right corner
   - Select "Redeem Code"

2. **Activating a promocode:**
   - Enter the promocode in the field
   - Click "Redeem"
   - Receive a success or error notification

### For Administrators

1. **Creating a promocode through the admin panel:**
   - Log into the admin panel
   - Navigate to the "Promocodes" section
   - Click "Create Promocode"
   - Fill out the form:
     - **Code**: unique promocode
     - **Value per claim**: amount per single use
     - **Total claims**: total number of uses
     - **Currency**: currency (BTC, ETH, USDT, etc.)
     - **Starts at**: start date
     - **Ends at**: end date
     - **Eligibility rules**: compliance rules

2. **Managing promocodes:**
   - View list of all promocodes
   - Edit active promocodes
   - View activation history
   - Suspend/resume promocodes

## API Endpoints

### POST /promocodes/redeem

Promocode activation by user.

**Headers:**

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request body:**

```json
{
  "code": "WELCOME2024"
}
```

**Success response (200):**

```json
{
  "success": true,
  "message": "Promocode activated successfully!",
  "amount": "0.001",
  "currency": "BTC"
}
```

**Errors:**

- `400` - Invalid promocode or user doesn't meet requirements
- `401` - Unauthorized
- `404` - Promocode not found
- `429` - Too many requests

## Eligibility Rules

The system supports various rules for determining user eligibility for promocodes:

- **onePerUser**: only one use per user
- **onePerIp**: only one use per IP address
- **minVipLevel**: minimum VIP level
- **kycRequired**: verification required
- **minAccountAge**: minimum account age
- **allowedCountries**: allowed countries
- **blockedCountries**: blocked countries

## Security

1. **Rate Limiting**: maximum 5 attempts per minute from one IP
2. **Device Fingerprinting**: device tracking
3. **IP Tracking**: IP address control
4. **Audit Logging**: complete logging of all operations
5. **Transaction Safety**: database transaction usage

## Monitoring

### Logs

The system maintains detailed logs:

- Promocode creation
- Promocode activation
- Errors and exceptions
- Automatic expiration

### Metrics

The following metrics are tracked:

- Number of activations
- Successful/unsuccessful attempts
- Popular promocodes
- Geographic distribution

## Testing

### Running Tests

```bash
# Backend tests
cd apps/backend
npm run test

# Frontend tests
cd ../../frontend
npm run test
```

### Test Script

```bash
# Running simple API test
node test-promocode-api.js
```

## Troubleshooting

### Common Issues

1. **"Promocode not found"**
   - Check the spelling of the code
   - Make sure the promocode is active

2. **"User not eligible"**
   - Check eligibility rules
   - Make sure the user meets the requirements

3. **"Too many requests"**
   - Wait a minute before the next attempt
   - Check if VPN is being used

4. **"Promocode has expired"**
   - Promocode has expired by time
   - All uses have been exhausted

### Debug Logs

```bash
# View backend logs
tail -f logs/backend.log | grep promocode

# View frontend logs
tail -f logs/frontend.log | grep promocode
```

## Development

### Adding New Eligibility Rules

1. Update `EligibilityRulesDto` in backend
2. Add logic to `PromocodeEligibilityService`
3. Update frontend promocode creation form
4. Add tests

### Extending Functionality

1. **Notifications**: integration with notification system
2. **Analytics**: detailed usage analytics
3. **A/B Testing**: testing different promocodes
4. **Personalization**: promocodes based on user behavior

## Contacts

If you encounter any issues, contact the development team or create an issue in the repository.
