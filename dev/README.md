# Development Environment

This directory contains auxiliary files for running the project in different environments:

- **Stage environment**: Configuration files for staging deployment
- **Test environment**: Setup for testing and QA purposes

## Contents

- `docker-compose.yml`: Docker Compose configuration for running the entire application stack locally
  - PostgreSQL database
  - API service
  - Metabase for database analytics

## Usage

To start all services:

```bash
cd dev
docker-compose down
docker-compose up -d --build
```

Or run if you want to remove all the data from postgres and/or metabase

```bash
docker-compose down -v
```

## Service Access

- **API**: http://localhost:3100
- **Metabase**: http://localhost:3105
- **PostgreSQL**: localhost:5432 (default credentials in .env file)

## Environment Variables

The Docker Compose setup uses environment variables with sensible defaults:

```
${VARIABLE_NAME:-default_value}
```

This syntax means "use the value of VARIABLE_NAME if it exists, otherwise use default_value".

You can override these defaults by:

1. Setting environment variables before running docker-compose
2. Creating a .env file in the project root
